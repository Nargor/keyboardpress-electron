'use strict';

const { app, ipcMain } = require('electron');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

let downloadedFilePath = null;
let currentUpdateInfo = null;

// GitHub repository info
const GITHUB_OWNER = 'Nargor';
const GITHUB_REPO = 'keyboardpress-electron';

function parseVersion(v) {
  if (!v) return [0, 0, 0];
  const cleaned = String(v).replace(/^v/i, '').trim();
  const parts = cleaned.split('.').map((n) => parseInt(n, 10) || 0);
  while (parts.length < 3) parts.push(0);
  return parts;
}

function isNewerVersion(current, remote) {
  const [cMaj, cMin, cPat] = parseVersion(current);
  const [rMaj, rMin, rPat] = parseVersion(remote);
  if (rMaj > cMaj) return true;
  if (rMaj < cMaj) return false;
  if (rMin > cMin) return true;
  if (rMin < cMin) return false;
  return rPat > cPat;
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'KeyPressOverlay-AutoUpdater',
        'Accept': 'application/vnd.github.v3+json',
      },
    };
    https.get(url, options, (res) => {
      // Handle redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(fetchJson(res.headers.location));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
      }
      let rawData = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        rawData += chunk;
      });
      res.on('end', () => {
        try {
          resolve(JSON.parse(rawData));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

function downloadFileWithProgress(url, destPath, onProgress) {
  return new Promise((resolve, reject) => {
    function requestUrl(targetUrl) {
      const isHttps = targetUrl.startsWith('https:');
      const client = isHttps ? https : http;
      const options = {
        headers: {
          'User-Agent': 'KeyPressOverlay-AutoUpdater',
          'Accept': 'application/octet-stream',
        },
      };

      const req = client.get(targetUrl, options, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          return requestUrl(res.headers.location);
        }

        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`Download failed: HTTP ${res.statusCode} ${res.statusMessage}`));
        }

        const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
        let transferredBytes = 0;
        let lastReportTime = 0;

        const file = fs.createWriteStream(destPath);

        res.on('data', (chunk) => {
          transferredBytes += chunk.length;
          file.write(chunk);

          const now = Date.now();
          if (now - lastReportTime > 150 || transferredBytes === totalBytes) {
            lastReportTime = now;
            const percent = totalBytes > 0 ? Math.round((transferredBytes / totalBytes) * 100) : 0;
            onProgress({
              percent,
              transferred: transferredBytes,
              total: totalBytes,
            });
          }
        });

        res.on('end', () => {
          file.end(() => {
            resolve(destPath);
          });
        });

        res.on('error', (err) => {
          file.close();
          fs.unlink(destPath, () => {});
          reject(err);
        });
      });

      req.on('error', (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
    }

    requestUrl(url);
  });
}

async function checkForUpdates(mainWindow) {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  try {
    const currentVersion = app.getVersion();
    const releaseUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;
    const release = await fetchJson(releaseUrl);

    const remoteTag = release.tag_name || release.name || '';
    const remoteVersion = remoteTag.replace(/^v/i, '');

    if (!isNewerVersion(currentVersion, remoteVersion)) {
      console.log(`[updater] App is up-to-date (${currentVersion}).`);
      return;
    }

    console.log(`[updater] New version found: ${remoteVersion} (current: ${currentVersion})`);

    // Find platform specific asset
    const assets = release.assets || [];
    let matchedAsset = null;

    if (process.platform === 'win32') {
      matchedAsset = assets.find((a) => a.name.endsWith('.exe') && !a.name.includes('__uninstaller'));
    } else if (process.platform === 'linux') {
      matchedAsset = assets.find((a) => a.name.endsWith('.AppImage') || a.name.endsWith('.deb'));
    } else if (process.platform === 'darwin') {
      matchedAsset = assets.find((a) => a.name.endsWith('.dmg') || a.name.endsWith('.zip'));
    }

    if (!matchedAsset) {
      console.warn(`[updater] No matching asset found for platform ${process.platform} in release ${remoteVersion}`);
      return;
    }

    currentUpdateInfo = {
      currentVersion,
      newVersion: remoteVersion,
      tagName: remoteTag,
      releaseNotes: release.body || '',
      assetName: matchedAsset.name,
      assetSize: matchedAsset.size,
      downloadUrl: matchedAsset.browser_download_url,
    };

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-available', currentUpdateInfo);
    }
  } catch (err) {
    console.error('[updater] Check update failed:', err.message);
  }
}

