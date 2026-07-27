import { Capacitor, registerPlugin } from '@capacitor/core';

const HealthKit = registerPlugin('HealthKit');

let authorized = false;

export function hrAvailable() {
  return Capacitor.isNativePlatform();
}

async function ensureAuth() {
  if (authorized) return true;
  const res = await HealthKit.requestAuthorization();
  // HealthKit doesn't reveal per-type grant status; a successful call is our green light.
  authorized = true;
  return !!res;
}

/**
 * Fetch a heart-rate summary for a time window.
 * @param {number} startMs - window start, ms since epoch
 * @param {number} endMs - window end, ms since epoch
 * @returns {Promise<{avg:number, max:number, min:number, count:number}>}
 * @throws if unavailable, unauthorized, or no samples in the window
 */
export async function fetchHRSummary(startMs, endMs) {
  if (!hrAvailable()) {
    throw new Error('Heart rate needs the native app');
  }
  await ensureAuth();
  const { samples } = await HealthKit.queryHeartRate({ start: startMs, end: endMs });
  if (!samples || !samples.length) {
    throw new Error('No heart rate samples in this window — was the Watch worn (ideally with a workout running)?');
  }
  const bpms = samples.map((s) => s.bpm);
  const sum = bpms.reduce((a, b) => a + b, 0);
  return {
    avg: Math.round(sum / bpms.length),
    max: Math.round(Math.max(...bpms)),
    min: Math.round(Math.min(...bpms)),
    count: bpms.length,
    samples,
  };
}

/**
 * Compute per-set max HR from a full sample list, using each set's hrAt
 * timestamp (stamped at RPE entry) and a trailing window.
 * Solves Watch->iPhone sync latency: by the time a session-level fetch runs,
 * all samples have arrived, so backfilling from them is reliable where a
 * live query at entry time was not.
 */
export function backfillSetHRs(exercises, samples, windowMs = 90000) {
  if (!samples || !samples.length) return exercises;
  return exercises.map((ex) => {
    if (ex.type !== 'strength' || !ex.sets) return ex;
    return {
      ...ex,
      sets: ex.sets.map((s) => {
        if (!s.hrAt) return s;
        const inWindow = samples.filter((p) => p.t >= s.hrAt - windowMs && p.t <= s.hrAt);
        if (!inWindow.length) return s;
        return { ...s, hr: Math.round(Math.max(...inWindow.map((p) => p.bpm))) };
      }),
    };
  });
}

/**
 * Max heart rate over the trailing window (default 90s). Designed for per-set
 * capture on RPE entry: catches the post-set peak regardless of typing delay.
 * SILENT by design — returns null on any failure or empty window, never throws,
 * so it can run mid-workout without error spam.
 */
export async function fetchRecentMaxHR(windowMs = 90000) {
  try {
    if (!hrAvailable()) return null;
    await ensureAuth();
    const now = Date.now();
    const { samples } = await HealthKit.queryHeartRate({ start: now - windowMs, end: now });
    if (!samples || !samples.length) return null;
    return Math.round(Math.max(...samples.map((s) => s.bpm)));
  } catch (e) {
    return null;
  }
}
