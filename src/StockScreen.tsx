import StockCard from './StockCard';
import type { ScreenConfig } from './screens';

interface StockScreenProps {
  screen: ScreenConfig;
  isActive: boolean;
}

function StockScreen({ screen, isActive }: StockScreenProps) {
  return (
    <div className={isActive ? 'screen screen-active' : 'screen'}>
      <h2 className="screen-title">{screen.title}</h2>
      <div className="stock-list">
        {screen.symbols.map((symbol) => (
          <StockCard key={symbol} symbol={symbol} />
        ))}
      </div>
    </div>
  );
}

export default StockScreen;