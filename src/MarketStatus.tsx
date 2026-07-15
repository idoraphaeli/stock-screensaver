import { useState, useEffect } from 'react';
import './MarketStatus.css';

// Regular trading hours per exchange, in the exchange's own timezone.
// Weekday numbers follow JS Date convention (0 = Sunday). This ignores
// exchange holidays — on a holiday the badge will wrongly show "open",
// but the alternative (a holiday calendar API) isn't worth it here.
interface Session {
  open: [number, number];
  close: [number, number];
}

interface MarketSpec {
  name: string;
  timeZone: string;
  sessions: Partial<Record<number, Session>>;
}

const US_SESSION: Session = { open: [9, 30], close: [16, 0] };
const TASE_SESSION: Session = { open: [9, 59], close: [17, 15] };

const MARKETS: MarketSpec[] = [
  {
    name: 'NYSE',
    timeZone: 'America/New_York',
    sessions: { 1: US_SESSION, 2: US_SESSION, 3: US_SESSION, 4: US_SESSION, 5: US_SESSION },
  },
  {
    name: 'TASE',
    timeZone: 'Asia/Jerusalem',
    // Sunday trading ends early on TASE.
    sessions: {
      0: { open: [9, 59], close: [15, 50] },
      1: TASE_SESSION,
      2: TASE_SESSION,
      3: TASE_SESSION,
      4: TASE_SESSION,
    },
  },
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_MS = 86400000;

// Current weekday index and minutes-since-midnight in the given timezone.
function zonedNow(timeZone: string, at: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return {
    day: WEEKDAYS.indexOf(get('weekday')),
    minutes: (parseInt(get('hour'), 10) % 24) * 60 + parseInt(get('minute'), 10),
  };
}

// Offset between UTC and the given timezone at the given instant.
function tzOffsetMs(timeZone: string, at: Date): number {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(at);
  const get = (type: string) => parseInt(parts.find((p) => p.type === type)?.value ?? '0', 10);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'));
  return asUtc - at.getTime();
}

// The exact instant at which the market's wall clock reads h:m, on the
// calendar day `dayOffset` days after `base` (in the market's timezone).
function instantOfWallTime(timeZone: string, base: Date, dayOffset: number, [h, m]: [number, number]): Date {
  const shifted = new Date(base.getTime() + dayOffset * DAY_MS);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(shifted);
  const get = (type: string) => parseInt(parts.find((p) => p.type === type)?.value ?? '0', 10);
  const naive = Date.UTC(get('year'), get('month') - 1, get('day'), h, m);
  return new Date(naive - tzOffsetMs(timeZone, new Date(naive)));
}

// Format an instant in the viewer's local time, prefixing the weekday
// when it isn't today.
function formatLocal(instant: Date, now: Date): string {
  const time = instant.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return instant.toDateString() === now.toDateString() ? time : `${WEEKDAYS[instant.getDay()]} ${time}`;
}

interface MarketState {
  name: string;
  isOpen: boolean;
  label: string;
}

function marketState(spec: MarketSpec, now: Date): MarketState {
  const { day, minutes } = zonedNow(spec.timeZone, now);
  const today = spec.sessions[day];

  if (today) {
    const openMin = today.open[0] * 60 + today.open[1];
    const closeMin = today.close[0] * 60 + today.close[1];
    if (minutes >= openMin && minutes < closeMin) {
      const closes = instantOfWallTime(spec.timeZone, now, 0, today.close);
      return { name: spec.name, isOpen: true, label: `closes ${formatLocal(closes, now)}` };
    }
    if (minutes < openMin) {
      const opens = instantOfWallTime(spec.timeZone, now, 0, today.open);
      return { name: spec.name, isOpen: false, label: `opens ${formatLocal(opens, now)}` };
    }
  }

  for (let offset = 1; offset <= 7; offset++) {
    const next = spec.sessions[(day + offset) % 7];
    if (next) {
      const opens = instantOfWallTime(spec.timeZone, now, offset, next.open);
      return { name: spec.name, isOpen: false, label: `opens ${formatLocal(opens, now)}` };
    }
  }

  return { name: spec.name, isOpen: false, label: '' };
}

function MarketStatus() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const intervalId = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(intervalId);
  }, []);

  return (
    <div className="market-status">
      {MARKETS.map((spec) => {
        const state = marketState(spec, now);
        return (
          <span key={spec.name} className={state.isOpen ? 'market open' : 'market'}>
            <span className="market-dot" />
            <span className="market-name">{state.name}</span>
            <span className="market-label">
              {state.isOpen ? 'open' : 'closed'} · {state.label}
            </span>
          </span>
        );
      })}
    </div>
  );
}

export default MarketStatus;
