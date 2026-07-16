// Electron entry point — runs the built renderer (dist/) as a Windows
// screensaver: fullscreen on every display, quits on real user input.
//
// Windows invokes a .scr file with one of:
//   /s          run the screensaver
//   /c[:hwnd]   show the configuration dialog
//   /p <hwnd>   render a live preview inside the tiny settings monitor
// No flag (double-clicking the exe) is treated like /s. Preview mode just
// exits — embedding into the miniature preview window isn't worth the
// native-window juggling it requires.

const { app, BrowserWindow, ipcMain, screen, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const configStore = require('../shared/config-store.cjs');

const args = process.argv.slice(app.isPackaged ? 1 : 2);
const windowed = args.includes('--windowed');
const flag = args.find((arg) => /^[/-][scp]/i.test(arg));
const mode = flag ? { s: 'run', c: 'config', p: 'preview' }[flag[1].toLowerCase()] : 'run';

// In development the renderer is served by Vite; packaged builds load the
// static files. SCREENSAVER_DIST=1 forces dist loading in dev, to test the
// packaged code path without packaging.
const useDist = app.isPackaged || process.env.SCREENSAVER_DIST === '1';
const DEV_URL = process.env.VITE_DEV_SERVER_URL ?? 'http://localhost:5173';

// The renderer fetches market data through this IPC bridge because the
// main process isn't subject to browser CORS (this replaces the Vite
// dev-server proxy). Allowlisted hosts only.
const ALLOWED_HOSTS = new Set([
  'query1.finance.yahoo.com',
  'feeds.finance.yahoo.com',
  'finnhub.io',
  'www.globes.co.il',
]);

function assertAllowed(url) {
  const host = new URL(url).hostname;
  if (!ALLOWED_HOSTS.has(host)) {
    throw new Error(`Fetch to ${host} is not allowed`);
  }
}

ipcMain.handle('fetch-json', async (_event, url) => {
  assertAllowed(url);
  const response = await fetch(url);
  return response.json();
});

ipcMain.handle('fetch-text', async (_event, url) => {
  assertAllowed(url);
  const response = await fetch(url);
  return response.text();
});

// The renderer asks for the current screen list on load; the file is
// seeded from bundled defaults on first run.
ipcMain.handle('get-screens', () => configStore.ensureSeeded());

// Watch screens.json for edits (the Telegram bot writes it) and push the
// new list to every window, so a bot message updates the display live.
// We watch the directory, not the file — atomic writes replace the file
// via rename, which can silence a file-level watcher.
function watchScreensConfig(getWindows) {
  const dir = configStore.configDir();
  fs.mkdirSync(dir, { recursive: true });

  let debounce = null;
  fs.watch(dir, (_event, filename) => {
    if (filename && !filename.startsWith('screens.json')) return;
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      const screens = configStore.readScreens();
      if (!screens) return;
      for (const win of getWindows()) {
        if (!win.isDestroyed()) win.webContents.send('screens-changed', screens);
      }
    }, 300);
  });
}

// displayIndex offsets which of the rotating screens this window shows
// (see DISPLAY_OFFSET in src/App.tsx) — on multi-monitor setups each
// monitor shows a different screen instead of duplicating one.
function createWindow(display, displayIndex) {
  const win = new BrowserWindow({
    x: display.bounds.x,
    y: display.bounds.y,
    width: windowed ? 1280 : display.bounds.width,
    height: windowed ? 800 : display.bounds.height,
    fullscreen: !windowed,
    frame: windowed,
    alwaysOnTop: !windowed,
    autoHideMenuBar: true,
    backgroundColor: '#04060a',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.removeMenu();
  win.once('ready-to-show', () => win.show());
  win.webContents.on('console-message', (event) => {
    if (event.level === 'error') console.error(`[renderer] ${event.message}`);
  });

  if (useDist) {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), {
      query: { display: String(displayIndex) },
    });
  } else {
    win.loadURL(`${DEV_URL}?display=${displayIndex}`);
  }

  return win;
}

// A real screensaver dies on any input. Keyboard/click reach the focused
// window's before-input-event; mouse movement doesn't, so poll the global
// cursor position (Electron has no built-in global mouse hook).
function quitOnUserInput(windows) {
  for (const win of windows) {
    win.webContents.on('before-input-event', () => app.quit());
  }

  let last = screen.getCursorScreenPoint();
  setInterval(() => {
    const point = screen.getCursorScreenPoint();
    if (Math.abs(point.x - last.x) + Math.abs(point.y - last.y) > 10) {
      app.quit();
    }
    last = point;
  }, 700);
}

if (mode === 'preview') {
  app.quit();
} else if (mode === 'config') {
  app.whenReady().then(async () => {
    await dialog.showMessageBox({
      type: 'info',
      title: 'Stock Screensaver',
      message: 'Change stocks from Telegram',
      detail: 'Message your screensaver bot to add or remove stocks — changes apply live. See bot/README for setup.',
    });
    app.quit();
  });
} else if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.whenReady().then(() => {
    const displays = windowed ? [screen.getPrimaryDisplay()] : screen.getAllDisplays();
    const windows = displays.map((display, index) => createWindow(display, index));

    watchScreensConfig(() => windows);

    if (!windowed) {
      quitOnUserInput(windows);
    }

    // Self-test hook: report what rendered, then (for the live-config test)
    // edit screens.json mid-run and confirm the renderer picks it up.
    if (process.env.SCREENSAVER_SMOKE === '1') {
      const countSymbol = (sym) =>
        `[...document.querySelectorAll('.stock-symbol')].filter(s => s.textContent === '${sym}').length`;

      setTimeout(async () => {
        try {
          const before = await windows[0].webContents.executeJavaScript(countSymbol('SMKT'));

          // Add a probe symbol to the portfolio and wait for the watcher +
          // renderer to react.
          configStore.addSymbol('portfolio', 'SMKT');
          await new Promise((r) => setTimeout(r, 2500));
          const after = await windows[0].webContents.executeJavaScript(countSymbol('SMKT'));
          configStore.removeSymbol('portfolio', 'SMKT'); // clean up the probe

          const summary = await windows[0].webContents.executeJavaScript(
            `JSON.stringify({
              prices: document.querySelectorAll('.stock-price').length,
              logos: [...document.querySelectorAll('img.stock-logo')].filter(i => i.naturalWidth > 0).length,
              newsTicker: !!document.querySelector('.news-ticker'),
            })`
          );
          console.log('SMOKE', summary);
          console.log('SMOKE liveReload', JSON.stringify({ before, after, applied: before === 0 && after === 1 }));
        } catch (error) {
          console.log('SMOKE ERROR', error.message);
        }
        app.quit();
      }, 9000);
    }
  });

  app.on('window-all-closed', () => app.quit());
}
