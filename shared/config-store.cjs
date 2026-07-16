// Shared read/write layer for the runtime, user-editable stock config.
// Used by BOTH the Electron main process (electron/main.cjs, bundled into
// the asar) and the standalone Telegram bot (bot/telegram-bot.cjs, run
// from the repo). Keeping it in one module keeps the file format and the
// %LOCALAPPDATA% path identical on both sides.
//
// The screensaver only READS this file (and watches it for live updates);
// only the bot WRITES it, so there's no write contention.

const fs = require('fs');
const path = require('path');
const os = require('os');

const DEFAULTS = require('../config/default-screens.json');

function configDir() {
  // Windows: %LOCALAPPDATA%\StockScreensaver. A stable per-user location,
  // independent of where the repo or the packaged app live. Falls back to
  // the home dir on non-Windows (dev on macOS/Linux).
  const base = process.env.LOCALAPPDATA || path.join(os.homedir(), '.stock-screensaver');
  return path.join(base, 'StockScreensaver');
}

function configPath() {
  return path.join(configDir(), 'screens.json');
}

// Returns the screens array, or null if the file is missing/unreadable.
function readScreens() {
  try {
    const parsed = JSON.parse(fs.readFileSync(configPath(), 'utf8'));
    if (Array.isArray(parsed.screens)) return parsed.screens;
  } catch {
    // Missing or malformed — caller decides whether to seed.
  }
  return null;
}

// Atomic write: write to a temp file then rename, so a reader (or the
// screensaver's file watcher) never sees a half-written file.
function writeScreens(screens) {
  fs.mkdirSync(configDir(), { recursive: true });
  const tmp = configPath() + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify({ screens }, null, 2), 'utf8');
  fs.renameSync(tmp, configPath());
}

// Returns the current screens, seeding the file from the bundled defaults
// on first run.
function ensureSeeded() {
  const existing = readScreens();
  if (existing) return existing;
  writeScreens(DEFAULTS.screens);
  return DEFAULTS.screens;
}

function findScreen(screens, screenId) {
  return screens.find((screen) => screen.id === screenId);
}

// Mutations used by the bot. Each returns { ok, screens?, error? }.

function addSymbol(screenId, symbol) {
  const screens = ensureSeeded();
  const screen = findScreen(screens, screenId);
  if (!screen) return { ok: false, error: `Unknown screen: ${screenId}` };
  if (screen.symbols.includes(symbol)) {
    return { ok: false, error: `${symbol} is already in ${screen.title}` };
  }
  screen.symbols.push(symbol);
  writeScreens(screens);
  return { ok: true, screens };
}

function removeSymbol(screenId, symbol) {
  const screens = ensureSeeded();
  const screen = findScreen(screens, screenId);
  if (!screen) return { ok: false, error: `Unknown screen: ${screenId}` };
  const index = screen.symbols.indexOf(symbol);
  if (index === -1) return { ok: false, error: `${symbol} is not in ${screen.title}` };
  screen.symbols.splice(index, 1);
  writeScreens(screens);
  return { ok: true, screens };
}

module.exports = {
  DEFAULTS,
  configDir,
  configPath,
  readScreens,
  writeScreens,
  ensureSeeded,
  addSymbol,
  removeSymbol,
};
