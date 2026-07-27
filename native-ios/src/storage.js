import { Preferences } from '@capacitor/preferences';

/**
 * Storage shim backed by Capacitor Preferences (native on-device storage).
 *
 * Keeps the exact same async contract the app was written against:
 *   await storage.get(key)        -> { value } | null
 *   await storage.set(key, value) -> truthy on success
 *
 * Preferences persists to UserDefaults on iOS. It survives app restarts,
 * updates, and reboots. It is removed only if the app is deleted.
 */

export const storage = {
  async get(key) {
    const { value } = await Preferences.get({ key });
    return value === null || value === undefined ? null : { value };
  },

  async set(key, value) {
    // Preferences only stores strings; callers already JSON.stringify objects.
    await Preferences.set({ key, value: String(value) });
    return { ok: true };
  },

  async remove(key) {
    await Preferences.remove({ key });
    return { ok: true };
  },

  async keys() {
    const { keys } = await Preferences.keys();
    return keys;
  },
};

export default storage;
