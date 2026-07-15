import { cachedFetch } from './fetchCache';

// Upcoming earnings dates come from Finnhub, not Yahoo — Yahoo's
// quoteSummary endpoint (which has this data) is crumb/cookie-gated and
// returns 401. Finnhub's earnings calendar works with a plain API key and
// allows browser requests, so no proxy is needed.
const FINNHUB_KEY = import.meta.env.VITE_FINNHUB_API_KEY;

// Finnhub only covers plain US tickers: TASE (.TA), crypto (BINANCE:) and
// FX (=X) symbols aren't in its calendar, and ETFs return an empty list.
function canHaveEarnings(symbol: string): boolean {
  return !/[.:=]/.test(symbol);
}

export async function fetchNextEarningsDate(symbol: string): Promise<string | null> {
  if (!FINNHUB_KEY || !canHaveEarnings(symbol)) return null;

  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const from = new Date();
  const to = new Date(from.getTime() + 90 * 86400000);
  const url = `https://finnhub.io/api/v1/calendar/earnings?from=${iso(from)}&to=${iso(to)}&symbol=${symbol}&token=${FINNHUB_KEY}`;

  const data = await cachedFetch(url);
  const dates: string[] = (data?.earningsCalendar ?? [])
    .map((entry: { date: string }) => entry.date)
    .sort();
  return dates[0] ?? null;
}
