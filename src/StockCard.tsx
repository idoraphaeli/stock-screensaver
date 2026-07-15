import MiniChart from './MiniChart';
import StockLogo from './StockLogo';
import { useStockData } from './useStockData';
import './StockCard.css';

interface StockCardProps {
  symbol: string;
}

// Yahoo quotes TASE stocks in agorot (currency code "ILA") — divide by 100
// to show shekels, matching how prices appear on the exchange itself.
function formatPrice(price: number | null, currency: string | null): string {
  if (price === null) return '—';
  if (currency === 'ILA') return `₪${(price / 100).toFixed(2)}`;
  if (currency === 'ILS') return `₪${price.toFixed(2)}`;
  return `$${price.toFixed(2)}`;
}

const BIG_MOVE_THRESHOLD = 3; // daily move (%) that gets the row highlighted
const EARNINGS_BADGE_MAX_DAYS = 14;

function StockCard({ symbol }: StockCardProps) {
  const { price, changePercent, currency, name, charts, status, earningsInDays } = useStockData(symbol);

  const isPositive = changePercent !== null && changePercent >= 0;
  const isBigMove = changePercent !== null && Math.abs(changePercent) >= BIG_MOVE_THRESHOLD;
  const rowClassName = isBigMove
    ? `stock-row ${isPositive ? 'big-move-up' : 'big-move-down'}`
    : 'stock-row';
  const showEarnings =
    status === 'success' && earningsInDays !== null && earningsInDays >= 0 && earningsInDays <= EARNINGS_BADGE_MAX_DAYS;

  // Leftmost chart is the longest period. The 1D block shows the quote's
  // daily change (vs. previous close) so it always matches the main badge.
  const chartBlocks = [
    { label: '1Y', prices: charts.year.prices, change: charts.year.changePercent },
    { label: '1M', prices: charts.month.prices, change: charts.month.changePercent },
    { label: '1D', prices: charts.day.prices, change: changePercent },
  ];

  return (
    <div className={rowClassName}>
      <div className="stock-info">
        <StockLogo symbol={symbol} />
        <div className="stock-ident">
          <span className="stock-symbol">{symbol}</span>
          {name && <span className="stock-name">{name}</span>}
        </div>

        {status === 'loading' && (
          <div className="stock-loading">
            <span className="loading-dot" />
            <span className="loading-dot" />
            <span className="loading-dot" />
          </div>
        )}

        {status === 'error' && <div className="stock-error">No data available</div>}

        {status === 'success' && (
          <>
            <div className="stock-price">{formatPrice(price, currency)}</div>
            <div className={isPositive ? 'stock-change positive' : 'stock-change negative'}>
              {isPositive ? '▲' : '▼'} {Math.abs(changePercent ?? 0).toFixed(2)}%
            </div>
            {showEarnings && (
              <div className="earnings-badge">
                {earningsInDays === 0 ? 'Earnings today' : `Earnings in ${earningsInDays}d`}
              </div>
            )}
          </>
        )}
      </div>

      {status === 'success' && (
        <div className="stock-charts">
          {chartBlocks.map(({ label, prices, change }) => {
            const chartPositive = change !== null && change >= 0;
            return (
              <div className="chart-block" key={label}>
                <span className="chart-label">{label}</span>
                <MiniChart prices={prices} isPositive={chartPositive} />
                {change !== null && (
                  <span className={chartPositive ? 'chart-range-change positive' : 'chart-range-change negative'}>
                    {Math.abs(change).toFixed(2)}%
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default StockCard;