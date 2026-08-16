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
    return s.replace(/[&<>\"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
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
  function init() {
    renderHistory();
    renderStats();
    const api = getElectronAPI();
    if (api) {
      setStatus("on");
      elTitle.textContent = "KeyPress Overlay";
      api.onKeyEvent(onEvent);
    } else {
      setStatus("off");
      elTitle.textContent = "KeyPress Overlay (no Electron)";
    }
    setInterval(renderStats, 500);
  }
  init();
})();
//# sourceMappingURL=main.js.map
