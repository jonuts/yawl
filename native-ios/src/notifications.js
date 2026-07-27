import { LocalNotifications } from '@capacitor/local-notifications';

/**
 * Rest-timer notifications.
 *
 * This is the thing a web app fundamentally cannot do: fire an alert when the
 * app is backgrounded or the phone is locked in your gym bag. iOS delivers it
 * with sound + vibration through whatever audio route is active (headphones
 * included).
 */

const REST_TIMER_ID = 1001;

let permissionGranted = false;

export async function ensurePermission() {
  try {
    const current = await LocalNotifications.checkPermissions();
    if (current.display === 'granted') {
      permissionGranted = true;
      return true;
    }
    const req = await LocalNotifications.requestPermissions();
    permissionGranted = req.display === 'granted';
    return permissionGranted;
  } catch (e) {
    return false;
  }
}

/**
 * Schedule the "rest over" alert.
 * @param {number} seconds - how long the rest period is
 */
export async function scheduleRestAlert(seconds) {
  if (!permissionGranted) {
    const ok = await ensurePermission();
    if (!ok) return false;
  }
  try {
    // Clear any previous pending alert so restarting the timer replaces it.
    await cancelRestAlert();
    await LocalNotifications.schedule({
      notifications: [
        {
          id: REST_TIMER_ID,
          title: 'Rest over',
          body: 'Next set.',
          schedule: { at: new Date(Date.now() + seconds * 1000) },
          sound: 'default',
        },
      ],
    });
    return true;
  } catch (e) {
    return false;
  }
}

export async function cancelRestAlert() {
  try {
    await LocalNotifications.cancel({ notifications: [{ id: REST_TIMER_ID }] });
  } catch (e) {
    // nothing pending
  }
}
