import { useState } from 'react';
import type { ReactElement } from 'react';
import { LOGO_DOMAINS, SYMBOL_LABELS } from './screens';

// Two overlapping circular flags (US in back, Israel in front) for the
// USD/ILS exchange-rate row.
function UsIlsFlags() {
  const usStripes = [0, 2, 4, 6].map((i) => (
    <rect key={i} x="2" y={3 + i * 3.43} width="24" height="3.43" fill="#b22234" />
  ));
  return (
    <svg className="stock-logo" viewBox="0 0 40 40" role="img" aria-label="USD/ILS">
      <defs>
        <clipPath id="flag-clip-us">
          <circle cx="14" cy="15" r="12" />
        </clipPath>
        <clipPath id="flag-clip-il">
          <circle cx="27" cy="26" r="12" />
        </clipPath>
      </defs>
      <g clipPath="url(#flag-clip-us)">
        <rect x="2" y="3" width="24" height="24" fill="#ffffff" />
        {usStripes}
        <rect x="2" y="3" width="11" height="10.3" fill="#3c3b6e" />
      </g>
      <circle cx="14" cy="15" r="11.5" fill="none" stroke="rgba(230,237,243,0.3)" />
      <g clipPath="url(#flag-clip-il)">
        <rect x="15" y="14" width="24" height="24" fill="#ffffff" />
        <rect x="15" y="16.6" width="24" height="2.7" fill="#0038b8" />
        <rect x="15" y="32.7" width="24" height="2.7" fill="#0038b8" />
        <polygon points="27,21.6 23.2,28.2 30.8,28.2" fill="none" stroke="#0038b8" strokeWidth="1.2" />
        <polygon points="27,30.4 23.2,23.8 30.8,23.8" fill="none" stroke="#0038b8" strokeWidth="1.2" />
      </g>
      <circle cx="27" cy="26" r="11.5" fill="none" stroke="rgba(230,237,243,0.3)" />
    </svg>
  );
}

// A small stack of gold ingots for GLD.
function GoldBars() {
  const bar = (points: string, key: string) => (
    <g key={key}>
      <polygon points={points} fill="#e3b341" stroke="#9e7b1c" strokeWidth="1" strokeLinejoin="round" />
    </g>
  );
  return (
    <svg className="stock-logo" viewBox="0 0 40 40" role="img" aria-label="Gold">
      {bar('3,33 8,25 17,25 22,33', 'left')}
      {bar('19,33 24,25 33,25 38,33', 'right')}
      {bar('11,24 16,16 25,16 30,24', 'top')}
      <line x1="17" y1="18.5" x2="23" y2="18.5" stroke="#f6d67c" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="9.5" y1="27.5" x2="15" y2="27.5" stroke="#f6d67c" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

// The S&P brand mark (red square, white type) — the favicon services only
// have tiny generic icons for the ETF issuers.
function SpBadge() {
  return (
    <svg className="stock-logo" viewBox="0 0 40 40" role="img" aria-label="S&P 500">
      <rect x="2" y="2" width="36" height="36" rx="9" fill="#d6001c" />
      <text x="20" y="19" textAnchor="middle" fontSize="12.5" fontWeight="700" fill="#ffffff" fontFamily="Arial, sans-serif">
        S&amp;P
      </text>
      <text x="20" y="32" textAnchor="middle" fontSize="11" fontWeight="700" fill="#ffffff" fontFamily="Arial, sans-serif">
        500
      </text>
    </svg>
  );
}

const CUSTOM_LOGOS: Record<string, () => ReactElement> = {
  'ILS=X': UsIlsFlags,
  GLD: GoldBars,
  SPY: SpBadge,
};

interface StockLogoProps {
  symbol: string;
}

function StockLogo({ symbol }: StockLogoProps) {
  const [failed, setFailed] = useState(false);

  const Custom = CUSTOM_LOGOS[symbol];
  if (Custom) {
    return <Custom />;
  }

  const domain = LOGO_DOMAINS[symbol];
  if (!domain || failed) {
    const label = SYMBOL_LABELS[symbol] ?? symbol;
    return <span className="stock-logo stock-logo-fallback">{label.charAt(0)}</span>;
  }

  return (
    <img
      className="stock-logo"
      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
      alt={`${symbol} logo`}
      onError={() => setFailed(true)}
    />
  );
}

export default StockLogo;
