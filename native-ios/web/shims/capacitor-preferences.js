// Web build stand-in for @capacitor/preferences.
//
// Uses the same localStorage naming as Capacitor's own web implementation
// ("CapacitorStorage.<key>"), so a site that was previously built with the real
// package keeps reading the data it already has. A bare-key fallback covers
// anything stored without the prefix.
const PREFIX = 'CapacitorStorage.';

function ls() {
  return window.localStorage;
}

export const Preferences = {
  async get({ key }) {
    let value = ls().getItem(PREFIX + key);
    if (value === null) value = ls().getItem(key);
    return { value };
  },
  async set({ key, value }) {
    ls().setItem(PREFIX + key, value);
  },
  async remove({ key }) {
    ls().removeItem(PREFIX + key);
  },
  async keys() {
    const keys = [];
    for (let i = 0; i < ls().length; i++) {
      const k = ls().key(i);
      if (k && k.indexOf(PREFIX) === 0) keys.push(k.slice(PREFIX.length));
    }
    return { keys };
  },
};
