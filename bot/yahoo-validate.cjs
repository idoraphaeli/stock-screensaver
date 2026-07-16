// Validates a user-typed ticker against Yahoo Finance before it's added to
// the screensaver. Runs in the bot's Node process, which — unlike the
// browser — isn't subject to CORS, so it calls Yahoo directly (no proxy).
//
// The chart endpoint is the validator: if Yahoo returns a result with a
// price for the symbol, it's real and tradable. We also grab its display
// name so the bot can show "Apple Inc. (AAPL)" for confirmation.

// Same crypto alias the app uses (screens store the Finnhub-style symbol,
// Yahoo needs BTC-USD). Kept minimal — extend if more aliases appear.
const SYMBOL_ALIASES = {
  'BINANCE:BTCUSDT': 'BTC-USD',
};

function toYahooSymbol(symbol) {
  return SYMBOL_ALIASES[symbol] || symbol;
}

async function validateTicker(rawInput) {
  const symbol = rawInput.trim().toUpperCase();
  if (!symbol || /\s/.test(symbol)) {
    return { ok: false };
  }

  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(toYahooSymbol(symbol))}` +
    `?interval=1d&range=1d`;

  try {
    const response = await fetch(url);
    if (!response.ok) return { ok: false };
    const data = await response.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (meta && meta.regularMarketPrice != null) {
      return {
        ok: true,
        // Store the symbol the user typed (app-side alias map handles the
        // Yahoo translation), and show Yahoo's name for confirmation.
        symbol,
        name: meta.shortName || meta.longName || symbol,
      };
    }
  } catch {
    // Network / parse failure — treat as "couldn't validate".
  }
  return { ok: false };
}

module.exports = { validateTicker };
