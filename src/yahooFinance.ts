import { cachedFetch } from './fetchCache';

// Every symbol now goes through Yahoo Finance's unofficial chart endpoint —
// one source for price, daily/weekly/yearly history, no per-provider rate
// limit juggling. Requests go through Vite's dev-server proxy (vite.config.ts)
// to avoid the browser's CORS restriction.

// Finnhub-style crypto symbols (BINANCE:BTCUSDT) don't exist on Yahoo —
// Yahoo uses its own ticker format (BTC-USD) for crypto pairs.
const YAHOO_SYMBOL_OVERRIDES: Record<string, string> = {
  'BINANCE:BTCUSDT': 'BTC-USD',
};

export function toYahooSymbol(symbol: string): string {
  return YAHOO_SYMBOL_OVERRIDES[symbol] ?? symbol;
}

export interface YahooQuoteResult {
  price: number | null;
  changePercent: number | null;
  currency: string | null;
  name: string | null;
}

export interface YahooHistoryResult {
  prices: number[];
  // Change over the chart's period, measured against the close immediately
  // before the period started (Yahoo's chartPreviousClose).
  changePercent: number | null;
}

function validCloses(result: any): number[] {
  const closes: (number | null)[] = result.indicators?.quote?.[0]?.close ?? [];
  return closes.filter((value): value is number => value !== null);
}

async function fetchYahooChart(symbol: string, range: string, interval: string) {
  const url = `/yahoo-api/v8/finance/chart/${symbol}?interval=${interval}&range=${range}`;
  const data = await cachedFetch(url);

  const result = data?.chart?.result?.[0];
  if (!result) {
    throw new Error(`No data returned from Yahoo Finance for ${symbol}`);
  }
  return result;
}

export async function fetchYahooQuote(symbol: string): Promise<YahooQuoteResult> {
  const result = await fetchYahooChart(symbol, '5d', '1d');

  const price: number = result.meta.regularMarketPrice;

  // meta.previousClose is simply absent on this endpoint (verified for both
  // US and TASE symbols), and meta.chartPreviousClose is the close before
  // the *range* start — 5 days ago here, not yesterday. Derive yesterday's
  // close from the daily bars instead: the last bar is the current trading
  // day, so the bar before it is the previous close.
  const closes = validCloses(result);
  const previousClose: number | undefined =
    closes.length >= 2 ? closes[closes.length - 2] : result.meta.chartPreviousClose;

  const changePercent = previousClose ? ((price - previousClose) / previousClose) * 100 : null;
  const currency: string | null = result.meta.currency ?? null;
  const name: string | null = result.meta.shortName ?? null;

  return { price, changePercent, currency, name };
}

export async function fetchYahooHistory(symbol: string, range: string, interval: string): Promise<YahooHistoryResult> {
  const result = await fetchYahooChart(symbol, range, interval);
  const prices = validCloses(result);

  const baseline: number | undefined = result.meta?.chartPreviousClose;
  const lastPrice = prices[prices.length - 1];
  let changePercent: number | null = null;
  if (lastPrice !== undefined) {
    if (baseline) {
      changePercent = ((lastPrice - baseline) / baseline) * 100;
    } else if (prices.length >= 2) {
      changePercent = ((lastPrice - prices[0]) / prices[0]) * 100;
    }
  }

  return { prices, changePercent };
}