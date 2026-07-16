// Where the active screen list comes from at runtime.
//
// In Electron the main process owns screens.json (user-editable via the
// Telegram bot) and exposes it over the preload bridge, plus a change
// event when the file is edited — that's how a bot message updates the
// display live. In the browser (dev) there's no bridge, so we fall back to
// the bundled defaults.

import { DEFAULT_SCREENS } from './screens';
import type { ScreenConfig } from './screens';

export function loadScreens(): Promise<ScreenConfig[]> {
  const native = window.screensaverNative;
  if (native?.getScreens) {
    return native
      .getScreens()
      .then((screens) => (screens && screens.length > 0 ? screens : DEFAULT_SCREENS))
      .catch(() => DEFAULT_SCREENS);
  }
  return Promise.resolve(DEFAULT_SCREENS);
}

// Subscribes to live edits of screens.json. Returns an unsubscribe fn.
export function subscribeScreens(callback: (screens: ScreenConfig[]) => void): () => void {
  const native = window.screensaverNative;
  if (native?.onScreensChanged) {
    return native.onScreensChanged((screens) => {
      if (screens && screens.length > 0) callback(screens);
    });
  }
  return () => {};
}
