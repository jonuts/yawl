import React, { useState, useEffect, useRef } from 'react';
import {
  Plus, X, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Check, Loader2,
  History as HistoryIcon, Pencil, Clock, Download, Copy, Trophy, Timer,
  Layers, Star, Dumbbell, Link2, Flame, TrendingUp, Calendar as CalendarIcon,
  List, Target, Settings as SettingsIcon, Scale, Sailboat,
  Search, Trash2, Archive, RotateCcw, Upload, Minus, BookOpen, Lock,
} from 'lucide-react';
import { storage } from './storage';
import { scheduleRestAlert, cancelRestAlert, ensurePermission, onNotificationAction } from './notifications';
import { fetchHRSummary, fetchRecentMaxHR, backfillSetHRs, hrAvailable } from './healthkit';
import { restDoneBuzz } from './haptics';


const APP_VERSION = '2.0';

const DAY_ORDER = ['lowerA', 'lowerB', 'upper1', 'upper2', 'upper3', 'upper4', 'plyo'];

// defaultSets on an exercise overrides the template's default, which overrides the global setting (3).
// derivedFrom: weight auto-fills to factor * source exercise's first-set weight, until manually edited.
const DEFAULT_TEMPLATE = {
  lowerA: {
    label: 'Lower A',
    subtitle: 'Sunday · Secondary Gym',
    colorKey: 'red',
    exercises: [
      { id: 'la-1', name: 'Hack Squat (Wide Stance)', type: 'strength' },
      { id: 'la-2', name: 'Deficit RDL (Stepper)', type: 'strength' },
      { id: 'la-3', name: 'Seated Calf Raise', type: 'strength' },
      { id: 'la-4', name: 'Leg Press (Narrow V + Wedge)', type: 'strength' },
      { id: 'la-5', name: 'Unilateral Leg Curl', type: 'strength' },
      { id: 'la-6', name: 'Adductor / Abductor', type: 'strength' },
      { id: 'la-7', name: 'Weighted Crunches', type: 'strength' },
    ],
  },
  lowerB: {
    label: 'Lower B',
    subtitle: 'Wednesday · Primary Gym',
    colorKey: 'red',
    exercises: [
      { id: 'lb-1', name: 'Conventional Deadlift', type: 'strength', defaultSets: 1 },
      { id: 'lb-2', name: 'RDL', type: 'strength', derivedFrom: { sourceId: 'lb-1', factor: 0.75 } },
      { id: 'lb-3', name: 'Smith Machine Squat', type: 'strength' },
      { id: 'lb-4', name: 'Standing Smith Calf Raise', type: 'strength' },
      { id: 'lb-5', name: 'Leg Extension', type: 'strength' },
    ],
  },
  upper1: {
    label: 'Upper 1',
    subtitle: 'Monday (Wk 1) · Heavy Bench',
    colorKey: 'blue',
    exercises: [
      { id: 'u1-1', name: 'Bench Press (Heavy)', type: 'strength' },
      { id: 'u1-2', name: 'Smith Seated BTNP', type: 'strength' },
      { id: 'u1-3', name: 'Weighted Pull-Up', type: 'strength' },
      { id: 'u1-4', name: 'Tbar Row', type: 'strength' },
      { id: 'u1-5', name: 'Arms Superset (2 ex · 40 reps)', type: 'strength' },
      { id: 'u1-6', name: 'Cable Lateral Raise', type: 'strength' },
      { id: 'u1-7', name: 'Reverse Cable Curl', type: 'strength' },
      { id: 'u1-trap', name: 'Trap & Neck Release (5-6 min)', type: 'conditioning' },
    ],
  },
  upper2: {
    label: 'Upper 2',
    subtitle: 'Thursday (Wk 1) · Light Bench',
    colorKey: 'blue',
    exercises: [
      { id: 'u2-1', name: 'Overhead Press (Heavy)', type: 'strength' },
      { id: 'u2-2', name: 'Chest Press', type: 'strength' },
      { id: 'u2-3', name: 'Weighted Pull-Up', type: 'strength' },
      { id: 'u2-4', name: 'Bench Press (Light)', type: 'strength' },
      { id: 'u2-5', name: 'Preacher Curls', type: 'strength' },
      { id: 'u2-6', name: 'Tbar Row', type: 'strength' },
      { id: 'u2-7', name: 'Kelso Shrugs', type: 'strength' },
      { id: 'u2-8', name: 'Cable Lateral Raise', type: 'strength' },
      { id: 'u2-9', name: 'Cable Tricep Pushdown', type: 'strength' },
      { id: 'u2-trap', name: 'Trap & Neck Release (5-6 min)', type: 'conditioning' },
    ],
  },
  upper3: {
    label: 'Upper 3',
    subtitle: 'Monday (Wk 2)',
    colorKey: 'blue',
    exercises: [
      { id: 'u3-1', name: 'Smith Barbell Row', type: 'strength' },
      { id: 'u3-2', name: 'Barbell Shrug (Smith)', type: 'strength' },
      { id: 'u3-3', name: 'Smith Incline Bench', type: 'strength' },
      { id: 'u3-4', name: 'Weighted Pull-Up', type: 'strength' },
      { id: 'u3-5', name: 'Chest Fly', type: 'strength' },
      { id: 'u3-6', name: 'Reverse Flyes', type: 'strength' },
      { id: 'u3-7', name: 'Overhead Press (Higher Rep)', type: 'strength' },
      { id: 'u3-8', name: 'Preacher Curls', type: 'strength' },
      { id: 'u3-9', name: 'Split Lat Pulldown', type: 'strength' },
      { id: 'u3-10', name: 'Lateral Raise', type: 'strength' },
      { id: 'u3-11', name: 'Hammer Curl', type: 'strength' },
      { id: 'u3-12', name: 'Push-Up', type: 'strength' },
      { id: 'u3-trap', name: 'Trap & Neck Release (5-6 min)', type: 'conditioning' },
    ],
  },
  upper4: {
    label: 'Upper 4',
    subtitle: 'Thursday (Wk 2) · Pull Focus',
    colorKey: 'blue',
    exercises: [
      { id: 'u4-1', name: 'Weighted Pull-Up', type: 'strength' },
      { id: 'u4-2', name: 'Tbar Row', type: 'strength' },
      { id: 'u4-3', name: 'Kelso Shrugs', type: 'strength' },
      { id: 'u4-4', name: 'Chest Fly', type: 'strength' },
      { id: 'u4-5', name: 'Reverse Flyes', type: 'strength' },
      { id: 'u4-6', name: 'Incline Dumbbell Bench Press', type: 'strength' },
      { id: 'u4-7', name: 'Preacher Curls', type: 'strength' },
      { id: 'u4-8', name: 'Behind the Neck Press', type: 'strength' },
      { id: 'u4-9', name: 'Lateral Raise', type: 'strength' },
      { id: 'u4-10', name: 'Hammer Curl', type: 'strength' },
      { id: 'u4-11', name: 'Push-Up', type: 'strength' },
      { id: 'u4-trap', name: 'Trap & Neck Release (5-6 min)', type: 'conditioning' },
    ],
  },
  plyo: {
    label: 'Plyo + Conditioning',
    subtitle: 'Tuesday / Friday',
    colorKey: 'amber',
    exercises: [
      { id: 'pl-1', name: 'Assault Bike HIIT (8x 10s/60s)', type: 'conditioning' },
      { id: 'pl-2', name: 'Broad Jumps', type: 'conditioning' },
      { id: 'pl-3', name: 'Endurance Block (Assault Treadmill)', type: 'conditioning' },
    ],
  },
};

const COLOR_MAP = {
  red: { stripe: 'bg-red-600', text: 'text-red-600', solidBg: 'bg-red-600', solidBgHover: 'hover:bg-red-500' },
  blue: { stripe: 'bg-blue-700', text: 'text-blue-700', solidBg: 'bg-blue-700', solidBgHover: 'hover:bg-blue-600' },
  amber: { stripe: 'bg-amber-600', text: 'text-amber-700', solidBg: 'bg-amber-600', solidBgHover: 'hover:bg-amber-500' },
  teal: { stripe: 'bg-teal-600', text: 'text-teal-700', solidBg: 'bg-teal-600', solidBgHover: 'hover:bg-teal-500' },
  purple: { stripe: 'bg-purple-700', text: 'text-purple-700', solidBg: 'bg-purple-700', solidBgHover: 'hover:bg-purple-600' },
  stone: { stripe: 'bg-stone-600', text: 'text-stone-700', solidBg: 'bg-stone-700', solidBgHover: 'hover:bg-stone-600' },
};

const GRID_COLS = 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 0.8fr) 28px';
const SET_GRID_STYLE = { display: 'grid', gridTemplateColumns: GRID_COLS, gap: '0.4rem' };
const SET_ROW_STYLE = { display: 'grid', gridTemplateColumns: GRID_COLS, gap: '0.4rem', alignItems: 'center' };

function roundToNearest(value, step) {
  return Math.round(value / step) * step;
}

/* ------------------------------------------------------------------
   Units.

   Weights are stored canonically in KILOGRAMS, always — in the draft,
   in saved sessions, and in the export payload. The unit setting is a
   presentation layer: it converts on the way to an input or a label,
   and back to kg on the way in. That keeps e1RM, PRs, and volume
   comparable across a unit switch, and means switching units never
   rewrites a single stored value.

   Anything that rounds to a "loadable" weight must round in the
   DISPLAY unit (2.5kg, or 5lb = a pair of 2.5lb plates) and convert
   the result back, or you get weights no plate set can make.
   ------------------------------------------------------------------ */

const KG_PER_LB = 0.45359237;

const UNITS = {
  kg: { key: 'kg', label: 'kg', name: 'Kilograms' },
  lb: { key: 'lb', label: 'lb', name: 'Pounds' },
};

/* ------------------------------------------------------------------
   Settings.

   One object, persisted under the `settings` key. Everything that used
   to be a hard-coded constant (plate step, bar weight, rest presets,
   deload rules, default set count, ...) reads from here.

   RT is the live copy. The root component assigns it at the top of
   every render, before any child renders, so the pure helpers in this
   file (unitDef, buildSuggestion, buildRamp, ...) can read the current
   settings without threading them through every call.
   ------------------------------------------------------------------ */

const DEFAULT_EQUIPMENT = ['Barbell', 'Dumbbell', 'Machine', 'Cable', 'Smith machine', 'Bodyweight', 'Kettlebell', 'Band', 'Other'];

const DEFAULT_SETTINGS = {
  unit: 'kg',
  // Per unit: `step` is one progression jump and what weights round to,
  // `fine` is the small stepper button, `bar` is the empty bar for warm-ups.
  loading: {
    kg: { step: 2.5, fine: 1, bar: 20 },
    lb: { step: 5, fine: 2.5, bar: 45 },
  },
  defaultSets: 3, // global default; a template or an exercise can override it
  setCountSource: 'history', // 'history' = match last session, 'defaults' = always use the default
  restPresets: [90, 180, 300],
  restDefault: 180,
  restAutoStart: true,
  restSound: true,
  restVibrate: true,
  rpeCap: 8,
  deloadPct: 60,
  deloadSets: 2,
  autoCollapse: true,
  showRamp: true,
  showE1rm: true,
  weekStart: 0, // 0 = Sunday, 1 = Monday
  restDays: [6],
  historyPageSize: 5,
  backupReminderDays: 7, // 0 = never remind
  equipmentTypes: DEFAULT_EQUIPMENT,
};

let RT = DEFAULT_SETTINGS;

function clampNum(v, lo, hi, fallback) {
  const n = typeof v === 'number' ? v : parseFloat(v);
  if (isNaN(n)) return fallback;
  return Math.min(hi, Math.max(lo, n));
}

function pickBool(v, fallback) {
  return typeof v === 'boolean' ? v : fallback;
}

/** Anything in, a complete and valid settings object out. Unknown or broken fields fall back to defaults. */
function normalizeSettings(raw) {
  const d = DEFAULT_SETTINGS;
  const r = raw && typeof raw === 'object' ? raw : {};
  const loading = {};
  ['kg', 'lb'].forEach((u) => {
    const src = (r.loading && r.loading[u]) || {};
    const step = clampNum(src.step, 0.25, 50, d.loading[u].step);
    loading[u] = {
      step,
      fine: clampNum(src.fine, 0.25, step, Math.min(d.loading[u].fine, step)),
      bar: clampNum(src.bar, 0, 100, d.loading[u].bar),
    };
  });
  let presets = Array.isArray(r.restPresets)
    ? r.restPresets.map((x) => Math.round(clampNum(x, 15, 1800, NaN))).filter((x) => !isNaN(x))
    : [];
  presets = Array.from(new Set(presets)).sort((a, b) => a - b).slice(0, 5);
  if (!presets.length) presets = d.restPresets.slice();
  let restDefault = Math.round(clampNum(r.restDefault, 15, 1800, d.restDefault));
  if (!presets.includes(restDefault)) {
    restDefault = presets.reduce((best, p) => (Math.abs(p - restDefault) < Math.abs(best - restDefault) ? p : best), presets[0]);
  }
  let equipment = Array.isArray(r.equipmentTypes)
    ? r.equipmentTypes.map((x) => String(x || '').trim()).filter(Boolean)
    : d.equipmentTypes.slice();
  equipment = Array.from(new Set(equipment)).slice(0, 30);
  const restDays = Array.isArray(r.restDays)
    ? Array.from(new Set(r.restDays.filter((x) => Number.isInteger(x) && x >= 0 && x <= 6))).sort()
    : d.restDays.slice();
  return {
    unit: UNITS[r.unit] ? r.unit : d.unit,
    loading,
    defaultSets: Math.round(clampNum(r.defaultSets, 1, 10, d.defaultSets)),
    setCountSource: r.setCountSource === 'defaults' ? 'defaults' : 'history',
    restPresets: presets,
    restDefault,
    restAutoStart: pickBool(r.restAutoStart, d.restAutoStart),
    restSound: pickBool(r.restSound, d.restSound),
    restVibrate: pickBool(r.restVibrate, d.restVibrate),
    rpeCap: Math.round(clampNum(r.rpeCap, 5, 10, d.rpeCap) * 2) / 2,
    deloadPct: Math.round(clampNum(r.deloadPct, 30, 95, d.deloadPct)),
    deloadSets: Math.round(clampNum(r.deloadSets, 1, 6, d.deloadSets)),
    autoCollapse: pickBool(r.autoCollapse, d.autoCollapse),
    showRamp: pickBool(r.showRamp, d.showRamp),
    showE1rm: pickBool(r.showE1rm, d.showE1rm),
    weekStart: r.weekStart === 1 ? 1 : 0,
    restDays,
    historyPageSize: [5, 10, 20].includes(r.historyPageSize) ? r.historyPageSize : d.historyPageSize,
    backupReminderDays: [0, 7, 14, 30].includes(r.backupReminderDays) ? r.backupReminderDays : d.backupReminderDays,
    equipmentTypes: equipment,
  };
}

function unitDef(unit) {
  const base = UNITS[unit] || UNITS.kg;
  const l = RT.loading[base.key];
  const stepper = l.fine < l.step ? [-l.step, -l.fine, l.fine, l.step] : [-l.step, l.step];
  return { ...base, step: l.step, stepper, bar: l.bar, lightCap: l.bar * 2, rampGap: l.step * 2 };
}

function fmtClock(sec) {
  return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
}

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** Is this template day scheduled for today? Explicit weekdays win; otherwise fall back to a weekday named in the subtitle. */
function dayIsToday(day) {
  if (!day) return false;
  const dow = new Date().getDay();
  if (Array.isArray(day.weekdays) && day.weekdays.length) return day.weekdays.includes(dow);
  return (day.subtitle || '').toLowerCase().includes(WEEKDAY_NAMES[dow].toLowerCase());
}

/* ------------------------------------------------------------------
   Exercise library.

   The global pool of exercises, persisted under the `exercises` key:
     { id, name, type, equipment, notes, defaultSets?, restSec?, hold?, archived? }

   Templates still embed { id, name, type } for each exercise (so older
   builds and old exports keep working), but the library is the source
   of truth: renaming an exercise here renames it in every template, and
   logged history follows the id, not the name.
   ------------------------------------------------------------------ */

function guessEquipment(name) {
  const n = ' ' + String(name || '').toLowerCase() + ' ';
  if (n.includes('smith')) return 'Smith machine';
  if (n.includes('cable')) return 'Cable';
  if (n.includes('dumbbell') || n.includes(' db ')) return 'Dumbbell';
  if (n.includes('kettlebell')) return 'Kettlebell';
  if (n.includes('barbell')) return 'Barbell';
  if (n.includes('machine')) return 'Machine';
  return '';
}

function makeLibEntry(id, name, type, guess) {
  return {
    id,
    name,
    type: type === 'conditioning' ? 'conditioning' : 'strength',
    equipment: guess ? guessEquipment(name) : '',
    notes: '',
  };
}

/** Make sure every exercise referenced by a template or a logged session exists in the library. Returns the same array if nothing was missing. */
function syncLibrary(library, templates, sessions, guess) {
  const have = new Set(library.map((e) => e.id));
  const out = library.slice();
  const add = (id, name, type) => {
    if (!id || !name || have.has(id)) return;
    have.add(id);
    out.push(makeLibEntry(id, name, type, guess));
  };
  templates.slice().sort((a, b) => (b.current ? 1 : 0) - (a.current ? 1 : 0)).forEach((t) => {
    (t.dayOrder || Object.keys(t.days || {})).forEach((dk) => {
      (((t.days || {})[dk] || {}).exercises || []).forEach((e) => add(e.id, e.name, e.type));
    });
  });
  for (let i = sessions.length - 1; i >= 0; i--) {
    (sessions[i].exercises || []).forEach((e) => add(e.exerciseId, e.name, e.type));
  }
  return out.length === library.length ? library : out;
}

function sanitizeLibrary(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  return raw
    .filter((e) => e && typeof e.id === 'string' && e.id && typeof e.name === 'string' && e.name.trim() && !seen.has(e.id) && seen.add(e.id))
    .map((e) => {
      const out = {
        id: e.id,
        name: e.name.trim(),
        type: e.type === 'conditioning' ? 'conditioning' : 'strength',
        equipment: typeof e.equipment === 'string' ? e.equipment : '',
        notes: typeof e.notes === 'string' ? e.notes : '',
      };
      const ds = parseInt(e.defaultSets, 10);
      if (!isNaN(ds) && ds >= 1) out.defaultSets = Math.min(ds, 10);
      const rs = parseInt(e.restSec, 10);
      if (!isNaN(rs) && rs >= 15) out.restSec = Math.min(rs, 1800);
      if (e.hold) out.hold = true;
      if (e.archived) out.archived = true;
      return out;
    });
}

/**
 * How many sets a strength exercise starts with when there is nothing better to go on.
 * Most specific wins: this exercise in this template day -> the exercise itself
 * (library) -> the template -> the global setting.
 */
function resolveDefaultSets(tplEx, libEx, tpl) {
  const pick = (v) => {
    const n = parseInt(v, 10);
    return !isNaN(n) && n >= 1 ? Math.min(n, 10) : null;
  };
  return pick(tplEx && tplEx.defaultSets) || pick(libEx && libEx.defaultSets) || pick(tpl && tpl.defaultSets) || RT.defaultSets;
}

/** Per-exercise facts for the library screens: where it's used, how often it's been logged, best and recent work. */
function buildUsageIndex(templates, sessions) {
  const idx = {};
  const get = (id) => (idx[id] = idx[id] || { days: [], count: 0, lastDate: null, best: null, recent: [] });
  templates.forEach((t) => {
    (t.dayOrder || []).forEach((dk) => {
      const day = (t.days || {})[dk];
      if (!day) return;
      (day.exercises || []).forEach((e) => {
        if (e.id) get(e.id).days.push({ templateId: t.id, templateName: t.name, current: !!t.current, dayLabel: day.label || 'Day' });
      });
    });
  });
  for (let i = sessions.length - 1; i >= 0; i--) {
    const s = sessions[i];
    (s.exercises || []).forEach((ex) => {
      if (!ex.exerciseId) return;
      const u = get(ex.exerciseId);
      u.count += 1;
      if (!u.lastDate) u.lastDate = s.date;
      if (u.recent.length < 5) u.recent.push({ date: s.date, deload: !!s.deload, sets: ex.sets || null, notes: ex.notes || '' });
      if (ex.type === 'strength') {
        (ex.sets || []).forEach((set) => {
          const e = epley(set.weight, set.reps);
          if (e !== null && (!u.best || e > u.best.e1rm)) u.best = { e1rm: e, weight: set.weight, reps: set.reps, date: s.date };
        });
      }
    });
  }
  return idx;
}

/** A kg number as a storable string, without float noise (61.23499999 -> "61.235"). */
function kgStr(kg) {
  return String(Math.round(kg * 10000) / 10000);
}

function kgToUnit(kg, unit) {
  return unit === 'lb' ? kg / KG_PER_LB : kg;
}

function unitToKg(value, unit) {
  return unit === 'lb' ? value * KG_PER_LB : value;
}

// Numeric -> compact string: at most 2dp, no trailing zeros ("102.5", "225").
function trimNum(n) {
  if (n == null || isNaN(n)) return '';
  return String(Math.round(n * 100) / 100);
}

/**
 * Stored kg -> display string in the active unit.
 * lb snaps to 0.5 so a kg-native history reads cleanly (100kg -> "220.5")
 * and a typed lb value round-trips back to exactly what was typed.
 */
function weightToDisplay(kgValue, unit) {
  if (kgValue === '' || kgValue == null) return '';
  const kg = parseFloat(kgValue);
  if (isNaN(kg)) return '';
  const v = kgToUnit(kg, unit);
  return trimNum(unit === 'lb' ? Math.round(v * 2) / 2 : v);
}

/** Typed display value -> kg string for storage. Keeps enough precision to round-trip. */
function displayToWeight(displayValue, unit) {
  if (displayValue === '' || displayValue == null) return '';
  const v = parseFloat(displayValue);
  if (isNaN(v)) return '';
  return String(Math.round(unitToKg(v, unit) * 10000) / 10000);
}

/** Round a kg weight to something actually loadable in the active unit. */
function roundWeightToStep(kg, unit) {
  return unitToKg(roundToNearest(kgToUnit(kg, unit), unitDef(unit).step), unit);
}

/** One progression jump (2.5kg / 5lb), expressed in kg. */
function stepIncrementKg(unit) {
  return unitToKg(unitDef(unit).step, unit);
}

/** Stored kg -> display string with its unit label appended ("100kg", "220.5lb"). */
function formatWeight(kgValue, unit) {
  const s = weightToDisplay(kgValue, unit);
  return s === '' ? '' : s + unitDef(unit).label;
}

