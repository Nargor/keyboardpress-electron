/**
 * KeyPress Overlay — Electron renderer.
 *
 * Receives key events from the main process via contextBridge IPC
 * (window.electronAPI.onKeyEvent) and renders:
 * recent key history, held modifiers, total count, keys-per-second, top keys.
 */

interface KeyEvent {
  type: 'down' | 'up';
  key: string;
  vk: number;
  t: number;
}

type ElectronAPI = {
  onKeyEvent: (cb: (ev: KeyEvent) => void) => void;
  close: () => void;
  minimize: () => void;
};

const MOD_CHIPS: Record<number, string> = {
  0xa0: 'shift', 0xa1: 'shift',
  0xa2: 'ctrl', 0xa3: 'ctrl',
  0xa4: 'alt', 0xa5: 'alt',
  0x5b: 'win', 0x5c: 'win',
};

const MAX_HISTORY = 14;
const TOP_KEYS = 3;

const keyHistory: Array<{ key: string; t: number }> = [];
const counts = new Map<string, number>();
const recentDowns: number[] = [];
let total = 0;

function getElectronAPI(): ElectronAPI | undefined {
  return (window as unknown as { electronAPI?: ElectronAPI }).electronAPI;
}

function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing element #${id}`);
  return el;
}

const elHistory = $('history');
const elTotal = $('total');
const elKps = $('kps');
const elTop = $('topkeys');
const elStatus = $('status-dot');
const elTitle = $('title');

function setStatus(state: 'on' | 'connecting' | 'off') {
  elStatus.dataset.state = state;
}

function renderHistory() {
  elHistory.innerHTML = '';
  for (const item of keyHistory) {
    const chip = document.createElement('span');
    chip.className = 'keychip';
    chip.textContent = item.key;
    elHistory.appendChild(chip);
  }
  const latest = elHistory.lastElementChild;
  if (latest) latest.classList.add('fresh');
}

function renderStats() {
  elTotal.textContent = String(total);
  elKps.textContent = kps().toFixed(1);

  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, TOP_KEYS);
  elTop.innerHTML = '';
  for (const [key, count] of top) {
    const item = document.createElement('span');
    item.className = 'topkey';
    item.innerHTML = `<b>${escapeHtml(key)}</b> ×${count}`;
    elTop.appendChild(item);
  }
  if (top.length === 0) {
    const empty = document.createElement('span');
    empty.className = 'topkey muted';
    empty.textContent = '—';
    elTop.appendChild(empty);
  }
}

function kps(): number {
  const now = Date.now();
  while (recentDowns.length && now - recentDowns[0] > 1000) recentDowns.shift();
  return recentDowns.length;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>\"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
}

function onEvent(ev: KeyEvent) {
  const chipId = MOD_CHIPS[ev.vk];
  if (ev.type === 'down') {
    if (chipId) { $(chipId).classList.add('active'); return; }
    keyHistory.push({ key: ev.key, t: ev.t });
    if (keyHistory.length > MAX_HISTORY) keyHistory.shift();
    counts.set(ev.key, (counts.get(ev.key) || 0) + 1);
    recentDowns.push(ev.t);
    while (recentDowns.length && ev.t - recentDowns[0] > 1000) recentDowns.shift();
    total++;
    renderHistory();
    renderStats();
  } else if (ev.type === 'up' && chipId) {
    $(chipId).classList.remove('active');
  }
}

// --- Buttons ---------------------------------------------------------------

$('btn-reset').addEventListener('click', () => {
  keyHistory.length = 0;
  counts.clear();
  recentDowns.length = 0;
  total = 0;
  renderHistory();
  renderStats();
});

$('btn-close').addEventListener('click', () => {
  getElectronAPI()?.close();
});

// --- Dragging (via CSS -webkit-app-region: drag) ---------------------------
// Electron supports -webkit-app-region: drag on frameless windows natively.

// --- Init ------------------------------------------------------------------

function init() {
  renderHistory();
  renderStats();

  const api = getElectronAPI();
  if (api) {
    setStatus('on');
    elTitle.textContent = 'KeyPress Overlay';
    api.onKeyEvent(onEvent);
  } else {
    // Running outside Electron (e.g. plain browser for preview)
    setStatus('off');
    elTitle.textContent = 'KeyPress Overlay (no Electron)';
  }

  setInterval(renderStats, 500);
}

init();
