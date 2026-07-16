import { useState, useEffect } from 'react';
import StockScreen from './StockScreen';
import ScreenIndicator from './ScreenIndicator';
import Clock from './Clock';
import MarketStatus from './MarketStatus';
import NewsTicker from './NewsTicker';
import { DEFAULT_SCREENS, SLIDE_INTERVAL_MS } from './screens';
import type { ScreenConfig } from './screens';
import { loadScreens, subscribeScreens } from './config';
import './App.css';

const CURSOR_HIDE_MS = 4000;
const BURN_IN_SHIFT_MS = 120000; // nudge the whole layout every 2 minutes
const BURN_IN_SHIFT_RANGE = 6; // ±px in each axis

// On multi-monitor setups the Electron main process opens one window per
// display and tags each with ?display=N. Each window shows a different
// screen (offset by N) while rotating in sync, so the same screen never
// appears on two monitors at once (as long as displays ≤ screens).
const DISPLAY_OFFSET =
  Number(new URLSearchParams(window.location.search).get('display') ?? '0') || 0;

function App() {
  const [activeScreen, setActiveScreen] = useState(0);
  const [shift, setShift] = useState({ x: 0, y: 0 });
  // Live screen list: the bundled defaults on first paint, then whatever
  // the Electron main process reports from screens.json (edited by the
  // Telegram bot). Updates in place while the screensaver runs.
  const [screens, setScreens] = useState<ScreenConfig[]>(DEFAULT_SCREENS);

  useEffect(() => {
    loadScreens().then(setScreens);
    return subscribeScreens(setScreens);
  }, []);

  // activeScreen grows unbounded; the modulo is applied here so the rotation
  // interval doesn't capture a stale screen count when the list changes.
  const screenCount = screens.length || 1;
  const shownScreen = ((activeScreen + DISPLAY_OFFSET) % screenCount + screenCount) % screenCount;

  useEffect(() => {
    const intervalId = setInterval(() => {
      setActiveScreen((current) => current + 1);
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
        {screens.map((screen, index) => (
          <StockScreen
            key={screen.id}
            screen={screen}
            isActive={index === shownScreen}
          />
        ))}
      </div>

      <ScreenIndicator
        total={screenCount}
        activeIndex={shownScreen}
        intervalMs={SLIDE_INTERVAL_MS}
        onSelect={(index) =>
          setActiveScreen((index - DISPLAY_OFFSET + screenCount) % screenCount)
        }
      />

      <NewsTicker />
    </div>
  );
}

export default App;
