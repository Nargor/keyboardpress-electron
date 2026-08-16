'use strict';

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// ---------------------------------------------------------------------------
// Key capture (koffi — same proven approach as the old daemon, but in-process)
// ---------------------------------------------------------------------------
const POLL_MS = 8;
const TEST_MODE = process.env.KEY_OVERLAY_TEST === '1';

let GetAsyncKeyState = null;
let GetConsoleWindow = null;
let ShowWindow = null;

try {
  const koffi = require('koffi');
  const user32 = koffi.load('user32.dll');
  GetAsyncKeyState = user32.func('short __stdcall GetAsyncKeyState(int vKey)');
  const kernel32 = koffi.load('kernel32.dll');
  GetConsoleWindow = kernel32.func('void* __stdcall GetConsoleWindow()');
  ShowWindow = user32.func('int __stdcall ShowWindow(void* hWnd, int nCmdShow)');
} catch (err) {
  console.error('[main] koffi load failed:', err.message);
}

// VK code → display label (same map as keys.js)
function buildKeyMap() {
  const pairs = [];
  for (let i = 0; i < 26; i++) pairs.push([0x41 + i, String.fromCharCode(0x41 + i)]);
  for (let i = 0; i < 10; i++) pairs.push([0x30 + i, String.fromCharCode(0x30 + i)]);
  const named = [
    [0x08, 'Backspace'], [0x09, 'Tab'], [0x0d, 'Enter'], [0x13, 'Pause'],
    [0x14, 'Caps'], [0x1b, 'Esc'], [0x20, 'Space'],
    [0x21, 'PgUp'], [0x22, 'PgDn'], [0x23, 'End'], [0x24, 'Home'],
    [0x25, '←'], [0x26, '↑'], [0x27, '→'], [0x28, '↓'],
    [0x2c, 'PrtSc'], [0x2d, 'Ins'], [0x2e, 'Del'],
    [0x5b, 'Win'], [0x5c, 'Win'], [0x5d, 'Menu'],
    [0x60, '0'], [0x61, '1'], [0x62, '2'], [0x63, '3'], [0x64, '4'],
    [0x65, '5'], [0x66, '6'], [0x67, '7'], [0x68, '8'], [0x69, '9'],
    [0x6a, 'Num*'], [0x6b, 'Num+'], [0x6c, 'Num,'], [0x6d, 'Num-'], [0x6e, 'Num.'], [0x6f, 'Num/'],
    [0x90, 'NumLk'], [0x91, 'ScrLk'],
    [0xa0, 'Shift'], [0xa1, 'Shift'], [0xa2, 'Ctrl'], [0xa3, 'Ctrl'],
    [0xa4, 'Alt'], [0xa5, 'Alt'],
    [0xba, ';'], [0xbb, '='], [0xbc, ','], [0xbd, '-'], [0xbe, '.'], [0xbf, '/'], [0xc0, '`'],
    [0xdb, '['], [0xdc, '\\'], [0xdd, ']'], [0xde, "'"],
  ];
  pairs.push(...named);
  for (let i = 0; i < 24; i++) pairs.push([0x70 + i, 'F' + (i + 1)]);
  return pairs;
}

const KEY_MAP = buildKeyMap();
const prevDown = new Map();

let mainWindow = null;

function pollKeys() {
  if (TEST_MODE) return; // test mode uses synthetic keys
  if (!GetAsyncKeyState || !mainWindow || mainWindow.isDestroyed()) return;
  for (const [vk, label] of KEY_MAP) {
    const down = !!(GetAsyncKeyState(vk) & 0x8000);
    const was = prevDown.get(vk) || false;
    if (down === was) continue;
    prevDown.set(vk, down);
    const event = { type: down ? 'down' : 'up', key: label, vk, t: Date.now() };
    try { mainWindow.webContents.send('key-event', event); } catch {}
  }
}

// Test mode — synthetic key pattern for UI verification
function startTestMode() {
  const pattern = [
    { key: 'W', hold: 120 }, { key: 'Shift', hold: 400 }, { key: 'A', hold: 90 },
    { key: 'D', hold: 90 }, { key: 'S', hold: 90 }, { key: 'Space', hold: 60 },
    { key: 'F1', hold: 100 }, { key: 'E', hold: 80 }, { key: 'Q', hold: 80 },
    { key: 'F', hold: 100 }, { key: 'Alt', hold: 250 }, { key: 'G', hold: 70 },
  ];
  let i = 0;
  setInterval(() => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const { key, hold } = pattern[i % pattern.length];
    i++;
    mainWindow.webContents.send('key-event', { type: 'down', key, vk: 0, t: Date.now() });
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed())
        mainWindow.webContents.send('key-event', { type: 'up', key, vk: 0, t: Date.now() });
    }, hold);
  }, 450);
}

// ---------------------------------------------------------------------------
// Window
// ---------------------------------------------------------------------------

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 460,
    height: 340,
    minWidth: 320,
    minHeight: 220,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: false,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'resources', 'index.html'));

  mainWindow.on('closed', () => { mainWindow = null; });
}

// IPC from renderer
ipcMain.on('window-close', () => { if (mainWindow) mainWindow.close(); });
ipcMain.on('window-minimize', () => { if (mainWindow) mainWindow.minimize(); });

// Dragging: renderer sends drag-start, we initiate native drag
ipcMain.on('window-drag', (_e, { x, y }) => {
  if (mainWindow) {
    // Simulate NCLBUTTONDOWN to start native drag
    mainWindow.webContents.send('noop');
  }
});

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------

app.whenReady().then(() => {
  // Hide the console window (if launched from a .bat or terminal)
  if (GetConsoleWindow && ShowWindow) {
    const hwnd = GetConsoleWindow();
    if (hwnd) ShowWindow(hwnd, 0 /* SW_HIDE */);
  }

  createWindow();
  if (TEST_MODE) startTestMode();
  else setInterval(pollKeys, POLL_MS);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => { app.quit(); });
