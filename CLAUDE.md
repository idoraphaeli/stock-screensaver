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
- Layout uses `flex-direction: row-reverse` on `.stock-row` to put
  symbol/price on the right and charts flowing left — intentional design
  choice, not a bug.