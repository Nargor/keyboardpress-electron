'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onKeyEvent: (callback) => ipcRenderer.on('key-event', (_e, data) => callback(data)),
  close: () => ipcRenderer.send('window-close'),
  minimize: () => ipcRenderer.send('window-minimize'),
  checkForUpdate: () => ipcRenderer.send('check-for-update'),
  downloadUpdate: () => ipcRenderer.send('download-update'),
  installUpdate: () => ipcRenderer.send('install-update'),
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', (_e, data) => callback(data)),
  onUpdateProgress: (callback) => ipcRenderer.on('update-progress', (_e, data) => callback(data)),
  onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', (_e, data) => callback(data)),
  onUpdateError: (callback) => ipcRenderer.on('update-error', (_e, data) => callback(data)),
});
