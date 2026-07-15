import { useState, useEffect } from 'react';
import { SCREENS } from './screens';
import { toYahooSymbol } from './yahooFinance';
import { fetchText } from './transport';
import './NewsTicker.css';

const REFRESH_MS = 15 * 60 * 1000;

function NewsTicker() {
  const [headlines, setHeadlines] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    function load() {
      const symbols = SCREENS.flatMap((screen) => screen.symbols)
        .map(toYahooSymbol)
        .join(',');
      // fetchText, not cachedFetch — the RSS feed is XML, not JSON.
      fetchText(`/yahoo-feeds/rss/2.0/headline?s=${symbols}&region=US&lang=en-US`)
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

  if (headlines.length === 0) {
    return null;
  }

  const line = headlines.join('   ·   ');

  return (
    <div className="news-ticker">
      {/* The line is rendered twice so the marquee can loop seamlessly:
          the animation slides exactly one copy's width (-50%). */}
      <div className="news-ticker-inner">
        <span className="news-ticker-content">{line}</span>
        <span className="news-ticker-content" aria-hidden="true">{line}</span>
      </div>
    </div>
  );
}

export default NewsTicker;