async function startDownload(mainWindow) {
  if (!currentUpdateInfo || !mainWindow || mainWindow.isDestroyed()) return;

  try {
    const tempDir = app.getPath('temp');
    const destPath = path.join(tempDir, `update-${Date.now()}-${currentUpdateInfo.assetName}`);

    await downloadFileWithProgress(currentUpdateInfo.downloadUrl, destPath, (progress) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-progress', progress);
      }
    });

    downloadedFilePath = destPath;
    console.log('[updater] Download completed:', downloadedFilePath);

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-downloaded', {
        version: currentUpdateInfo.newVersion,
        filePath: downloadedFilePath,
      });
    }
  } catch (err) {
    console.error('[updater] Download error:', err);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-error', { message: err.message || 'Download failed' });
    }
  }
}

function installAndRestart() {
  if (!downloadedFilePath || !fs.existsSync(downloadedFilePath)) {
    console.error('[updater] No downloaded file found to install');
    return;
  }

  // If in dev mode, don't overwrite electron.exe
  if (!app.isPackaged) {
    console.log('[updater] App is in development mode. Downloaded update is at:', downloadedFilePath);
    app.relaunch();
    app.exit(0);
    return;
  }

  const currentExe = process.execPath;
  const currentPid = process.pid;

  if (process.platform === 'win32') {
    const batPath = path.join(app.getPath('temp'), `kp-updater-${Date.now()}.bat`);
    const batContent = `@echo off
chcp 65001 >nul
setlocal
set "OLD_EXE=%~1"
set "NEW_EXE=%~2"
set "APP_PID=%~3"

:WAIT_LOOP
tasklist /fi "PID eq %APP_PID%" 2>nul | findstr /i "%APP_PID%" >nul
if not errorlevel 1 (
    timeout /t 1 /nobreak >nul
    goto WAIT_LOOP
)

:: Wait 1 extra second to ensure file handle is released
timeout /t 1 /nobreak >nul

:: Overwrite target executable with new version
move /y "%NEW_EXE%" "%OLD_EXE%" >nul
if errorlevel 1 (
    copy /y "%NEW_EXE%" "%OLD_EXE%" >nul
    del "%NEW_EXE%" 2>nul
)

:: Launch updated app
start "" "%OLD_EXE%"

:: Self delete
(goto) 2>nul & del "%~f0"
`;

    fs.writeFileSync(batPath, batContent, 'utf8');

    const updaterProc = spawn('cmd.exe', ['/c', batPath, currentExe, downloadedFilePath, String(currentPid)], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });
    updaterProc.unref();
    app.exit(0);
  } else if (process.platform === 'linux') {
    const appImagePath = process.env.APPIMAGE || currentExe;
    fs.chmodSync(downloadedFilePath, 0o755);

    const shPath = path.join(app.getPath('temp'), `kp-updater-${Date.now()}.sh`);
    const shContent = `#!/bin/sh
while kill -0 ${currentPid} 2>/dev/null; do
  sleep 0.5
done
mv -f "${downloadedFilePath}" "${appImagePath}"
chmod +x "${appImagePath}"
"${appImagePath}" &
rm -f "$0"
`;

    fs.writeFileSync(shPath, shContent, { mode: 0o755 });
    const updaterProc = spawn('/bin/sh', [shPath], {
      detached: true,
      stdio: 'ignore',
    });
    updaterProc.unref();
    app.exit(0);
  } else {
    // macOS or fallback: launch downloaded file
    const { shell } = require('electron');
    shell.openPath(downloadedFilePath);
    app.quit();
  }
}

function setupUpdater(mainWindow) {
  ipcMain.on('check-for-update', () => {
    checkForUpdates(mainWindow);
  });

  ipcMain.on('download-update', () => {
    startDownload(mainWindow);
  });

  ipcMain.on('install-update', () => {
    installAndRestart();
  });

  // Automatically check 2 seconds after window is ready
  setTimeout(() => {
    checkForUpdates(mainWindow);
  }, 2000);
}

module.exports = {
  setupUpdater,
  checkForUpdates,
};
