import { useState, useEffect } from 'react';

interface StockCardProps {
  symbol: string;
}

function StockCard({ symbol }: StockCardProps) {
  const [price, setPrice] = useState<number | null>(null);

  useEffect(() => {
    const apiKey = import.meta.env.VITE_FINNHUB_API_KEY;
    const url = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${apiKey}`;

    fetch(url)
      .then((response) => response.json())
      .then((data) => {
        setPrice(data.c);
      });
  }, [symbol]);

  return (
    <div style={{ border: '1px solid #ccc', borderRadius: '8px', padding: '16px', margin: '8px' }}>
      <h3>{symbol}</h3>
      {price === null ? <p>טוען...</p> : <p>{price} $</p>}
    </div>
  );
}

export default StockCard;