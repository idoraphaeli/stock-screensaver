import { useEffect } from 'react';
import MiniChart from './MiniChart';
import StockLogo from './StockLogo';
import { useStockData } from './useStockData';
import type { ExtendedSession } from './yahooFinance';
import { SYMBOL_LABELS, SYMBOL_NAMES } from './screens';
import type { SymbolLabel } from './screens';
import './StockCard.css';

interface StockCardProps {
  symbol: string;
  // Live display override from screens.json (set via the Telegram bot), if
  // any. Takes precedence over the hardcoded SYMBOL_LABELS / SYMBOL_NAMES.
  override?: SymbolLabel;
  // Lets the screen sort its rows by daily change (see StockScreen).
  onChangeReport: (symbol: string, changePercent: number | null) => void;
}

const BIG_MOVE_THRESHOLD = 3; // daily move (%) that gets the row highlighted
const EARNINGS_BADGE_MAX_DAYS = 14;
const NEAR_HIGH_RATIO = 0.99; // within 1% of a high counts as "at the high"

// Yahoo quotes TASE stocks in agorot (currency code "ILA") — divide by 100
// to show shekels, matching how prices appear on the exchange itself.
// Uses `== null` so a missing (undefined) price from Yahoo is handled too,
// not just an explicit null.
function formatPrice(price: number | null | undefined, currency: string | null): string {
  if (price == null || Number.isNaN(price)) return '—';
  if (currency === 'ILA') return `₪${(price / 100).toFixed(2)}`;
  if (currency === 'ILS') return `₪${price.toFixed(2)}`;
  return `$${price.toFixed(2)}`;
}

// Rising half-sun for pre-market, crescent moon for after-hours.
function SessionIcon({ session }: { session: ExtendedSession }) {
  if (session === 'pre') {
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 17a7 7 0 0 1 14 0z" fill="#f0b429" />
        <line x1="3" y1="20" x2="21" y2="20" stroke="#f0b429" strokeWidth="2" strokeLinecap="round" />
        <line x1="12" y1="3" x2="12" y2="6.5" stroke="#f0b429" strokeWidth="2" strokeLinecap="round" />
        <line x1="4.5" y1="6.5" x2="7" y2="9" stroke="#f0b429" strokeWidth="2" strokeLinecap="round" />
        <line x1="19.5" y1="6.5" x2="17" y2="9" stroke="#f0b429" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20.5 14.8A9 9 0 0 1 9.2 3.5 9 9 0 1 0 20.5 14.8z" fill="#9fb6d9" />
    </svg>
  );
}

function HighStar({ type }: { type: 'ath' | '52w' }) {
  const isAth = type === 'ath';
  const color = isAth ? '#ffd54a' : '#d4a72c';
  return (
    <span className={isAth ? 'high-star high-star-ath' : 'high-star'} title={isAth ? 'All-time high' : '52-week high'}>
      <svg viewBox="0 0 24 24" width="30" height="30">
        <path
          d="M12 1.8l3 6.4 7 .7-5.3 4.6 1.6 6.9-6.3-3.7-6.3 3.7 1.6-6.9L2 8.9l7-.7z"
          fill={isAth ? color : 'rgba(212, 167, 44, 0.15)'}
          stroke={color}
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
        <text
          x="12"
          y="14.8"
          textAnchor="middle"
          fontSize={isAth ? '5.4' : '7'}
          fontWeight="700"
          fill={isAth ? '#4a3a05' : color}
        >
          {isAth ? 'ATH' : '52'}
        </text>
      </svg>
    </span>
  );
}

function StockCard({ symbol, override, onChangeReport }: StockCardProps) {
  const {
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
  } = useStockData(symbol);

  useEffect(() => {
    onChangeReport(symbol, changePercent);
  }, [symbol, changePercent, onChangeReport]);

  const label = override?.label ?? SYMBOL_LABELS[symbol] ?? symbol;
  const displayName = override?.name ?? SYMBOL_NAMES[symbol] ?? name;
  const isPositive = changePercent !== null && changePercent >= 0;
  const isBigMove = changePercent !== null && Math.abs(changePercent) >= BIG_MOVE_THRESHOLD;
  const rowClassName = isBigMove
    ? `stock-row ${isPositive ? 'big-move-up' : 'big-move-down'}`
    : 'stock-row';

  const showEarnings =
    status === 'success' && earningsInDays !== null && earningsInDays >= 0 && earningsInDays <= EARNINGS_BADGE_MAX_DAYS;

  const nearHigh = (high: number | null) =>
    price !== null && high !== null && high > 0 && price >= high * NEAR_HIGH_RATIO;
  const highType = nearHigh(allTimeHigh) ? 'ath' : nearHigh(high52w) ? '52w' : null;

  // Leftmost chart is the longest period. The 1D block shows the quote's
  // daily change (vs. previous close) so it always matches the main badge.
  const chartBlocks = [
    { label: '1Y', prices: charts.year.prices, change: charts.year.changePercent },
    { label: '1M', prices: charts.month.prices, change: charts.month.changePercent },
    { label: '1D', prices: charts.day.prices, change: changePercent },
  ];

  // The row is an 8-column grid (see StockCard.css) so every column lines
  // up across rows: 3 charts | badges (flexible) | change | price | ident | logo.
  // Badges share the flexible cell so their varying width never shifts
  // the fixed columns.
  return (
    <div className={rowClassName}>
      {chartBlocks.map(({ label: chartLabel, prices, change }) => {
        if (status !== 'success') {
          return <div key={chartLabel} />;
        }
        const chartPositive = change !== null && change >= 0;
        return (
          <div className="chart-block" key={chartLabel}>
            <span className="chart-label">{chartLabel}</span>
            <MiniChart prices={prices} isPositive={chartPositive} />
            {change !== null && (
              <span className={chartPositive ? 'chart-range-change positive' : 'chart-range-change negative'}>
                {Math.abs(change).toFixed(2)}%
              </span>
            )}
          </div>
        );
      })}

      <div className="row-badges">
        {highType && <HighStar type={highType} />}
        {showEarnings && (
          <div className="earnings-badge">
            {earningsInDays === 0 ? 'Earnings today' : `Earnings in ${earningsInDays}d`}
          </div>
        )}
      </div>

      {status === 'success' ? (
        <div className={isPositive ? 'stock-change positive' : 'stock-change negative'}>
          {isPositive ? '▲' : '▼'} {Math.abs(changePercent ?? 0).toFixed(2)}%
        </div>
      ) : (
        <div />
      )}

      <div className="stock-price-cell">
        {status === 'success' && (
          <>
            <div className="stock-price">{formatPrice(price, currency)}</div>
            {extendedPrice !== null && extendedSession !== null && (
              <div
                className="stock-ext-price"
                title={extendedSession === 'pre' ? 'Pre-market' : 'After hours'}
              >
                <SessionIcon session={extendedSession} />
                <span>{formatPrice(extendedPrice, currency)}</span>
              </div>
            )}
          </>
        )}
        {status === 'loading' && (
          <div className="stock-loading">
            <span className="loading-dot" />
            <span className="loading-dot" />
            <span className="loading-dot" />
          </div>
        )}
        {status === 'error' && <div className="stock-error">No data</div>}
      </div>

      <div className="stock-ident">
        <span className="stock-symbol">{label}</span>
        {displayName && <span className="stock-name">{displayName}</span>}
      </div>

      <StockLogo symbol={symbol} label={label} logoDomain={override?.logo} />
    </div>
  );
}

export default StockCard;
