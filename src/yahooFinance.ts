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

export type ExtendedSession = 'pre' | 'post';

export interface YahooQuoteResult {
  price: number | null;
  changePercent: number | null;
  currency: string | null;
  name: string | null;
  high52w: number | null;
  // Live pre-market / after-hours price, when the exchange is outside its
  // regular session and Yahoo has extended-hours bars (US stocks only —
  // TASE, crypto and FX have no extended sessions).
  extendedPrice: number | null;
  extendedSession: ExtendedSession | null;
}

// Pulls the newest extended-hours close out of an intraday chart fetched
// with includePrePost=true. meta.currentTradingPeriod gives the day's
// pre/regular/post windows; any bar outside the regular window is an
// extended-hours trade.
function extractExtendedPrice(result: any): { price: number | null; session: ExtendedSession | null } {
  const period = result?.meta?.currentTradingPeriod;
  if (!period?.regular) return { price: null, session: null };

  const nowSec = Math.floor(Date.now() / 1000);
  const isPre = period.pre && nowSec < period.regular.start;
  const isPost = nowSec >= period.regular.end;
  if (!isPre && !isPost) return { price: null, session: null };

  const from = isPre ? period.pre.start : period.regular.end;
  const to = isPre ? period.regular.start : Infinity;
  const timestamps: number[] = result.timestamp ?? [];
  const closes: (number | null)[] = result.indicators?.quote?.[0]?.close ?? [];

  for (let i = timestamps.length - 1; i >= 0; i--) {
    const close = closes[i];
    if (close !== null && close !== undefined && timestamps[i] >= from && timestamps[i] < to) {
      return { price: close, session: isPre ? 'pre' : 'post' };
    }
  }
  return { price: null, session: null };
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

async function fetchYahooChart(symbol: string, range: string, interval: string, includePrePost = false) {
  const extra = includePrePost ? '&includePrePost=true' : '';
  const url = `/yahoo-api/v8/finance/chart/${symbol}?interval=${interval}&range=${range}${extra}`;
  const data = await cachedFetch(url);

  const result = data?.chart?.result?.[0];
  if (!result) {
    throw new Error(`No data returned from Yahoo Finance for ${symbol}`);
  }
  return result;
}

export async function fetchYahooQuote(symbol: string): Promise<YahooQuoteResult> {
  // Two parallel requests: daily bars for the price/change baseline, and an
  // intraday extended-hours chart for the pre/post price. The extended data
  // is a nice-to-have — its failure must not break the quote.
  const [result, intraday] = await Promise.all([
    fetchYahooChart(symbol, '5d', '1d'),
    fetchYahooChart(symbol, '1d', '15m', true).catch(() => null),
  ]);

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
  const high52w: number | null = result.meta.fiftyTwoWeekHigh ?? null;
  const extended = intraday ? extractExtendedPrice(intraday) : { price: null, session: null };

  return {
    price,
    changePercent,
    currency,
    name,
    high52w,
    extendedPrice: extended.price,
    extendedSession: extended.session,
  };
}

// Highest price ever, from the full monthly history (one extra request per
// symbol, fetched once at startup). Uses the bars' intraday highs, falling
// back to closes for symbols that don't report a high series.
export async function fetchAllTimeHigh(symbol: string): Promise<number | null> {
  const result = await fetchYahooChart(symbol, 'max', '1mo');
  const quote = result.indicators?.quote?.[0] ?? {};
  const values: (number | null)[] = (quote.high ?? []).length > 0 ? quote.high : (quote.close ?? []);
  const valid = values.filter((value): value is number => value !== null);
  return valid.length > 0 ? Math.max(...valid) : null;
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