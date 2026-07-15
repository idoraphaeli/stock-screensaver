// Prevents duplicate network requests to the exact same URL that happen
// close together in time — most notably React's StrictMode, which in
// development intentionally runs every effect twice to help surface bugs.
// Without this, every API call (and therefore every unit of our rate limit)
// would silently be spent twice.

import { fetchJson } from './transport';

const pendingRequests = new Map<string, Promise<any>>();

export function cachedFetch(url: string): Promise<any> {
  const existing = pendingRequests.get(url);
  if (existing) {
    return existing;
  }

  const requestPromise = fetchJson(url)
    .finally(() => {
      // Keep the entry around briefly so a near-simultaneous duplicate
      // (like StrictMode's double-invoke) reuses this result instead of
      // firing a second real request.
      setTimeout(() => pendingRequests.delete(url), 3000);
    });

  pendingRequests.set(url, requestPromise);
  return requestPromise;
}
