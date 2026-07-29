import { LocalNotifications } from '@capacitor/local-notifications';

/**
 * Rest-timer notifications.
 *
 * The thing a web app fundamentally cannot do: fire an alert when the app is
 * backgrounded or the phone is locked in your gym bag. iOS delivers it with
 * sound + vibration through whatever audio route is active (headphones too),
 * and mirrors it to a paired Apple Watch.
 *
 * The notification carries a text-input action so an RPE can be replied
 * straight from the notification (including from the Watch), which logs it
 * against the announced set and starts the next rest period.
 */

const REST_TIMER_ID = 1001;
const REST_ACTION_TYPE = 'REST_DONE';

let permissionGranted = false;
let actionsRegistered = false;

export async function ensurePermission() {
  try {
    const current = await LocalNotifications.checkPermissions();
    if (current.display === 'granted') {
      permissionGranted = true;
    } else {
      const req = await LocalNotifications.requestPermissions();
      permissionGranted = req.display === 'granted';
    }
    if (permissionGranted) await ensureActionTypes();
    return permissionGranted;
  } catch (e) {
    return false;
  }
}

async function ensureActionTypes() {
  if (actionsRegistered) return;
  try {
    await LocalNotifications.registerActionTypes({
      types: [
        {
          id: REST_ACTION_TYPE,
          actions: [
            {
              id: 'LOG_RPE',
              title: 'Log RPE',
              input: true,
              inputButtonTitle: 'Save',
              inputPlaceholder: 'RPE (e.g. 8)',
            },
          ],
        },
      ],
    });
    actionsRegistered = true;
  } catch (e) {
    // action types unsupported — plain notification still works
  }
}

/**
 * @param {number} seconds - rest length
 * @param {object} opts - { body, extra } ; extra identifies the set the
 *                        notification is announcing, so a replied RPE knows
 *                        which set it belongs to.
 */
export async function scheduleRestAlert(seconds, opts = {}) {
  if (!permissionGranted) {
    const ok = await ensurePermission();
    if (!ok) return false;
  }
  try {
    await cancelRestAlert();
    await LocalNotifications.schedule({
      notifications: [
        {
          id: REST_TIMER_ID,
          title: 'Rest over',
          body: opts.body || 'Next set.',
          schedule: { at: new Date(Date.now() + seconds * 1000) },
          sound: 'default',
          actionTypeId: REST_ACTION_TYPE,
          extra: opts.extra || {},
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

/**
 * Handler receives { actionId, inputValue, extra }.
 * Fires when the notification is acted on — including a reply sent from the
 * Apple Watch. If the app was backgrounded, iOS delivers it on resume.
 */
export function onNotificationAction(handler) {
  try {
    LocalNotifications.addListener('localNotificationActionPerformed', (event) => {
      handler({
        actionId: event.actionId,
        inputValue: event.inputValue,
        extra: (event.notification && event.notification.extra) || {},
      });
    });
  } catch (e) {
    // listener unsupported
  }
}
