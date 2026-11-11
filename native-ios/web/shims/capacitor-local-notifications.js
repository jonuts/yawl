// Web build stand-in for @capacitor/local-notifications.
// A browser tab can't fire a lock-screen alert; the in-app floating timer,
// beep and vibration still run. Everything here is a quiet no-op.
export const LocalNotifications = {
  async checkPermissions() { return { display: 'denied' }; },
  async requestPermissions() { return { display: 'denied' }; },
  async registerActionTypes() {},
  async schedule() {},
  async cancel() {},
  async addListener() { return { remove() {} }; },
};
