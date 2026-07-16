# Stock Screensaver — Project Context

## Overview
A React + Vite + TypeScript screensaver-style app for a portfolio project.
Displays stocks across 3 rotating screens (10s interval), each stock as a
horizontal row with price, daily change %, and 3 mini charts (1D/1W/1Y).
Will eventually be packaged as an Electron desktop app.

## Key architectural decisions (and why)
- **All price/history data comes from Yahoo Finance's unofficial chart
  endpoint** (`/v8/finance/chart/{symbol}`), NOT Finnhub or Twelve Data.
  We started with Finnhub (quote) + Twelve Data (history) but abandoned
  them: Finnhub doesn't cover the Tel Aviv Stock Exchange at all, and
  Twelve Data's 8 calls/min free-tier limit made loading 3 timeframes ×
  13 stocks (39 calls) take minutes instead of seconds. Yahoo has no
  hard documented rate limit, so all 39 requests fire immediately.
- **Two fetch transports, one code path** (`src/transport.ts`): in the
  browser (dev), relative `/yahoo-*` paths hit the Vite dev-server proxy
  (`vite.config.ts`) because Yahoo blocks cross-origin browser requests;
  in the packaged Electron app, the preload script exposes
  `window.screensaverNative` and requests go through the main process
  (`electron/main.cjs`, host-allowlisted IPC), where CORS doesn't apply.
  All app code just calls `fetchJson`/`fetchText` with proxy-style paths.
