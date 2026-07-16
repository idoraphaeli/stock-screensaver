import { useState, useEffect, useRef } from 'react';
import { fetchText } from './transport';
import './NewsTicker.css';

const REFRESH_MS = 15 * 60 * 1000;

// Globes' capital-markets feed (Hebrew). Node 585 = "שוק ההון והשקעות".
const FEED_PATH = '/globes-feeds/webservice/rss/rssfeeder.asmx/FeederNode?iID=585';

// Pixels per second. Deriving the animation duration from the measured
// line width keeps the crawl at the same comfortable reading speed no
// matter how many (or how long) the headlines are.
const SCROLL_SPEED_PX_PER_S = 35;

function NewsTicker() {
  const [headlines, setHeadlines] = useState<string[]>([]);
  const [durationSec, setDurationSec] = useState(0);
  const contentRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let cancelled = false;

    function load() {
      // fetchText, not cachedFetch — the RSS feed is XML, not JSON.
      fetchText(FEED_PATH)
        .then((xml) => {
          if (cancelled) return;
          const doc = new DOMParser().parseFromString(xml, 'text/xml');
          const titles = Array.from(doc.querySelectorAll('item > title'))
            .map((node) => node.textContent?.trim())
            .filter((title): title is string => Boolean(title));
          if (titles.length > 0) setHeadlines(titles.slice(0, 15));
        })
        .catch(() => {
          // Keep showing the previous headlines (or nothing) on failure.
        });
    }

    load();
    const intervalId = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (headlines.length > 0 && contentRef.current) {
      setDurationSec(Math.max(30, Math.round(contentRef.current.offsetWidth / SCROLL_SPEED_PX_PER_S)));
    }
  }, [headlines]);

  if (headlines.length === 0) {
    return null;
  }

  const line = headlines.join('   ·   ');

  return (
    <div className="news-ticker">
      {/* The line is rendered twice so the marquee can loop seamlessly:
          the RTL animation slides exactly one copy's width (+50%). */}
      <div
        className="news-ticker-inner"
        style={durationSec > 0 ? { animationDuration: `${durationSec}s` } : undefined}
      >
        <span className="news-ticker-content" ref={contentRef}>{line}</span>
        <span className="news-ticker-content" aria-hidden="true">{line}</span>
      </div>
    </div>
  );
}

export default NewsTicker;
