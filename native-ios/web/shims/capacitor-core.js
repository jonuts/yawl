// Web build stand-in for @capacitor/core: there is no native layer in a browser.
export const Capacitor = {
  isNativePlatform: () => false,
  getPlatform: () => 'web',
};

export function registerPlugin() {
  // Any native plugin call rejects; callers (healthkit.js) already guard with isNativePlatform().
  return new Proxy({}, { get: () => () => Promise.reject(new Error('Not available in the web app')) });
}
