interface MiniChartProps {
  prices: number[];
  isPositive: boolean;
}

function MiniChart({ prices, isPositive }: MiniChartProps) {
  if (prices.length < 2) {
    return null;
  }

  const width = 120;
  const height = 36;

  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;

  const coords = prices.map((price, index) => {
    const x = (index / (prices.length - 1)) * width;
    const y = height - ((price - min) / range) * height;
    return { x, y };
  });

  const linePoints = coords.map((p) => `${p.x},${p.y}`).join(' ');

  // Build a closed polygon (line + straight edges down to the baseline)
  // so we can fill the area under the curve with a soft gradient.
  const fillPoints = `0,${height} ${linePoints} ${width},${height}`;

  const color = isPositive ? '#3fb950' : '#f85149';
  const gradientId = `chart-gradient-${isPositive ? 'up' : 'down'}`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={fillPoints} fill={`url(#${gradientId})`} stroke="none" />
      {/* pathLength=1 normalizes the dash length so the CSS draw-in
          animation (.chart-line in StockCard.css) works for any curve. */}
      <polyline className="chart-line" pathLength={1} points={linePoints} fill="none" stroke={color} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export default MiniChart;
