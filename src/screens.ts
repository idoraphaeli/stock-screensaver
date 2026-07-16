// A per-symbol display override, set live via the Telegram bot and stored in
// screens.json (see shared/config-store.cjs). Any field present here wins over
// the hardcoded SYMBOL_LABELS / SYMBOL_NAMES / LOGO_DOMAINS maps below.
export interface SymbolLabel {
  label?: string; // big displayed ticker (overrides SYMBOL_LABELS)
  name?: string; // subtitle (overrides SYMBOL_NAMES / Yahoo's shortName)
  logo?: string; // website domain for the favicon logo (overrides LOGO_DOMAINS)
}

export interface ScreenConfig {
  id: string;
  title: string;
  symbols: string[];
  // Optional display overrides keyed by raw symbol. Absent for screens whose
  // symbols all use the hardcoded defaults.
  labels?: Record<string, SymbolLabel>;
}

// How long each screen stays up. Also drives the overflow auto-scroll in
// StockScreen (the full scroll fits exactly one interval).
export const SLIDE_INTERVAL_MS = 20000;

// Display-name overrides: what the big row label shows instead of the raw
// ticker. Data still uses the real symbol.
export const SYMBOL_LABELS: Record<string, string> = {
  GOOGL: 'ALPHABET',
  'BINANCE:BTCUSDT': 'BTCUSD',
  'ILS=X': 'ILS/USD',
};

// Subtitle overrides for rows where Yahoo's shortName reads awkwardly
// (e.g. "USD/ILS" under an "ILS/USD" label).
export const SYMBOL_NAMES: Record<string, string> = {
  'ILS=X': 'Shekels per Dollar',
};

// Company website per symbol, used to fetch logos via Google's favicon
// service (https://www.google.com/s2/favicons). Symbols without an entry
// (or whose domain 404s) fall back to a letter avatar in <StockLogo>.
// Some symbols (GLD, ILS=X) use hand-drawn SVGs instead — see StockLogo.tsx.
export const LOGO_DOMAINS: Record<string, string> = {
  AMZN: 'amazon.com',
  IREN: 'iren.com',
  'RMLI.TA': 'rami-levy.co.il',
  'AFHL.TA': 'afcon.co.il',
  SPY: 'ssga.com',
  QQQ: 'invesco.com',
  GLD: 'spdrgoldshares.com',
  'BINANCE:BTCUSDT': 'bitcoin.org',
  'ILS=X': 'boi.org.il',
  NVDA: 'nvidia.com',
  GOOGL: 'google.com',
  MSFT: 'microsoft.com',
  TSLA: 'tesla.com',
  AAPL: 'apple.com',
  MU: 'micron.com',
  SNDK: 'sandisk.com',
  SPCX: 'spacex.com',
};

// Bundled defaults — kept in sync with config/default-screens.json (which
// seeds the runtime file the Telegram bot edits). These are used as-is in
// the browser (dev) and as the first-paint fallback in Electron until the
// live screens.json loads. See src/config.ts.
export const DEFAULT_SCREENS: ScreenConfig[] = [
  {
    id: 'portfolio',
    title: 'My Portfolio',
    symbols: ['AMZN', 'IREN', 'RMLI.TA', 'AFHL.TA'],
  },
  {
    id: 'indices',
    title: 'Indices & Commodities',
    symbols: ['SPY', 'QQQ', 'GLD', 'BINANCE:BTCUSDT', 'ILS=X'],
  },
  {
    id: 'tech',
    title: 'Tech Stocks',
    symbols: ['NVDA', 'GOOGL', 'MSFT', 'TSLA', 'AAPL', 'MU', 'SNDK', 'SPCX'],
  },
];