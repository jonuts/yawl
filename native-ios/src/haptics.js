import { Capacitor } from '@capacitor/core';
import { Haptics, NotificationType } from '@capacitor/haptics';

/**
 * "Rest is over" buzz while the app is open.
 *
 * iOS has no navigator.vibrate, so the native app uses the Taptic Engine via
 * Capacitor Haptics (three taps, to be felt through a pocket or a wrist strap).
 * In a browser it falls back to navigator.vibrate where that exists (Android).
 * Never throws — a missing buzz must not break the timer.
 */
export function restDoneBuzz() {
  try {
    if (Capacitor.isNativePlatform()) {
      const tap = () => Haptics.notification({ type: NotificationType.Success }).catch(() => {});
      tap();
      setTimeout(tap, 450);
      setTimeout(tap, 900);
    } else if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([300, 120, 300, 120, 300]);
    }
  } catch (e) {
    // no haptics available
  }
}
