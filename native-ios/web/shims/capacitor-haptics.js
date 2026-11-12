// Web build stand-in for @capacitor/haptics. src/haptics.js only calls it on
// the native platform; in a browser it uses navigator.vibrate instead.
export const NotificationType = { Success: 'SUCCESS', Warning: 'WARNING', Error: 'ERROR' };
export const Haptics = {
  async notification() {},
  async impact() {},
  async vibrate() {},
};
