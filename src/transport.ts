// Single place that decides how network requests leave the app.
//
// In the browser (dev), relative /yahoo-* paths hit the Vite dev-server
// proxy (vite.config.ts) because Yahoo blocks cross-origin browser
// requests. In Electron, the preload script exposes window.screensaverNative
// and requests go through the main process instead, where CORS doesn't
// apply — so proxy paths are rewritten back to the real hosts here.

declare global {
  interface Window {
    screensaverNative?: {
      fetchJson(url: string): Promise<unknown>;
      fetchText(url: string): Promise<string>;
    };
  }
}

const PROXY_HOSTS: Record<string, string> = {
  '/yahoo-api': 'https://query1.finance.yahoo.com',
  '/yahoo-feeds': 'https://feeds.finance.yahoo.com',
};

function toAbsoluteUrl(url: string): string {
  for (const [prefix, host] of Object.entries(PROXY_HOSTS)) {
    if (url.startsWith(prefix)) {
      return host + url.slice(prefix.length);
    }
  }
  return url;
}

export function fetchJson(url: string): Promise<unknown> {
  const native = window.screensaverNative;
  if (native) {
    return native.fetchJson(toAbsoluteUrl(url));
  }
  return fetch(url).then((response) => response.json());
}

export function fetchText(url: string): Promise<string> {
  const native = window.screensaverNative;
  if (native) {
    return native.fetchText(toAbsoluteUrl(url));
  }
  return fetch(url).then((response) => response.text());
}
