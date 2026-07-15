import StockCard from './StockCard';
import { STOCK_SYMBOLS } from './stocks';
import './App.css';

function App() {
  return (
    <div className="app-container">
      <h1 className="app-title">מעקב מניות</h1>
      <div className="stock-grid">
        {STOCK_SYMBOLS.map((symbol) => (
          <StockCard key={symbol} symbol={symbol} />
        ))}
      </div>
    </div>
  );
}

export default App;