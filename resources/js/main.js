"use strict";
(() => {
  // ui/main.ts
  var MOD_CHIPS = {
    160: "shift",
    161: "shift",
    162: "ctrl",
    163: "ctrl",
    164: "alt",
    165: "alt",
    91: "win",
    92: "win"
  };
  var MAX_HISTORY = 14;
  var TOP_KEYS = 3;
  var keyHistory = [];
  var counts = /* @__PURE__ */ new Map();
  var recentDowns = [];
  var total = 0;
  function getElectronAPI() {
    return window.electronAPI;
  }
  function $(id) {
    const el = document.getElementById(id);
    if (!el) throw new Error(`missing element #${id}`);
    return el;
  }
  var elHistory = $("history");
  var elTotal = $("total");
  var elKps = $("kps");
  var elTop = $("topkeys");
  var elStatus = $("status-dot");
  var elTitle = $("title");
  var elUpdateModal = $("update-modal");
  var elUpdateVersion = $("update-version");
  var elUpdateNotes = $("update-notes");
  var elUpdateProgressWrap = $("update-progress-wrap");
  var elProgressBarFill = $("progress-bar-fill");
  var elProgressPercentText = $("progress-percent-text");
  var elProgressStatusText = $("progress-status-text");
  var elProgressSizeText = $("progress-size-text");
  var elBtnUpdateDownload = $("btn-update-download");
  var elBtnUpdateRestart = $("btn-update-restart");
  var elBtnUpdateDismiss = $("btn-update-dismiss");
  var elBtnUpdateClose = $("btn-update-close");
  function setStatus(state) {
    elStatus.dataset.state = state;
  }
  function renderHistory() {
    elHistory.innerHTML = "";
    for (const item of keyHistory) {
      const chip = document.createElement("span");
      chip.className = "keychip";
      chip.textContent = item.key;
      elHistory.appendChild(chip);
    }
    const latest = elHistory.lastElementChild;
    if (latest) latest.classList.add("fresh");
  }
  function renderStats() {
    elTotal.textContent = String(total);
    elKps.textContent = kps().toFixed(1);
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, TOP_KEYS);
    elTop.innerHTML = "";
    for (const [key, count] of top) {
      const item = document.createElement("span");
      item.className = "topkey";
      item.innerHTML = `<b>${escapeHtml(key)}</b> \xD7${count}`;
      elTop.appendChild(item);
    }
    if (top.length === 0) {
      const empty = document.createElement("span");
      empty.className = "topkey muted";
      empty.textContent = "\u2014";
      elTop.appendChild(empty);
    }
  }
  function kps() {
    const now = Date.now();
    while (recentDowns.length && now - recentDowns[0] > 1e3) recentDowns.shift();
    return recentDowns.length;
  }
  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
  }
  function onEvent(ev) {
    const chipId = MOD_CHIPS[ev.vk];
    if (ev.type === "down") {
      if (chipId) {
        $(chipId).classList.add("active");
        return;
      }
      keyHistory.push({ key: ev.key, t: ev.t });
      if (keyHistory.length > MAX_HISTORY) keyHistory.shift();
      counts.set(ev.key, (counts.get(ev.key) || 0) + 1);
      recentDowns.push(ev.t);
      while (recentDowns.length && ev.t - recentDowns[0] > 1e3) recentDowns.shift();
      total++;
      renderHistory();
      renderStats();
    } else if (ev.type === "up" && chipId) {
      $(chipId).classList.remove("active");
    }
  }
  $("btn-reset").addEventListener("click", () => {
    keyHistory.length = 0;
    counts.clear();
    recentDowns.length = 0;
    total = 0;
    renderHistory();
    renderStats();
  });
  $("btn-close").addEventListener("click", () => {
    getElectronAPI()?.close();
  });
  function hideUpdateModal() {
    elUpdateModal.classList.add("hidden");
  }
  function setupUpdaterUI(api) {
    api.onUpdateAvailable((info) => {
      elUpdateVersion.textContent = info.tagName.startsWith("v") ? info.tagName : `v${info.newVersion}`;
      elUpdateNotes.textContent = info.releaseNotes.trim() || "\u0E21\u0E35\u0E01\u0E32\u0E23\u0E1B\u0E23\u0E31\u0E1A\u0E1B\u0E23\u0E38\u0E07\u0E1B\u0E23\u0E30\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E20\u0E32\u0E1E\u0E41\u0E25\u0E30\u0E41\u0E01\u0E49\u0E44\u0E02\u0E02\u0E49\u0E2D\u0E1C\u0E34\u0E14\u0E1E\u0E25\u0E32\u0E14\u0E17\u0E31\u0E48\u0E27\u0E44\u0E1B";
      elUpdateProgressWrap.classList.add("hidden");
      elBtnUpdateDownload.classList.remove("hidden");
      elBtnUpdateDownload.disabled = false;
      elBtnUpdateDownload.textContent = "\u0E2D\u0E31\u0E1B\u0E40\u0E14\u0E15\u0E40\u0E25\u0E22";
      elBtnUpdateRestart.classList.add("hidden");
      elUpdateModal.classList.remove("hidden");
    });
    elBtnUpdateDownload.addEventListener("click", () => {
      elBtnUpdateDownload.disabled = true;
      elBtnUpdateDownload.textContent = "\u0E01\u0E33\u0E25\u0E31\u0E07\u0E14\u0E32\u0E27\u0E19\u0E4C\u0E42\u0E2B\u0E25\u0E14...";
      elUpdateProgressWrap.classList.remove("hidden");
      elProgressBarFill.style.width = "0%";
      elProgressPercentText.textContent = "0%";
      elProgressStatusText.textContent = "\u0E01\u0E33\u0E25\u0E31\u0E07\u0E14\u0E32\u0E27\u0E19\u0E4C\u0E42\u0E2B\u0E25\u0E14...";
      elProgressSizeText.textContent = "0 MB";
      api.downloadUpdate();
    });
    api.onUpdateProgress((progress) => {
      elProgressBarFill.style.width = `${progress.percent}%`;
      elProgressPercentText.textContent = `${progress.percent}%`;
      const transMB = (progress.transferred / 1024 / 1024).toFixed(1);
      const totalMB = progress.total > 0 ? (progress.total / 1024 / 1024).toFixed(1) : "?";
      elProgressSizeText.textContent = `${transMB} MB / ${totalMB} MB`;
    });
    api.onUpdateDownloaded((_data) => {
      elProgressBarFill.style.width = "100%";
      elProgressPercentText.textContent = "100%";
      elProgressStatusText.textContent = "\u0E14\u0E32\u0E27\u0E19\u0E4C\u0E42\u0E2B\u0E25\u0E14\u0E40\u0E2A\u0E23\u0E47\u0E08\u0E2A\u0E21\u0E1A\u0E39\u0E23\u0E13\u0E4C! \u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E15\u0E34\u0E14\u0E15\u0E31\u0E49\u0E07";
      elBtnUpdateDownload.classList.add("hidden");
      elBtnUpdateRestart.classList.remove("hidden");
    });
    elBtnUpdateRestart.addEventListener("click", () => {
      elBtnUpdateRestart.disabled = true;
      elBtnUpdateRestart.textContent = "\u0E01\u0E33\u0E25\u0E31\u0E07\u0E23\u0E35\u0E2A\u0E15\u0E32\u0E23\u0E4C\u0E17...";
      api.installUpdate();
    });
    elBtnUpdateDismiss.addEventListener("click", hideUpdateModal);
    elBtnUpdateClose.addEventListener("click", hideUpdateModal);
    api.onUpdateError((err) => {
      elProgressStatusText.textContent = `\u0E40\u0E01\u0E34\u0E14\u0E02\u0E49\u0E2D\u0E1C\u0E34\u0E14\u0E1E\u0E25\u0E32\u0E14: ${err.message}`;
      elBtnUpdateDownload.disabled = false;
      elBtnUpdateDownload.textContent = "\u0E25\u0E2D\u0E07\u0E43\u0E2B\u0E21\u0E48\u0E2D\u0E35\u0E01\u0E04\u0E23\u0E31\u0E49\u0E07";
    });
    api.checkForUpdate();
  }
  function init() {
    renderHistory();
    renderStats();
    const api = getElectronAPI();
    if (api) {
      setStatus("on");
      elTitle.textContent = "KeyPress Overlay";
      api.onKeyEvent(onEvent);
      setupUpdaterUI(api);
    } else {
      setStatus("off");
      elTitle.textContent = "KeyPress Overlay (no Electron)";
    }
    setInterval(renderStats, 500);
  }
  init();
})();
//# sourceMappingURL=main.js.map
