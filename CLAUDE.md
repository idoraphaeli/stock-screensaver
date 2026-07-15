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
- **Yahoo requests go through a Vite dev-server proxy** (`vite.config.ts`,
  `/yahoo-api` → `query1.finance.yahoo.com`) because Yahoo blocks direct
  browser requests via CORS. When this becomes an Electron app, this
  fetching should move to the Electron main process instead, where CORS
  doesn't apply — the proxy is a dev-only workaround.
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
- `.env` still has unused `VITE_FINNHUB_API_KEY` / `VITE_TWELVEDATA_API_KEY`
  — harmless leftovers from the old architecture, safe to remove.

## Conventions
- Hebrew is used in chat with the developer, but all UI text is English.
- Layout uses `flex-direction: row-reverse` on `.stock-row` to put
  symbol/price on the right and charts flowing left — intentional design
  choice, not a bug.