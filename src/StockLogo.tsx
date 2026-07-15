import { useState } from 'react';
import { LOGO_DOMAINS } from './screens';

interface StockLogoProps {
  symbol: string;
}

function StockLogo({ symbol }: StockLogoProps) {
  const [failed, setFailed] = useState(false);
  const domain = LOGO_DOMAINS[symbol];

  if (!domain || failed) {
    return <span className="stock-logo stock-logo-fallback">{symbol.charAt(0)}</span>;
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
