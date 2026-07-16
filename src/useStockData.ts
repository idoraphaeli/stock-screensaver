import { useState, useEffect } from 'react';
import { fetchYahooQuote, fetchYahooHistory, fetchAllTimeHigh, toYahooSymbol } from './yahooFinance';
import type { YahooHistoryResult, ExtendedSession } from './yahooFinance';
import { fetchNextEarningsDate } from './earnings';

export type StockStatus = 'loading' | 'success' | 'error';

export interface Timeframes {
  day: YahooHistoryResult;
  month: YahooHistoryResult;
  year: YahooHistoryResult;
}

const EMPTY_SERIES: YahooHistoryResult = { prices: [], changePercent: null };

interface StockData {
  price: number | null;
  changePercent: number | null;
  currency: string | null;
  name: string | null;
  charts: Timeframes;
  status: StockStatus;
  earningsInDays: number | null;
  high52w: number | null;
  allTimeHigh: number | null;
  extendedPrice: number | null;
  extendedSession: ExtendedSession | null;
}

const PRICE_REFRESH_MS = 60000; // keep the price "live" for long-running screensaver sessions

interface TimeframeSpec {
  key: keyof Timeframes;
  range: string;
  interval: string;
}

const TIMEFRAMES: TimeframeSpec[] = [
  { key: 'day', range: '1d', interval: '15m' },
  { key: 'month', range: '1mo', interval: '1d' },
  { key: 'year', range: '1y', interval: '1wk' },
];

export function useStockData(symbol: string): StockData {
  const [price, setPrice] = useState<number | null>(null);
  const [changePercent, setChangePercent] = useState<number | null>(null);
  const [currency, setCurrency] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [earningsInDays, setEarningsInDays] = useState<number | null>(null);
  const [high52w, setHigh52w] = useState<number | null>(null);
  const [allTimeHigh, setAllTimeHigh] = useState<number | null>(null);
  const [extendedPrice, setExtendedPrice] = useState<number | null>(null);
  const [extendedSession, setExtendedSession] = useState<ExtendedSession | null>(null);
  const [charts, setCharts] = useState<Timeframes>({
    day: EMPTY_SERIES,
    month: EMPTY_SERIES,
    year: EMPTY_SERIES,
  });
  const [status, setStatus] = useState<StockStatus>('loading');

  const yahooSymbol = toYahooSymbol(symbol);

  // Live price + daily change — fetched immediately, then refreshed every minute.
  useEffect(() => {
    let cancelled = false;

    function fetchQuote() {
      fetchYahooQuote(yahooSymbol)
        .then(({ price, changePercent, currency, name, high52w, extendedPrice, extendedSession }) => {
          if (cancelled) return;
          setPrice(price);
          setChangePercent(changePercent);
          setCurrency(currency);
          setName(name);
          setHigh52w(high52w);
          setExtendedPrice(extendedPrice);
          setExtendedSession(extendedSession);
          setStatus('success');
        })
        .catch(() => {
          if (!cancelled) setStatus('error');
        });
    }

    fetchQuote();
    const intervalId = setInterval(fetchQuote, PRICE_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [yahooSymbol]);

  // All three chart timeframes fire together — no staggering needed since
  // Yahoo has no hard, documented rate limit like Twelve Data did.
  useEffect(() => {
    TIMEFRAMES.forEach((tf) => {
      fetchYahooHistory(yahooSymbol, tf.range, tf.interval)
        .then((series) => {
          setCharts((prev) => ({ ...prev, [tf.key]: series }));
        })
        .catch(() => {
          // A single missing timeframe just means that chart stays empty —
          // it doesn't affect price/status.
        });
    });
  }, [yahooSymbol]);

  // All-time high — fetched once per symbol from the full history.
  useEffect(() => {
    let cancelled = false;
    fetchAllTimeHigh(yahooSymbol)
      .then((high) => {
        if (!cancelled) setAllTimeHigh(high);
      })
      .catch(() => {
        // Missing history just means no all-time-high star.
      });
    return () => {
      cancelled = true;
    };
  }, [yahooSymbol]);

  // Next earnings date — fetched once per symbol (Finnhub, using the
  // original symbol format, not Yahoo's).
  useEffect(() => {
    let cancelled = false;
    fetchNextEarningsDate(symbol)
      .then((date) => {
        if (cancelled || !date) return;
        const startOfToday = new Date().setHours(0, 0, 0, 0);
        setEarningsInDays(Math.round((Date.parse(date) - startOfToday) / 86400000));
      })
      .catch(() => {
        // No earnings info just means no badge.
      });
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  return {
    price,
    changePercent,
    currency,
    name,
    charts,
    status,
    earningsInDays,
    high52w,
    allTimeHigh,
    extendedPrice,
    extendedSession,
  };
}