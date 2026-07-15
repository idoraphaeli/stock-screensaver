import { useState, useEffect } from 'react';
import './StockCard.css';

interface StockCardProps {
  symbol: string;
}

function StockCard({ symbol }: StockCardProps) {
  const [price, setPrice] = useState<number | null>(null);
  const [changePercent, setChangePercent] = useState<number | null>(null);

  useEffect(() => {
    const apiKey = import.meta.env.VITE_FINNHUB_API_KEY;
    const url = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${apiKey}`;

    fetch(url)
      .then((response) => response.json())
      .then((data) => {
        setPrice(data.c);
        setChangePercent(data.dp);
      });
  }, [symbol]);

  const isPositive = changePercent !== null && changePercent >= 0;

  return (
    <div className="stock-card">
      <div className="stock-symbol">{symbol}</div>
      {price === null ? (
        <div className="stock-loading">טוען...</div>
      ) : (
        <>
          <div className="stock-price">{price} $</div>
          <div className={isPositive ? 'stock-change positive' : 'stock-change negative'}>
            {isPositive ? '▲' : '▼'} {changePercent?.toFixed(2)}%
          </div>
        </>
      )}
    </div>
  );
}

export default StockCard;