/** Session volume (accumulated in kg) -> rounded display string with unit label. */
function formatVolume(kgVolume, unit) {
  return Math.round(kgToUnit(kgVolume, unit)).toLocaleString() + unitDef(unit).label;
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDateFull(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function dayKeyOf(iso) {
  const d = new Date(iso);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function formatDuration(sec) {
  if (!sec && sec !== 0) return '';
  const m = Math.round(sec / 60);
  if (m < 60) return m + ' min';
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return h + 'h ' + String(rem).padStart(2, '0') + 'm';
}

function formatSet(s, unit) {
  let out = weightToDisplay(s.weight, unit) + '×' + s.reps;
  if (s.rpe) out += ' @' + s.rpe;
  if (s.hr) out += ' ♥' + s.hr;
  return out;
}

function epley(weight, reps) {
  const w = parseFloat(weight);
  const r = parseFloat(reps);
  if (isNaN(w) || isNaN(r) || w <= 0 || r <= 0) return null;
  if (r === 1) return w;
  return w * (1 + r / 30);
}

function moveExerciseBlock(list, exId, dir) {
  // Group consecutive exercises sharing a superset letter into blocks; move whole blocks.
  const getId = (it) => it.id || it.exerciseId;
  const blocks = [];
  list.forEach((item) => {
    const prev = blocks[blocks.length - 1];
    const ss = item.superset || null;
    if (ss && prev && prev.ss === ss) prev.items.push(item);
    else blocks.push({ ss, items: [item] });
  });
  const bi = blocks.findIndex((b) => b.items.some((it) => getId(it) === exId));
  if (bi < 0) return list;
  const ti = bi + (dir === 'up' ? -1 : 1);
  if (ti < 0 || ti >= blocks.length) return list;
  const copy = blocks.slice();
  const [b] = copy.splice(bi, 1);
  copy.splice(ti, 0, b);
  return copy.flatMap((blk) => blk.items);
}

function buildRamp(targetWeightKg, unit) {
  // Worked entirely in display units — an lb ramp should climb in lb plates
  // off a 45lb bar, not read as converted kg numbers.
  const d = unitDef(unit);
  const t = kgToUnit(parseFloat(targetWeightKg), unit);
  if (isNaN(t) || t <= 0) return null;
  const BAR = d.bar;
  if (t <= d.lightCap) return [{ label: 'Bar or light warm-up', detail: 'Target is light — a couple of easy sets is plenty' }];
  const steps = [
    { p: 0.4, r: 8 },
    { p: 0.55, r: 5 },
    { p: 0.7, r: 3 },
    { p: 0.8, r: 2 },
    { p: 0.9, r: 1 },
  ];
  const out = BAR > 0 ? [{ label: trimNum(BAR) + d.label + ' × 10', detail: 'empty bar' }] : [];
  let prev = BAR;
  steps.forEach((s) => {
    const w = roundToNearest(t * s.p, d.step);
    if (w > prev + d.rampGap && w < t) {
      out.push({ label: trimNum(w) + d.label + ' × ' + s.r, detail: Math.round(s.p * 100) + '%' });
      prev = w;
    }
  });
  return out;
}

function buildExerciseTrend(sessions, exerciseName, nameOf) {
  // Best e1RM per session for this exercise, chronological.
  const points = [];
  sessions
    .slice()
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .forEach((s) => {
      let best = null;
      s.exercises.forEach((ex) => {
        if (ex.type !== 'strength' || (nameOf ? nameOf(ex) : ex.name) !== exerciseName) return;
        ex.sets.forEach((set) => {
          const e = epley(set.weight, set.reps);
          if (e !== null && (best === null || e > best)) best = e;
        });
      });
      if (best !== null) points.push({ date: s.date, e1rm: best });
    });
  return points;
}

function ExerciseAutocomplete({ query, known, excludeIds, onPick }) {
  const q = query.trim().toLowerCase();
  if (q.length < 1) return null;
  const matches = known
    .filter((k) => !excludeIds.includes(k.id) && k.name.toLowerCase().includes(q))
    .slice(0, 6);
  if (!matches.length) return null;
  return (
    <div className="border border-stone-300 rounded-sm bg-white mb-2 overflow-hidden">
      <div className="text-[10px] uppercase tracking-widest text-stone-400 px-3 pt-2">Your exercises — tap to add (keeps its history)</div>
      {matches.map((m) => (
        <button
          key={m.id}
          onClick={() => onPick(m)}
          className="w-full text-left px-3 py-2.5 text-sm text-stone-800 hover:bg-stone-100 flex items-center justify-between gap-2"
        >
          <span className="truncate">{m.name}</span>
          <span className="text-[10px] uppercase tracking-widest text-stone-400 shrink-0">{m.equipment || (m.type === 'strength' ? 'w×r' : 'notes')}</span>
        </button>
      ))}
    </div>
  );
}

function buildSuggestion(hist, target, unit, opts) {
  // hist: newest-first array of top sets [{weight, reps, rpe, e1rm}], max 3, non-deload only.
  //       weights are kg (canonical); the prescription text is rendered in `unit`.
  // target (optional, from template): { lo, hi, cap } — rep range + RPE ceiling for double progression.
  if (!hist.length) return null;
  const last = hist[0];
  const w = parseFloat(last.weight);
  const r = parseFloat(last.reps);
  const rpe = last.rpe !== '' && last.rpe != null ? parseFloat(last.rpe) : null;
  if (isNaN(w) || isNaN(r)) return null;
  const cur = weightToDisplay(w, unit);
  const up = weightToDisplay(roundWeightToStep(w + stepIncrementKg(unit), unit), unit);

  if (opts && opts.hold) {
    return { kind: 'hold', text: cur + ' × ' + trimNum(r) + ' — on hold, repeat last time' };
  }

  if (target && target.lo && target.hi) {
    const cap = target.cap || RT.rpeCap;
    if (rpe !== null && rpe > cap + 1) {
      return { kind: 'ease', text: cur + ' × ' + target.lo + '–' + target.hi + ' @ ≤' + cap + ' — last was @' + rpe + ', own it first' };
    }
    if (r >= target.hi && (rpe === null || rpe <= cap)) {
      return { kind: 'up', text: up + ' × ' + target.lo + '–' + target.hi + ' @ ≤' + cap + ' — range filled, weight up' };
    }
    if (r < target.hi) {
      const aim = Math.min(target.hi, r + 1);
      return { kind: 'hold', text: cur + ' × ' + aim + '+ @ ≤' + cap + ' — fill the range (' + target.lo + '–' + target.hi + ')' };
    }
    return { kind: 'hold', text: cur + ' × ' + target.hi + ' @ ≤' + cap + ' — repeat cleaner' };
  }

  const trendUp = hist.length >= 2 ? hist[0].e1rm >= hist[hist.length - 1].e1rm * 0.99 : true;
  const ceil = RT.rpeCap;
  if ((rpe === null || rpe <= ceil) && trendUp) {
    return { kind: 'up', text: up + ' × ' + Math.max(1, r - 1) + '–' + r + ' @ ≤' + ceil };
  }
  if (rpe !== null && rpe <= ceil + 1) {
    return { kind: 'hold', text: cur + ' × ' + r + '–' + (r + 1) + ' @ ≤' + Math.min(10, ceil + 0.5) + ' — earn the jump' };
  }
  return { kind: 'ease', text: cur + ' × ' + r + ' — last was @' + rpe + '; better bar speed before adding' };
}

function findNextSet(draft, exerciseId, idx) {
  // The set that comes after (exerciseId, idx): next set of the same exercise,
  // otherwise the first set of the next strength exercise.
  if (!draft || !draft.exercises) return null;
  const exIndex = draft.exercises.findIndex((e) => e.exerciseId === exerciseId);
  if (exIndex < 0) return null;
  const ex = draft.exercises[exIndex];
  if (ex.sets && idx + 1 < ex.sets.length) {
    return { exerciseId, index: idx + 1, name: ex.name, set: ex.sets[idx + 1] };
  }
  for (let i = exIndex + 1; i < draft.exercises.length; i++) {
    const nx = draft.exercises[i];
    if (nx.type === 'strength' && nx.sets && nx.sets.length) {
      return { exerciseId: nx.exerciseId, index: 0, name: nx.name, set: nx.sets[0] };
    }
  }
  return null;
}

function draftHasData(draft) {
  if (!draft || !draft.exercises) return false;
  return draft.exercises.some((ex) => {
    if (ex.type === 'strength') {
      return (ex.sets || []).some((s) => s.weight !== '' || s.reps !== '' || s.rpe !== '');
    }
    return !!(ex.notes && ex.notes.trim());
  });
}

function findFirstPendingSet(draft) {
  // First strength set that hasn't been given an RPE yet — what you're about
  // to do when you start a rest timer manually.
  if (!draft || !draft.exercises) return null;
  for (let e = 0; e < draft.exercises.length; e++) {
    const ex = draft.exercises[e];
    if (ex.type !== 'strength' || !ex.sets) continue;
    for (let i = 0; i < ex.sets.length; i++) {
      if (!ex.sets[i].rpe) return { exerciseId: ex.exerciseId, index: i, name: ex.name, set: ex.sets[i] };
    }
  }
  return null;
}

function sessionVolume(s) {
  let total = 0;
  s.exercises.forEach((ex) => {
    if (ex.type !== 'strength') return;
    ex.sets.forEach((set) => {
      const w = parseFloat(set.weight);
      const r = parseFloat(set.reps);
      if (!isNaN(w) && !isNaN(r)) total += w * r;
    });
  });
  return Math.round(total);
}

function bestE1rmByName(sessions, nameOf) {
  const map = {};
  sessions.forEach((s) => {
    s.exercises.forEach((ex) => {
      if (ex.type !== 'strength') return;
      const name = nameOf ? nameOf(ex) : ex.name;
      ex.sets.forEach((set) => {
        const e = epley(set.weight, set.reps);
        if (e !== null && (!map[name] || e > map[name])) map[name] = e;
      });
    });
  });
  return map;
}

function buildRecords(sessions, nameOf) {
  const map = {};
  sessions.forEach((s) => {
    s.exercises.forEach((ex) => {
      if (ex.type !== 'strength') return;
      const name = nameOf ? nameOf(ex) : ex.name;
      ex.sets.forEach((set) => {
        const e = epley(set.weight, set.reps);
        if (e === null) return;
        const cur = map[name];
        if (!cur || e > cur.e1rm) {
          map[name] = { name, e1rm: e, weight: parseFloat(set.weight), reps: parseFloat(set.reps), rpe: set.rpe, date: s.date };
        }
      });
    });
  });
  return Object.values(map).sort((a, b) => b.e1rm - a.e1rm);
}

function newId() {
  return 'ex-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
}

function buildSessionText(template, s, unit, nameOf) {
  const nm = (ex) => (nameOf ? nameOf(ex) : ex.name);
  const day = template[s.dayType];
  const label = s.dayLabel || (day ? day.label : s.dayType);
  const dateStr = new Date(s.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  let header = label.toUpperCase() + ' — ' + dateStr;
  if (s.durationSec) header += '  (' + formatDuration(s.durationSec) + ')';
  const lines = [header];
  if (s.note) lines.push('  Note: ' + s.note);
  s.exercises.forEach((ex) => {
    if (ex.type === 'strength') {
      lines.push('  ' + nm(ex) + ': ' + ex.sets.map((set) => formatSet(set, unit)).join(', '));
    } else if (ex.notes) {
      lines.push('  ' + nm(ex) + ': ' + ex.notes);
    }
  });
  return lines.join('\n');
}

function buildExportText(templates, sessions, library, settings) {
  const ordered = sessions.slice().sort((a, b) => new Date(b.date) - new Date(a.date));
  // weightUnit is metadata, not a setting: stored weights are always kg.
  // (App renamed from 'workout-log' — import never validated the app field, so old exports still load.)
  // formatVersion 3 adds `exercises` (the library) and `settings`. Both are optional on import, so
  // older exports still load here and this export still loads in an older build (which ignores them).
  return JSON.stringify({ app: 'yawl', formatVersion: 3, weightUnit: 'kg', exportedAt: new Date().toISOString(), settings: settings || undefined, exercises: library || [], templates: templates, sessions: ordered }, null, 2);
}

function parseImportText(text) {
  const data = JSON.parse(text);
  const rawSessions = Array.isArray(data) ? data : data.sessions;
  const sessions = Array.isArray(rawSessions)
    ? rawSessions.filter((s) => s && s.id && s.dayType && s.date && Array.isArray(s.exercises))
    : [];
  const rawTemplates = Array.isArray(data) ? [] : data.templates;
  const templates = Array.isArray(rawTemplates)
    ? rawTemplates
      .filter((t) => t && t.id && t.name && Array.isArray(t.dayOrder) && t.days && typeof t.days === 'object')
      .map((t) => {
        // Drop day keys with no day behind them and make sure every day has an exercise list,
        // so a hand-edited file can't crash the screens that render it.
        const days = {};
        Object.keys(t.days).forEach((k) => {
          const d = t.days[k];
          if (d && typeof d === 'object') days[k] = { ...d, exercises: Array.isArray(d.exercises) ? d.exercises.filter((e) => e && e.id && e.name) : [] };
        });
        return { ...t, days, dayOrder: t.dayOrder.filter((k) => days[k]) };
      })
    : [];
  const exercises = Array.isArray(data) ? [] : sanitizeLibrary(data.exercises);
  const settings = !Array.isArray(data) && data.settings && typeof data.settings === 'object' ? data.settings : null;
  if (!sessions.length && !templates.length && !exercises.length && !settings) throw new Error('Nothing to import');
  return { sessions, templates, exercises, settings };
}

function SessionTimer({ startedAt }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const total = Math.max(0, Math.floor((now - startedAt) / 1000));
  const mm = String(Math.floor(total / 60)).padStart(2, '0');
  const ss = String(total % 60).padStart(2, '0');
  return <span className="font-mono tabular-nums">{mm}:{ss}</span>;
}

function StorageBanner({ message, onRetry, retrying }) {
  if (!message) return null;
  return (
    <div className="bg-red-50 border border-red-300 rounded-sm p-3 mb-4 flex items-start justify-between gap-3">
      <div className="text-xs text-red-700 leading-relaxed">{message}</div>
      {onRetry && (
        <button onClick={onRetry} disabled={retrying} className="shrink-0 text-xs uppercase tracking-widest text-red-700 border border-red-300 rounded-sm px-2 py-1 hover:bg-red-100 disabled:opacity-50">
          {retrying ? '...' : 'Retry'}
        </button>
      )}
    </div>
  );
}

const DAY_COLORS = ['red', 'blue', 'amber', 'teal', 'purple', 'stone'];

/* ---------- small shared UI pieces ---------- */

function PageHeader({ eyebrow, title, sub, children }) {
  // pr-10 leaves room for the settings gear the root pins to the top-right corner.
  return (
    <div className="mb-5 pr-10">
      {eyebrow && <div className="text-xs uppercase tracking-widest text-stone-500 mb-1 flex items-center gap-1.5">{eyebrow}</div>}
      <h1 className="text-2xl font-black uppercase tracking-tight text-stone-900">{title}</h1>
      {sub && <p className="text-xs text-stone-500 mt-1 leading-relaxed">{sub}</p>}
      {children}
    </div>
  );
}

function Card({ title, icon: Icon, children }) {
  return (
    <div className="bg-white border border-stone-200 rounded-sm p-4 mb-3">
      {title && (
        <div className="text-xs uppercase tracking-widest text-stone-500 mb-3 flex items-center gap-1.5">
          {Icon && <Icon size={13} />} {title}
        </div>
      )}
      {children}
    </div>
  );
}

function Row({ label, hint, children, stacked }) {
  return (
    <div className={'py-3 border-t border-stone-100 first:border-t-0 first:pt-0 last:pb-0 ' + (stacked ? '' : 'flex items-center justify-between gap-3')}>
      <div className="min-w-0">
        <div className="text-sm text-stone-800">{label}</div>
        {hint && <div className="text-[11px] text-stone-400 leading-snug mt-0.5">{hint}</div>}
      </div>
      <div className={stacked ? 'mt-2' : 'shrink-0'}>{children}</div>
    </div>
  );
}

function Segmented({ options, value, onChange, full }) {
  return (
    <div className={'flex border border-stone-300 rounded-sm overflow-hidden ' + (full ? 'w-full' : '')}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            onClick={() => onChange(o.value)}
            disabled={o.disabled}
            aria-pressed={active}
            className={'px-3 py-2.5 text-xs uppercase tracking-widest ' + (full ? 'flex-1 ' : '') + (active ? 'bg-stone-800 text-white font-bold' : 'bg-white text-stone-500 disabled:opacity-40')}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function NumStepper({ value, onChange, min, max, step = 1, format, label }) {
  const round = (n) => Math.round(n * 100) / 100;
  return (
    <div className="flex items-center shrink-0 border border-stone-300 rounded-sm overflow-hidden" role="group" aria-label={label}>
      <button onClick={() => onChange(Math.max(min, round(value - step)))} disabled={value <= min} className="w-10 h-10 flex items-center justify-center text-stone-700 bg-stone-50 active:bg-stone-200 disabled:opacity-30" aria-label={'Decrease ' + (label || '')}>
        <Minus size={15} />
      </button>
      <div className="min-w-[3.5rem] px-1 text-center text-sm font-mono tabular-nums font-bold text-stone-900">{format ? format(value) : trimNum(value)}</div>
      <button onClick={() => onChange(Math.min(max, round(value + step)))} disabled={value >= max} className="w-10 h-10 flex items-center justify-center text-stone-700 bg-stone-50 active:bg-stone-200 disabled:opacity-30" aria-label={'Increase ' + (label || '')}>
        <Plus size={15} />
      </button>
    </div>
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <button
      role="switch"
      aria-checked={!!checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={'relative w-12 h-7 rounded-full transition-colors ' + (checked ? 'bg-stone-800' : 'bg-stone-300')}
    >
      <span className="absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-all" style={{ left: checked ? '1.375rem' : '0.125rem' }} />
    </button>
  );
}

function ConfirmModal({ title, body, confirmLabel, danger, onConfirm, onCancel, cancelLabel }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)', zIndex: 80 }} role="dialog" aria-modal="true">
      <div className="bg-white rounded-sm border border-stone-300 w-full max-w-sm p-4">
        <div className="text-sm font-black uppercase tracking-tight text-stone-900 mb-1">{title}</div>
        {body && <div className="text-xs text-stone-600 leading-relaxed">{body}</div>}
        <div className="flex gap-2 mt-4">
          <button onClick={onCancel} className="flex-1 text-xs uppercase tracking-widest text-stone-600 border border-stone-300 rounded-sm py-3">{cancelLabel || 'Cancel'}</button>
          <button onClick={onConfirm} className={'flex-1 text-xs uppercase tracking-widest text-white rounded-sm py-3 font-bold ' + (danger ? 'bg-red-600 hover:bg-red-500' : 'bg-stone-800 hover:bg-stone-700')}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

/** Bottom action bar that clears the iPhone home indicator. */
function SaveBar({ children }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-stone-100 border-t border-stone-200 px-4 pt-4" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))', zIndex: 40 }}>
      <div className="max-w-md mx-auto">{children}</div>
    </div>
  );
}

function Toast({ message, raised }) {
  if (!message) return null;
  return (
    <div className="fixed left-0 right-0 flex justify-center pointer-events-none px-4" style={{ bottom: 'calc(' + (raised ? '12rem' : '5.5rem') + ' + env(safe-area-inset-bottom))', zIndex: 90 }} role="status">
      <div className="bg-stone-900 text-white text-xs uppercase tracking-widest rounded-sm px-4 py-2.5 shadow-lg flex items-center gap-2">
        <Check size={14} /> {message}
      </div>
    </div>
  );
}

function ColorSwatches({ value, onChange }) {
  return (
    <div className="flex items-center gap-2">
      {DAY_COLORS.map((c) => (
        <button
          key={c}
          onClick={() => onChange(c)}
          aria-label={'Day color ' + c}
          aria-pressed={value === c}
          className={'w-9 h-9 rounded-sm flex items-center justify-center text-white ' + COLOR_MAP[c].stripe + (value === c ? ' ring-2 ring-offset-2 ring-stone-800' : '')}
        >
          {value === c && <Check size={15} />}
        </button>
      ))}
    </div>
  );
}

function WeekdayChips({ value, onChange }) {
  const selected = Array.isArray(value) ? value : [];
  const order = [0, 1, 2, 3, 4, 5, 6].map((i) => (i + RT.weekStart) % 7);
  return (
    <div className="flex gap-1">
      {order.map((dow) => {
        const on = selected.includes(dow);
        return (
          <button
            key={dow}
            onClick={() => onChange(on ? selected.filter((x) => x !== dow) : [...selected, dow].sort())}
            aria-label={WEEKDAY_NAMES[dow]}
            aria-pressed={on}
            className={'flex-1 h-9 rounded-sm border text-xs font-mono ' + (on ? 'bg-stone-800 border-stone-800 text-white font-bold' : 'bg-white border-stone-300 text-stone-500')}
          >
            {WEEKDAY_LETTERS[dow]}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- templates ---------- */

function TemplatesView({ templates, onSetCurrent, onEdit, onAdd, onDelete, onDuplicate }) {
  const [newName, setNewName] = useState('');
  const [newSets, setNewSets] = useState(RT.defaultSets);
  const [confirmDelete, setConfirmDelete] = useState(null);

  return (
    <div>
      <PageHeader eyebrow="Programs" title="Templates" sub="The starred template is the one on your Today screen. Tap a star to switch." />

      <div className="space-y-2 mb-6">
        {templates.map((t) => (
          <div key={t.id} className={'bg-white border rounded-sm ' + (t.current ? 'border-stone-400' : 'border-stone-200')}>
            <div className="flex items-stretch">
              <button onClick={() => onSetCurrent(t.id)} className="px-3 flex items-center" aria-label={t.current ? 'Current template' : 'Make this the current template'}>
                <Star size={18} className={t.current ? 'text-amber-500 fill-amber-500' : 'text-stone-300'} />
              </button>
              <button onClick={() => onEdit(t.id)} className="flex-1 min-w-0 text-left py-3">
                <div className="text-sm font-black uppercase tracking-tight text-stone-900 truncate">{t.name}</div>
                <div className="text-xs text-stone-500">
                  {t.dayOrder.length} day{t.dayOrder.length === 1 ? '' : 's'} · {t.defaultSets || RT.defaultSets} sets default{t.current ? ' · current' : ''}
                </div>
              </button>
              <button onClick={() => onDuplicate(t.id)} className="text-stone-400 hover:text-stone-800 px-2.5" aria-label="Duplicate template">
                <Copy size={16} />
              </button>
              <button onClick={() => onEdit(t.id)} className="text-stone-500 hover:text-stone-900 px-2.5" aria-label="Edit template">
                <Pencil size={16} />
              </button>
              {!t.current && templates.length > 1 && (
                <button onClick={() => setConfirmDelete(t)} className="text-stone-400 hover:text-red-600 px-2.5" aria-label="Delete template">
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-dashed border-stone-300 rounded-sm p-4">
        <div className="text-xs uppercase tracking-widest text-stone-500 mb-2">New Template</div>
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Template name (e.g. 3-Day Full Body)"
          className="w-full bg-stone-50 border border-stone-300 rounded-sm px-3 py-2.5 text-sm text-stone-900 mb-3 focus:outline-none focus:border-stone-500"
        />
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="min-w-0">
            <div className="text-sm text-stone-800">Default sets</div>
            <div className="text-[11px] text-stone-400 leading-snug">What each exercise in this template starts with.</div>
          </div>
          <NumStepper value={newSets} onChange={setNewSets} min={1} max={10} label="default sets" />
        </div>
        <button
          onClick={() => {
            if (!newName.trim()) return;
            onAdd(newName.trim(), newSets);
            setNewName('');
            setNewSets(RT.defaultSets);
          }}
          disabled={!newName.trim()}
          className="w-full bg-stone-800 hover:bg-stone-700 disabled:opacity-40 rounded-sm py-3 text-xs uppercase tracking-widest text-white font-bold flex items-center justify-center gap-1"
        >
          <Plus size={14} /> Create & Add Days
        </button>
      </div>

      {confirmDelete && (
        <ConfirmModal
          title={'Delete ' + confirmDelete.name + '?'}
          body="The template is removed. Workouts you already logged with it stay in your history."
          confirmLabel="Delete"
          danger
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => { onDelete(confirmDelete.id); setConfirmDelete(null); }}
        />
      )}
    </div>
  );
}

function TemplateEditView({ template, library, onBack, onSave }) {
  const [name, setName] = useState(template.name);
  // null = follow the global default; a number = this template's own default.
  const [defaultSets, setDefaultSets] = useState(() => {
    const n = parseInt(template.defaultSets, 10);
    return !isNaN(n) && n >= 1 ? n : null;
  });
  const [daysArr, setDaysArr] = useState(() =>
    template.dayOrder.map((k) => {
      const d = template.days[k] || { label: k, subtitle: '', colorKey: 'blue', exercises: [] };
      return {
        key: k,
        label: d.label,
        subtitle: d.subtitle || '',
        colorKey: COLOR_MAP[d.colorKey] ? d.colorKey : 'blue',
        weekdays: Array.isArray(d.weekdays) ? d.weekdays : [],
        exercises: (d.exercises || []).map((e) => ({ ...e })),
      };
    })
  );
  const [expanded, setExpanded] = useState(template.dayOrder.length === 1 ? template.dayOrder[0] : null);
  const [newExName, setNewExName] = useState('');
  const [newExType, setNewExType] = useState('strength');
  const [editor, setEditor] = useState(null); // { kind: 'sets' | 'target' | 'link', dayKey, exId, ...fields }
  const [nameEdit, setNameEdit] = useState(null); // { exId, value }
  const [confirm, setConfirm] = useState(null); // { kind: 'removeDay', key } | { kind: 'discard' }

  const snapshot = JSON.stringify({ name, defaultSets, daysArr });
  const initial = useRef(snapshot);
  const dirty = snapshot !== initial.current;

  const libMap = {};
  (library || []).forEach((l) => { libMap[l.id] = l; });
  const tplSets = defaultSets || RT.defaultSets;

  function updateDay(key, field, value) {
    setDaysArr((prev) => prev.map((d) => (d.key === key ? { ...d, [field]: value } : d)));
  }

  function mapExercise(dayKey, exId, fn) {
    setDaysArr((prev) => prev.map((d) => (d.key !== dayKey ? d : { ...d, exercises: d.exercises.map((e) => (e.id === exId ? fn(e) : e)) })));
  }

  function withoutField(e, field) {
    const copy = { ...e };
    delete copy[field];
    return copy;
  }

  function addDay() {
    const key = newId();
    setDaysArr((prev) => [...prev, { key, label: 'New Day', subtitle: '', colorKey: 'blue', weekdays: [], exercises: [] }]);
    setExpanded(key);
    setEditor(null);
  }

  function moveDay(key, dir) {
    setDaysArr((prev) => {
      const i = prev.findIndex((d) => d.key === key);
      const j = i + (dir === 'up' ? -1 : 1);
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const copy = prev.slice();
      const [d] = copy.splice(i, 1);
      copy.splice(j, 0, d);
      return copy;
    });
  }

  function removeDay(key) {
    setDaysArr((prev) => prev.filter((d) => d.key !== key));
    if (expanded === key) setExpanded(null);
  }

  function addExerciseToDay(key, knownPick) {
    const typed = newExName.trim();
    // Typing the exact name of an existing exercise reuses it rather than creating a twin.
    const exact = !knownPick && typed
      ? (library || []).find((l) => !l.archived && l.name.toLowerCase() === typed.toLowerCase())
      : null;
    const pick = knownPick || exact;
    const ex = pick
      ? { id: pick.id, name: pick.name, type: pick.type }
      : (typed ? { id: newId(), name: typed, type: newExType } : null);
    if (!ex) return;
    setDaysArr((prev) => prev.map((d) => {
      if (d.key !== key) return d;
      if (d.exercises.some((e) => e.id === ex.id)) return d;
      return { ...d, exercises: [...d.exercises, ex] };
    }));
    setNewExName('');
    setNewExType('strength');
  }

  function renameExercise(exId, value) {
    // One exercise, one name: rename it on every day of this template it appears on.
    setDaysArr((prev) => prev.map((d) => ({ ...d, exercises: d.exercises.map((e) => (e.id === exId ? { ...e, name: value } : e)) })));
  }

  function moveExercise(dayKey, exId, dir) {
    setDaysArr((prev) => prev.map((d) => (d.key !== dayKey ? d : { ...d, exercises: moveExerciseBlock(d.exercises, exId, dir) })));
  }

  function cycleSuperset(dayKey, exId) {
    mapExercise(dayKey, exId, (e) => {
      const next = !e.superset ? 'A' : e.superset === 'A' ? 'B' : null;
      return next ? { ...e, superset: next } : withoutField(e, 'superset');
    });
  }

  function removeExerciseFromDay(key, exId) {
    setDaysArr((prev) => prev.map((d) => (d.key === key ? { ...d, exercises: d.exercises.filter((e) => e.id !== exId) } : d)));
    setEditor(null);
  }

  function isEditing(kind, dayKey, exId) {
    return editor && editor.kind === kind && editor.dayKey === dayKey && editor.exId === exId;
  }

  function toggleEditor(kind, dayKey, ex) {
    if (isEditing(kind, dayKey, ex.id)) {
      setEditor(null);
      return;
    }
    if (kind === 'target') {
      setEditor({ kind, dayKey, exId: ex.id, lo: ex.target ? String(ex.target.lo) : '', hi: ex.target ? String(ex.target.hi) : '', cap: ex.target && ex.target.cap ? String(ex.target.cap) : String(RT.rpeCap), error: null });
    } else if (kind === 'link') {
      setEditor({ kind, dayKey, exId: ex.id, sourceId: ex.derivedFrom ? ex.derivedFrom.sourceId : '', pct: ex.derivedFrom ? String(Math.round(ex.derivedFrom.factor * 100)) : '75', error: null });
    } else {
      setEditor({ kind, dayKey, exId: ex.id });
    }
  }

  function saveTarget() {
    const lo = parseInt(editor.lo, 10);
    const hi = parseInt(editor.hi, 10);
    const cap = parseFloat(editor.cap);
    if (isNaN(lo) || isNaN(hi) || lo < 1 || hi < lo) {
      setEditor({ ...editor, error: 'Enter a rep range like 8 to 10.' });
      return;
    }
    mapExercise(editor.dayKey, editor.exId, (e) => ({ ...e, target: { lo, hi, cap: isNaN(cap) ? RT.rpeCap : Math.min(10, Math.max(1, cap)) } }));
    setEditor(null);
  }

  function saveLink() {
    const pctNum = parseFloat(editor.pct);
    if (!editor.sourceId || isNaN(pctNum) || pctNum <= 0) {
      setEditor({ ...editor, error: 'Pick a source exercise and a percentage.' });
      return;
    }
    mapExercise(editor.dayKey, editor.exId, (e) => ({ ...e, derivedFrom: { sourceId: editor.sourceId, factor: pctNum / 100 } }));
    setEditor(null);
  }

  function save() {
    const dayOrder = daysArr.map((d) => d.key);
    const days = {};
    daysArr.forEach((d) => {
      const day = { label: d.label.trim() || 'Day', subtitle: d.subtitle, colorKey: d.colorKey, exercises: d.exercises };
      if (d.weekdays && d.weekdays.length) day.weekdays = d.weekdays;
      days[d.key] = day;
    });
    onSave(template.id, { name: name.trim() || template.name, defaultSets: defaultSets || undefined, dayOrder, days });
  }

  const inputCls = 'w-full bg-stone-50 border border-stone-300 rounded-sm px-3 py-2.5 text-sm text-stone-900 focus:outline-none focus:border-stone-500';
  const chipBase = 'text-[11px] uppercase tracking-wide rounded-sm px-2 py-1.5 border flex items-center gap-1 ';
  const chipOff = 'text-stone-500 border-stone-200 bg-white';

  return (
    <div>
      <div className="flex items-center mb-5">
        <button onClick={() => (dirty ? setConfirm({ kind: 'discard' }) : onBack())} className="flex items-center gap-1 text-stone-500 text-sm py-2">
          <ChevronLeft size={18} /> Templates
        </button>
      </div>
      <div className="mb-4">
        <div className="text-xs uppercase tracking-widest text-stone-500 mb-1">Edit Template</div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Template name"
          className="w-full bg-transparent text-2xl font-black uppercase tracking-tight text-stone-900 border-b border-stone-300 focus:outline-none focus:border-stone-500 pb-1"
        />
      </div>

      <div className="bg-white border border-stone-200 rounded-sm p-4 mb-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm text-stone-800">Default sets</div>
            <div className="text-[11px] text-stone-400 leading-snug">
              {defaultSets ? 'Set for this template.' : 'Following the global default (' + RT.defaultSets + ').'} An exercise can override it below.
            </div>
          </div>
          <NumStepper value={tplSets} onChange={setDefaultSets} min={1} max={10} label="template default sets" />
        </div>
        {defaultSets && (
          <button onClick={() => setDefaultSets(null)} className="mt-2 text-[11px] uppercase tracking-widest text-stone-500 underline">
            Use the global default ({RT.defaultSets})
          </button>
        )}
      </div>

      {daysArr.length === 0 && (
        <div className="text-sm text-stone-500 mb-3">No days yet. Add your first training day below.</div>
      )}

      <div className="space-y-2">
        {daysArr.map((d, di) => {
          const colors = COLOR_MAP[d.colorKey] || COLOR_MAP.blue;
          const open = expanded === d.key;
          const dayNames = (d.weekdays || []).map((w) => WEEKDAY_SHORT[w]).join(', ');
          return (
            <div key={d.key} className="bg-white border border-stone-200 rounded-sm overflow-hidden">
              <div className="flex items-stretch">
                <div className={'w-2 shrink-0 ' + colors.stripe} />
                <button onClick={() => { setExpanded(open ? null : d.key); setEditor(null); setNewExName(''); }} className="flex-1 min-w-0 text-left px-3 py-3" aria-expanded={open}>
                  <div className="text-sm font-black uppercase tracking-tight text-stone-900 truncate">{d.label || 'Day'}</div>
                  <div className="text-xs text-stone-500 truncate">
                    {d.exercises.length} exercise{d.exercises.length === 1 ? '' : 's'}{dayNames ? ' · ' + dayNames : ''}
                  </div>
                </button>
                <button onClick={() => moveDay(d.key, 'up')} disabled={di === 0} className="px-1.5 text-stone-400 hover:text-stone-700 disabled:opacity-20" aria-label="Move day up">
                  <ChevronUp size={18} />
                </button>
                <button onClick={() => moveDay(d.key, 'down')} disabled={di === daysArr.length - 1} className="px-1.5 text-stone-400 hover:text-stone-700 disabled:opacity-20" aria-label="Move day down">
                  <ChevronDown size={18} />
                </button>
                <button onClick={() => setExpanded(open ? null : d.key)} className="px-2 text-stone-500 text-[11px] uppercase tracking-widest">
                  {open ? 'Close' : 'Edit'}
                </button>
              </div>
              {open && (
                <div className="border-t border-stone-200 p-3 space-y-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-stone-400 mb-1">Day name</div>
                    <input value={d.label} onChange={(e) => updateDay(d.key, 'label', e.target.value)} placeholder="e.g. Lower A" className={inputCls} />
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-stone-400 mb-1">Subtitle (optional)</div>
                    <input value={d.subtitle} onChange={(e) => updateDay(d.key, 'subtitle', e.target.value)} placeholder="e.g. Secondary gym · heavy" className={inputCls} />
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-stone-400 mb-1">Trains on — marks it “Today” on the home screen</div>
                    <WeekdayChips value={d.weekdays} onChange={(v) => updateDay(d.key, 'weekdays', v)} />
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-stone-400 mb-1">Color</div>
                    <ColorSwatches value={d.colorKey} onChange={(c) => updateDay(d.key, 'colorKey', c)} />
                  </div>

                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-stone-400 mb-1">Exercises</div>
                    {d.exercises.length === 0 && <div className="text-xs text-stone-500 mb-2">None yet — add one below.</div>}
                    <div className="space-y-1.5">
                      {d.exercises.map((ex) => {
                        const lib = libMap[ex.id];
                        const isStrength = ex.type === 'strength';
                        const allSources = daysArr.flatMap((day) => day.exercises.filter((e) => e.type === 'strength').map((e) => ({ ...e, dayLabel: day.label || 'Day', dayKey: day.key })));
                        const source = ex.derivedFrom ? allSources.find((e) => e.id === ex.derivedFrom.sourceId) : null;
                        const seenSrc = new Set();
                        const linkableSources = allSources
                          .filter((e) => e.id !== ex.id && !seenSrc.has(e.id) && seenSrc.add(e.id))
                          .sort((a, b) => a.name.localeCompare(b.name));
                        const ownSets = parseInt(ex.defaultSets, 10);
                        const hasOwnSets = !isNaN(ownSets) && ownSets >= 1;
                        const inheritedSets = (lib && lib.defaultSets) || tplSets;
                        const effSets = hasOwnSets ? ownSets : inheritedSets;
                        return (
                          <div key={ex.id} className="bg-stone-50 border border-stone-200 rounded-sm px-3 py-2">
                            <div className="flex items-start justify-between gap-1">
                              <button onClick={() => setNameEdit({ exId: ex.id, value: ex.name })} className="min-w-0 flex-1 text-left py-1" aria-label={'Rename ' + ex.name}>
                                <span className="text-sm font-bold text-stone-900 leading-snug" style={{ overflowWrap: 'anywhere' }}>{ex.name}</span>
                                <span className="block text-[11px] text-stone-400">
                                  {isStrength ? 'Weight × reps' : 'Notes only'}{lib && lib.equipment ? ' · ' + lib.equipment : ''}
                                </span>
                              </button>
                              <div className="flex items-center shrink-0">
                                <button onClick={() => moveExercise(d.key, ex.id, 'up')} className="text-stone-400 hover:text-stone-700 p-1.5" aria-label="Move up">
                                  <ChevronUp size={17} />
                                </button>
                                <button onClick={() => moveExercise(d.key, ex.id, 'down')} className="text-stone-400 hover:text-stone-700 p-1.5" aria-label="Move down">
                                  <ChevronDown size={17} />
                                </button>
                                <button onClick={() => removeExerciseFromDay(d.key, ex.id)} className="text-stone-400 hover:text-red-600 p-1.5" aria-label={'Remove ' + ex.name + ' from this day'}>
                                  <X size={17} />
                                </button>
                              </div>
                            </div>

                            {isStrength && (
                              <div className="flex flex-wrap gap-1.5 mt-1.5">
                                <button onClick={() => toggleEditor('sets', d.key, ex)} className={chipBase + (hasOwnSets ? 'text-stone-900 border-stone-500 bg-white font-bold' : chipOff)}>
                                  {effSets} set{effSets === 1 ? '' : 's'}
                                </button>
                                <button onClick={() => toggleEditor('target', d.key, ex)} className={chipBase + (ex.target ? 'text-emerald-800 border-emerald-300 bg-emerald-50 font-bold' : chipOff)}>
                                  <Target size={11} /> {ex.target ? ex.target.lo + '–' + ex.target.hi + ' @≤' + ex.target.cap : 'Rep target'}
                                </button>
                                <button onClick={() => cycleSuperset(d.key, ex.id)} className={chipBase + (ex.superset ? 'text-purple-800 border-purple-300 bg-purple-50 font-bold' : chipOff)}>
                                  {ex.superset ? 'Superset ' + ex.superset : 'Superset'}
                                </button>
                                {(linkableSources.length > 0 || ex.derivedFrom) && (
                                  <button onClick={() => toggleEditor('link', d.key, ex)} className={chipBase + (ex.derivedFrom ? 'text-blue-800 border-blue-300 bg-blue-50 font-bold' : chipOff)}>
                                    <Link2 size={11} /> {ex.derivedFrom ? Math.round(ex.derivedFrom.factor * 100) + '% of ' + (source ? source.name : 'missing exercise') : 'Link weight'}
                                  </button>
                                )}
                              </div>
                            )}

                            {isEditing('sets', d.key, ex.id) && (
                              <div className="mt-2 bg-white border border-stone-200 rounded-sm p-3">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="text-xs text-stone-600 leading-snug">
                                    {hasOwnSets ? 'Custom for this day.' : 'Following the default (' + inheritedSets + ').'}
                                  </div>
                                  <NumStepper value={effSets} onChange={(n) => mapExercise(d.key, ex.id, (e) => ({ ...e, defaultSets: n }))} min={1} max={10} label="sets" />
                                </div>
                                <div className="flex gap-2 mt-2">
                                  {hasOwnSets && (
                                    <button onClick={() => mapExercise(d.key, ex.id, (e) => withoutField(e, 'defaultSets'))} className="text-xs uppercase tracking-widest text-stone-500 border border-stone-300 rounded-sm px-3 py-2">
                                      Use default ({inheritedSets})
                                    </button>
                                  )}
                                  <button onClick={() => setEditor(null)} className="flex-1 bg-stone-800 hover:bg-stone-700 text-white text-xs uppercase tracking-widest py-2 rounded-sm">Done</button>
                                </div>
                              </div>
                            )}

                            {isEditing('target', d.key, ex.id) && (
                              <div className="mt-2 bg-white border border-stone-200 rounded-sm p-3 space-y-2">
                                <div className="text-xs text-stone-600 leading-snug">Fill the rep range at or under the RPE cap, then the app tells you to add weight.</div>
                                <div className="flex items-center gap-2">
                                  <input type="number" inputMode="numeric" value={editor.lo} onChange={(e) => setEditor({ ...editor, lo: e.target.value, error: null })} placeholder="Min" aria-label="Minimum reps" className="w-16 bg-white border border-stone-300 rounded-sm px-2 py-2 text-sm font-mono tabular-nums text-stone-900 focus:outline-none focus:border-stone-500" />
                                  <span className="text-xs text-stone-500">to</span>
                                  <input type="number" inputMode="numeric" value={editor.hi} onChange={(e) => setEditor({ ...editor, hi: e.target.value, error: null })} placeholder="Max" aria-label="Maximum reps" className="w-16 bg-white border border-stone-300 rounded-sm px-2 py-2 text-sm font-mono tabular-nums text-stone-900 focus:outline-none focus:border-stone-500" />
                                  <span className="text-xs text-stone-500">reps @ ≤</span>
                                  <input type="number" inputMode="decimal" step="0.5" value={editor.cap} onChange={(e) => setEditor({ ...editor, cap: e.target.value, error: null })} placeholder="RPE" aria-label="RPE cap" className="w-16 bg-white border border-stone-300 rounded-sm px-2 py-2 text-sm font-mono tabular-nums text-stone-900 focus:outline-none focus:border-stone-500" />
                                </div>
                                {editor.error && <div className="text-xs text-red-600">{editor.error}</div>}
                                <div className="flex gap-2">
                                  <button onClick={saveTarget} className="flex-1 bg-stone-800 hover:bg-stone-700 text-white text-xs uppercase tracking-widest py-2 rounded-sm">Save Target</button>
                                  {ex.target && (
                                    <button onClick={() => { mapExercise(d.key, ex.id, (e) => withoutField(e, 'target')); setEditor(null); }} className="text-xs uppercase tracking-widest text-red-600 border border-red-300 rounded-sm px-3">Clear</button>
                                  )}
                                  <button onClick={() => setEditor(null)} className="text-xs uppercase tracking-widest text-stone-500 border border-stone-300 rounded-sm px-3">Cancel</button>
                                </div>
                              </div>
                            )}

                            {isEditing('link', d.key, ex.id) && (
                              <div className="mt-2 bg-white border border-stone-200 rounded-sm p-3 space-y-2">
                                <div className="text-xs text-stone-600 leading-snug">This exercise's weight is always set to a percentage of another lift's first set.</div>
                                <select
                                  value={editor.sourceId}
                                  onChange={(e) => setEditor({ ...editor, sourceId: e.target.value, error: null })}
                                  aria-label="Source exercise"
                                  className="w-full bg-white border border-stone-300 rounded-sm px-2 py-2 text-sm text-stone-900 focus:outline-none focus:border-stone-500"
                                >
                                  <option value="">Choose source exercise...</option>
                                  {linkableSources.map((s) => (
                                    <option key={s.id} value={s.id}>{s.name}{s.dayKey !== d.key ? ' (' + s.dayLabel + ')' : ''}</option>
                                  ))}
                                </select>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    inputMode="numeric"
                                    value={editor.pct}
                                    onChange={(e) => setEditor({ ...editor, pct: e.target.value, error: null })}
                                    aria-label="Percent of source weight"
                                    className="w-20 bg-white border border-stone-300 rounded-sm px-2 py-2 text-sm font-mono tabular-nums text-stone-900 focus:outline-none focus:border-stone-500"
                                  />
                                  <span className="text-xs text-stone-500">% of source weight</span>
                                </div>
                                {editor.error && <div className="text-xs text-red-600">{editor.error}</div>}
                                <div className="flex gap-2">
                                  <button onClick={saveLink} className="flex-1 bg-stone-800 hover:bg-stone-700 text-white text-xs uppercase tracking-widest py-2 rounded-sm">Save Link</button>
                                  {ex.derivedFrom && (
                                    <button onClick={() => { mapExercise(d.key, ex.id, (e) => withoutField(e, 'derivedFrom')); setEditor(null); }} className="text-xs uppercase tracking-widest text-red-600 border border-red-300 rounded-sm px-3">Unlink</button>
                                  )}
                                  <button onClick={() => setEditor(null)} className="text-xs uppercase tracking-widest text-stone-500 border border-stone-300 rounded-sm px-3">Cancel</button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="border border-dashed border-stone-300 rounded-sm p-3">
                    <div className="text-[10px] uppercase tracking-widest text-stone-400 mb-1.5">Add exercise</div>
                    <input
                      value={newExName}
                      onChange={(e) => setNewExName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') addExerciseToDay(d.key); }}
                      placeholder="Exercise name"
                      className={inputCls + ' mb-2'}
                    />
                    <ExerciseAutocomplete
                      query={newExName}
                      known={(library || []).filter((l) => !l.archived)}
                      excludeIds={d.exercises.map((e) => e.id)}
                      onPick={(m) => addExerciseToDay(d.key, m)}
                    />
                    <div className="flex gap-2">
                      <Segmented
                        value={newExType}
                        onChange={setNewExType}
                        options={[{ value: 'strength', label: 'Weight × reps' }, { value: 'conditioning', label: 'Notes' }]}
                      />
                      <button onClick={() => addExerciseToDay(d.key)} disabled={!newExName.trim()} className="flex-1 bg-stone-800 hover:bg-stone-700 disabled:opacity-40 rounded-sm text-xs uppercase tracking-widest text-white font-bold flex items-center justify-center gap-1">
                        <Plus size={14} /> Add
                      </button>
                    </div>
                  </div>

                  <button onClick={() => setConfirm({ kind: 'removeDay', key: d.key, label: d.label || 'this day' })} className="w-full text-xs uppercase tracking-widest text-red-600 border border-red-200 rounded-sm py-2.5 flex items-center justify-center gap-1">
                    <Trash2 size={13} /> Remove this day
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button onClick={addDay} className="mt-3 w-full border border-dashed border-stone-300 rounded-sm py-3 text-xs uppercase tracking-widest text-stone-500 hover:text-stone-800 hover:border-stone-400 flex items-center justify-center gap-1">
        <Plus size={14} /> Add Day
      </button>

      <div className="h-24" />
      <SaveBar>
        <button onClick={save} className="w-full bg-stone-800 hover:bg-stone-700 text-white font-black uppercase tracking-wide py-4 rounded-sm flex items-center justify-center gap-2">
          <Check size={18} /> Save Template
        </button>
      </SaveBar>

      {nameEdit && (
        <div className="fixed inset-0 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)', zIndex: 70 }}>
          <div className="bg-white rounded-sm border border-stone-300 w-full max-w-sm p-4">
            <div className="text-xs uppercase tracking-widest text-stone-500 mb-1">Exercise Name</div>
            <div className="text-[11px] text-stone-400 leading-snug mb-2">Renaming changes it everywhere it's used. Its logged history stays attached.</div>
            <textarea
              value={nameEdit.value}
              onChange={(e) => setNameEdit({ ...nameEdit, value: e.target.value })}
              rows={3}
              autoFocus
              className="w-full bg-stone-50 border border-stone-300 rounded-sm px-3 py-2 text-sm text-stone-900 focus:outline-none focus:border-stone-500 resize-none"
            />
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => {
                  renameExercise(nameEdit.exId, nameEdit.value.replace(/\s+/g, ' ').trim() || 'Exercise');
                  setNameEdit(null);
                }}
                className="flex-1 bg-stone-800 hover:bg-stone-700 text-white text-xs uppercase tracking-widest py-2.5 rounded-sm"
              >
                Save Name
              </button>
              <button onClick={() => setNameEdit(null)} className="text-xs uppercase tracking-widest text-stone-500 border border-stone-300 rounded-sm px-4">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {confirm && confirm.kind === 'removeDay' && (
        <ConfirmModal
          title={'Remove ' + confirm.label + '?'}
          body="The day and its exercise list are removed from this template once you save. Logged workouts are not touched."
          confirmLabel="Remove"
          danger
          onCancel={() => setConfirm(null)}
          onConfirm={() => { removeDay(confirm.key); setConfirm(null); }}
        />
      )}
      {confirm && confirm.kind === 'discard' && (
        <ConfirmModal
          title="Discard your changes?"
          body="You've edited this template but haven't saved."
          confirmLabel="Discard"
          cancelLabel="Keep editing"
          danger
          onCancel={() => setConfirm(null)}
          onConfirm={onBack}
        />
      )}
    </div>
  );
}

function playBeep(ctx) {
  try {
    const t = ctx.currentTime;
    [0, 0.22, 0.44].forEach((off) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.001, t + off);
      g.gain.exponentialRampToValueAtTime(0.5, t + off + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + off + 0.18);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(t + off);
      o.stop(t + off + 0.2);
    });
  } catch (e) {
    // audio unavailable — vibration still fires
  }
}

function RestStarter({ activePreset, running, onStart }) {
  return (
    <div className="border border-stone-200 bg-white rounded-sm p-3 mb-4 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <Timer size={15} className="text-stone-500" />
        <span className="text-xs uppercase tracking-widest text-stone-500">{running ? 'Resting...' : 'Rest Timer'}</span>
      </div>
      <div className="flex items-center justify-end flex-wrap gap-1.5">
        {RT.restPresets.map((sec) => (
          <button
            key={sec}
            onClick={() => onStart(sec)}
            className={'text-xs font-mono tabular-nums rounded-sm px-2.5 py-2 border ' + (activePreset === sec ? 'text-stone-900 border-stone-500 bg-stone-100 font-bold' : 'text-stone-600 border-stone-300 hover:bg-stone-100')}
          >
            {fmtClock(sec)}
          </button>
        ))}
      </div>
    </div>
  );
}

function FloatingTimer({ endsAt, onDismiss, audioCtxRef, low }) {
  const [now, setNow] = useState(Date.now());
  const firedRef = React.useRef(false);

  useEffect(() => {
    firedRef.current = false;
  }, [endsAt]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const remaining = Math.ceil((endsAt - now) / 1000);
  const done = remaining <= 0;

  useEffect(() => {
    if (done && !firedRef.current) {
      firedRef.current = true;
      if (RT.restVibrate) restDoneBuzz();
      if (RT.restSound && audioCtxRef.current) playBeep(audioCtxRef.current);
    }
  }, [done, audioCtxRef]);

  return (
    <button
      onClick={onDismiss}
      // `low`: the workout is minimized, so sit just above the session strip instead of over the page title.
      style={low ? { bottom: 'calc(8.25rem + env(safe-area-inset-bottom))' } : { top: 'calc(env(safe-area-inset-top) + 0.5rem)' }}
      className={'fixed left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full px-4 py-2 shadow-lg border font-mono tabular-nums text-lg font-bold ' +
        (done ? 'bg-green-600 border-green-700 text-white animate-pulse' : 'bg-stone-900 border-stone-700 text-white')}
      aria-label={done ? 'Rest over — dismiss' : 'Stop rest timer'}
    >
      <Timer size={16} />
      {done ? 'GO' : Math.floor(remaining / 60) + ':' + String(remaining % 60).padStart(2, '0')}
      <X size={14} className="opacity-60" />
    </button>
  );
}

function RecordsView({ sessions, unit, nameOf }) {
  const records = buildRecords(sessions, nameOf);
  const [expanded, setExpanded] = useState(null);
  return (
    <div>
      <PageHeader eyebrow="Personal Records" title="Best Lifts" sub="Best set per exercise by estimated 1RM (Epley). Estimates lose accuracy above ~10 reps. Tap one for its trend." />
      {records.length === 0 && <div className="text-sm text-stone-500">Log some strength work and your records will build here.</div>}
      <div className="space-y-2">
        {records.map((r) => {
          const open = expanded === r.name;
          const trend = open ? buildExerciseTrend(sessions, r.name, nameOf).slice(-8) : [];
          const maxE = trend.length ? Math.max(...trend.map((p) => p.e1rm)) : 1;
          return (
            <div key={r.name} className="bg-white border border-stone-200 rounded-sm overflow-hidden">
              <button onClick={() => setExpanded(open ? null : r.name)} className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left">
                <div className="min-w-0">
                  <div className="text-sm font-black uppercase tracking-tight text-stone-900 truncate flex items-center gap-1.5">
                    {r.name} <TrendingUp size={12} className={open ? 'text-stone-700' : 'text-stone-300'} />
                  </div>
                  <div className="text-xs font-mono tabular-nums text-stone-500 mt-0.5">
                    {weightToDisplay(r.weight, unit)}×{r.reps}{r.rpe ? ' @' + r.rpe : ''} · {formatDate(r.date)}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-base font-black font-mono tabular-nums text-stone-900">{weightToDisplay(r.e1rm, unit)}</div>
                  <div className="text-[10px] uppercase tracking-widest text-stone-400">est 1RM ({unitDef(unit).label})</div>
                </div>
              </button>
              {open && (
                <div className="border-t border-stone-200 px-4 py-3">
                  {trend.length < 2 ? (
                    <div className="text-xs text-stone-500">Not enough sessions yet for a trend — keep logging.</div>
                  ) : (
                    <div className="space-y-1.5">
                      {trend.map((p, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <div className="w-14 shrink-0 text-[10px] font-mono tabular-nums text-stone-500">{formatDate(p.date)}</div>
                          <div className="flex-1 bg-stone-100 rounded-sm h-4 relative">
                            <div className="bg-stone-700 h-4 rounded-sm" style={{ width: Math.max(8, Math.round((p.e1rm / maxE) * 100)) + '%' }} />
                          </div>
                          <div className="w-12 shrink-0 text-right text-[11px] font-mono tabular-nums text-stone-700">{weightToDisplay(p.e1rm, unit)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SettingsView({ settings, onChange, onReset, sessions, lastExportAt, onOpenBackup }) {
  const unit = settings.unit;
  const d = unitDef(unit);
  const load = settings.loading[unit];
  const [newEquip, setNewEquip] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);

  // Show the unit switch against a real lift from the log — abstract units are easy
  // to get wrong, "your last squat reads X" is not.
  const sample = (() => {
    for (let i = sessions.length - 1; i >= 0; i--) {
      const ex = (sessions[i].exercises || []).find((e) => e.type === 'strength' && e.sets && e.sets.length);
      if (!ex) continue;
      const s = ex.sets.find((x) => x.weight !== '' && x.weight != null);
      if (s) return { name: ex.name, kg: s.weight };
    }
    return null;
  })();

  function setLoad(patch) {
    const next = { ...load, ...patch };
    if (next.fine > next.step) next.fine = next.step;
    onChange({ loading: { ...settings.loading, [unit]: next } });
  }

  function changePreset(i, delta) {
    const cur = settings.restPresets[i];
    const next = Math.min(1800, Math.max(15, cur + delta));
    if (next === cur || settings.restPresets.includes(next)) return;
    const presets = settings.restPresets.map((p, j) => (j === i ? next : p));
    onChange({ restPresets: presets, restDefault: settings.restDefault === cur ? next : settings.restDefault });
  }

  function removePreset(i) {
    if (settings.restPresets.length <= 1) return;
    onChange({ restPresets: settings.restPresets.filter((_, j) => j !== i) });
  }

  function addPreset() {
    const last = settings.restPresets[settings.restPresets.length - 1];
    let next = Math.min(1800, last + 60);
    while (settings.restPresets.includes(next) && next > 15) next -= 15;
    onChange({ restPresets: [...settings.restPresets, next] });
  }

  function addEquipment() {
    const v = newEquip.replace(/\s+/g, ' ').trim();
    if (!v) return;
    if (!settings.equipmentTypes.some((x) => x.toLowerCase() === v.toLowerCase())) {
      onChange({ equipmentTypes: [...settings.equipmentTypes, v] });
    }
    setNewEquip('');
  }

  const stepList = unit === 'kg' ? [0.5, 1, 1.25, 2, 2.5, 5, 10] : [1, 2.5, 5, 10, 20];
  function nudge(list, cur, dir) {
    // Move to the neighbouring value in a list of sensible plate jumps.
    if (dir > 0) return list.find((x) => x > cur + 1e-9) || cur;
    const lower = list.filter((x) => x < cur - 1e-9);
    return lower.length ? lower[lower.length - 1] : cur;
  }
  function listStepper(value, list, onPick, label) {
    return (
      <div className="flex items-center shrink-0 border border-stone-300 rounded-sm overflow-hidden" role="group" aria-label={label}>
        <button onClick={() => onPick(nudge(list, value, -1))} disabled={value <= list[0]} className="w-10 h-10 flex items-center justify-center text-stone-700 bg-stone-50 active:bg-stone-200 disabled:opacity-30" aria-label={'Decrease ' + label}>
          <Minus size={15} />
        </button>
        <div className="min-w-[3.5rem] px-1 text-center text-sm font-mono tabular-nums font-bold text-stone-900">{trimNum(value)}{d.label}</div>
        <button onClick={() => onPick(nudge(list, value, 1))} disabled={value >= list[list.length - 1]} className="w-10 h-10 flex items-center justify-center text-stone-700 bg-stone-50 active:bg-stone-200 disabled:opacity-30" aria-label={'Increase ' + label}>
          <Plus size={15} />
        </button>
      </div>
    );
  }

  return (
    <div>
      <PageHeader eyebrow="Preferences" title="Settings" sub="Changes save as you make them." />

      <Card title="Units & loading" icon={Scale}>
        <Row label="Weight unit" hint={sample ? sample.name + ' reads ' + formatWeight(sample.kg, unit) : 'Stored weights never change — only how they are shown.'}>
          <Segmented value={unit} onChange={(u) => onChange({ unit: u })} options={[{ value: 'kg', label: 'kg' }, { value: 'lb', label: 'lb' }]} />
        </Row>
        <Row label="Weight jump" hint="One progression step. Suggested and linked weights round to this.">
          {listStepper(load.step, stepList, (v) => setLoad({ step: v }), 'weight jump')}
        </Row>
        <Row label="Small step" hint={'The fine button on the keypad bar: ' + d.stepper.map((s) => (s > 0 ? '+' + trimNum(s) : trimNum(s))).join('  ')}>
          {listStepper(load.fine, stepList.filter((x) => x <= load.step), (v) => setLoad({ fine: v }), 'small step')}
        </Row>
        <Row label="Empty bar" hint="Where the warm-up ramp starts.">
          <NumStepper value={load.bar} onChange={(v) => setLoad({ bar: v })} min={0} max={unit === 'kg' ? 30 : 65} step={unit === 'kg' ? 2.5 : 5} format={(v) => trimNum(v) + d.label} label="bar weight" />
        </Row>
      </Card>

      <Card title="Sets" icon={Layers}>
        <Row label="Default sets" hint="The global default. A template can set its own, and so can an exercise.">
          <NumStepper value={settings.defaultSets} onChange={(v) => onChange({ defaultSets: v })} min={1} max={10} label="default sets" />
        </Row>
        <Row
          stacked
          label="When a workout starts"
          hint={settings.setCountSource === 'history'
            ? 'Each exercise opens with the number of sets you logged last time. The default is used when there is no history.'
            : 'Each exercise always opens with its default number of sets, whatever you did last time.'}
        >
          <Segmented full value={settings.setCountSource} onChange={(v) => onChange({ setCountSource: v })} options={[{ value: 'history', label: 'Match last time' }, { value: 'defaults', label: 'Use defaults' }]} />
        </Row>
      </Card>

      <Card title="Rest timer" icon={Timer}>
        <div className="space-y-2">
          {settings.restPresets.map((p, i) => {
            const isDefault = settings.restDefault === p;
            return (
              <div key={p} className="flex items-center gap-2">
                <NumStepper value={p} onChange={(v) => changePreset(i, v - p)} min={15} max={1800} step={15} format={fmtClock} label={'rest preset ' + (i + 1)} />
                <button
                  onClick={() => onChange({ restDefault: p })}
                  aria-pressed={isDefault}
                  className={'flex-1 h-10 rounded-sm border text-[11px] uppercase tracking-widest ' + (isDefault ? 'bg-stone-800 border-stone-800 text-white font-bold' : 'bg-white border-stone-300 text-stone-500')}
                >
                  {isDefault ? 'Default' : 'Make default'}
                </button>
                <button onClick={() => removePreset(i)} disabled={settings.restPresets.length <= 1} className="w-10 h-10 flex items-center justify-center text-stone-400 hover:text-red-600 disabled:opacity-20" aria-label={'Remove preset ' + fmtClock(p)}>
                  <X size={16} />
                </button>
              </div>
            );
          })}
        </div>
        {settings.restPresets.length < 5 && (
          <button onClick={addPreset} className="mt-2 w-full border border-dashed border-stone-300 rounded-sm py-2.5 text-xs uppercase tracking-widest text-stone-500 flex items-center justify-center gap-1">
            <Plus size={14} /> Add preset
          </button>
        )}
        <div className="mt-3">
          <Row label="Start automatically" hint="Starts the default rest as soon as you enter an RPE.">
            <Toggle checked={settings.restAutoStart} onChange={(v) => onChange({ restAutoStart: v })} label="Start rest timer automatically" />
          </Row>
          <Row label="Beep when rest is over" hint={hrAvailable() ? 'The beep inside the app. The lock-screen alert follows your iPhone notification settings.' : null}>
            <Toggle checked={settings.restSound} onChange={(v) => onChange({ restSound: v })} label="Beep when rest is over" />
          </Row>
          <Row label="Vibrate when rest is over" hint={hrAvailable() ? 'A triple tap while the app is open.' : 'Only on devices that support it.'}>
            <Toggle checked={settings.restVibrate} onChange={(v) => onChange({ restVibrate: v })} label="Vibrate when rest is over" />
          </Row>
        </div>
      </Card>

      <Card title="Progression" icon={TrendingUp}>
        <Row label="RPE ceiling" hint="Used for suggestions when an exercise has no rep target of its own.">
          <NumStepper value={settings.rpeCap} onChange={(v) => onChange({ rpeCap: v })} min={5} max={10} step={0.5} label="RPE ceiling" />
        </Row>
        <Row label="Deload weight" hint="Percent of your normal first-set weight.">
          <NumStepper value={settings.deloadPct} onChange={(v) => onChange({ deloadPct: v })} min={30} max={95} step={5} format={(v) => v + '%'} label="deload percent" />
        </Row>
        <Row label="Deload sets" hint="Most sets per exercise on a deload day.">
          <NumStepper value={settings.deloadSets} onChange={(v) => onChange({ deloadSets: v })} min={1} max={6} label="deload sets" />
        </Row>
      </Card>

      <Card title="Workout screen" icon={Dumbbell}>
        <Row label="Fold finished exercises" hint="Collapse an exercise once its last set has an RPE.">
          <Toggle checked={settings.autoCollapse} onChange={(v) => onChange({ autoCollapse: v })} label="Fold finished exercises" />
        </Row>
        <Row label="Warm-up ramp button">
          <Toggle checked={settings.showRamp} onChange={(v) => onChange({ showRamp: v })} label="Show warm-up ramp button" />
        </Row>
        <Row label="Estimated 1RM line">
          <Toggle checked={settings.showE1rm} onChange={(v) => onChange({ showE1rm: v })} label="Show estimated 1RM" />
        </Row>
      </Card>

      <Card title="Week" icon={CalendarIcon}>
        <Row label="Week starts on">
          <Segmented value={settings.weekStart} onChange={(v) => onChange({ weekStart: v })} options={[{ value: 0, label: 'Sunday' }, { value: 1, label: 'Monday' }]} />
        </Row>
        <Row stacked label="Rest days" hint="Shown as a rest day on the Today screen when no session is scheduled.">
          <WeekdayChips value={settings.restDays} onChange={(v) => onChange({ restDays: v })} />
        </Row>
        <Row label="History page size" hint="Sessions per page in the History list.">
          <Segmented value={settings.historyPageSize} onChange={(v) => onChange({ historyPageSize: v })} options={[{ value: 5, label: '5' }, { value: 10, label: '10' }, { value: 20, label: '20' }]} />
        </Row>
      </Card>

      <Card title="Equipment types" icon={BookOpen}>
        <div className="text-[11px] text-stone-400 leading-snug mb-2">The choices offered when you edit an exercise.</div>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {settings.equipmentTypes.map((eq) => (
            <span key={eq} className="flex items-center gap-1 text-xs text-stone-700 border border-stone-300 rounded-sm pl-2.5 bg-stone-50">
              {eq}
              <button onClick={() => onChange({ equipmentTypes: settings.equipmentTypes.filter((x) => x !== eq) })} className="p-2 text-stone-400 hover:text-red-600" aria-label={'Remove ' + eq}>
                <X size={13} />
              </button>
            </span>
          ))}
          {settings.equipmentTypes.length === 0 && <span className="text-xs text-stone-500">No types yet.</span>}
        </div>
        <div className="flex gap-2">
          <input
            value={newEquip}
            onChange={(e) => setNewEquip(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addEquipment(); }}
            placeholder="Add a type (e.g. Trap bar)"
            className="flex-1 min-w-0 bg-stone-50 border border-stone-300 rounded-sm px-3 py-2.5 text-sm text-stone-900 focus:outline-none focus:border-stone-500"
          />
          <button onClick={addEquipment} disabled={!newEquip.trim()} className="shrink-0 bg-stone-800 disabled:opacity-40 rounded-sm px-4 text-white" aria-label="Add equipment type">
            <Plus size={16} />
          </button>
        </div>
      </Card>

      <Card title="Backup" icon={Download}>
        <Row label="Remind me to back up" hint={lastExportAt ? 'Last backup ' + formatDateFull(lastExportAt) + '.' : 'No backup made yet.'}>
          <Segmented
            value={settings.backupReminderDays}
            onChange={(v) => onChange({ backupReminderDays: v })}
            options={[{ value: 0, label: 'Off' }, { value: 7, label: '7d' }, { value: 14, label: '14d' }, { value: 30, label: '30d' }]}
          />
        </Row>
        <button onClick={onOpenBackup} className="mt-3 w-full bg-stone-800 hover:bg-stone-700 text-white text-xs uppercase tracking-widest font-bold py-3 rounded-sm flex items-center justify-center gap-2">
          <Download size={14} /> Export or import data
        </button>
      </Card>

      <button onClick={() => setConfirmReset(true)} className="w-full text-xs uppercase tracking-widest text-stone-500 border border-stone-300 rounded-sm py-3 flex items-center justify-center gap-1.5">
        <RotateCcw size={13} /> Reset settings to defaults
      </button>
      <div className="text-center text-[10px] uppercase tracking-widest text-stone-400 mt-4">Yawl {APP_VERSION}</div>
      <div className="h-8" />

      {confirmReset && (
        <ConfirmModal
          title="Reset all settings?"
          body="Every setting on this screen goes back to its default. Your workouts, templates and exercises are not touched."
          confirmLabel="Reset"
          danger
          onCancel={() => setConfirmReset(false)}
          onConfirm={() => { onReset(); setConfirmReset(false); }}
        />
      )}
    </div>
  );
}

/* ---------- exercise library ---------- */

function ExercisesView({ library, usage, onOpen, onAdd, onRestore }) {
  const [query, setQuery] = useState('');
  const [equip, setEquip] = useState('all');
  const [showRemoved, setShowRemoved] = useState(false);

  const active = library.filter((e) => !e.archived);
  const removed = library.filter((e) => e.archived);
  const equipInUse = Array.from(new Set(active.map((e) => e.equipment).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  const hasUnset = active.some((e) => !e.equipment);
  const q = query.trim().toLowerCase();
  const shown = active
    .filter((e) => (equip === 'all' ? true : equip === 'none' ? !e.equipment : e.equipment === equip))
    .filter((e) => !q || e.name.toLowerCase().includes(q) || (e.notes || '').toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name));

  const chip = (key, label) => (
    <button
      key={key}
      onClick={() => setEquip(key)}
      aria-pressed={equip === key}
      className={'shrink-0 text-[11px] uppercase tracking-widest rounded-sm px-2.5 py-2 border ' + (equip === key ? 'bg-stone-800 border-stone-800 text-white font-bold' : 'bg-white border-stone-300 text-stone-500')}
    >
      {label}
    </button>
  );

  return (
    <div>
      <PageHeader eyebrow="Library" title="Exercises" sub="Every exercise your templates can use. Edit one here and it changes everywhere." />

      <button onClick={onAdd} className="w-full bg-stone-800 hover:bg-stone-700 text-white text-xs uppercase tracking-widest font-bold py-3.5 rounded-sm flex items-center justify-center gap-1 mb-3">
        <Plus size={15} /> New exercise
      </button>

      <div className="relative mb-2">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={'Search ' + active.length + ' exercises'}
          aria-label="Search exercises"
          className="w-full bg-white border border-stone-300 rounded-sm pl-9 pr-3 py-2.5 text-sm text-stone-900 focus:outline-none focus:border-stone-500"
        />
      </div>

      {(equipInUse.length > 0) && (
        <div className="flex gap-1.5 overflow-x-auto pb-2 mb-2 -mx-4 px-4">
          {chip('all', 'All')}
          {equipInUse.map((eq) => chip(eq, eq))}
          {hasUnset && chip('none', 'No equipment set')}
        </div>
      )}

      {shown.length === 0 && (
        <div className="text-sm text-stone-500 py-6 text-center">
          {active.length === 0 ? 'No exercises yet. Add your first one above.' : 'Nothing matches that search.'}
        </div>
      )}

      <div className="space-y-2">
        {shown.map((e) => {
          const u = usage[e.id] || { days: [], count: 0, lastDate: null };
          const currentDays = u.days.filter((x) => x.current).map((x) => x.dayLabel);
          const meta = [];
          if (e.equipment) meta.push(e.equipment);
          if (e.type !== 'strength') meta.push('Notes only');
          if (e.defaultSets) meta.push(e.defaultSets + ' sets');
          if (e.hold) meta.push('On hold');
          return (
            <button key={e.id} onClick={() => onOpen(e.id)} className="w-full text-left bg-white border border-stone-200 rounded-sm px-4 py-3 flex items-center gap-3 active:bg-stone-50">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-black uppercase tracking-tight text-stone-900 leading-snug" style={{ overflowWrap: 'anywhere' }}>{e.name}</div>
                {meta.length > 0 && <div className="text-xs text-stone-500 mt-0.5">{meta.join(' · ')}</div>}
                <div className="text-[11px] text-stone-400 mt-0.5 font-mono tabular-nums">
                  {u.count ? u.count + '× logged · last ' + formatDate(u.lastDate) : 'Never logged'}
                  {currentDays.length ? ' · ' + currentDays.join(', ') : u.days.length ? ' · ' + u.days[0].templateName : ''}
                </div>
                {e.notes && <div className="text-xs text-stone-500 italic mt-1 truncate">{e.notes}</div>}
              </div>
              <ChevronRight size={17} className="text-stone-300 shrink-0" />
            </button>
          );
        })}
      </div>

      {removed.length > 0 && (
        <div className="mt-6">
          <button onClick={() => setShowRemoved(!showRemoved)} className="w-full flex items-center justify-between text-xs uppercase tracking-widest text-stone-500 py-2" aria-expanded={showRemoved}>
            <span className="flex items-center gap-1.5"><Archive size={13} /> Removed ({removed.length})</span>
            {showRemoved ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
          {showRemoved && (
            <div className="space-y-2 mt-1">
              <div className="text-[11px] text-stone-400 leading-snug">These were removed but have logged history, so the history is kept. Restore one to use it again.</div>
              {removed.sort((a, b) => a.name.localeCompare(b.name)).map((e) => (
                <div key={e.id} className="bg-white border border-stone-200 rounded-sm px-4 py-2.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm text-stone-600 truncate">{e.name}</div>
                    <div className="text-[11px] text-stone-400 font-mono tabular-nums">{(usage[e.id] || {}).count || 0}× logged</div>
                  </div>
                  <button onClick={() => onRestore(e.id)} className="shrink-0 text-xs uppercase tracking-widest text-stone-600 border border-stone-300 rounded-sm px-3 py-2">Restore</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ExerciseEditView({ entry, usage, library, settings, unit, onSave, onDelete, onBack }) {
  const isNew = !entry;
  const u = usage || { days: [], count: 0, lastDate: null, best: null, recent: [] };
  const [name, setName] = useState(entry ? entry.name : '');
  const [type, setType] = useState(entry ? entry.type : 'strength');
  const [equipment, setEquipment] = useState(entry ? entry.equipment || '' : '');
  const [notes, setNotes] = useState(entry ? entry.notes || '' : '');
  const [defaultSets, setDefaultSets] = useState(entry && entry.defaultSets ? entry.defaultSets : null);
  const [restSec, setRestSec] = useState(entry && entry.restSec ? entry.restSec : null);
  const [hold, setHold] = useState(!!(entry && entry.hold));
  const [error, setError] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const snapshot = JSON.stringify({ name, type, equipment, notes, defaultSets, restSec, hold });
  const initial = useRef(snapshot);
  const dirty = snapshot !== initial.current;

  const equipOptions = settings.equipmentTypes.slice();
  if (equipment && !equipOptions.includes(equipment)) equipOptions.push(equipment);
  const typeLocked = !isNew && u.count > 0;

  function save() {
    const clean = name.replace(/\s+/g, ' ').trim();
    if (!clean) {
      setError('Give the exercise a name.');
      return;
    }
    const out = { id: entry ? entry.id : null, name: clean, type, equipment, notes: notes.trim() };
    if (type === 'strength') {
      if (defaultSets) out.defaultSets = defaultSets;
      if (restSec) out.restSec = restSec;
      if (hold) out.hold = true;
    }
    onSave(out);
  }

  const twin = name.trim()
    ? library.find((l) => !l.archived && (!entry || l.id !== entry.id) && l.name.toLowerCase() === name.replace(/\s+/g, ' ').trim().toLowerCase())
    : null;
  const tplDays = u.days.length;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <button onClick={() => (dirty ? setConfirm('discard') : onBack())} className="flex items-center gap-1 text-stone-500 text-sm py-2">
          <ChevronLeft size={18} /> Exercises
        </button>
        {!isNew && (
          <button onClick={() => setConfirm('delete')} className="flex items-center gap-1 text-xs uppercase tracking-widest text-stone-500 hover:text-red-600 border border-stone-300 rounded-sm px-2.5 py-2">
            <Trash2 size={13} /> Remove
          </button>
        )}
      </div>

      <div className="mb-4">
        <div className="text-xs uppercase tracking-widest text-stone-500 mb-1">{isNew ? 'New Exercise' : 'Edit Exercise'}</div>
        <input
          value={name}
          onChange={(e) => { setName(e.target.value); setError(null); }}
          placeholder="Exercise name"
          aria-label="Exercise name"
          autoFocus={isNew}
          className="w-full bg-transparent text-2xl font-black uppercase tracking-tight text-stone-900 border-b border-stone-300 focus:outline-none focus:border-stone-500 pb-1 placeholder:text-stone-300"
        />
        {error && <div className="text-xs text-red-600 mt-1.5">{error}</div>}
        {twin && <div className="text-[11px] text-amber-800 mt-1.5 leading-snug">There is already an exercise called “{twin.name}”. Two with the same name keep separate histories.</div>}
        {!isNew && <div className="text-[11px] text-stone-400 mt-1.5 leading-snug">Renaming changes it in every template. Logged history stays attached.</div>}
      </div>

      <Card title="Type">
        <Segmented
          full
          value={type}
          onChange={setType}
          options={[
            { value: 'strength', label: 'Weight × reps', disabled: typeLocked },
            { value: 'conditioning', label: 'Notes only', disabled: typeLocked },
          ]}
        />
        <div className="text-[11px] text-stone-400 leading-snug mt-2">
          {typeLocked
            ? 'Locked because this exercise already has logged history.'
            : type === 'strength' ? 'Logged as sets of weight, reps and RPE.' : 'Logged as a free-text note — intervals, distance, time.'}
        </div>
      </Card>

      <Card title="Equipment">
        <div className="flex flex-wrap gap-1.5">
          {equipOptions.map((eq) => (
            <button
              key={eq}
              onClick={() => setEquipment(equipment === eq ? '' : eq)}
              aria-pressed={equipment === eq}
              className={'text-xs rounded-sm px-3 py-2 border ' + (equipment === eq ? 'bg-stone-800 border-stone-800 text-white font-bold' : 'bg-stone-50 border-stone-300 text-stone-600')}
            >
              {eq}
            </button>
          ))}
        </div>
        <div className="text-[11px] text-stone-400 leading-snug mt-2">Tap again to clear. Add or remove types in Settings.</div>
      </Card>

      <Card title="Notes">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Setup, cues, machine settings — shown on the exercise while you log."
          rows={3}
          className="w-full bg-stone-50 border border-stone-300 rounded-sm px-3 py-2 text-sm text-stone-900 focus:outline-none focus:border-stone-500 resize-none"
        />
      </Card>

      {type === 'strength' && (
        <Card title="Logging">
          <Row label="Default sets" hint={defaultSets ? 'This exercise starts with ' + defaultSets + ' sets in every template.' : 'Following the template (or the global default of ' + settings.defaultSets + ').'}>
            {defaultSets ? (
              <div className="flex items-center gap-2">
                <NumStepper value={defaultSets} onChange={setDefaultSets} min={1} max={10} label="default sets" />
                <button onClick={() => setDefaultSets(null)} className="p-2 text-stone-400 hover:text-red-600" aria-label="Clear custom sets"><X size={16} /></button>
              </div>
            ) : (
              <button onClick={() => setDefaultSets(settings.defaultSets)} className="text-xs uppercase tracking-widest text-stone-600 border border-stone-300 rounded-sm px-3 py-2.5">Customize</button>
            )}
          </Row>
          <Row label="Rest time" hint={restSec ? 'The timer uses ' + fmtClock(restSec) + ' after each set of this exercise.' : 'Following the default rest (' + fmtClock(settings.restDefault) + ').'}>
            {restSec ? (
              <div className="flex items-center gap-2">
                <NumStepper value={restSec} onChange={setRestSec} min={15} max={1800} step={15} format={fmtClock} label="rest time" />
                <button onClick={() => setRestSec(null)} className="p-2 text-stone-400 hover:text-red-600" aria-label="Clear custom rest"><X size={16} /></button>
              </div>
            ) : (
              <button onClick={() => setRestSec(settings.restDefault)} className="text-xs uppercase tracking-widest text-stone-600 border border-stone-300 rounded-sm px-3 py-2.5">Customize</button>
            )}
          </Row>
          <Row label="Hold progression" hint="Stops the app suggesting more weight — it tells you to repeat your last numbers.">
            <Toggle checked={hold} onChange={setHold} label="Hold progression" />
          </Row>
        </Card>
      )}

      {!isNew && (
        <Card title="History" icon={HistoryIcon}>
          {u.count === 0 ? (
            <div className="text-xs text-stone-500">Not logged yet.</div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div>
                  <div className="text-base font-black font-mono tabular-nums text-stone-900">{u.count}</div>
                  <div className="text-[10px] uppercase tracking-widest text-stone-400">Sessions</div>
                </div>
                <div>
                  <div className="text-base font-black font-mono tabular-nums text-stone-900">{formatDate(u.lastDate)}</div>
                  <div className="text-[10px] uppercase tracking-widest text-stone-400">Last done</div>
                </div>
                {u.best && (
                  <div>
                    <div className="text-base font-black font-mono tabular-nums text-stone-900">{formatWeight(u.best.e1rm, unit)}</div>
                    <div className="text-[10px] uppercase tracking-widest text-stone-400">Best est 1RM</div>
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                {u.recent.map((r, i) => (
                  <div key={i} className="flex gap-2 text-xs font-mono tabular-nums">
                    <div className="w-14 shrink-0 text-stone-400">{formatDate(r.date)}</div>
                    <div className="min-w-0 text-stone-700" style={{ overflowWrap: 'anywhere' }}>
                      {r.sets ? r.sets.map((s) => formatSet(s, unit)).join('  ') : r.notes}{r.deload ? '  (deload)' : ''}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          {tplDays > 0 && (
            <div className="text-[11px] text-stone-400 leading-snug mt-3 pt-3 border-t border-stone-100">
              Used in: {u.days.map((x) => x.templateName + ' — ' + x.dayLabel).join(' · ')}
            </div>
          )}
        </Card>
      )}

      <div className="h-24" />
      <SaveBar>
        <button onClick={save} className="w-full bg-stone-800 hover:bg-stone-700 text-white font-black uppercase tracking-wide py-4 rounded-sm flex items-center justify-center gap-2">
          <Check size={18} /> {isNew ? 'Add Exercise' : 'Save Exercise'}
        </button>
      </SaveBar>

      {confirm === 'delete' && (
        <ConfirmModal
          title={'Remove ' + entry.name + '?'}
          body={
            (tplDays ? 'It will be taken out of ' + tplDays + ' template day' + (tplDays === 1 ? '' : 's') + '. ' : '') +
            (u.count
              ? 'The ' + u.count + ' logged session' + (u.count === 1 ? '' : 's') + ' with it stay in your history and PRs, and you can restore the exercise later from the Removed list.'
              : 'It has no logged history, so it is deleted for good.')
          }
          confirmLabel="Remove"
          danger
          onCancel={() => setConfirm(null)}
          onConfirm={() => onDelete(entry.id)}
        />
      )}
      {confirm === 'discard' && (
        <ConfirmModal
          title="Discard your changes?"
          body="You've edited this exercise but haven't saved."
          confirmLabel="Discard"
          cancelLabel="Keep editing"
          danger
          onCancel={() => setConfirm(null)}
          onConfirm={onBack}
        />
      )}
    </div>
  );
}

const TABS = [
  { key: 'home', label: 'Today', icon: Dumbbell },
  { key: 'templates', label: 'Templates', icon: Layers },
  { key: 'exercises', label: 'Exercises', icon: BookOpen },
  { key: 'history', label: 'History', icon: HistoryIcon },
  { key: 'records', label: 'PRs', icon: Trophy },
];

/** The strip above the tab bar while a workout is minimized: tap to go back to it. */
function SessionBar({ draft, label, colorKey, onResume }) {
  const colors = COLOR_MAP[colorKey] || COLOR_MAP.blue;
  let total = 0;
  let done = 0;
  draft.exercises.forEach((ex) => {
    if (ex.type !== 'strength' || !ex.sets) return;
    total += ex.sets.length;
    done += ex.sets.filter((x) => x.rpe !== '' && x.rpe != null).length;
  });
  return (
    <button onClick={onResume} className="w-full flex items-stretch text-left bg-stone-900 text-white active:bg-stone-800" aria-label={'Resume ' + label + ' workout'}>
      <div className={'w-1.5 shrink-0 ' + colors.stripe} />
      <div className="flex-1 min-w-0 max-w-md mx-auto flex items-center gap-3 px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-widest text-stone-400">Workout in progress</div>
          <div className="text-sm font-black uppercase tracking-tight truncate">{label}</div>
        </div>
        <div className="shrink-0 text-right text-xs font-mono tabular-nums text-stone-300">
          <div className="flex items-center justify-end gap-1"><Clock size={11} /> <SessionTimer startedAt={draft.startedAt} /></div>
          {total > 0 && <div>{done}/{total} sets</div>}
        </div>
        <div className="shrink-0 flex items-center gap-0.5 text-[11px] uppercase tracking-widest font-bold">
          Resume <ChevronUp size={16} />
        </div>
      </div>
    </button>
  );
}

function BottomTabs({ active, onSelect, above }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200" style={{ paddingBottom: 'env(safe-area-inset-bottom)', zIndex: 40 }}>
      {above}
      <div className="max-w-md mx-auto flex">
        {TABS.map((t) => {
          const Icon = t.icon;
          const isActive = active === t.key;
          return (
            <button
              key={t.key}
              onClick={() => onSelect(t.key)}
              aria-current={isActive ? 'page' : undefined}
              className={'flex-1 min-w-0 flex flex-col items-center gap-0.5 pt-2.5 pb-3 ' + (isActive ? 'text-stone-900' : 'text-stone-400')}
            >
              <Icon size={19} strokeWidth={isActive ? 2.5 : 2} />
              <span className={'text-[10px] uppercase tracking-wider ' + (isActive ? 'font-bold' : '')}>{t.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-stone-500">
      <Loader2 className="animate-spin mb-3" size={22} />
      <div className="text-xs uppercase tracking-widest">Loading log</div>
    </div>
  );
}

/**
 * Weight field. Stores kg, shows the active unit.
 *
 * It holds the raw typed text while focused so conversion never fights the
 * keyboard — typing "22" on the way to "225" must not redisplay as "48.5".
 * The text buffer is dropped as soon as the value changes from outside
 * (the stepper bar), so external adjustments still show through.
 */
function WeightInput({ valueKg, placeholderKg, unit, onChange, onFocus, onBlur, fillFromPlaceholder, className }) {
  const [text, setText] = useState(null);
  const emitted = useRef(null);

  useEffect(() => {
    if (emitted.current !== null && valueKg === emitted.current) return;
    setText(null);
  }, [valueKg]);

  function emit(displayValue) {
    const kg = displayToWeight(displayValue, unit);
    emitted.current = kg;
    onChange(kg);
  }

  const shown = text !== null ? text : weightToDisplay(valueKg, unit);
  const placeholder = placeholderKg != null && placeholderKg !== '' ? weightToDisplay(placeholderKg, unit) : '';

  return (
    <input
      type="number"
      inputMode="decimal"
      value={shown}
      placeholder={placeholder}
      onFocus={(e) => {
        if (fillFromPlaceholder && (valueKg === '' || valueKg == null) && placeholder !== '') {
          setText(placeholder);
          emit(placeholder);
          const el = e.target;
          requestAnimationFrame(() => { try { el.select(); } catch (err) {} });
        }
        if (onFocus) onFocus();
      }}
      onChange={(e) => {
        setText(e.target.value);
        emit(e.target.value);
      }}
      onBlur={() => {
        setText(null);
        if (onBlur) onBlur();
      }}
      className={className}
    />
  );
}

function ExerciseCard({ exercise, lastData, suggestion, editMode, unit, info, displayName, onUpdateSet, onAddSet, onRemoveSet, onUpdateNotes, onRemoveExercise, onMoveExercise, onToggleCollapse, onRpeBlur, onFocusField, onBlurField }) {
  const collapsible = typeof onToggleCollapse === 'function';
  const isCollapsed = collapsible && exercise.collapsed;
  const rampWeight = exercise.sets && exercise.sets[0] && exercise.sets[0].weight !== ''
    ? exercise.sets[0].weight
    : (lastData && lastData.sets && lastData.sets[0] && lastData.sets[0].weight != null ? String(lastData.sets[0].weight) : '');
  const [showRamp, setShowRamp] = useState(false);
  return (
    <div className="bg-white border border-stone-200 rounded-sm p-4 mb-3">
      <div className={'flex items-start justify-between gap-2 ' + (isCollapsed ? '' : 'mb-2')}>
        <button
          onClick={() => collapsible && onToggleCollapse(exercise.exerciseId)}
          className="flex items-start gap-1.5 text-left min-w-0"
          disabled={!collapsible}
        >
          <h3 className="font-black uppercase tracking-tight text-stone-900 text-base leading-tight" style={{ overflowWrap: 'anywhere' }}>{displayName || exercise.name}</h3>
          {collapsible && (isCollapsed ? <ChevronDown size={15} className="text-stone-400 shrink-0 mt-0.5" /> : <ChevronUp size={15} className="text-stone-300 shrink-0 mt-0.5" />)}
        </button>
        {editMode && (
          <div className="flex items-center gap-0.5 shrink-0">
            <button onClick={() => onMoveExercise(exercise.exerciseId, 'up')} className="text-stone-400 hover:text-stone-700 p-1" aria-label="Move up">
              <ChevronUp size={17} />
            </button>
            <button onClick={() => onMoveExercise(exercise.exerciseId, 'down')} className="text-stone-400 hover:text-stone-700 p-1" aria-label="Move down">
              <ChevronDown size={17} />
            </button>
            <button onClick={() => onRemoveExercise(exercise.exerciseId)} className="text-stone-500 hover:text-red-600 p-1" aria-label="Remove exercise">
              <X size={18} />
            </button>
          </div>
        )}
      </div>

      {!isCollapsed && info && (info.equipment || info.notes || info.hold) && (
        <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
          {info.equipment && <span className="text-[10px] uppercase tracking-widest text-stone-500 border border-stone-200 rounded-sm px-1.5 py-0.5">{info.equipment}</span>}
          {info.hold && <span className="text-[10px] uppercase tracking-widest text-stone-500 border border-stone-200 rounded-sm px-1.5 py-0.5 flex items-center gap-1"><Lock size={9} /> Hold</span>}
          {info.notes && <span className="text-xs text-stone-500 italic leading-snug" style={{ overflowWrap: 'anywhere' }}>{info.notes}</span>}
        </div>
      )}

      {isCollapsed ? (
        <div className="text-xs font-mono tabular-nums text-stone-500 mt-1">
          {exercise.type === 'strength'
            ? exercise.sets.filter((s) => s.weight !== '' || s.reps !== '').map((s) => formatSet(s, unit)).join('  ·  ') || 'No sets entered'
            : (exercise.notes || 'No notes')}
        </div>
      ) : exercise.type === 'strength' ? (
        <>
          <div className="flex items-center justify-between mb-3 gap-2">
            <div className="text-xs text-stone-500 font-mono tabular-nums min-w-0 truncate">
              {lastData && lastData.sets && lastData.sets.length ? 'Last: ' + lastData.sets.map((s) => formatSet(s, unit)).join('  ') : 'No previous data logged'}
            </div>
            {RT.showRamp && rampWeight !== '' && (
              <button onClick={() => setShowRamp(!showRamp)} className={'shrink-0 flex items-center gap-1 text-[10px] uppercase tracking-widest rounded-sm px-1.5 py-0.5 border ' + (showRamp ? 'text-orange-700 border-orange-300 bg-orange-50' : 'text-stone-400 border-stone-200')}>
                <Flame size={11} /> Ramp
              </button>
            )}
          </div>
          {suggestion && (
            <div className={'text-[11px] mb-2 flex items-center gap-1 ' + (suggestion.kind === 'up' ? 'text-emerald-700' : suggestion.kind === 'deload' ? 'text-sky-700' : 'text-stone-500')}>
              <TrendingUp size={11} /> Target: {suggestion.text}
            </div>
          )}
          {RT.showRamp && showRamp && rampWeight !== '' && (
            <div className="bg-orange-50 border border-orange-200 rounded-sm px-3 py-2 mb-3">
              <div className="text-[10px] uppercase tracking-widest text-orange-700 font-bold mb-1">Warm-up to {formatWeight(rampWeight, unit)}</div>
              <div className="text-xs font-mono tabular-nums text-stone-700 space-y-0.5">
                {(buildRamp(rampWeight, unit) || []).map((step, i) => (
                  <div key={i} className="flex justify-between"><span>{step.label}</span><span className="text-stone-400">{step.detail}</span></div>
                ))}
              </div>
            </div>
          )}
          <div style={SET_GRID_STYLE} className="mb-1.5">
            <div className="text-xs uppercase tracking-wide text-stone-500 pl-2.5">Weight ({unitDef(unit).label})</div>
            <div className="text-xs uppercase tracking-wide text-stone-500 pl-2.5">Reps</div>
            <div className="text-xs uppercase tracking-wide text-stone-500 pl-2.5">RPE</div>
            <div />
          </div>
          <div className="space-y-2">
            {exercise.sets.map((set, i) => (
              <div key={i} style={SET_ROW_STYLE}>
                <WeightInput
                  valueKg={set.weight}
                  placeholderKg={lastData && lastData.sets && lastData.sets[i] && lastData.sets[i].weight != null ? String(lastData.sets[i].weight) : ''}
                  unit={unit}
                  fillFromPlaceholder
                  onChange={(kg) => onUpdateSet(exercise.exerciseId, i, 'weight', kg)}
                  onFocus={() => { if (onFocusField) onFocusField(exercise.exerciseId, i, 'weight'); }}
                  onBlur={() => onBlurField && onBlurField()}
                  className="w-full bg-stone-50 border border-stone-300 rounded-sm px-2.5 py-2.5 text-base font-mono tabular-nums text-stone-900 focus:outline-none focus:border-stone-400"
                />
                <input
                  type="number"
                  inputMode="numeric"
                  value={set.reps}
                  placeholder={lastData && lastData.sets && lastData.sets[i] && lastData.sets[i].reps != null ? String(lastData.sets[i].reps) : ''}
                  onFocus={(e) => {
                    const ph = lastData && lastData.sets && lastData.sets[i] && lastData.sets[i].reps != null ? String(lastData.sets[i].reps) : '';
                    if (set.reps === '' && ph !== '') {
                      onUpdateSet(exercise.exerciseId, i, 'reps', ph);
                      const el = e.target;
                      requestAnimationFrame(() => { try { el.select(); } catch (err) {} });
                    }
                    if (onFocusField) onFocusField(exercise.exerciseId, i, 'reps');
                  }}
                  onBlur={() => onBlurField && onBlurField()}
                  onChange={(e) => onUpdateSet(exercise.exerciseId, i, 'reps', e.target.value)}
                  className="w-full bg-stone-50 border border-stone-300 rounded-sm px-2.5 py-2.5 text-base font-mono tabular-nums text-stone-900 focus:outline-none focus:border-stone-400"
                />
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.5"
                  value={set.rpe}
                  placeholder={lastData && lastData.sets && lastData.sets[i] && lastData.sets[i].rpe ? String(lastData.sets[i].rpe) : ''}
                  onFocus={() => { if (onFocusField) onFocusField(exercise.exerciseId, i, 'rpe'); }}
                  onChange={(e) => onUpdateSet(exercise.exerciseId, i, 'rpe', e.target.value)}
                  onBlur={() => { if (onRpeBlur) onRpeBlur(exercise.exerciseId, i); if (onBlurField) onBlurField(); }}
                  className="w-full bg-stone-50 border border-stone-300 rounded-sm px-2.5 py-2.5 text-base font-mono tabular-nums text-stone-700 focus:outline-none focus:border-stone-400"
                />
                <button onClick={() => onRemoveSet(exercise.exerciseId, i)} className="text-stone-500 hover:text-red-600 flex items-center justify-center self-stretch" aria-label={'Remove set ' + (i + 1)}>
                  <X size={16} />
                </button>
                {set.hr ? (
                  <div style={{ gridColumn: '1 / -1' }} className="text-right text-[10px] font-mono tabular-nums text-stone-400">♥ {set.hr}</div>
                ) : null}
              </div>
            ))}
          </div>
          {(() => {
            let best = null;
            exercise.sets.forEach((s) => {
              const e = epley(s.weight, s.reps);
              if (e !== null && (best === null || e > best)) best = e;
            });
            return RT.showE1rm && best !== null ? (
              <div className="mt-2 text-[11px] font-mono tabular-nums text-stone-400">est 1RM this session: <span className="text-stone-600 font-bold">{formatWeight(best, unit)}</span></div>
            ) : null;
          })()}
          <button
            onClick={() => onAddSet(exercise.exerciseId)}
            className="mt-3 w-full border border-dashed border-stone-300 rounded-sm py-2 text-xs uppercase tracking-widest text-stone-500 hover:text-stone-700 hover:border-stone-400 flex items-center justify-center gap-1"
          >
            <Plus size={14} /> Add Set
          </button>
        </>
      ) : (
        <>
          <div className="text-xs text-stone-500 mb-2">{lastData && lastData.notes ? 'Last: ' + lastData.notes : 'No previous data logged'}</div>
          <textarea
            value={exercise.notes}
            onChange={(e) => onUpdateNotes(exercise.exerciseId, e.target.value)}
            placeholder="Log intervals, distance, time, or check off..."
            rows={2}
            className="w-full bg-stone-50 border border-stone-300 rounded-sm px-3 py-2 text-sm text-stone-900 focus:outline-none focus:border-stone-400 resize-none"
          />
        </>
      )}
    </div>
  );
}

function AddExerciseRow({ onAdd, known, excludeIds }) {
  const [name, setName] = useState('');
  const [type, setType] = useState('strength');

  function submit() {
    if (name.trim()) {
      onAdd(name.trim(), type, null);
      setName('');
      setType('strength');
    }
  }

  return (
    <div className="bg-white border border-dashed border-stone-300 rounded-sm p-4 mb-3">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Add an exercise — type to search yours"
        className="w-full bg-stone-50 border border-stone-300 rounded-sm px-3 py-2 text-sm text-stone-900 mb-2 focus:outline-none focus:border-stone-400"
      />
      <ExerciseAutocomplete
        query={name}
        known={known || []}
        excludeIds={excludeIds || []}
        onPick={(m) => { onAdd(m.name, m.type, m.id); setName(''); setType('strength'); }}
      />
      <div className="flex gap-2 mb-2">
        <button
          onClick={() => setType('strength')}
          className={'flex-1 py-1.5 text-xs uppercase tracking-widest rounded-sm border ' + (type === 'strength' ? 'bg-stone-200 border-stone-400 text-stone-900' : 'border-stone-300 text-stone-500')}
        >
          Weight × Reps
        </button>
        <button
          onClick={() => setType('conditioning')}
          className={'flex-1 py-1.5 text-xs uppercase tracking-widest rounded-sm border ' + (type === 'conditioning' ? 'bg-stone-200 border-stone-400 text-stone-900' : 'border-stone-300 text-stone-500')}
        >
          Notes
        </button>
      </div>
      <button onClick={submit} className="w-full bg-stone-200 hover:bg-stone-300 rounded-sm py-2 text-xs uppercase tracking-widest text-stone-800 flex items-center justify-center gap-1">
        <Plus size={14} /> Add Exercise
      </button>
    </div>
  );
}

function HomeView({ template, dayOrder, templateName, sessions, unit, onStart, onHistory, onOpenBackup, onOpenTemplates, newPRs, onDismissPRs, backupDue, lastExportAt, inProgressDay }) {
  const dow = new Date().getDay();
  const anyToday = dayOrder.some((k) => dayIsToday(template[k]));
  const isRestDay = !anyToday && RT.restDays.includes(dow);
  const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  return (
    <div>
      <PageHeader
        eyebrow={<><Sailboat size={14} className="text-amber-600" /> Yawl <span className="normal-case tracking-normal text-stone-400">· {todayLabel}</span></>}
        title="Pick Today's Session"
      >
        {templateName && <div className="text-xs uppercase tracking-widest text-stone-400 mt-1">{templateName}</div>}
      </PageHeader>
      {newPRs && newPRs.length > 0 && (
        <div className="bg-green-50 border border-green-300 rounded-sm p-3 mb-4 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-widest font-bold text-green-700 flex items-center gap-1 mb-1"><Trophy size={12} /> New PR{newPRs.length > 1 ? 's' : ''}!</div>
            <div className="text-sm text-green-800">
              {newPRs.map((p) => p.name + ' — est 1RM ' + formatWeight(p.e1rm, unit)).join(' · ')}
            </div>
          </div>
          <button onClick={onDismissPRs} className="shrink-0 text-green-700 p-2 -m-1" aria-label="Dismiss"><X size={16} /></button>
        </div>
      )}
      {backupDue && (
        <button onClick={onOpenBackup} className="w-full text-left bg-amber-50 border border-amber-300 rounded-sm px-3 py-2.5 mb-4 text-xs text-amber-800 flex items-center justify-between gap-2">
          <span>{lastExportAt ? 'Last backup was ' + formatDateFull(lastExportAt) : 'No backup yet'} — tap to back up your data.</span>
          <ChevronRight size={15} className="shrink-0" />
        </button>
      )}
      {isRestDay && (
        <div className="bg-white border border-stone-200 rounded-sm px-4 py-3 mb-3 text-sm text-stone-500">
          Rest day — nothing scheduled for {WEEKDAY_NAMES[dow]}.
        </div>
      )}
      {dayOrder.length === 0 && (
        <div className="bg-white border border-dashed border-stone-300 rounded-sm p-5 text-center">
          <div className="text-sm text-stone-600 mb-3">This template has no training days yet.</div>
          <button onClick={onOpenTemplates} className="bg-stone-800 text-white text-xs uppercase tracking-widest font-bold rounded-sm px-4 py-3">Set up a template</button>
        </div>
      )}
      <div className="space-y-3">
        {dayOrder.map((dayType) => {
          const day = template[dayType];
          if (!day) return null;
          const daySessions = sessions.filter((s) => s.dayType === dayType);
          const last = daySessions.length ? daySessions[daySessions.length - 1] : null;
          const colors = COLOR_MAP[day.colorKey] || COLOR_MAP.blue;
          const isToday = dayIsToday(day);
          const count = (day.exercises || []).length;
          const inProgress = inProgressDay === dayType;
          return (
            <div key={dayType} className={'flex items-stretch bg-white border rounded-sm overflow-hidden ' + (inProgress ? 'border-stone-800 ring-1 ring-stone-800' : isToday ? 'border-amber-400 ring-1 ring-amber-300' : 'border-stone-200')}>
              <div className={'w-1.5 ' + colors.stripe} />
              <button onClick={() => onStart(dayType)} className="flex-1 min-w-0 text-left px-4 py-3.5 active:bg-stone-50 transition-colors">
                <div className="flex items-center gap-2">
                  <div className="font-black uppercase tracking-tight text-stone-900">{day.label}</div>
                  {inProgress
                    ? <span className="text-[10px] uppercase tracking-widest font-bold text-white bg-stone-800 rounded-sm px-1.5 py-0.5">In progress</span>
                    : isToday && <span className="text-[10px] uppercase tracking-widest font-bold text-amber-700 bg-amber-100 rounded-sm px-1.5 py-0.5">Today</span>}
                </div>
                {day.subtitle && <div className="text-xs text-stone-500 mt-0.5">{day.subtitle}</div>}
                <div className="text-xs text-stone-500 mt-1.5 font-mono tabular-nums">
                  {count} exercise{count === 1 ? '' : 's'} · {inProgress ? 'tap to resume' : last
                    ? 'last ' + formatDate(last.date) + (last.durationSec ? ' · ' + formatDuration(last.durationSec) : '')
                    : 'not logged yet'}
                </div>
              </button>
              {daySessions.length > 0 && (
                <button onClick={() => onHistory(dayType)} className="px-3.5 flex items-center justify-center text-stone-500 hover:text-stone-700 border-l border-stone-200" aria-label={'History for ' + day.label}>
                  <HistoryIcon size={17} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ExportView({ exportText, counts, onImport, onCopied, onBack }) {
  const text = exportText;
  const [copied, setCopied] = useState(false);
  const [importText, setImportText] = useState('');
  const [importHasSettings, setImportHasSettings] = useState(false);
  const [replaceSettings, setReplaceSettings] = useState(false);
  const [importMsg, setImportMsg] = useState(null);
  const fileRef = useRef(null);

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (onCopied) onCopied();
      setTimeout(() => setCopied(false), 1600);
    } catch (e) {
      setCopied(false);
      setImportMsg({ ok: false, text: 'Copy was blocked — tap the box below, select all, and copy by hand.' });
    }
  }

  function downloadFile() {
    try {
      const blob = new Blob([text], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'yawl-backup-' + dayKeyOf(new Date().toISOString()) + '.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      if (onCopied) onCopied();
    } catch (e) {
      setImportMsg({ ok: false, text: 'Could not create the file here — use Copy instead.' });
    }
  }

  // Native app: hand the backup to the iOS share sheet (Save to Files, AirDrop,
  // Mail...). A WKWebView can't download a file the way a browser tab can.
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  async function shareFile() {
    const name = 'yawl-backup-' + dayKeyOf(new Date().toISOString()) + '.json';
    try {
      let payload = { title: 'Yawl backup', text };
      try {
        const file = new File([text], name, { type: 'application/json' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) payload = { files: [file], title: 'Yawl backup' };
      } catch (e) {
        // File sharing unsupported — share the text instead
      }
      await navigator.share(payload);
      if (onCopied) onCopied();
    } catch (e) {
      // Closing the share sheet without picking anything is not an error.
      if (e && e.name === 'AbortError') return;
      setImportMsg({ ok: false, text: 'Sharing is not available here — use Copy instead.' });
    }
  }

  function setIncoming(value) {
    setImportText(value);
    setImportMsg(null);
    let has = false;
    try {
      const data = JSON.parse(value);
      has = !!(data && !Array.isArray(data) && data.settings && typeof data.settings === 'object');
    } catch (e) {
      // not valid JSON (yet)
    }
    setImportHasSettings(has);
    if (!has) setReplaceSettings(false);
  }

  function pickFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setIncoming(String(reader.result || ''));
    reader.onerror = () => setImportMsg({ ok: false, text: 'Could not read that file.' });
    reader.readAsText(file);
    e.target.value = '';
  }

  async function runImport() {
    try {
      const incoming = parseImportText(importText);
      const result = await onImport(incoming, { replaceSettings });
      const plural = (n, word) => n + ' ' + word + (n === 1 ? '' : 's');
      const parts = [plural(result.addedSessions, 'session'), plural(result.addedTemplates, 'template')];
      if (result.addedExercises) parts.push(plural(result.addedExercises, 'exercise'));
      const skipped = result.skippedSessions + result.skippedTemplates;
      setImportMsg({ ok: true, text: 'Imported ' + parts.join(', ') + (skipped ? ' (' + skipped + ' already here, skipped)' : '') + (result.settingsReplaced ? '. Settings replaced' : '') + '.' });
      setImportText('');
      setImportHasSettings(false);
      setReplaceSettings(false);
    } catch (e) {
      setImportMsg({ ok: false, text: 'Could not read that — it needs to be the exact JSON from a Yawl export.' });
    }
  }

  const native = hrAvailable();

  return (
    <div>
      <div className="flex items-center mb-5">
        <button onClick={onBack} className="flex items-center gap-1 text-stone-500 text-sm py-2">
          <ChevronLeft size={18} /> Settings
        </button>
      </div>
      <div className="mb-4">
        <div className="text-xs uppercase tracking-widest text-stone-500 mb-1">Backup</div>
        <h1 className="text-2xl font-black uppercase tracking-tight text-stone-900">Export Your Data</h1>
        <p className="text-xs text-stone-500 mt-2 leading-relaxed">
          One file with everything: {counts.sessions} session{counts.sessions === 1 ? '' : 's'}, {counts.templates} template{counts.templates === 1 ? '' : 's'}, {counts.exercises} exercise{counts.exercises === 1 ? '' : 's'} and your settings. Keep it as a backup, or paste it into a chat for coaching.
        </p>
      </div>
      <div className="flex gap-2 mb-3">
        <button onClick={copyAll} className="flex-1 bg-stone-800 hover:bg-stone-700 text-white text-xs uppercase tracking-widest font-bold py-3 rounded-sm flex items-center justify-center gap-1.5">
          <Copy size={14} /> {copied ? 'Copied' : 'Copy'}
        </button>
        {!native && (
          <button onClick={downloadFile} className="flex-1 bg-white border border-stone-300 text-stone-700 text-xs uppercase tracking-widest font-bold py-3 rounded-sm flex items-center justify-center gap-1.5">
            <Download size={14} /> Save as file
          </button>
        )}
        {native && canShare && (
          <button onClick={shareFile} className="flex-1 bg-white border border-stone-300 text-stone-700 text-xs uppercase tracking-widest font-bold py-3 rounded-sm flex items-center justify-center gap-1.5">
            <Upload size={14} /> Share / Save
          </button>
        )}
      </div>
      <textarea
        readOnly
        value={text}
        onFocus={(e) => e.target.select()}
        rows={8}
        aria-label="Export data"
        className="w-full bg-white border border-stone-200 rounded-sm px-3 py-3 text-xs font-mono text-stone-700 focus:outline-none focus:border-stone-400 resize-none"
      />

      <div className="mt-8 mb-3">
        <div className="text-xs uppercase tracking-widest text-stone-500 mb-1">Restore</div>
        <h2 className="text-lg font-black uppercase tracking-tight text-stone-900">Import</h2>
        <p className="text-xs text-stone-500 mt-1 leading-relaxed">Paste an export or choose a backup file. Anything you already have is skipped, so importing the same backup twice is safe.</p>
      </div>
      <input ref={fileRef} type="file" accept="application/json,.json,text/plain" onChange={pickFile} className="hidden" />
      <button onClick={() => fileRef.current && fileRef.current.click()} className="w-full mb-2 bg-white border border-stone-300 text-stone-700 text-xs uppercase tracking-widest font-bold py-3 rounded-sm flex items-center justify-center gap-1.5">
        <Upload size={14} /> Choose a backup file
      </button>
      <textarea
        value={importText}
        onChange={(e) => setIncoming(e.target.value)}
        placeholder="...or paste exported JSON here"
        rows={5}
        aria-label="Import data"
        className="w-full bg-white border border-stone-300 rounded-sm px-3 py-3 text-xs font-mono text-stone-900 focus:outline-none focus:border-stone-500 resize-none"
      />
      {importHasSettings && (
        <div className="flex items-center justify-between gap-3 mt-2 bg-white border border-stone-200 rounded-sm px-3 py-2.5">
          <div className="text-xs text-stone-600 leading-snug">This backup includes settings. Replace the settings on this device with them?</div>
          <Toggle checked={replaceSettings} onChange={setReplaceSettings} label="Replace settings with the backup's" />
        </div>
      )}
      {importMsg && (
        <div className={'text-xs mt-2 ' + (importMsg.ok ? 'text-green-700' : 'text-red-600')} role="status">{importMsg.text}</div>
      )}
      <button
        onClick={runImport}
        disabled={!importText.trim()}
        className="mt-3 w-full bg-stone-800 hover:bg-stone-700 disabled:opacity-40 text-white font-black uppercase tracking-wide py-3.5 rounded-sm flex items-center justify-center gap-2"
      >
        <Upload size={16} /> Import
      </button>
      <div className="h-8" />
    </div>
  );
}

function StepperBar({ field, unit, onAdjust, onDone }) {
  // Sit just above the keyboard. visualViewport reports the keyboard inset
  // whether or not the WebView itself resizes, so this works either way.
  const [bottom, setBottom] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return undefined;
    const update = () => {
      // Measure against the LAYOUT viewport. On iOS window.innerHeight tracks
      // the *visual* viewport, so using it made this inset compute to 0 and
      // the bar sat underneath the keyboard.
      const layoutH = document.documentElement.clientHeight;
      const visibleBottom = vv.offsetTop + vv.height;
      setBottom(Math.max(0, Math.round(layoutH - visibleBottom)));
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  // Weight deltas are in the DISPLAY unit — the caller converts to kg.
  const steps = field === 'weight' ? unitDef(unit).stepper : field === 'reps' ? [-1, 1] : [-0.5, 0.5];
  // Don't let the button steal focus, or the keyboard closes on every tap.
  const keepFocus = (e) => e.preventDefault();

  return (
    <div
      style={{ position: 'fixed', left: 0, right: 0, bottom, zIndex: 60 }}
      className="bg-stone-800 border-t border-stone-700 px-2 py-2 flex items-center gap-2"
    >
      {steps.map((d) => (
        <button
          key={d}
          onPointerDown={keepFocus}
          onMouseDown={keepFocus}
          onClick={() => onAdjust(d)}
          className="flex-1 bg-stone-700 active:bg-stone-600 text-white font-mono tabular-nums text-base rounded-sm py-2.5"
        >
          {d > 0 ? '+' + d : String(d)}
        </button>
      ))}
      <button
        onPointerDown={keepFocus}
        onMouseDown={keepFocus}
        onClick={onDone}
        className="px-3 py-2.5 text-xs uppercase tracking-widest text-stone-300 font-bold"
      >
        Done
      </button>
    </div>
  );
}

function LogView({ dayType, template, draft, editMode, setEditMode, unit, libMap, onMinimize, onUpdateSet, onAddSet, onRemoveSet, onUpdateNotes, onAddExercise, onRemoveExercise, onMoveExercise, onFinish, onCancel, saving, getLastExerciseData, getSuggestion, onToggleDeload, onUpdateSessionNote, onToggleCollapse, onRpeBlur, knownExercises, onFetchHR, timerEndsAt, timerPreset, onTimerStart }) {
  const day = template[dayType] || { label: 'Workout', subtitle: '', colorKey: 'blue', exercises: [] };
  const colors = COLOR_MAP[day.colorKey] || COLOR_MAP.blue;
  const [confirm, setConfirm] = useState(null);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [focusedField, setFocusedField] = useState(null);
  // Progress: a set counts as done once it has an RPE — the same signal that starts the rest timer.
  let setsTotal = 0;
  let setsDone = 0;
  draft.exercises.forEach((ex) => {
    if (ex.type !== 'strength' || !ex.sets) return;
    setsTotal += ex.sets.length;
    setsDone += ex.sets.filter((s) => s.rpe !== '' && s.rpe != null).length;
  });
  const blurTimer = useRef(null);

  function handleFocusField(exerciseId, index, field) {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    setFocusedField({ exerciseId, index, field });
  }

  function handleBlurField() {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    blurTimer.current = setTimeout(() => setFocusedField(null), 200);
  }

  function adjustFocused(delta) {
    if (!focusedField) return;
    const { exerciseId, index, field } = focusedField;
    const ex = draft.exercises.find((e) => e.exerciseId === exerciseId);
    if (!ex || !ex.sets[index]) return;
    let base = parseFloat(ex.sets[index][field]);
    if (isNaN(base)) {
      // Empty field: start from last session's value, else a sane default.
      const last = getLastExerciseData(exerciseId);
      const ls = last && last.sets && last.sets[index];
      base = ls ? parseFloat(ls[field]) : NaN;
      if (isNaN(base)) base = field === 'rpe' ? 8 : 0;
    }
    if (field === 'weight') {
      // base is kg, delta is in display units — step in display space, store kg.
      let next = kgToUnit(base, unit) + delta;
      if (next < 0) next = 0;
      onUpdateSet(exerciseId, index, field, displayToWeight(String(Math.round(next * 100) / 100), unit));
      return;
    }
    let next = base + delta;
    if (next < 0) next = 0;
    if (field === 'rpe' && next > 10) next = 10;
    next = Math.round(next * 100) / 100;
    onUpdateSet(exerciseId, index, field, String(next));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <button onClick={onMinimize} className="flex items-center gap-1 text-stone-500 text-sm py-2" aria-label="Minimize workout — keeps it running">
          <ChevronDown size={18} /> Minimize
        </button>
        <div className="flex items-center gap-1">
          <button
            onClick={onToggleDeload}
            className={'text-xs uppercase tracking-widest py-2 px-2 rounded-sm ' + (draft.deload ? 'text-white bg-sky-700 font-bold' : 'text-stone-500')}
          >
            {draft.deload ? 'Deload On' : 'Deload'}
          </button>
          <button
            onClick={() => setEditMode((m) => !m)}
            className={'flex items-center gap-1 text-xs uppercase tracking-widest py-2 px-2 ' + (editMode ? colors.text : 'text-stone-500')}
          >
            <Pencil size={14} /> {editMode ? 'Done Editing' : 'Edit'}
          </button>
        </div>
      </div>
      <div className="mb-5">
        <div className={'text-xs uppercase tracking-widest mb-1 ' + colors.text}>{day.subtitle}</div>
        <h1 className="text-2xl font-black uppercase tracking-tight text-stone-900">{day.label}</h1>
        <div className="flex items-center justify-between gap-3 text-stone-500 text-sm mt-2">
          <span className="flex items-center gap-1.5"><Clock size={14} /> <SessionTimer startedAt={draft.startedAt} /></span>
          {setsTotal > 0 && <span className="text-xs font-mono tabular-nums">{setsDone} of {setsTotal} sets done</span>}
        </div>
        {setsTotal > 0 && (
          <div className="mt-2 h-1 bg-stone-200 rounded-full overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={setsTotal} aria-valuenow={setsDone}>
            <div className={'h-1 ' + colors.stripe} style={{ width: Math.round((setsDone / setsTotal) * 100) + '%' }} />
          </div>
        )}
      </div>

      <RestStarter activePreset={timerPreset} running={!!timerEndsAt} onStart={onTimerStart} />
      {focusedField && (
        <StepperBar
          field={focusedField.field}
          unit={unit}
          onAdjust={adjustFocused}
          onDone={() => {
            try { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); } catch (e) {}
            setFocusedField(null);
          }}
        />
      )}

      {(() => {
        const chunks = [];
        draft.exercises.forEach((ex) => {
          const prev = chunks[chunks.length - 1];
          if (ex.superset && prev && prev.superset === ex.superset) prev.items.push(ex);
          else chunks.push({ superset: ex.superset || null, items: [ex] });
        });
        return chunks.map((chunk, ci) => {
          const cards = chunk.items.map((ex) => (
            <ExerciseCard
              key={ex.exerciseId}
              exercise={ex}
              lastData={getLastExerciseData(ex.exerciseId)}
              suggestion={ex.type === 'strength' ? getSuggestion(ex.exerciseId) : null}
              editMode={editMode}
              unit={unit}
              info={libMap ? libMap[ex.exerciseId] : null}
              onUpdateSet={onUpdateSet}
              onAddSet={onAddSet}
              onRemoveSet={onRemoveSet}
              onUpdateNotes={onUpdateNotes}
              onRemoveExercise={(id) => setRemoveTarget(id)}
              onMoveExercise={onMoveExercise}
              onToggleCollapse={onToggleCollapse}
              onRpeBlur={onRpeBlur}
              onFocusField={handleFocusField}
              onBlurField={handleBlurField}
            />
          ));
          if (chunk.superset && chunk.items.length > 1) {
            return (
              <div key={'ss-' + ci} className="border-2 border-purple-200 rounded-sm p-2 mb-3">
                <div className="text-[10px] uppercase tracking-widest font-bold text-purple-700 mb-2 px-1">Superset {chunk.superset} — alternate exercises, rest after the pair</div>
                {cards}
              </div>
            );
          }
          return <div key={'ch-' + ci}>{cards}</div>;
        });
      })()}

      {editMode && <AddExerciseRow onAdd={(name, type, existingId) => onAddExercise(dayType, name, type, existingId)} known={knownExercises} excludeIds={draft.exercises.map((e) => e.exerciseId)} />}

      {hrAvailable() && (
      <div className="bg-white border border-stone-200 rounded-sm p-4 mb-3">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs uppercase tracking-widest text-stone-500">Watch HR</div>
          <button
            onClick={onFetchHR}
            disabled={draft.hrLoading}
            className="text-xs uppercase tracking-widest text-stone-500 hover:text-stone-800 border border-stone-300 rounded-sm px-2 py-1 disabled:opacity-40"
          >
            {draft.hrLoading ? 'Reading…' : draft.hr ? 'Refresh' : 'Fetch'}
          </button>
        </div>
        {draft.hr ? (
          <div className="text-sm font-mono tabular-nums text-stone-800">
            avg {draft.hr.avg} · max {draft.hr.max} · min {draft.hr.min} <span className="text-stone-400 text-xs">({draft.hr.count} samples)</span>
          </div>
        ) : draft.hrError ? (
          <div className="text-xs text-red-600">{draft.hrError}</div>
        ) : (
          <div className="text-xs text-stone-400">Pulls heart rate from Apple Health for this session's window.</div>
        )}
      </div>
      )}

      <div className="bg-white border border-stone-200 rounded-sm p-4 mb-3">
        <div className="text-xs uppercase tracking-widest text-stone-500 mb-2">Session Notes</div>
        <textarea
          value={draft.note || ''}
          onChange={(e) => onUpdateSessionNote(e.target.value)}
          placeholder="Sleep, energy, form cues, anything worth remembering..."
          rows={2}
          className="w-full bg-stone-50 border border-stone-300 rounded-sm px-3 py-2 text-sm text-stone-900 focus:outline-none focus:border-stone-500 resize-none"
        />
      </div>

      <div className="h-24" />

      <SaveBar>
          {confirm === 'cancel' ? (
            <div className="flex items-center gap-2">
              <div className="flex-1 text-xs text-stone-600">Discard this workout? Nothing will be saved.</div>
              <button onClick={() => setConfirm(null)} className="text-xs uppercase tracking-widest text-stone-600 border border-stone-300 rounded-sm px-3 py-3">Keep Going</button>
              <button onClick={onCancel} className="text-xs uppercase tracking-widest text-white bg-red-600 hover:bg-red-500 rounded-sm px-3 py-3 font-bold">Discard</button>
            </div>
          ) : confirm === 'finish' ? (
            <div className="flex items-center gap-2">
              <div className="flex-1 text-xs text-stone-600">Finish and save this workout?</div>
              <button onClick={() => setConfirm(null)} className="text-xs uppercase tracking-widest text-stone-600 border border-stone-300 rounded-sm px-3 py-3">Back</button>
              <button
                onClick={() => { setConfirm(null); onFinish(); }}
                disabled={saving}
                className={colors.solidBg + ' ' + colors.solidBgHover + ' disabled:opacity-50 text-xs uppercase tracking-widest text-white rounded-sm px-3 py-3 font-bold flex items-center gap-1'}
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Save
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setConfirm('cancel')}
                disabled={saving}
                className="shrink-0 border border-stone-300 text-stone-600 hover:text-red-600 hover:border-red-300 font-black uppercase tracking-wide py-4 px-4 rounded-sm flex items-center justify-center gap-1 disabled:opacity-50"
              >
                <X size={16} /> Cancel
              </button>
              <button
                onClick={() => setConfirm('finish')}
                disabled={saving}
                className={'flex-1 ' + colors.solidBg + ' ' + colors.solidBgHover + ' disabled:opacity-50 text-white font-black uppercase tracking-wide py-4 rounded-sm flex items-center justify-center gap-2 transition-colors'}
              >
                {saving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                {saving ? 'Saving' : 'Finish & Save'}
              </button>
            </div>
          )}
      </SaveBar>

      {removeTarget && (() => {
        const target = draft.exercises.find((e) => e.exerciseId === removeTarget);
        const inTemplate = (day.exercises || []).some((e) => e.id === removeTarget);
        const done = (keepInTemplate) => { onRemoveExercise(removeTarget, !keepInTemplate); setRemoveTarget(null); };
        return (
          <div className="fixed inset-0 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)', zIndex: 80 }} role="dialog" aria-modal="true">
            <div className="bg-white rounded-sm border border-stone-300 w-full max-w-sm p-4">
              <div className="text-sm font-black uppercase tracking-tight text-stone-900 mb-1">Remove {target ? target.name : 'this exercise'}?</div>
              <div className="text-xs text-stone-600 leading-relaxed">Anything you've entered for it in this workout is dropped.</div>
              <div className="space-y-2 mt-4">
                <button onClick={() => done(true)} className="w-full text-xs uppercase tracking-widest text-white bg-stone-800 hover:bg-stone-700 rounded-sm py-3 font-bold">Skip it just for today</button>
                {inTemplate && (
                  <button onClick={() => done(false)} className="w-full text-xs uppercase tracking-widest text-red-600 border border-red-300 rounded-sm py-3">Remove from {day.label} for good</button>
                )}
                <button onClick={() => setRemoveTarget(null)} className="w-full text-xs uppercase tracking-widest text-stone-600 border border-stone-300 rounded-sm py-3">Cancel</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function SessionRow({ session, template, unit, onOpen }) {
  const day = template[session.dayType];
  const label = session.dayLabel || (day ? day.label : session.dayType);
  const colors = COLOR_MAP[session.colorKey || (day ? day.colorKey : 'blue')] || COLOR_MAP.blue;
  return (
    <div className="flex items-stretch bg-white border border-stone-200 rounded-sm overflow-hidden">
      <div className={'w-1.5 ' + colors.stripe} />
      <button onClick={() => onOpen(session)} className="flex-1 text-left px-4 py-3.5 active:bg-stone-100 transition-colors">
        <div className="flex items-center justify-between">
          <div className="font-black uppercase tracking-tight text-stone-900 flex items-center gap-1.5">{label}{session.deload && <span className="text-[9px] uppercase tracking-widest font-bold text-sky-700 bg-sky-50 border border-sky-200 rounded-sm px-1 py-0.5">Deload</span>}</div>
          <div className="text-xs uppercase tracking-widest text-stone-400">{formatDateFull(session.date)}</div>
        </div>
        <div className="text-xs text-stone-500 mt-1 font-mono tabular-nums">
          {session.exercises.length} exercises{session.durationSec ? ' · ' + formatDuration(session.durationSec) : ''}{sessionVolume(session) > 0 ? ' · ' + formatVolume(sessionVolume(session), unit) : ''}{session.hr ? ' · ♥ ' + session.hr.avg : ''}
        </div>
        {session.note && <div className="text-xs text-stone-400 mt-1 truncate italic">{session.note}</div>}
      </button>
    </div>
  );
}

function SessionEditView({ session, template, unit, nameOf, onBack, onSave, onDelete, onFetchSessionHR }) {
  const day = template[session.dayType];
  const label = session.dayLabel || (day ? day.label : session.dayType);
  const colors = COLOR_MAP[session.colorKey || (day ? day.colorKey : 'blue')] || COLOR_MAP.blue;
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const blurTimer = useRef(null);
  const [durMin, setDurMin] = useState(session.durationSec ? String(Math.round(session.durationSec / 60)) : '');
  const [note, setNote] = useState(session.note || '');
  const [exercises, setExercises] = useState(() =>
    session.exercises.map((ex) =>
      ex.type === 'strength'
        ? { ...ex, sets: ex.sets.map((s) => ({ weight: String(s.weight ?? ''), reps: String(s.reps ?? ''), rpe: s.rpe ? String(s.rpe) : '', hr: s.hr, hrAt: s.hrAt })) }
        : { ...ex, notes: ex.notes || '' }
    )
  );

  // A Fetch updates the stored session, but this view holds its own copy of the
  // exercises. Merge freshly backfilled HR in without clobbering unsaved edits.
  useEffect(() => {
    setExercises((prev) => prev.map((ex) => {
      const src = session.exercises.find((e) => e.exerciseId === ex.exerciseId);
      if (!src || !src.sets || !ex.sets) return ex;
      return {
        ...ex,
        sets: ex.sets.map((s, i) => (src.sets[i] && src.sets[i].hr ? { ...s, hr: src.sets[i].hr } : s)),
      };
    }));
  }, [session]);

  async function copySession() {
    try {
      await navigator.clipboard.writeText(buildSessionText(template, { ...session, exercises, durationSec: session.durationSec }, unit, nameOf));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch (e) {
      setCopied(false);
    }
  }

  function updateSet(exerciseId, idx, field, value) {
    setExercises((prev) => prev.map((ex) => {
      if (ex.exerciseId !== exerciseId) return ex;
      return { ...ex, sets: ex.sets.map((s, i) => (i === idx ? { ...s, [field]: value } : s)) };
    }));
  }

  function handleFocusField(exerciseId, index, field) {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    setFocusedField({ exerciseId, index, field });
  }

  function handleBlurField() {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    blurTimer.current = setTimeout(() => setFocusedField(null), 200);
  }

  function adjustFocused(delta) {
    if (!focusedField) return;
    const { exerciseId, index, field } = focusedField;
    const ex = exercises.find((e) => e.exerciseId === exerciseId);
    if (!ex || !ex.sets || !ex.sets[index]) return;
    let base = parseFloat(ex.sets[index][field]);
    if (isNaN(base)) base = field === 'rpe' ? 8 : 0;
    if (field === 'weight') {
      // base is kg, delta is in display units — step in display space, store kg.
      let next = kgToUnit(base, unit) + delta;
      if (next < 0) next = 0;
      updateSet(exerciseId, index, field, displayToWeight(String(Math.round(next * 100) / 100), unit));
      return;
    }
    let next = base + delta;
    if (next < 0) next = 0;
    if (field === 'rpe' && next > 10) next = 10;
    next = Math.round(next * 100) / 100;
    updateSet(exerciseId, index, field, String(next));
  }

  function addSet(exerciseId) {
    setExercises((prev) => prev.map((ex) => {
      if (ex.exerciseId !== exerciseId) return ex;
      const last = ex.sets[ex.sets.length - 1];
      return { ...ex, sets: [...ex.sets, { weight: (last && last.weight) || '', reps: (last && last.reps) || '', rpe: '' }] };
    }));
  }

  function removeSet(exerciseId, idx) {
    setExercises((prev) => prev.map((ex) => {
      if (ex.exerciseId !== exerciseId) return ex;
      const sets = ex.sets.filter((_, i) => i !== idx);
      return { ...ex, sets: sets.length ? sets : [{ weight: '', reps: '', rpe: '' }] };
    }));
  }

  function updateNotes(exerciseId, text) {
    setExercises((prev) => prev.map((ex) => (ex.exerciseId === exerciseId ? { ...ex, notes: text } : ex)));
  }

  function save() {
    const cleaned = exercises
      .map((ex) => {
        if (ex.type === 'strength') {
          const sets = ex.sets.filter((s) => s.weight !== '' || s.reps !== '' || s.rpe !== '');
          return sets.length ? { exerciseId: ex.exerciseId, name: ex.name, type: 'strength', sets } : null;
        }
        return ex.notes && ex.notes.trim() ? { exerciseId: ex.exerciseId, name: ex.name, type: 'conditioning', notes: ex.notes } : null;
      })
      .filter(Boolean);
    const m = parseFloat(durMin);
    const durationSec = !isNaN(m) && m > 0 ? Math.round(m * 60) : null;
    onSave(session.id, cleaned, durationSec, note && note.trim() ? note.trim() : undefined);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <button onClick={onBack} className="flex items-center gap-1 text-stone-500 text-sm py-2">
          <ChevronLeft size={18} /> Back
        </button>
        <div className="flex items-center gap-2">
          {confirmDelete ? (
            <>
              <button onClick={() => setConfirmDelete(false)} className="text-xs uppercase tracking-widest text-stone-500 border border-stone-300 rounded-sm px-2.5 py-1.5">Keep</button>
              <button onClick={() => onDelete(session.id)} className="text-xs uppercase tracking-widest text-white bg-red-600 hover:bg-red-500 rounded-sm px-2.5 py-1.5 font-bold">Delete</button>
            </>
          ) : (
            <>
              <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-1 text-xs uppercase tracking-widest text-stone-500 hover:text-red-600 border border-stone-300 rounded-sm px-2.5 py-1.5">
                <X size={13} /> Delete
              </button>
              <button onClick={copySession} className="flex items-center gap-1 text-xs uppercase tracking-widest text-stone-500 hover:text-stone-800 border border-stone-300 rounded-sm px-2.5 py-1.5">
                <Copy size={13} /> {copied ? 'Copied' : 'Copy'}
              </button>
            </>
          )}
        </div>
      </div>
      <div className="mb-5">
        <div className={'text-xs uppercase tracking-widest mb-1 ' + colors.text}>{formatDateFull(session.date)} · Edit Session</div>
        <h1 className="text-2xl font-black uppercase tracking-tight text-stone-900">{label}</h1>
        {session.hr ? (
          <div className="text-xs font-mono tabular-nums text-stone-600 mt-2">♥ avg {session.hr.avg} · max {session.hr.max} · min {session.hr.min}</div>
        ) : !hrAvailable() ? null : (
          <button onClick={async () => { try { await onFetchSessionHR(session); } catch (e) { /* surfaced by alert below */ alert(e.message || 'Could not read heart rate'); } }} className="mt-2 text-xs uppercase tracking-widest text-stone-500 hover:text-stone-800 border border-stone-300 rounded-sm px-2 py-1">
            ♥ Fetch Watch HR
          </button>
        )}
        <div className="flex items-center gap-1.5 mt-3">
          <Clock size={14} className="text-stone-500" />
          <input
            type="number"
            inputMode="numeric"
            value={durMin}
            onChange={(e) => setDurMin(e.target.value)}
            placeholder="--"
            className="w-16 bg-stone-50 border border-stone-300 rounded-sm px-2 py-1 text-sm font-mono tabular-nums text-stone-900 focus:outline-none focus:border-stone-500"
          />
          <span className="text-xs text-stone-500">min</span>
        </div>
      </div>

      <div className="bg-white border border-stone-200 rounded-sm p-4 mb-3">
        <div className="text-xs uppercase tracking-widest text-stone-500 mb-2">Session Notes</div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Sleep, energy, form cues..."
          rows={2}
          className="w-full bg-stone-50 border border-stone-300 rounded-sm px-3 py-2 text-sm text-stone-900 focus:outline-none focus:border-stone-500 resize-none"
        />
      </div>

      {exercises.map((ex) => (
        <ExerciseCard
          key={ex.exerciseId}
          exercise={ex}
          displayName={nameOf ? nameOf(ex) : ex.name}
          lastData={null}
          editMode={false}
          unit={unit}
          onUpdateSet={updateSet}
          onAddSet={addSet}
          onRemoveSet={removeSet}
          onUpdateNotes={updateNotes}
          onRemoveExercise={() => {}}
          onMoveExercise={() => {}}
          onFocusField={handleFocusField}
          onBlurField={handleBlurField}
        />
      ))}

      {focusedField && (
        <StepperBar
          field={focusedField.field}
          unit={unit}
          onAdjust={adjustFocused}
          onDone={() => {
            try { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); } catch (e) {}
            setFocusedField(null);
          }}
        />
      )}

      <div className="h-24" />

      <SaveBar>
          <button
            onClick={save}
            className={'w-full ' + colors.solidBg + ' ' + colors.solidBgHover + ' text-white font-black uppercase tracking-wide py-4 rounded-sm flex items-center justify-center gap-2 transition-colors'}
          >
            <Check size={18} /> Save Changes
          </button>
      </SaveBar>
    </div>
  );
}

function CalendarView({ sessionsAll, unit, onOpenSession }) {
  const [anchor, setAnchor] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const [selectedKey, setSelectedKey] = useState(null);

  const byDay = {};
  sessionsAll.forEach((s) => {
    const k = dayKeyOf(s.date);
    (byDay[k] = byDay[k] || []).push(s);
  });

  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const firstDow = (new Date(year, month, 1).getDay() - RT.weekStart + 7) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayKey = dayKeyOf(new Date().toISOString());
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const selectedSessions = selectedKey ? (byDay[selectedKey] || []) : [];

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setAnchor(new Date(year, month - 1, 1))} className="p-2 text-stone-500 hover:text-stone-900" aria-label="Previous month"><ChevronLeft size={18} /></button>
        <div className="text-sm font-black uppercase tracking-tight text-stone-900">
          {anchor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </div>
        <button onClick={() => setAnchor(new Date(year, month + 1, 1))} className="p-2 text-stone-500 hover:text-stone-900" aria-label="Next month"><ChevronRight size={18} /></button>
      </div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => WEEKDAY_LETTERS[(i + RT.weekStart) % 7]).map((d, i) => (
          <div key={i} className="text-center text-[10px] uppercase tracking-widest text-stone-400 py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (d === null) return <div key={'e' + i} />;
          const k = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
          const daySessions = byDay[k] || [];
          const isSelected = selectedKey === k;
          const isToday = k === todayKey;
          return (
            <button
              key={k}
              onClick={() => setSelectedKey(isSelected ? null : k)}
              className={'aspect-square rounded-sm border flex flex-col items-center justify-center gap-0.5 ' +
                (isSelected ? 'border-stone-700 bg-stone-100 ' : daySessions.length ? 'border-stone-300 bg-white ' : 'border-stone-200 bg-white ') +
                (isToday ? 'ring-1 ring-amber-400 ' : '')}
            >
              <span className={'text-xs font-mono tabular-nums ' + (daySessions.length ? 'text-stone-900 font-bold' : 'text-stone-400')}>{d}</span>
              {daySessions.length > 0 && (
                <span className="flex gap-0.5">
                  {daySessions.slice(0, 3).map((s, si) => (
                    <span key={si} className={'w-1.5 h-1.5 rounded-full ' + (COLOR_MAP[s.colorKey] ? COLOR_MAP[s.colorKey].stripe : 'bg-stone-400')} />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {selectedKey && (
        <div className="mt-4 space-y-3">
          {selectedSessions.length === 0 && <div className="text-xs text-stone-500">No sessions on this day.</div>}
          {selectedSessions.map((s) => (
            <SessionRow key={s.id} session={s} template={{}} unit={unit} onOpen={onOpenSession} />
          ))}
        </div>
      )}
    </div>
  );
}

function HistoryView({ dayType, template, sessions, unit, onBack, onOpenSession, mode, onSetMode }) {
  const PAGE_SIZE = RT.historyPageSize;
  const [page, setPage] = useState(0);
  const isAll = !dayType;
  const day = isAll ? null : template[dayType];
  const all = (isAll ? sessions.slice() : sessions.filter((s) => s.dayType === dayType))
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  const pageCount = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const shown = all.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const showCalendar = isAll && mode === 'calendar';

  return (
    <div>
      {!isAll && (
        <div className="flex items-center mb-5">
          <button onClick={onBack} className="flex items-center gap-1 text-stone-500 text-sm py-2">
            <ChevronLeft size={18} /> Back
          </button>
        </div>
      )}
      <div className={'mb-5 flex items-end justify-between gap-2 ' + (isAll ? 'pr-10' : '')}>
        <div>
          <div className="text-xs uppercase tracking-widest text-stone-500 mb-1">History</div>
          <h1 className="text-2xl font-black uppercase tracking-tight text-stone-900">{isAll ? 'All Sessions' : (day ? day.label : 'Sessions')}</h1>
        </div>
        {isAll && (
          <div className="flex border border-stone-300 rounded-sm overflow-hidden shrink-0">
            <button onClick={() => onSetMode('list')} className={'p-2.5 ' + (mode !== 'calendar' ? 'bg-stone-800 text-white' : 'bg-white text-stone-500')} aria-label="List view">
              <List size={15} />
            </button>
            <button onClick={() => onSetMode('calendar')} className={'p-2.5 ' + (mode === 'calendar' ? 'bg-stone-800 text-white' : 'bg-white text-stone-500')} aria-label="Calendar view">
              <CalendarIcon size={15} />
            </button>
          </div>
        )}
      </div>

      {all.length === 0 && (
        <div className="text-sm text-stone-500">No sessions logged yet.</div>
      )}

      {showCalendar ? (
        <CalendarView sessionsAll={all} unit={unit} onOpenSession={onOpenSession} />
      ) : (
        <div className="space-y-3">
          {shown.map((s) => (
            <SessionRow key={s.id} session={s} template={template} unit={unit} onOpen={onOpenSession} />
          ))}
        </div>
      )}

      {!showCalendar && pageCount > 1 && (
        <div className="flex items-center justify-between mt-5">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={safePage === 0}
            className="text-xs uppercase tracking-widest text-stone-500 border border-stone-300 rounded-sm px-3 py-2 disabled:opacity-40"
          >
            Newer
          </button>
          <div className="text-xs font-mono tabular-nums text-stone-500">{safePage + 1} / {pageCount}</div>
          <button
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            disabled={safePage >= pageCount - 1}
            className="text-xs uppercase tracking-widest text-stone-500 border border-stone-300 rounded-sm px-3 py-2 disabled:opacity-40"
          >
            Older
          </button>
        </div>
      )}
    </div>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    this.setState({ info });
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 16, fontFamily: 'monospace' }}>
          <div style={{ color: '#dc2626', fontWeight: 700, marginBottom: 8 }}>
            Something broke rendering this screen:
          </div>
          <div style={{ color: '#dc2626', fontSize: 12, whiteSpace: 'pre-wrap' }}>
            {String(this.state.error && (this.state.error.message || this.state.error))}
            {this.state.info ? '\n' + this.state.info.componentStack : ''}
          </div>
          <button
            onClick={() => this.setState({ error: null, info: null })}
            style={{ marginTop: 12, padding: '8px 12px', border: '1px solid #ccc', borderRadius: 4 }}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const TAB_VIEWS = ['home', 'templates', 'exercises', 'history', 'records', 'settings', 'export'];

export default function WorkoutTracker() {
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState([]);
  const currentTemplate = templates.find((t) => t.current) || templates[0] || { id: null, name: '', dayOrder: [], days: {} };
  const template = currentTemplate.days || {};
  const [editingTemplateId, setEditingTemplateId] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [library, setLibrary] = useState([]);
  const [editingExerciseId, setEditingExerciseId] = useState(null); // an id, or 'new'
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [view, setView] = useState('home');
  const [activeDayType, setActiveDayType] = useState(null);
  const [draft, setDraft] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [storageError, setStorageError] = useState(null);
  const [editingSession, setEditingSession] = useState(null);
  const [timerEndsAt, setTimerEndsAt] = useState(null);
  const [newPRs, setNewPRs] = useState(null);
  const [lastExportAt, setLastExportAt] = useState(null);
  const [historyMode, setHistoryMode] = useState('list');
  const [toast, setToast] = useState(null);
  const [timerPreset, setTimerPreset] = useState(null); // null = use the default rest from settings

  // Make the live settings visible to the pure helpers before any child renders.
  RT = settings;
  const unit = settings.unit;

  // The in-progress workout belongs to the template it was started from, which
  // may no longer be the current one (the rest of the app stays usable while a
  // workout is minimized, including switching templates).
  const draftTemplate = (draft && draft.templateId && templates.find((t) => t.id === draft.templateId)) || currentTemplate;
  const draftDays = draftTemplate.days || {};
  const draftDay = draft
    ? draftDays[draft.dayType] || { label: draft.dayLabel || 'Workout', subtitle: '', colorKey: draft.colorKey || 'blue', exercises: [] }
    : null;
  const [pendingStart, setPendingStart] = useState(null); // a day the user tapped while another workout is in progress

  const libMap = {};
  library.forEach((l) => { libMap[l.id] = l; });
  // History is keyed by exercise id; the library holds the current name for that id.
  const nameOf = (ex) => {
    const l = ex && libMap[ex.exerciseId];
    return (l && l.name) || (ex && ex.name) || '';
  };

  const audioCtxRef = React.useRef(null);
  const draftRef = React.useRef(null);
  const startRestTimerRef = React.useRef(null);

  function showToast(message) {
    setToast({ message, at: Date.now() });
  }

  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(id);
  }, [toast]);

  function setHistoryModePersist(m) {
    setHistoryMode(m);
    storage.set('history-view-mode', m).catch(() => {});
  }

  function persistSettings(next) {
    setSettings(next);
    storage.set('settings', JSON.stringify(next)).catch(() => {
      setStorageError('Could not save your settings. They may not persist after you close this.');
    });
    // Older builds read the unit from its own key; keep it in step.
    storage.set('weight-unit', next.unit).catch(() => {});
  }

  function updateSettings(patch) {
    persistSettings(normalizeSettings({ ...settings, ...patch }));
  }

  function startRestTimer(sec, ctx) {
    // A tapped preset sets the length for the rest of the workout. An automatic
    // start uses the exercise's own rest time if it has one, else that preset,
    // else the default from settings.
    let s = sec;
    if (s) {
      setTimerPreset(s);
    } else {
      const lib = ctx ? libMap[ctx.exerciseId] : null;
      s = (lib && lib.restSec) || timerPreset || settings.restDefault;
    }
    // Announce the upcoming set, and tag the notification with its identity so
    // a replied RPE (phone or Watch) knows which set it belongs to.
    let body = 'Next set.';
    let extra = {};
    const d = draftRef.current;
    if (d) {
      // With context: the set after the one just logged. Without (timer started
      // by hand): the first set still awaiting an RPE.
      const next = ctx ? findNextSet(d, ctx.exerciseId, ctx.index) : findFirstPendingSet(d);
      if (next) {
        const last = getLastExerciseData(next.exerciseId);
        const ls = last && last.sets && last.sets[next.index];
        const w = next.set.weight !== '' ? next.set.weight : ls ? ls.weight : '';
        const r = next.set.reps !== '' ? next.set.reps : ls ? ls.reps : '';
        body = next.name + (w !== '' && r !== '' ? ' — ' + formatWeight(w, unit) + ' × ' + r : '');
        extra = { exerciseId: next.exerciseId, setIndex: next.index };
      }
    }
    scheduleRestAlert(s, { body, extra });
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
    } catch (e) {
      // no audio support
    }
    setTimerEndsAt(Date.now() + s * 1000);
  }
  // The notification listener is registered once; route it through a ref so it
  // always calls the current closure (current settings, sessions and draft).
  startRestTimerRef.current = startRestTimer;

  function stopRestTimer() {
    setTimerEndsAt(null);
    cancelRestAlert();
  }

  function recordBackup() {
    const now = new Date().toISOString();
    setLastExportAt(now);
    storage.set('last-export', now).catch(() => {});
  }

  // Ask once for notification permission (used by the rest timer).
  useEffect(() => {
    ensurePermission();
  }, []);

  // Keep a ref of the live draft so notification callbacks can read it.
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  // Replying to the rest notification with an RPE (from the phone or a paired
  // Watch) logs it against the announced set and starts the next rest period.
  useEffect(() => {
    return onNotificationAction(({ inputValue, extra }) => {
      const rpe = parseFloat(inputValue);
      if (isNaN(rpe) || !extra || !extra.exerciseId) return;
      const clamped = String(Math.min(10, Math.max(1, rpe)));
      const targetId = extra.exerciseId;
      const targetIdx = extra.setIndex;
      setDraft((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          exercises: prev.exercises.map((ex) => {
            if (ex.exerciseId !== targetId) return ex;
            if (!ex.sets || targetIdx == null || !ex.sets[targetIdx]) return ex;
            return {
              ...ex,
              sets: ex.sets.map((s, i) => (i === targetIdx ? { ...s, rpe: clamped, hrAt: s.hrAt || Date.now() } : s)),
            };
          }),
        };
      });
      if (startRestTimerRef.current) startRestTimerRef.current(undefined, { exerciseId: targetId, index: targetIdx });
    });
  }, []);

  // Continuously persist where the user is + any in-progress workout draft, so an
  // accidental close restores exactly where they left off.
  useEffect(() => {
    if (loading) return;
    const snapshot = {
      view: ['log', ...TAB_VIEWS].includes(view) ? view : 'home',
      activeDayType,
      // Kept whichever screen is showing: a minimized workout survives a close too.
      draft: draft || null,
    };
    storage.set('ui-state', JSON.stringify(snapshot)).catch(() => {});
  }, [loading, view, activeDayType, draft]);

  // A view that has lost the thing it shows (template deleted, draft gone)
  // would otherwise be a dead end with no tab bar — send it home.
  useEffect(() => {
    if (loading) return;
    if (view === 'log' && !draft) setView('home');
    else if (view === 'templateEdit' && !templates.some((t) => t.id === editingTemplateId)) setView('templates');
    else if (view === 'exerciseEdit' && editingExerciseId !== 'new' && !libMap[editingExerciseId]) setView('exercises');
    else if (view === 'sessionEdit' && !editingSession) setView('history');
  }, [loading, view, draft, templates, editingTemplateId, editingExerciseId, editingSession, library]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      // Self-test: confirm storage actually round-trips in this environment before relying on it.
      try {
        const probe = 'probe-' + Date.now();
        await storage.set('storage-probe', probe);
        const readBack = await storage.get('storage-probe');
        if (!readBack || readBack.value !== probe) {
          if (!cancelled) setStorageError('Storage isn\'t saving correctly in this environment. Your log may not persist — export often as a backup.');
        }
      } catch (e) {
        if (!cancelled) setStorageError('Storage isn\'t available in this environment. Your log won\'t persist between sessions — export after each workout.');
      }
      let tpls = null;
      try {
        const res = await storage.get('templates');
        if (res && res.value) tpls = JSON.parse(res.value);
      } catch (e) {
        // no templates stored yet
      }
      if (!Array.isArray(tpls) || !tpls.length) {
        // Migrate a legacy single template if one exists; otherwise seed with the built-in U4L2.
        let legacyDays = null;
        try {
          const res = await storage.get('program-template');
          if (res && res.value) legacyDays = JSON.parse(res.value);
        } catch (e) {
          // no legacy template
        }
        tpls = [{ id: 'tpl-u4l2', name: 'U4L2', current: true, dayOrder: DAY_ORDER, days: legacyDays || DEFAULT_TEMPLATE }];
        try {
          await storage.set('templates', JSON.stringify(tpls));
        } catch (e) {
          // fall back to in-memory
        }
      }
      // Tolerate templates saved without a dayOrder or days map.
      tpls = tpls
        .filter((t) => t && t.id)
        .map((t) => ({ ...t, days: t.days && typeof t.days === 'object' ? t.days : {}, dayOrder: Array.isArray(t.dayOrder) ? t.dayOrder.filter((k) => t.days && t.days[k]) : Object.keys(t.days || {}) }));
      let sess = [];
      try {
        const res2 = await storage.get('workout-sessions');
        if (res2 && res2.value) sess = JSON.parse(res2.value);
      } catch (e) {
        // none logged yet
      }
      if (!Array.isArray(sess)) sess = [];
      sess = sess.filter((s) => s && Array.isArray(s.exercises));
      try {
        const exRes = await storage.get('last-export');
        if (exRes && exRes.value && !cancelled) setLastExportAt(exRes.value);
      } catch (e) {
        // never backed up
      }
      try {
        const hmRes = await storage.get('history-view-mode');
        if (hmRes && hmRes.value && !cancelled) setHistoryMode(hmRes.value);
      } catch (e) {
        // default to list
      }
      // Settings. Before the settings object existed the unit lived under its own key.
      let loadedSettings = DEFAULT_SETTINGS;
      try {
        const sRes = await storage.get('settings');
        if (sRes && sRes.value) {
          loadedSettings = normalizeSettings(JSON.parse(sRes.value));
        } else {
          const uRes = await storage.get('weight-unit');
          loadedSettings = normalizeSettings(uRes && UNITS[uRes.value] ? { unit: uRes.value } : {});
        }
      } catch (e) {
        // defaults
      }
      // Exercise library. First run builds it from every exercise the templates
      // and the log already know about; later runs only add anything missing.
      let lib = null;
      try {
        const lRes = await storage.get('exercises');
        if (lRes && lRes.value) lib = sanitizeLibrary(JSON.parse(lRes.value));
      } catch (e) {
        // build it below
      }
      const firstLibrary = lib === null;
      const synced = syncLibrary(lib || [], tpls, sess, firstLibrary);
      if (firstLibrary || synced !== lib) {
        try {
          await storage.set('exercises', JSON.stringify(synced));
        } catch (e) {
          // in-memory only
        }
      }
      // Restore prior UI state (including an in-progress workout draft) if present.
      let restored = null;
      try {
        const uiRes = await storage.get('ui-state');
        if (uiRes && uiRes.value) restored = JSON.parse(uiRes.value);
      } catch (e) {
        // no saved state
      }
      if (!cancelled) {
        setTemplates(tpls);
        setSessions(sess);
        setSettings(loadedSettings);
        setLibrary(synced);
        if (restored && restored.view) {
          const rd = restored.draft && Array.isArray(restored.draft.exercises) ? restored.draft : null;
          // Drafts saved by older builds kept their day only in activeDayType.
          const rdDay = rd ? rd.dayType || (restored.view === 'log' ? restored.activeDayType : null) : null;
          if (rd && rdDay) setDraft({ ...rd, dayType: rdDay });
          if (restored.view === 'log' && rd && rdDay) {
            setView('log');
          } else if (restored.view !== 'log' && TAB_VIEWS.includes(restored.view)) {
            const cur = tpls.find((t) => t.current) || tpls[0];
            // A per-day history view only makes sense if that day still exists.
            const dayOk = restored.activeDayType && cur && cur.days && cur.days[restored.activeDayType];
            setActiveDayType(dayOk ? restored.activeDayType : null);
            setView(restored.view);
          }
        }
        setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function persistTemplates(next) {
    setTemplates(next);
    try {
      const result = await storage.set('templates', JSON.stringify(next));
      if (!result) throw new Error('storage.set returned falsy result');
      setStorageError(null);
    } catch (e) {
      console.error('Failed to save templates', e);
      setStorageError('Could not save your templates. They may not persist after you close this.');
    }
  }

  async function persistLibrary(next) {
    setLibrary(next);
    try {
      const result = await storage.set('exercises', JSON.stringify(next));
      if (!result) throw new Error('storage.set returned falsy result');
    } catch (e) {
      console.error('Failed to save exercises', e);
      setStorageError('Could not save your exercises. They may not persist after you close this.');
    }
  }

  async function persistTemplateDays(templateId, newDays) {
    if (!templateId) return;
    await persistTemplates(templates.map((t) => (t.id === templateId ? { ...t, days: newDays } : t)));
  }

  function setCurrentTemplate(id) {
    persistTemplates(templates.map((t) => ({ ...t, current: t.id === id })));
  }

  function addTemplate(name, defaultSets) {
    const id = newId();
    const tpl = { id, name, current: false, dayOrder: [], days: {} };
    const n = parseInt(defaultSets, 10);
    if (!isNaN(n) && n >= 1 && n !== settings.defaultSets) tpl.defaultSets = n;
    persistTemplates([...templates, tpl]);
    setEditingTemplateId(id);
    setView('templateEdit');
  }

  function duplicateTemplate(id) {
    const src = templates.find((t) => t.id === id);
    if (!src) return;
    const copy = JSON.parse(JSON.stringify(src));
    copy.id = newId();
    copy.name = src.name + ' (copy)';
    copy.current = false;
    persistTemplates([...templates, copy]);
    showToast('Template duplicated');
  }

  function deleteTemplate(id) {
    const next = templates.filter((t) => t.id !== id);
    if (next.length && !next.some((t) => t.current)) next[0] = { ...next[0], current: true };
    persistTemplates(next);
  }

  function saveTemplateEdits(id, changes) {
    const orig = templates.find((t) => t.id === id);
    const origNames = {};
    if (orig) {
      Object.keys(orig.days || {}).forEach((dk) => {
        ((orig.days[dk] || {}).exercises || []).forEach((e) => { origNames[e.id] = e.name; });
      });
    }
    // The library is the source of truth for names. An exercise renamed in this
    // editor is renamed everywhere; one that's new to the app joins the library.
    const renames = {};
    const additions = [];
    const added = new Set();
    const used = new Set();
    Object.keys(changes.days).forEach((dk) => {
      (changes.days[dk].exercises || []).forEach((e) => {
        used.add(e.id);
        if (!libMap[e.id]) {
          if (!added.has(e.id)) {
            added.add(e.id);
            additions.push(makeLibEntry(e.id, e.name, e.type, true));
          }
        } else if (origNames[e.id] !== undefined && origNames[e.id] !== e.name) {
          renames[e.id] = e.name;
        }
      });
    });
    let nextTemplates = templates.map((t) => {
      if (t.id !== id) return t;
      const merged = { ...t, ...changes };
      if (changes.defaultSets === undefined) delete merged.defaultSets;
      return merged;
    });
    if (Object.keys(renames).length) {
      nextTemplates = nextTemplates.map((t) => {
        const days = {};
        Object.keys(t.days || {}).forEach((dk) => {
          const day = t.days[dk];
          days[dk] = { ...day, exercises: (day.exercises || []).map((e) => (renames[e.id] ? { ...e, name: renames[e.id] } : e)) };
        });
        return { ...t, days };
      });
    }
    persistTemplates(nextTemplates);
    const needsUnarchive = library.some((l) => l.archived && used.has(l.id));
    if (additions.length || Object.keys(renames).length || needsUnarchive) {
      persistLibrary(
        library
          .map((l) => {
            let out = l;
            if (renames[l.id]) out = { ...out, name: renames[l.id] };
            if (out.archived && used.has(out.id)) {
              out = { ...out };
              delete out.archived;
            }
            return out;
          })
          .concat(additions)
      );
    }
    setEditingTemplateId(null);
    setView('templates');
    showToast('Template saved');
  }

  /* ---- exercise library ---- */

  function saveExercise(entry) {
    if (entry.id && libMap[entry.id]) {
      const prev = libMap[entry.id];
      persistLibrary(library.map((l) => (l.id === entry.id ? entry : l)));
      if (prev.name !== entry.name || prev.type !== entry.type) {
        persistTemplates(templates.map((t) => {
          const days = {};
          Object.keys(t.days || {}).forEach((dk) => {
            const day = t.days[dk];
            days[dk] = { ...day, exercises: (day.exercises || []).map((e) => (e.id === entry.id ? { ...e, name: entry.name, type: entry.type } : e)) };
          });
          return { ...t, days };
        }));
      }
      showToast('Exercise saved');
    } else {
      persistLibrary([...library, { ...entry, id: newId() }]);
      showToast('Exercise added');
    }
    setEditingExerciseId(null);
    setView('exercises');
  }

  function deleteLibraryExercise(id) {
    const hasHistory = sessions.some((s) => (s.exercises || []).some((e) => e.exerciseId === id));
    // Take it out of every template day, and drop weight links that pointed at it.
    persistTemplates(templates.map((t) => {
      const days = {};
      Object.keys(t.days || {}).forEach((dk) => {
        const day = t.days[dk];
        days[dk] = {
          ...day,
          exercises: (day.exercises || [])
            .filter((e) => e.id !== id)
            .map((e) => {
              if (!e.derivedFrom || e.derivedFrom.sourceId !== id) return e;
              const copy = { ...e };
              delete copy.derivedFrom;
              return copy;
            }),
        };
      });
      return { ...t, days };
    }));
    // With logged history the entry is kept (hidden) so the history keeps its
    // name and the exercise can be restored; without any it's deleted outright.
    persistLibrary(hasHistory ? library.map((l) => (l.id === id ? { ...l, archived: true } : l)) : library.filter((l) => l.id !== id));
    setEditingExerciseId(null);
    setView('exercises');
    showToast('Exercise removed');
  }

  function restoreExercise(id) {
    persistLibrary(library.map((l) => {
      if (l.id !== id) return l;
      const copy = { ...l };
      delete copy.archived;
      return copy;
    }));
    showToast('Exercise restored');
  }

  async function persistSessions(newSessions) {
    setSessions(newSessions);
    try {
      const result = await storage.set('workout-sessions', JSON.stringify(newSessions));
      if (!result) throw new Error('storage.set returned falsy result');
      // Verify by reading back immediately — catches environments where set() resolves but doesn't persist.
      const check = await storage.get('workout-sessions');
      if (!check || !check.value) throw new Error('verification read failed after write');
      const parsedBack = JSON.parse(check.value);
      if (!Array.isArray(parsedBack) || parsedBack.length !== newSessions.length) {
        throw new Error('verification read did not match what was written');
      }
      setStorageError(null);
      return true;
    } catch (e) {
      console.error('Failed to save sessions', e);
      setStorageError('Your last workout may not have saved. Screenshot this session before leaving, then try Retry below.');
      return false;
    }
  }

  function getLastExerciseData(exerciseId) {
    let deloadFallback = null;
    for (let i = sessions.length - 1; i >= 0; i--) {
      const found = sessions[i].exercises.find((e) => e.exerciseId === exerciseId);
      if (found) {
        if (!sessions[i].deload) return found;
        if (!deloadFallback) deloadFallback = found;
      }
    }
    return deloadFallback;
  }

  function getSuggestion(exerciseId) {
    if (draft && draft.deload) return { kind: 'deload', text: 'Deload — crisp reps, stop @6' };
    const hist = [];
    for (let i = sessions.length - 1; i >= 0 && hist.length < 3; i--) {
      if (sessions[i].deload) continue;
      const found = sessions[i].exercises.find((e) => e.exerciseId === exerciseId && e.type === 'strength');
      if (found) {
        let top = null;
        found.sets.forEach((s) => {
          const e = epley(s.weight, s.reps);
          if (e !== null && (!top || e > top.e1rm)) top = { weight: s.weight, reps: s.reps, rpe: s.rpe, e1rm: e };
        });
        if (top) hist.push(top);
      }
    }
    let target = null;
    Object.keys(draftDays).forEach((dk) => {
      const found = ((draftDays[dk] || {}).exercises || []).find((e) => e.id === exerciseId);
      if (found && found.target) target = found.target;
    });
    const lib = libMap[exerciseId];
    return buildSuggestion(hist, target, unit, { hold: !!(lib && lib.hold) });
  }

  function applyDeloadTransform(exercises) {
    const maxSets = settings.deloadSets;
    return exercises.map((ex) => {
      if (ex.type !== 'strength') return ex;
      let base = ex.sets[0] && ex.sets[0].weight !== '' ? parseFloat(ex.sets[0].weight) : NaN;
      if (isNaN(base)) {
        const last = getLastExerciseData(ex.exerciseId);
        if (last && last.sets && last.sets[0] && last.sets[0].weight != null) base = parseFloat(last.sets[0].weight);
      }
      const dw = !isNaN(base) ? kgStr(roundWeightToStep(base * (settings.deloadPct / 100), unit)) : '';
      const keep = ex.sets.slice(0, maxSets).map((s) => ({ weight: dw, reps: s.reps, rpe: '' }));
      while (keep.length < Math.min(2, maxSets)) keep.push({ weight: dw, reps: '', rpe: '' });
      return { ...ex, sets: keep, touched: true };
    });
  }

  function toggleDeload() {
    if (!draft) return;
    if (draft.deload) {
      // Rebuild the day fresh at normal loads (wipes entered sets), keeping the clock and the note.
      const fresh = buildDraft(draftTemplate, draft.dayType);
      if (!fresh) return;
      setDraft({ ...fresh, startedAt: draft.startedAt, note: draft.note, deload: false });
    } else {
      setDraft((prev) => ({ ...prev, deload: true, exercises: applyDeloadTransform(prev.exercises) }));
    }
  }

  /** A fresh workout draft for one day of a template, or null if the day is gone. */
  function buildDraft(tpl, dayType) {
    const day = (tpl.days || {})[dayType];
    if (!day) return null;
    const draftExercises = (day.exercises || []).map((ex) => {
      if (ex.type !== 'strength') {
        return { exerciseId: ex.id, name: ex.name, type: 'conditioning', notes: '' };
      }
      const last = getLastExerciseData(ex.id);
      // Set count: the default is exercise-in-this-day -> exercise -> template -> global.
      // Unless the user asked to always use defaults, last session's count wins.
      let n = resolveDefaultSets(ex, libMap[ex.id], tpl);
      if (settings.setCountSource === 'history' && last && last.sets && last.sets.length) n = last.sets.length;
      const sets = Array.from({ length: n }, () => ({ weight: '', reps: '', rpe: '' }));
      // Linked exercises are perpetual: their weight always re-derives from the source,
      // even when they have their own history (reps/RPE still prefill from history above).
      return { exerciseId: ex.id, name: ex.name, type: 'strength', sets, touched: false, derivedFrom: ex.derivedFrom || null, forceDerive: !!ex.derivedFrom, superset: ex.superset || null, collapsed: false };
    });

    // Apply derived weights (e.g. RDL = 75% of deadlift) from this session's pre-filled source weight.
    draftExercises.forEach((ex) => {
      if (ex.derivedFrom && (ex.forceDerive || !ex.touched)) {
        // Same-day source: read from today's prefilled draft (stays live as it's edited).
        // Cross-day source: read the source's last logged weight from history.
        const inDraft = draftExercises.find((e) => e.exerciseId === ex.derivedFrom.sourceId);
        let srcWeight = inDraft && inDraft.sets && inDraft.sets[0] ? inDraft.sets[0].weight : '';
        if (srcWeight === '') {
          const hist = getLastExerciseData(ex.derivedFrom.sourceId);
          if (hist && hist.sets && hist.sets[0] && hist.sets[0].weight != null) srcWeight = String(hist.sets[0].weight);
        }
        if (srcWeight !== '') {
          const w = parseFloat(srcWeight);
          if (!isNaN(w)) {
            const derived = kgStr(roundWeightToStep(w * ex.derivedFrom.factor, unit));
            ex.sets = ex.sets.map((s) => ({ ...s, weight: derived }));
          }
        }
      }
    });

    // The day's label and colour are snapshotted so the workout still reads
    // correctly if its template is edited, switched or deleted mid-session.
    return { exercises: draftExercises, startedAt: Date.now(), dayType, templateId: tpl.id, dayLabel: day.label, colorKey: day.colorKey };
  }

  function beginSession(dayType) {
    const fresh = buildDraft(currentTemplate, dayType);
    if (!fresh) return;
    stopRestTimer();
    setDraft(fresh);
    setTimerPreset(null);
    setEditMode(false);
    setView('log');
  }

  function resumeSession() {
    if (!draft) return;
    setEditMode(false);
    setView('log');
  }

  function startSession(dayType) {
    if (draft) {
      const sameWorkout = draft.dayType === dayType && (!draft.templateId || draft.templateId === currentTemplate.id);
      if (sameWorkout) {
        resumeSession();
        return;
      }
      // Another workout is minimized. If anything has been entered, ask first.
      if (draftHasData(draft)) {
        setPendingStart(dayType);
        return;
      }
    }
    beginSession(dayType);
  }

  /** Leave the workout running and go use the rest of the app. */
  function minimizeSession() {
    setEditMode(false);
    setActiveDayType(null);
    setView('home');
  }

  /** End the workout without saving it. */
  function goBack() {
    setView('home');
    setActiveDayType(null);
    setDraft(null);
    setEditMode(false);
    stopRestTimer();
  }

  function openHistory(dayType) {
    setActiveDayType(dayType);
    setView('history');
  }

  function openAllHistory() {
    setActiveDayType(null);
    setView('history');
  }

  async function importData(incoming, opts) {
    const existingSessionIds = new Set(sessions.map((s) => s.id));
    const freshSessions = incoming.sessions.filter((s) => !existingSessionIds.has(s.id));
    let nextSessions = sessions;
    if (freshSessions.length) {
      nextSessions = [...sessions, ...freshSessions].sort((a, b) => new Date(a.date) - new Date(b.date));
      await persistSessions(nextSessions);
    }

    const existingTemplateIds = new Set(templates.map((t) => t.id));
    let freshTemplates = incoming.templates.filter((t) => !existingTemplateIds.has(t.id));
    let nextTemplates = templates;
    if (freshTemplates.length) {
      // Never import a second "current" template — the one already on this device wins.
      // The exception is a device with nothing logged yet (a fresh install being
      // restored from a backup): there the backup's current template takes over.
      const restoring = sessions.length === 0 && freshTemplates.some((t) => t.current);
      const hasCurrent = !restoring && templates.some((t) => t.current);
      let seenCurrent = false;
      freshTemplates = freshTemplates.map((t) => {
        const current = !hasCurrent && !!t.current && !seenCurrent;
        if (current) seenCurrent = true;
        return { ...t, current };
      });
      if (!hasCurrent && !seenCurrent && !templates.length) {
        freshTemplates[0] = { ...freshTemplates[0], current: true };
      }
      nextTemplates = [...(restoring ? templates.map((t) => ({ ...t, current: false })) : templates), ...freshTemplates];
      await persistTemplates(nextTemplates);
    }

    // Exercises: take the backup's entries for anything not already here, then
    // make sure everything the imported templates and sessions use exists.
    // For an exercise that exists on both sides, what's here wins — but details
    // that are blank here (equipment, notes, set count, rest) are filled from the backup.
    const have = new Set(library.map((l) => l.id));
    const incomingLib = sanitizeLibrary(incoming.exercises);
    const incomingById = {};
    incomingLib.forEach((l) => { incomingById[l.id] = l; });
    const freshLib = incomingLib.filter((l) => !have.has(l.id));
    let filled = false;
    const mergedLocal = library.map((l) => {
      const inc = incomingById[l.id];
      if (!inc) return l;
      const out = { ...l };
      ['equipment', 'notes', 'defaultSets', 'restSec', 'hold'].forEach((k) => {
        if (!out[k] && inc[k]) { out[k] = inc[k]; filled = true; }
      });
      return out;
    });
    const usedInTemplates = new Set();
    nextTemplates.forEach((t) => Object.keys(t.days || {}).forEach((dk) => ((t.days[dk] || {}).exercises || []).forEach((e) => usedInTemplates.add(e.id))));
    let nextLib = freshLib.length || filled ? [...mergedLocal, ...freshLib] : library;
    if (nextLib.some((l) => l.archived && usedInTemplates.has(l.id))) {
      nextLib = nextLib.map((l) => {
        if (!l.archived || !usedInTemplates.has(l.id)) return l;
        const copy = { ...l };
        delete copy.archived;
        return copy;
      });
    }
    nextLib = syncLibrary(nextLib, nextTemplates, nextSessions, true);
    if (nextLib !== library) await persistLibrary(nextLib);

    let settingsReplaced = false;
    if (opts && opts.replaceSettings && incoming.settings) {
      persistSettings(normalizeSettings(incoming.settings));
      settingsReplaced = true;
    }

    return {
      addedSessions: freshSessions.length,
      skippedSessions: incoming.sessions.length - freshSessions.length,
      addedTemplates: freshTemplates.length,
      skippedTemplates: incoming.templates.length - freshTemplates.length,
      addedExercises: nextLib.length - library.length,
      settingsReplaced,
    };
  }

  async function fetchDraftHR() {
    if (!draft || !draft.startedAt) return;
    setDraft((prev) => ({ ...prev, hrError: null, hrLoading: true }));
    try {
      const full = await fetchHRSummary(draft.startedAt, Date.now());
      const hr = { avg: full.avg, max: full.max, min: full.min, count: full.count };
      setDraft((prev) => (prev ? {
        ...prev,
        hr,
        hrLoading: false,
        exercises: backfillSetHRs(prev.exercises, full.samples),
      } : prev));
    } catch (e) {
      setDraft((prev) => (prev ? { ...prev, hrError: e.message || 'Could not read heart rate', hrLoading: false } : prev));
    }
  }

  async function fetchSessionHR(session) {
    const startMs = new Date(session.date).getTime();
    const endMs = startMs + (session.durationSec ? session.durationSec * 1000 : 3600 * 1000);
    const full = await fetchHRSummary(startMs, endMs);
    const hr = { avg: full.avg, max: full.max, min: full.min, count: full.count };
    const backfilled = backfillSetHRs(session.exercises, full.samples);
    const updated = sessions.map((s) => (s.id === session.id ? { ...s, hr, exercises: backfilled } : s));
    await persistSessions(updated);
    if (editingSession && editingSession.id === session.id) {
      setEditingSession({ ...editingSession, hr, exercises: backfilled });
    }
    return hr;
  }

  function updateSessionNote(text) {
    setDraft((prev) => ({ ...prev, note: text }));
  }

  function openSession(session) {
    setEditingSession(session);
    setView('sessionEdit');
  }

  function deleteSession(sessionId) {
    persistSessions(sessions.filter((s) => s.id !== sessionId));
    setEditingSession(null);
    setView('history');
    showToast('Session deleted');
  }

  function saveSessionEdits(sessionId, exercises, durationSec, note) {
    const updated = sessions.map((s) => (s.id === sessionId ? { ...s, exercises, durationSec, note } : s));
    persistSessions(updated);
    setEditingSession(null);
    setView('history');
    showToast('Session saved');
  }

  function updateSet(exerciseId, idx, field, value) {
    if (field === 'rpe' && value !== '' && view === 'log' && settings.restAutoStart) {
      startRestTimer(undefined, { exerciseId, index: idx });
    }
    setDraft((prev) => {
      let exercises = prev.exercises.map((ex) => {
        if (ex.exerciseId !== exerciseId) return ex;
        const newSets = ex.sets.map((s, i) => (i === idx ? { ...s, [field]: value } : s));
        const touched = ex.derivedFrom && field === 'weight' ? true : ex.touched;
        return { ...ex, sets: newSets, touched };
      });

      // If a source weight changed, refresh any derived exercises that haven't been manually edited.
      if (field === 'weight') {
        exercises = exercises.map((ex) => {
          if (ex.derivedFrom && ex.derivedFrom.sourceId === exerciseId && !ex.touched) {
            const source = exercises.find((e) => e.exerciseId === exerciseId);
            const srcWeight = source && source.sets[0] ? source.sets[0].weight : '';
            if (srcWeight === '') {
              return { ...ex, sets: ex.sets.map((s) => ({ ...s, weight: '' })) };
            }
            const w = parseFloat(srcWeight);
            if (!isNaN(w)) {
              const derived = kgStr(roundWeightToStep(w * ex.derivedFrom.factor, unit));
              return { ...ex, sets: ex.sets.map((s) => ({ ...s, weight: derived })) };
            }
          }
          return ex;
        });
      }
      return { ...prev, exercises };
    });
  }

  function addSet(exerciseId) {
    setDraft((prev) => ({
      ...prev,
      exercises: prev.exercises.map((ex) => {
        if (ex.exerciseId !== exerciseId) return ex;
        const lastSet = ex.sets[ex.sets.length - 1];
        return { ...ex, sets: [...ex.sets, { weight: (lastSet && lastSet.weight) || '', reps: (lastSet && lastSet.reps) || '', rpe: '' }], collapsed: false };
      }),
    }));
  }

  function removeSet(exerciseId, idx) {
    setDraft((prev) => ({
      ...prev,
      exercises: prev.exercises.map((ex) => {
        if (ex.exerciseId !== exerciseId) return ex;
        const newSets = ex.sets.filter((_, i) => i !== idx);
        return { ...ex, sets: newSets.length ? newSets : [{ weight: '', reps: '', rpe: '' }] };
      }),
    }));
  }

  function updateNotes(exerciseId, text) {
    setDraft((prev) => ({
      ...prev,
      exercises: prev.exercises.map((ex) => (ex.exerciseId === exerciseId ? { ...ex, notes: text } : ex)),
    }));
  }

  function addExercise(dayType, name, type, existingId) {
    // Typing the exact name of an exercise that already exists reuses it.
    const typedMatch = !existingId ? library.find((l) => !l.archived && l.name.toLowerCase() === name.toLowerCase()) : null;
    const known = existingId ? libMap[existingId] : typedMatch;
    const id = known ? known.id : existingId || newId();
    const exName = known ? known.name : name;
    const exType = known ? known.type : type;
    // Guard: if the exercise is already in today's draft, don't add it twice.
    if (draft && draft.exercises.some((e) => e.exerciseId === id)) return;
    const day = draftDays[dayType];
    if (day && !(day.exercises || []).some((e) => e.id === id)) {
      persistTemplateDays(draftTemplate.id, {
        ...draftDays,
        [dayType]: { ...day, exercises: [...(day.exercises || []), { id, name: exName, type: exType }] },
      });
    }
    if (!known) persistLibrary([...library, makeLibEntry(id, exName, exType, true)]);
    const n = resolveDefaultSets(null, known, draftTemplate);
    setDraft((prev) => ({
      ...prev,
      exercises: [
        ...prev.exercises,
        exType === 'strength'
          ? { exerciseId: id, name: exName, type: exType, sets: Array.from({ length: n }, () => ({ weight: '', reps: '', rpe: '' })), touched: false, derivedFrom: null }
          : { exerciseId: id, name: exName, type: exType, notes: '' },
      ],
    }));
  }

  function handleRpeBlur(exerciseId, idx) {
    let shouldFetchHR = false;
    setDraft((prev) => ({
      ...prev,
      exercises: prev.exercises.map((ex) => {
        if (ex.exerciseId !== exerciseId) return ex;
        const isLast = idx === ex.sets.length - 1;
        const filled = ex.sets[idx] && ex.sets[idx].rpe !== '';
        if (filled) shouldFetchHR = true;
        // Stamp the entry time on the set; backfill computes HR from it later.
        const stamped = filled
          ? { ...ex, sets: ex.sets.map((s, i) => (i === idx && !s.hrAt ? { ...s, hrAt: Date.now() } : s)) }
          : ex;
        return isLast && filled && settings.autoCollapse ? { ...stamped, collapsed: true } : stamped;
      }),
    }));
    // Per-set HR: max bpm over the trailing 90s catches the post-set peak.
    if (shouldFetchHR) {
      fetchRecentMaxHR().then((bpm) => {
        if (bpm == null) return;
        setDraft((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            exercises: prev.exercises.map((ex) => {
              if (ex.exerciseId !== exerciseId) return ex;
              return { ...ex, sets: ex.sets.map((s, i) => (i === idx ? { ...s, hr: bpm } : s)) };
            }),
          };
        });
      });
    }
  }

  function toggleCollapse(exerciseId) {
    setDraft((prev) => ({
      ...prev,
      exercises: prev.exercises.map((ex) => (ex.exerciseId === exerciseId ? { ...ex, collapsed: !ex.collapsed } : ex)),
    }));
  }

  function moveDraftExercise(exerciseId, dir) {
    setDraft((prev) => ({ ...prev, exercises: moveExerciseBlock(prev.exercises, exerciseId, dir) }));
  }

  function removeExercise(exerciseId, fromTemplateToo) {
    const day = draft ? draftDays[draft.dayType] : null;
    if (fromTemplateToo && day) {
      persistTemplateDays(draftTemplate.id, {
        ...draftDays,
        [draft.dayType]: { ...day, exercises: (day.exercises || []).filter((e) => e.id !== exerciseId) },
      });
    }
    setDraft((prev) => ({
      ...prev,
      exercises: prev.exercises.filter((e) => e.exerciseId !== exerciseId),
    }));
  }

  async function finishSession() {
    setSaving(true);
    const cleanExercises = draft.exercises
      .map((ex) => {
        if (ex.type === 'strength') {
          const sets = ex.sets
            .filter((s) => s.weight !== '' || s.reps !== '' || s.rpe !== '')
            .map((s) => ({ weight: s.weight, reps: s.reps, rpe: s.rpe, hr: s.hr, hrAt: s.hrAt }));
          return sets.length ? { exerciseId: ex.exerciseId, name: ex.name, type: 'strength', sets } : null;
        }
        return ex.notes && ex.notes.trim() ? { exerciseId: ex.exerciseId, name: ex.name, type: 'conditioning', notes: ex.notes } : null;
      })
      .filter(Boolean);

    if (cleanExercises.length === 0) {
      setSaving(false);
      goBack();
      return;
    }

    const durationSec = draft.startedAt ? Math.round((Date.now() - draft.startedAt) / 1000) : null;
    const newSession = {
      id: 's-' + Date.now(),
      dayType: draft.dayType,
      dayLabel: draftDay.label,
      colorKey: draftDay.colorKey,
      date: new Date().toISOString(),
      durationSec,
      note: draft.note && draft.note.trim() ? draft.note.trim() : undefined,
      deload: draft.deload || undefined,
      hr: draft.hr || undefined,
      exercises: cleanExercises,
    };
    // PR check: compare this session's best e1RM per exercise against all prior history.
    const prior = bestE1rmByName(sessions, nameOf);
    const prs = [];
    cleanExercises.forEach((ex) => {
      if (ex.type !== 'strength') return;
      let best = null;
      ex.sets.forEach((set) => {
        const e = epley(set.weight, set.reps);
        if (e !== null && (best === null || e > best)) best = e;
      });
      if (best !== null && best > (prior[nameOf(ex)] || 0)) prs.push({ name: nameOf(ex), e1rm: Math.round(best * 2) / 2 });
    });

    const ok = await persistSessions([...sessions, newSession]);
    setSaving(false);
    if (ok) {
      setNewPRs(!draft.deload && prs.length ? prs : null);
      goBack();
      showToast('Workout saved');
    }
    // if save failed, stay on the log screen with the banner showing — nothing is lost, user can hit Retry
  }

  const reminderMs = settings.backupReminderDays * 86400000;
  const backupDue = settings.backupReminderDays > 0 && sessions.length > 0 && (!lastExportAt || (Date.now() - new Date(lastExportAt).getTime()) > reminderMs);
  const knownExercises = library.filter((l) => !l.archived);
  const showTabs = !loading && TAB_VIEWS.includes(view);
  const editingTemplate = view === 'templateEdit' ? templates.find((t) => t.id === editingTemplateId) : null;
  const editingExercise = view === 'exerciseEdit' && editingExerciseId !== 'new' ? libMap[editingExerciseId] : null;

  function renderView() {
    if (loading) return <LoadingState />;
    if (view === 'settings') {
      return <SettingsView settings={settings} onChange={updateSettings} onReset={() => { persistSettings(normalizeSettings({ unit: settings.unit })); showToast('Settings reset'); }} sessions={sessions} lastExportAt={lastExportAt} onOpenBackup={() => setView('export')} />;
    }
    if (view === 'export') {
      return (
        <ExportView
          exportText={buildExportText(templates, sessions, library, settings)}
          counts={{ sessions: sessions.length, templates: templates.length, exercises: knownExercises.length }}
          onImport={importData}
          onCopied={recordBackup}
          onBack={() => setView('settings')}
        />
      );
    }
    if (view === 'log' && draft) {
      return (
        <LogView
          dayType={draft.dayType}
          template={{ ...draftDays, [draft.dayType]: draftDay }}
          draft={draft}
          editMode={editMode}
          setEditMode={setEditMode}
          unit={unit}
          libMap={libMap}
          onMinimize={minimizeSession}
          onUpdateSet={updateSet}
          onAddSet={addSet}
          onRemoveSet={removeSet}
          onUpdateNotes={updateNotes}
          onAddExercise={addExercise}
          onRemoveExercise={removeExercise}
          onMoveExercise={moveDraftExercise}
          onToggleCollapse={toggleCollapse}
          onRpeBlur={handleRpeBlur}
          knownExercises={knownExercises}
          onFetchHR={fetchDraftHR}
          timerEndsAt={timerEndsAt}
          timerPreset={timerPreset || settings.restDefault}
          onTimerStart={startRestTimer}
          onFinish={finishSession}
          saving={saving}
          getLastExerciseData={getLastExerciseData}
          getSuggestion={getSuggestion}
          onToggleDeload={toggleDeload}
          onUpdateSessionNote={updateSessionNote}
          onCancel={goBack}
        />
      );
    }
    if (view === 'records') return <RecordsView sessions={sessions} unit={unit} nameOf={nameOf} />;
    if (view === 'templates') {
      return <TemplatesView templates={templates} onSetCurrent={setCurrentTemplate} onEdit={(id) => { setEditingTemplateId(id); setView('templateEdit'); }} onAdd={addTemplate} onDelete={deleteTemplate} onDuplicate={duplicateTemplate} />;
    }
    if (view === 'templateEdit' && editingTemplate) {
      return <TemplateEditView key={editingTemplate.id} template={editingTemplate} library={library} onBack={() => { setEditingTemplateId(null); setView('templates'); }} onSave={saveTemplateEdits} />;
    }
    if (view === 'exercises') {
      return (
        <ExercisesView
          library={library}
          usage={buildUsageIndex(templates, sessions)}
          onOpen={(id) => { setEditingExerciseId(id); setView('exerciseEdit'); }}
          onAdd={() => { setEditingExerciseId('new'); setView('exerciseEdit'); }}
          onRestore={restoreExercise}
        />
      );
    }
    if (view === 'exerciseEdit' && (editingExerciseId === 'new' || editingExercise)) {
      return (
        <ExerciseEditView
          key={editingExerciseId}
          entry={editingExercise}
          usage={editingExercise ? buildUsageIndex(templates, sessions)[editingExercise.id] : null}
          library={library}
          settings={settings}
          unit={unit}
          onSave={saveExercise}
          onDelete={deleteLibraryExercise}
          onBack={() => { setEditingExerciseId(null); setView('exercises'); }}
        />
      );
    }
    if (view === 'history') {
      return <HistoryView dayType={activeDayType} template={template} sessions={sessions} unit={unit} onBack={() => { setActiveDayType(null); setView('home'); }} onOpenSession={openSession} mode={historyMode} onSetMode={setHistoryModePersist} />;
    }
    if (view === 'sessionEdit' && editingSession) {
      return <SessionEditView key={editingSession.id} session={editingSession} template={template} unit={unit} nameOf={nameOf} onBack={() => { setEditingSession(null); setView('history'); }} onSave={saveSessionEdits} onDelete={deleteSession} onFetchSessionHR={fetchSessionHR} />;
    }
    return (
      <HomeView
        template={template}
        dayOrder={currentTemplate.dayOrder || []}
        templateName={currentTemplate.name}
        sessions={sessions}
        unit={unit}
        onStart={startSession}
        onHistory={openHistory}
        onOpenBackup={() => setView('export')}
        onOpenTemplates={() => setView('templates')}
        newPRs={newPRs}
        onDismissPRs={() => setNewPRs(null)}
        backupDue={backupDue}
        lastExportAt={lastExportAt}
        inProgressDay={draft && draftTemplate.id === currentTemplate.id ? draft.dayType : null}
      />
    );
  }

  // The session strip shows on the tab screens while a workout is minimized.
  const minimized = !!draft && showTabs;

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900">
      <style>{`
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
        /* iOS Safari auto-zooms on focus when input font-size < 16px; pin everything to 16px */
        input, textarea, select { font-size: 16px !important; }
      `}</style>
      <div className={'max-w-md mx-auto px-4 pt-6 relative ' + (minimized ? 'pb-44' : 'pb-28')}>
        {showTabs && view !== 'export' && (
          <button
            onClick={() => setView(view === 'settings' ? 'home' : 'settings')}
            className={'absolute right-2 top-4 p-2.5 ' + (view === 'settings' ? 'text-stone-900' : 'text-stone-400 hover:text-stone-700')}
            aria-label={view === 'settings' ? 'Close settings' : 'Settings'}
            aria-pressed={view === 'settings'}
            style={{ zIndex: 10 }}
          >
            {view === 'settings' ? <X size={22} /> : <SettingsIcon size={21} />}
          </button>
        )}
        <ErrorBoundary>
          <StorageBanner
            message={storageError}
            onRetry={async () => {
              setSaving(true);
              await persistSessions(sessions);
              setSaving(false);
            }}
            retrying={saving}
          />
          {renderView()}
        </ErrorBoundary>
      </div>
      {showTabs && (
        <BottomTabs
          active={view === 'history' && activeDayType ? 'home' : view}
          above={minimized ? <SessionBar draft={draft} label={draftDay.label} colorKey={draftDay.colorKey} onResume={resumeSession} /> : null}
          onSelect={(key) => {
            setEditingSession(null);
            setEditingTemplateId(null);
            setEditingExerciseId(null);
            if (key === 'history') {
              openAllHistory();
            } else {
              setActiveDayType(null);
              setView(key);
            }
          }}
        />
      )}
      {/* Lives here, not in the log screen, so rest keeps counting down (and beeps) while the workout is minimized. */}
      {draft && timerEndsAt && <FloatingTimer endsAt={timerEndsAt} onDismiss={stopRestTimer} audioCtxRef={audioCtxRef} low={minimized} />}
      {pendingStart && draft && (
        <div className="fixed inset-0 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)', zIndex: 80 }} role="dialog" aria-modal="true">
          <div className="bg-white rounded-sm border border-stone-300 w-full max-w-sm p-4">
            <div className="text-sm font-black uppercase tracking-tight text-stone-900 mb-1">{draftDay.label} is still in progress</div>
            <div className="text-xs text-stone-600 leading-relaxed">Only one workout can run at a time. Starting {(template[pendingStart] || {}).label || 'a new one'} throws away what you've entered for {draftDay.label}.</div>
            <div className="space-y-2 mt-4">
              <button onClick={() => { setPendingStart(null); resumeSession(); }} className="w-full text-xs uppercase tracking-widest text-white bg-stone-800 hover:bg-stone-700 rounded-sm py-3 font-bold">Resume {draftDay.label}</button>
              <button onClick={() => { const d = pendingStart; setPendingStart(null); beginSession(d); }} className="w-full text-xs uppercase tracking-widest text-red-600 border border-red-300 rounded-sm py-3">Discard it and start {(template[pendingStart] || {}).label || 'new'}</button>
              <button onClick={() => setPendingStart(null)} className="w-full text-xs uppercase tracking-widest text-stone-600 border border-stone-300 rounded-sm py-3">Cancel</button>
            </div>
          </div>
        </div>
      )}
      <Toast message={toast && toast.message} raised={minimized} />
    </div>
  );
}
