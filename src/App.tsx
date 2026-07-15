import StockCard from './StockCard';
import { STOCK_SYMBOLS } from './stocks';

function App() {
  return (
    <div>
      <h1>מעקב מניות</h1>
      <div style={{ display: 'flex', flexWrap: 'wrap' }}>
        {STOCK_SYMBOLS.map((symbol) => (
          <StockCard key={symbol} symbol={symbol} />
        ))}
      </div>
    </div>
  );
}

export default App;