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

// A per-symbol display override lives in screen.labels[symbol]:
//   { label?, name?, logo? }
// label = the big displayed ticker (e.g. Yahoo's "^TA125.TA" shown as
// "TA125"); name = the subtitle; logo = a website domain the renderer turns
// into a favicon. These override the hardcoded SYMBOL_LABELS / SYMBOL_NAMES /
// LOGO_DOMAINS maps in src/screens.ts, and flow to the display over the same
// IPC that carries the symbols. Undefined/blank fields are dropped so we
// never persist empty overrides.
function normalizeDomain(value) {
  return String(value)
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .replace(/^www\./i, '')
    .toLowerCase();
}

function cleanMeta(meta) {
  if (!meta || typeof meta !== 'object') return {};
  const out = {};
  if (typeof meta.label === 'string' && meta.label.trim()) out.label = meta.label.trim();
  if (typeof meta.name === 'string' && meta.name.trim()) out.name = meta.name.trim();
  if (typeof meta.logo === 'string' && meta.logo.trim()) {
    const domain = normalizeDomain(meta.logo);
    if (domain) out.logo = domain;
  }
  return out;
}

// Stores `clean` under screen.labels[symbol] (merging when `merge` is true),
// and prunes the entry / the whole labels object when nothing is left, so the
// JSON stays tidy.
function applyLabel(screen, symbol, clean, merge) {
  const existing = (merge && screen.labels && screen.labels[symbol]) || {};
  const merged = merge ? { ...existing, ...clean } : clean;
  if (Object.keys(merged).length > 0) {
    if (!screen.labels) screen.labels = {};
    screen.labels[symbol] = merged;
  } else if (screen.labels) {
    delete screen.labels[symbol];
  }
  if (screen.labels && Object.keys(screen.labels).length === 0) {
    delete screen.labels;
  }
}

// Mutations used by the bot. Each returns { ok, screens?, error? }.

// `meta` (optional) is a display override — see cleanMeta / applyLabel above.
function addSymbol(screenId, symbol, meta) {
  const screens = ensureSeeded();
  const screen = findScreen(screens, screenId);
  if (!screen) return { ok: false, error: `Unknown screen: ${screenId}` };
  if (screen.symbols.includes(symbol)) {
    return { ok: false, error: `${symbol} is already in ${screen.title}` };
  }
  screen.symbols.push(symbol);
  applyLabel(screen, symbol, cleanMeta(meta), false);
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
  // Drop any orphaned display override for the removed symbol.
  applyLabel(screen, symbol, {}, false);
  writeScreens(screens);
  return { ok: true, screens };
}

// Sets/updates the display override for an already-present symbol. Only the
// fields present in `meta` are changed (merge) — a field the bot skipped
// keeps its previous value.
function setLabel(screenId, symbol, meta) {
  const screens = ensureSeeded();
  const screen = findScreen(screens, screenId);
  if (!screen) return { ok: false, error: `Unknown screen: ${screenId}` };
  if (!screen.symbols.includes(symbol)) {
    return { ok: false, error: `${symbol} is not in ${screen.title}` };
  }
  applyLabel(screen, symbol, cleanMeta(meta), true);
  writeScreens(screens);
  return { ok: true, screens };
}

// The current display override for a symbol, or {} if none.
function getLabel(screenId, symbol) {
  const screen = findScreen(ensureSeeded(), screenId);
  return (screen && screen.labels && screen.labels[symbol]) || {};
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
  setLabel,
  getLabel,
};
