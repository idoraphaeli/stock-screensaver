import { useState, useCallback, useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import StockCard from './StockCard';
import ErrorBoundary from './ErrorBoundary';
import { SLIDE_INTERVAL_MS } from './screens';
import type { ScreenConfig } from './screens';

interface StockScreenProps {
  screen: ScreenConfig;
  isActive: boolean;
}

// Must match .stock-row height and the visual gap between rows.
const ROW_HEIGHT = 112;
const ROW_GAP = 14;

function StockScreen({ screen, isActive }: StockScreenProps) {
  // Daily change per symbol, reported up by each card as quotes arrive
  // (and again on every refresh) — this drives the live sort order.
  const [changes, setChanges] = useState<Record<string, number | null>>({});
  const viewportRef = useRef<HTMLDivElement>(null);
  const [scrollDistance, setScrollDistance] = useState(0);

  const listHeight = screen.symbols.length * (ROW_HEIGHT + ROW_GAP) - ROW_GAP;

  const reportChange = useCallback((symbol: string, changePercent: number | null) => {
    setChanges((prev) => (prev[symbol] === changePercent ? prev : { ...prev, [symbol]: changePercent }));
  }, []);

  // When the list is taller than its viewport (many stocks), the active
  // screen auto-scrolls through it. The animation spans exactly one slide
  // interval, so every row gets its moment before the screen switches.
  useEffect(() => {
    if (!isActive) return;

    function measure() {
      const viewport = viewportRef.current;
      if (!viewport) return;
      setScrollDistance(Math.max(0, listHeight - viewport.clientHeight));
    }

    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [isActive, listHeight]);

  // Biggest daily gainer first; symbols without data yet sink to the
  // bottom in their configured order (Array.sort is stable).
  const ranked = [...screen.symbols].sort(
    (a, b) => (changes[b] ?? -Infinity) - (changes[a] ?? -Infinity)
  );
  const rankOf = new Map(ranked.map((symbol, index) => [symbol, index]));

  const listStyle: CSSProperties = {
    height: listHeight,
    '--scroll-distance': `-${scrollDistance}px`,
    '--scroll-duration': `${SLIDE_INTERVAL_MS}ms`,
  } as CSSProperties;

  // Cards are keyed by symbol and never remount — re-sorting only moves
  // their absolutely-positioned slot, so no data is refetched and the
  // change animates via the CSS `top` transition.
  return (
    <div className={isActive ? 'screen screen-active' : 'screen'}>
      <h2 className="screen-title">{screen.title}</h2>
      <div className="stock-viewport" ref={viewportRef}>
        <div
          className={scrollDistance > 0 ? 'stock-list stock-list-scrolling' : 'stock-list'}
          style={listStyle}
        >
          {screen.symbols.map((symbol) => (
            <div
              key={symbol}
              className="stock-slot"
              style={{ top: (rankOf.get(symbol) ?? 0) * (ROW_HEIGHT + ROW_GAP) }}
            >
              <ErrorBoundary fallback={<div className="stock-row" />}>
                <StockCard symbol={symbol} onChangeReport={reportChange} />
              </ErrorBoundary>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default StockScreen;