- **Electron packaging → Windows screensaver**: `npm run electron:build`
  produces `release/win-unpacked/` (a `.scr` is just a renamed exe);
  `scripts/install-screensaver.ps1` copies it to `%LOCALAPPDATA%` and
  registers it under `HKCU\Control Panel\Desktop`. The main process
  handles the Windows screensaver args (`/s` run, `/c` config, `/p`
  preview → instant exit) and quits on keyboard input or global cursor
  movement (polled — Electron has no global mouse hook). `vite build`
  uses `base: './'` so `dist/` works from `file://`. electron-builder
  needs `electronDist: node_modules/electron/dist` — without it, its own
  zip extraction loses a rename race against antivirus scanning (EPERM).
  Gotcha: executing the packaged exe from inside a Claude Code session
  leaves its `.asar` files locked by the Claude host process until the app
  restarts, which makes the *next* electron-builder run fail with EBUSY —
  build to a fresh `--config.directories.output` folder if that happens
  (the install script auto-finds the newest build under `release\`).
- **Runtime, remotely-editable stock list**: the active screens live in
  `%LOCALAPPDATA%\StockScreensaver\screens.json`, NOT the compiled bundle.
  The Electron main process seeds it from `config/default-screens.json` on
  first run, serves it to the renderer over IPC (`get-screens`), and
  watches the file — edits are pushed live via `screens-changed`, so the
  display updates without a rebuild (`src/config.ts` + `App.tsx` hold it in
  state). `DEFAULT_SCREENS` in `src/screens.ts` is only the browser-dev
  fallback and first-paint default; **keep it in sync with
  `config/default-screens.json`** (two copies — the JSON is the CJS-side
  seed used by main + bot). `shared/config-store.cjs` is the single
  read/write/mutate layer, bundled into the asar AND used by the bot.
  Each screen may also carry an optional `labels` map (`{ [symbol]:
  { label?, name?, logo? } }`) — per-symbol display overrides set live via
  the bot; they flow to the renderer over the same IPC and, in the display,
  take precedence over the hardcoded `SYMBOL_LABELS` / `SYMBOL_NAMES` /
  `LOGO_DOMAINS` maps (`StockScreen`→`StockCard`→`StockLogo` thread the
  override down as props).
- **Telegram control bot** (`bot/`): a standalone always-on Node process
  (separate from the screensaver, which only runs when idle) that
  long-polls Telegram — no server/webhook/open port needed. Menu-driven
  (inline-keyboard buttons) for every choice except the free-text fields —
  the ticker to add (validated against Yahoo, `bot/yahoo-validate.cjs`, no
  LLM) and the optional display overrides (label / subtitle / logo domain,
  set on add via "Customize" or after the fact via "Rename / logo", each a
  skippable `/skip` step in a small typed wizard). It writes `screens.json`
  via `shared/config-store.cjs` (`addSymbol` takes an optional meta arg;
  `setLabel` merges overrides onto an existing symbol; `removeSymbol` drops
  the orphaned override); the screensaver's watcher applies it live. Auth is by Telegram chat id
  (`bot/bot-config.json`, gitignored). `scripts/install-bot.ps1` registers
  a hidden logon task. Core logic is covered by `npm run bot:test`; the
  Telegram round-trip needs the user's real token/account.
- **Error isolation**: each card is wrapped in `ErrorBoundary` so one
  symbol's malformed data can't blank the whole (unattended, long-running)
  screensaver. `formatPrice` uses `== null` to tolerate Yahoo omitting a
  price entirely.
- **Symbol mapping quirks**: crypto uses `BTC-USD` on Yahoo (not
  `BINANCE:BTCUSDT`, which was the Finnhub format). TASE (Israeli) stocks
  use a `.TA` suffix (`RMLI.TA`, `AFHL.TA`) and were only discoverable
  by testing directly — no official symbol list was found.
- **`useStockData` hook** centralizes all fetching logic per stock
  (price, daily change, 3 chart timeframes). `StockCard` is presentation-only.
- **`fetchCache.ts`** dedupes identical in-flight requests — needed because
  React StrictMode double-invokes effects in dev, which was silently
  doubling API usage before this existed.

## Known limitations / things to revisit
- Yahoo's endpoint is unofficial — could break or get rate-limited without
  notice. No fallback currently exists if it does.
- `VITE_FINNHUB_API_KEY` is **back in use** — upcoming earnings dates come
  from Finnhub's calendar API (`earnings.ts`), because Yahoo's quoteSummary
  endpoint (which has that data) is crumb/cookie-gated and returns 401.
  Only plain US tickers get earnings badges; Finnhub doesn't cover TASE.
  `VITE_TWELVEDATA_API_KEY` is still unused and safe to remove.
- Yahoo's chart endpoint has no `meta.previousClose` (verified for both US
  and TASE symbols), and `meta.chartPreviousClose` is the close before the
  *range* start — daily change is therefore derived from the last two bars
  of the 5d/1d series in `fetchYahooQuote`. Don't "simplify" it back to
  meta fields.
- `MarketStatus.tsx` hardcodes NYSE/TASE regular trading hours and ignores
  exchange holidays — on a holiday it will wrongly show "open".
- Stock logos come from Google's favicon service (`StockLogo.tsx`, domain
  map in `screens.ts`) — an external browser request that bypasses the
  proxy; unknown domains 404 and fall back to a letter avatar.

## Conventions
- Hebrew is used in chat with the developer, but all UI text is English.
- Info reads right-to-left (logo on the far right, then ticker, price,
  change; charts flow on the left) — intentional design choice, not a bug.
  Each `.stock-row` is an 8-column CSS grid with fixed column widths so
  columns align across rows; badges live in the single flexible column so
  their varying width can't shift anything.
- Rows within a screen are live-sorted by daily change (biggest gainer
  first): cards report their change up to `StockScreen`, which positions
  each card in an absolutely-positioned slot (`top` transition animates
  reorder without remounting cards — remounting would refetch).
- `SYMBOL_LABELS` in `screens.ts` overrides the displayed ticker (e.g.
  GOOGL renders as "ALPHABET"); `SYMBOL_NAMES` overrides the subtitle.
  Data always uses the real symbol. These are the compile-time baseline;
  a per-symbol `labels` entry in `screens.json` (set via the bot) overrides
  them at runtime (see the runtime stock-list note above).
- Multi-monitor: Electron opens one window per display, tagged
  `?display=N`; each window shows a different screen (offset N) while
  rotating in sync, so no screen appears twice at once.
- Screens that overflow their viewport (e.g. Tech with 8+ rows)
  auto-scroll through their content over exactly one slide interval
  (`SLIDE_INTERVAL_MS` in `screens.ts`, currently 20s), with short holds
  at both ends. Distance is measured in `StockScreen`, animated by the
  `list-scroll` keyframes in `App.css`.