export interface ScreenConfig {
  id: string;
  title: string;
  symbols: string[];
}

// Company website per symbol, used to fetch logos via Google's favicon
// service (https://www.google.com/s2/favicons). Symbols without an entry
// (or whose domain 404s) fall back to a letter avatar in <StockLogo>.
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
  TSLA: 'tesla.com',
  AAPL: 'apple.com',
  MU: 'micron.com',
  SNDK: 'sandisk.com',
  SPCX: 'spacex.com',
};

export const SCREENS: ScreenConfig[] = [
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
    symbols: ['NVDA', 'GOOGL', 'TSLA', 'AAPL', 'MU', 'SNDK', 'SPCX'],
  },
];