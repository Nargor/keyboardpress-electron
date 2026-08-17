interface KeyEvent {
  type: 'down' | 'up';
  key: string;
  vk: number;
  t: number;
}

interface UpdateInfo {
  currentVersion: string;
  newVersion: string;
  tagName: string;
  releaseNotes: string;
  assetName: string;
  assetSize: number;
  downloadUrl: string;
}

interface UpdateProgress {
  percent: number;
  transferred: number;
  total: number;
}

interface UpdateDownloaded {
  version: string;
  filePath: string;
}

type ElectronAPI = {
  onKeyEvent: (cb: (ev: KeyEvent) => void) => void;
  close: () => void;
  minimize: () => void;
  checkForUpdate: () => void;
  downloadUpdate: () => void;
  installUpdate: () => void;
  onUpdateAvailable: (cb: (info: UpdateInfo) => void) => void;
  onUpdateProgress: (cb: (progress: UpdateProgress) => void) => void;
  onUpdateDownloaded: (cb: (data: UpdateDownloaded) => void) => void;
  onUpdateError: (cb: (err: { message: string }) => void) => void;
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

// Updater elements
const elUpdateModal = $('update-modal');
const elUpdateVersion = $('update-version');
const elUpdateNotes = $('update-notes');
const elUpdateProgressWrap = $('update-progress-wrap');
const elProgressBarFill = $('progress-bar-fill');
const elProgressPercentText = $('progress-percent-text');
const elProgressStatusText = $('progress-status-text');
const elProgressSizeText = $('progress-size-text');
const elBtnUpdateDownload = $('btn-update-download') as HTMLButtonElement;
const elBtnUpdateRestart = $('btn-update-restart') as HTMLButtonElement;
const elBtnUpdateDismiss = $('btn-update-dismiss') as HTMLButtonElement;
const elBtnUpdateClose = $('btn-update-close') as HTMLButtonElement;

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
  return s.replace(/[&<>"']/g, (c) =>
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

// --- Auto-Updater UI Logic ------------------------------------------------

function hideUpdateModal() {
  elUpdateModal.classList.add('hidden');
}

function setupUpdaterUI(api: ElectronAPI) {
  // Update Available
  api.onUpdateAvailable((info: UpdateInfo) => {
    elUpdateVersion.textContent = info.tagName.startsWith('v') ? info.tagName : `v${info.newVersion}`;
    elUpdateNotes.textContent = info.releaseNotes.trim() || 'มีการปรับปรุงประสิทธิภาพและแก้ไขข้อผิดพลาดทั่วไป';

    // Reset view state
    elUpdateProgressWrap.classList.add('hidden');
    elBtnUpdateDownload.classList.remove('hidden');
    elBtnUpdateDownload.disabled = false;
    elBtnUpdateDownload.textContent = 'อัปเดตเลย';
    elBtnUpdateRestart.classList.add('hidden');

    // Show modal
    elUpdateModal.classList.remove('hidden');
  });

  // Download Action
  elBtnUpdateDownload.addEventListener('click', () => {
    elBtnUpdateDownload.disabled = true;
    elBtnUpdateDownload.textContent = 'กำลังดาวน์โหลด...';
    elUpdateProgressWrap.classList.remove('hidden');
    elProgressBarFill.style.width = '0%';
    elProgressPercentText.textContent = '0%';
    elProgressStatusText.textContent = 'กำลังดาวน์โหลด...';
    elProgressSizeText.textContent = '0 MB';

    api.downloadUpdate();
  });

  // Download Progress
  api.onUpdateProgress((progress: UpdateProgress) => {
    elProgressBarFill.style.width = `${progress.percent}%`;
    elProgressPercentText.textContent = `${progress.percent}%`;
    const transMB = (progress.transferred / 1024 / 1024).toFixed(1);
    const totalMB = progress.total > 0 ? (progress.total / 1024 / 1024).toFixed(1) : '?';
    elProgressSizeText.textContent = `${transMB} MB / ${totalMB} MB`;
  });

  // Download Complete
  api.onUpdateDownloaded((_data: UpdateDownloaded) => {
    elProgressBarFill.style.width = '100%';
    elProgressPercentText.textContent = '100%';
    elProgressStatusText.textContent = 'ดาวน์โหลดเสร็จสมบูรณ์! พร้อมติดตั้ง';
    elBtnUpdateDownload.classList.add('hidden');
    elBtnUpdateRestart.classList.remove('hidden');
  });

  // Restart & Install Action
  elBtnUpdateRestart.addEventListener('click', () => {
    elBtnUpdateRestart.disabled = true;
    elBtnUpdateRestart.textContent = 'กำลังรีสตาร์ท...';
    api.installUpdate();
  });

  // Dismiss ("ไว้ก่อน") buttons
  elBtnUpdateDismiss.addEventListener('click', hideUpdateModal);
  elBtnUpdateClose.addEventListener('click', hideUpdateModal);

  // Update Error
  api.onUpdateError((err: { message: string }) => {
    elProgressStatusText.textContent = `เกิดข้อผิดพลาด: ${err.message}`;
    elBtnUpdateDownload.disabled = false;
    elBtnUpdateDownload.textContent = 'ลองใหม่อีกครั้ง';
  });

  // Check for updates upon startup
  api.checkForUpdate();
}

// --- Init ------------------------------------------------------------------

function init() {
  renderHistory();
  renderStats();

  const api = getElectronAPI();
  if (api) {
    setStatus('on');
    elTitle.textContent = 'KeyPress Overlay';
    api.onKeyEvent(onEvent);
    setupUpdaterUI(api);
  } else {
    // Running outside Electron (e.g. plain browser for preview)
    setStatus('off');
    elTitle.textContent = 'KeyPress Overlay (no Electron)';
  }

  setInterval(renderStats, 500);
}

init();

