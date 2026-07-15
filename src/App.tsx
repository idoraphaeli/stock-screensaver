import { useState, useEffect } from 'react';
import StockScreen from './StockScreen';
import ScreenIndicator from './ScreenIndicator';
import Clock from './Clock';
import MarketStatus from './MarketStatus';
import NewsTicker from './NewsTicker';
import { SCREENS } from './screens';
import './App.css';

const SLIDE_INTERVAL_MS = 10000;
const CURSOR_HIDE_MS = 4000;
const BURN_IN_SHIFT_MS = 120000; // nudge the whole layout every 2 minutes
const BURN_IN_SHIFT_RANGE = 6; // ±px in each axis

function App() {
  const [activeScreen, setActiveScreen] = useState(0);
  const [shift, setShift] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const intervalId = setInterval(() => {
      setActiveScreen((current) => (current + 1) % SCREENS.length);
    }, SLIDE_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, []);

  // OLED burn-in protection: drift the whole layout by a few pixels
  // every couple of minutes so no pixel shows static content for hours.
  useEffect(() => {
    const randomShift = () => Math.round(Math.random() * BURN_IN_SHIFT_RANGE * 2) - BURN_IN_SHIFT_RANGE;
    const intervalId = setInterval(() => {
      setShift({ x: randomShift(), y: randomShift() });
    }, BURN_IN_SHIFT_MS);

    return () => clearInterval(intervalId);
  }, []);

  // Hide the mouse cursor after a few idle seconds; any movement brings
  // it back.
  useEffect(() => {
    let timeoutId: number;

    function wake() {
      document.body.classList.remove('cursor-hidden');
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => document.body.classList.add('cursor-hidden'), CURSOR_HIDE_MS);
    }

    wake();
    window.addEventListener('mousemove', wake);
    return () => {
      window.removeEventListener('mousemove', wake);
      window.clearTimeout(timeoutId);
      document.body.classList.remove('cursor-hidden');
    };
  }, []);

  return (
    <div className="app-container" style={{ transform: `translate(${shift.x}px, ${shift.y}px)` }}>
      <header className="app-header">
        <div>
          <h1 className="app-title">Stock Tracker</h1>
          <MarketStatus />
        </div>
        <Clock />
      </header>

      <div className="screen-stack">
        {SCREENS.map((screen, index) => (
          <StockScreen
            key={screen.id}
            screen={screen}
            isActive={index === activeScreen}
          />
        ))}
      </div>

      <ScreenIndicator
        total={SCREENS.length}
        activeIndex={activeScreen}
        intervalMs={SLIDE_INTERVAL_MS}
        onSelect={setActiveScreen}
      />

      <NewsTicker />
    </div>
  );
}

export default App;
