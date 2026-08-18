import React, { useState, useEffect, useRef } from 'react';
import {
  Plus, X, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Check, Loader2,
  History as HistoryIcon, Pencil, Clock, Download, Copy, Trophy, Timer, Square,
  Layers, Star, Dumbbell, Link2, Flame, TrendingUp, Calendar as CalendarIcon,
  List, Target, Settings as SettingsIcon, Scale, Sailboat,
} from 'lucide-react';
import { storage } from './storage';
import { scheduleRestAlert, cancelRestAlert, ensurePermission, onNotificationAction } from './notifications';
import { fetchHRSummary, fetchRecentMaxHR, backfillSetHRs, hrAvailable } from './healthkit';


const TEMPLATE_VERSION = '3';

const DAY_ORDER = ['lowerA', 'lowerB', 'upper1', 'upper2', 'upper3', 'upper4', 'plyo'];

// defaultSets defaults to 2 for strength exercises; only overridden where noted.
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
  kg: { key: 'kg', label: 'kg', name: 'Kilograms', step: 2.5, stepper: [-2.5, -1, 1, 2.5], bar: 20, lightCap: 40, rampGap: 5 },
  lb: { key: 'lb', label: 'lb', name: 'Pounds', step: 5, stepper: [-5, -2.5, 2.5, 5], bar: 45, lightCap: 90, rampGap: 10 },
};

function unitDef(unit) {
  return UNITS[unit] || UNITS.kg;
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
  const out = [{ label: BAR + d.label + ' × 10', detail: 'empty bar' }];
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

function buildExerciseTrend(sessions, exerciseName) {
  // Best e1RM per session for this exercise, chronological.
  const points = [];
  sessions
    .slice()
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .forEach((s) => {
      let best = null;
      s.exercises.forEach((ex) => {
        if (ex.type !== 'strength' || ex.name !== exerciseName) return;
        ex.sets.forEach((set) => {
          const e = epley(set.weight, set.reps);
          if (e !== null && (best === null || e > best)) best = e;
        });
      });
      if (best !== null) points.push({ date: s.date, e1rm: best });
    });
  return points;
}

function collectKnownExercises(templates, sessions) {
  const byId = {};
  templates.forEach((t) => {
    Object.keys(t.days || {}).forEach((dk) => {
      (t.days[dk].exercises || []).forEach((e) => {
        if (e.id && e.name && !byId[e.id]) byId[e.id] = { id: e.id, name: e.name, type: e.type || 'strength' };
      });
    });
  });
  sessions.forEach((s) => {
    (s.exercises || []).forEach((e) => {
      if (e.exerciseId && e.name && !byId[e.exerciseId]) byId[e.exerciseId] = { id: e.exerciseId, name: e.name, type: e.type || 'strength' };
    });
  });
  return Object.values(byId).sort((a, b) => a.name.localeCompare(b.name));
}

function ExerciseAutocomplete({ query, known, excludeIds, onPick }) {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return null;
  const matches = known
    .filter((k) => !excludeIds.includes(k.id) && k.name.toLowerCase().includes(q))
    .slice(0, 5);
  if (!matches.length) return null;
  return (
    <div className="border border-stone-300 rounded-sm bg-white mb-2 overflow-hidden">
      <div className="text-[10px] uppercase tracking-widest text-stone-400 px-3 pt-2">Existing — tap to reuse (keeps history)</div>
      {matches.map((m) => (
        <button
          key={m.id}
          onClick={() => onPick(m)}
          className="w-full text-left px-3 py-2 text-sm text-stone-800 hover:bg-stone-100 flex items-center justify-between gap-2"
        >
          <span className="truncate">{m.name}</span>
          <span className="text-[10px] uppercase tracking-widest text-stone-400 shrink-0">{m.type === 'strength' ? 'w×r' : 'notes'}</span>
        </button>
      ))}
    </div>
  );
}

function buildSuggestion(hist, target, unit) {
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

  if (target && target.lo && target.hi) {
    const cap = target.cap || 8;
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
  if ((rpe === null || rpe <= 8) && trendUp) {
    return { kind: 'up', text: up + ' × ' + Math.max(1, r - 1) + '–' + r + ' @ ≤8' };
  }
  if (rpe !== null && rpe <= 9) {
    return { kind: 'hold', text: cur + ' × ' + r + '–' + (r + 1) + ' @ ≤8.5 — earn the jump' };
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

function bestE1rmByName(sessions) {
  const map = {};
  sessions.forEach((s) => {
    s.exercises.forEach((ex) => {
      if (ex.type !== 'strength') return;
      ex.sets.forEach((set) => {
        const e = epley(set.weight, set.reps);
        if (e !== null && (!map[ex.name] || e > map[ex.name])) map[ex.name] = e;
      });
    });
  });
  return map;
}

function buildRecords(sessions) {
  const map = {};
  sessions.forEach((s) => {
    s.exercises.forEach((ex) => {
      if (ex.type !== 'strength') return;
      ex.sets.forEach((set) => {
        const e = epley(set.weight, set.reps);
        if (e === null) return;
        const cur = map[ex.name];
        if (!cur || e > cur.e1rm) {
          map[ex.name] = { name: ex.name, e1rm: e, weight: parseFloat(set.weight), reps: parseFloat(set.reps), rpe: set.rpe, date: s.date };
        }
      });
    });
  });
  return Object.values(map).sort((a, b) => b.e1rm - a.e1rm);
}

function newId() {
  return 'ex-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
}

function buildSessionText(template, s, unit) {
  const day = template[s.dayType];
  const label = s.dayLabel || (day ? day.label : s.dayType);
  const dateStr = new Date(s.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  let header = label.toUpperCase() + ' — ' + dateStr;
  if (s.durationSec) header += '  (' + formatDuration(s.durationSec) + ')';
  const lines = [header];
  if (s.note) lines.push('  Note: ' + s.note);
  s.exercises.forEach((ex) => {
    if (ex.type === 'strength') {
      lines.push('  ' + ex.name + ': ' + ex.sets.map((set) => formatSet(set, unit)).join(', '));
    } else if (ex.notes) {
      lines.push('  ' + ex.name + ': ' + ex.notes);
    }
  });
  return lines.join('\n');
}

function buildExportText(templates, sessions) {
  const ordered = sessions.slice().sort((a, b) => new Date(b.date) - new Date(a.date));
  // weightUnit is metadata, not a setting: stored weights are always kg.
  // (App renamed from 'workout-log' — import never validated the app field, so old exports still load.)
  return JSON.stringify({ app: 'yawl', formatVersion: 2, weightUnit: 'kg', exportedAt: new Date().toISOString(), templates: templates, sessions: ordered }, null, 2);
}

function parseImportText(text) {
  const data = JSON.parse(text);
  const rawSessions = Array.isArray(data) ? data : data.sessions;
  const sessions = Array.isArray(rawSessions)
    ? rawSessions.filter((s) => s && s.id && s.dayType && s.date && Array.isArray(s.exercises))
    : [];
  const rawTemplates = Array.isArray(data) ? [] : data.templates;
  const templates = Array.isArray(rawTemplates)
    ? rawTemplates.filter((t) => t && t.id && t.name && Array.isArray(t.dayOrder) && t.days && typeof t.days === 'object')
    : [];
  if (!sessions.length && !templates.length) throw new Error('No sessions or templates found');
  return { sessions, templates };
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

const DAY_COLORS = ['red', 'blue', 'amber'];

function TemplatesView({ templates, onSetCurrent, onEdit, onAdd, onDelete }) {
  const [newName, setNewName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  return (
    <div>
      <div className="mb-5">
        <div className="text-xs uppercase tracking-widest text-stone-500 mb-1">Programs</div>
        <h1 className="text-2xl font-black uppercase tracking-tight text-stone-900">Workout Templates</h1>
        <p className="text-xs text-stone-500 mt-1">The template marked current is what shows on your home screen.</p>
      </div>

      <div className="space-y-2 mb-6">
        {templates.map((t) => (
          <div key={t.id} className="bg-white border border-stone-200 rounded-sm px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <button onClick={() => onSetCurrent(t.id)} className="flex items-center gap-2 min-w-0 text-left">
                <Star size={16} className={t.current ? 'text-amber-500 fill-amber-500 shrink-0' : 'text-stone-300 shrink-0'} />
                <div className="min-w-0">
                  <div className="text-sm font-black uppercase tracking-tight text-stone-900 truncate">{t.name}</div>
                  <div className="text-xs text-stone-500">{t.dayOrder.length} days{t.current ? ' · current' : ''}</div>
                </div>
              </button>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => onEdit(t.id)} className="text-stone-500 hover:text-stone-900 p-2" aria-label="Edit template">
                  <Pencil size={15} />
                </button>
                {!t.current && templates.length > 1 && (
                  confirmDeleteId === t.id ? (
                    <button onClick={() => { onDelete(t.id); setConfirmDeleteId(null); }} className="text-xs uppercase tracking-widest text-red-600 border border-red-300 rounded-sm px-2 py-1">
                      Confirm
                    </button>
                  ) : (
                    <button onClick={() => setConfirmDeleteId(t.id)} className="text-stone-400 hover:text-red-600 p-2" aria-label="Delete template">
                      <X size={15} />
                    </button>
                  )
                )}
              </div>
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
          className="w-full bg-stone-50 border border-stone-300 rounded-sm px-3 py-2 text-sm text-stone-900 mb-2 focus:outline-none focus:border-stone-500"
        />
        <button
          onClick={() => { if (newName.trim()) { onAdd(newName.trim()); setNewName(''); } }}
          disabled={!newName.trim()}
          className="w-full bg-stone-200 hover:bg-stone-300 disabled:opacity-40 rounded-sm py-2 text-xs uppercase tracking-widest text-stone-800 flex items-center justify-center gap-1"
        >
          <Plus size={14} /> Create & Edit
        </button>
      </div>
    </div>
  );
}

function TemplateEditView({ template, onBack, onSave, knownExercises }) {
  const [name, setName] = useState(template.name);
  const [daysArr, setDaysArr] = useState(() =>
    template.dayOrder.map((k) => {
      const d = template.days[k] || { label: k, subtitle: '', colorKey: 'blue', exercises: [] };
      return { key: k, label: d.label, subtitle: d.subtitle || '', colorKey: d.colorKey || 'blue', exercises: d.exercises.map((e) => ({ ...e })) };
    })
  );
  const [expanded, setExpanded] = useState(null);
  const [newExName, setNewExName] = useState('');
  const [newExType, setNewExType] = useState('strength');

  function updateDay(key, field, value) {
    setDaysArr((prev) => prev.map((d) => (d.key === key ? { ...d, [field]: value } : d)));
  }

  function cycleColor(key) {
    setDaysArr((prev) => prev.map((d) => {
      if (d.key !== key) return d;
      const i = DAY_COLORS.indexOf(d.colorKey);
      return { ...d, colorKey: DAY_COLORS[(i + 1) % DAY_COLORS.length] };
    }));
  }

  function addDay() {
    const key = newId();
    setDaysArr((prev) => [...prev, { key, label: 'New Day', subtitle: '', colorKey: 'blue', exercises: [] }]);
    setExpanded(key);
  }

  function removeDay(key) {
    setDaysArr((prev) => prev.filter((d) => d.key !== key));
    if (expanded === key) setExpanded(null);
  }

  function addExerciseToDay(key, knownPick) {
    const ex = knownPick
      ? { id: knownPick.id, name: knownPick.name, type: knownPick.type }
      : (newExName.trim() ? { id: newId(), name: newExName.trim(), type: newExType } : null);
    if (!ex) return;
    setDaysArr((prev) => prev.map((d) => {
      if (d.key !== key) return d;
      if (d.exercises.some((e) => e.id === ex.id)) return d;
      return { ...d, exercises: [...d.exercises, ex] };
    }));
    setNewExName('');
    setNewExType('strength');
  }

  const [linkEdit, setLinkEdit] = useState(null); // { dayKey, exId, sourceId, pct }
  const [targetEdit, setTargetEdit] = useState(null); // { dayKey, exId, lo, hi, cap }
  const [nameEdit, setNameEdit] = useState(null); // { dayKey, exId, value }

  function openTargetEditor(dayKey, ex) {
    setTargetEdit({
      dayKey,
      exId: ex.id,
      lo: ex.target ? String(ex.target.lo) : '',
      hi: ex.target ? String(ex.target.hi) : '',
      cap: ex.target && ex.target.cap ? String(ex.target.cap) : '8',
    });
  }

  function saveTarget() {
    const lo = parseInt(targetEdit.lo, 10);
    const hi = parseInt(targetEdit.hi, 10);
    const cap = parseFloat(targetEdit.cap);
    if (isNaN(lo) || isNaN(hi) || lo < 1 || hi < lo) {
      setTargetEdit(null);
      return;
    }
    setDaysArr((prev) => prev.map((d) => {
      if (d.key !== targetEdit.dayKey) return d;
      return {
        ...d,
        exercises: d.exercises.map((e) => (e.id === targetEdit.exId ? { ...e, target: { lo, hi, cap: isNaN(cap) ? 8 : cap } } : e)),
      };
    }));
    setTargetEdit(null);
  }

  function clearTarget() {
    setDaysArr((prev) => prev.map((d) => {
      if (d.key !== targetEdit.dayKey) return d;
      return {
        ...d,
        exercises: d.exercises.map((e) => {
          if (e.id !== targetEdit.exId) return e;
          const copy = { ...e };
          delete copy.target;
          return copy;
        }),
      };
    }));
    setTargetEdit(null);
  }

  function openLinkEditor(dayKey, ex) {
    setLinkEdit({
      dayKey,
      exId: ex.id,
      sourceId: ex.derivedFrom ? ex.derivedFrom.sourceId : '',
      pct: ex.derivedFrom ? String(Math.round(ex.derivedFrom.factor * 100)) : '75',
    });
  }

  function saveLink() {
    const pctNum = parseFloat(linkEdit.pct);
    if (!linkEdit.sourceId || isNaN(pctNum) || pctNum <= 0) {
      setLinkEdit(null);
      return;
    }
    setDaysArr((prev) => prev.map((d) => {
      if (d.key !== linkEdit.dayKey) return d;
      return {
        ...d,
        exercises: d.exercises.map((e) => (e.id === linkEdit.exId ? { ...e, derivedFrom: { sourceId: linkEdit.sourceId, factor: pctNum / 100 } } : e)),
      };
    }));
    setLinkEdit(null);
  }

  function clearLink() {
    setDaysArr((prev) => prev.map((d) => {
      if (d.key !== linkEdit.dayKey) return d;
      return {
        ...d,
        exercises: d.exercises.map((e) => {
          if (e.id !== linkEdit.exId) return e;
          const copy = { ...e };
          delete copy.derivedFrom;
          return copy;
        }),
      };
    }));
    setLinkEdit(null);
  }

  function updateExerciseName(dayKey, exId, name) {
    setDaysArr((prev) => prev.map((d) => {
      if (d.key !== dayKey) return d;
      return { ...d, exercises: d.exercises.map((e) => (e.id === exId ? { ...e, name } : e)) };
    }));
  }

  function moveExercise(dayKey, exId, dir) {
    setDaysArr((prev) => prev.map((d) => {
      if (d.key !== dayKey) return d;
      return { ...d, exercises: moveExerciseBlock(d.exercises, exId, dir) };
    }));
  }

  function cycleSuperset(dayKey, exId) {
    setDaysArr((prev) => prev.map((d) => {
      if (d.key !== dayKey) return d;
      return {
        ...d,
        exercises: d.exercises.map((e) => {
          if (e.id !== exId) return e;
          const next = !e.superset ? 'A' : e.superset === 'A' ? 'B' : null;
          const copy = { ...e };
          if (next) copy.superset = next; else delete copy.superset;
          return copy;
        }),
      };
    }));
  }

  function removeExerciseFromDay(key, exId) {
    setDaysArr((prev) => prev.map((d) => (d.key === key ? { ...d, exercises: d.exercises.filter((e) => e.id !== exId) } : d)));
  }

  function save() {
    const dayOrder = daysArr.map((d) => d.key);
    const days = {};
    daysArr.forEach((d) => {
      days[d.key] = { label: d.label || 'Day', subtitle: d.subtitle, colorKey: d.colorKey, exercises: d.exercises };
    });
    onSave(template.id, { name: name.trim() || template.name, dayOrder, days });
  }

  return (
    <div>
      <div className="flex items-center mb-5">
        <button onClick={onBack} className="flex items-center gap-1 text-stone-500 text-sm py-2">
          <ChevronLeft size={18} /> Back
        </button>
      </div>
      <div className="mb-5">
        <div className="text-xs uppercase tracking-widest text-stone-500 mb-1">Edit Template</div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full bg-transparent text-2xl font-black uppercase tracking-tight text-stone-900 border-b border-stone-300 focus:outline-none focus:border-stone-500 pb-1"
        />
      </div>

      <div className="space-y-2">
        {daysArr.map((d) => {
          const colors = COLOR_MAP[d.colorKey] || COLOR_MAP.blue;
          const open = expanded === d.key;
          return (
            <div key={d.key} className="bg-white border border-stone-200 rounded-sm overflow-hidden">
              <div className="flex items-stretch">
                <button onClick={() => cycleColor(d.key)} className={'w-3 shrink-0 ' + colors.stripe} aria-label="Cycle day color" />
                <button onClick={() => setExpanded(open ? null : d.key)} className="flex-1 text-left px-3 py-3">
                  <div className="text-sm font-black uppercase tracking-tight text-stone-900">{d.label || 'Day'}</div>
                  <div className="text-xs text-stone-500">{d.exercises.length} exercises</div>
                </button>
                <button onClick={() => removeDay(d.key)} className="px-3 text-stone-400 hover:text-red-600" aria-label="Remove day">
                  <X size={15} />
                </button>
              </div>
              {open && (
                <div className="border-t border-stone-200 p-3 space-y-2">
                  <input
                    value={d.label}
                    onChange={(e) => updateDay(d.key, 'label', e.target.value)}
                    placeholder="Day name (e.g. Lower A)"
                    className="w-full bg-stone-50 border border-stone-300 rounded-sm px-3 py-2 text-sm text-stone-900 focus:outline-none focus:border-stone-500"
                  />
                  <input
                    value={d.subtitle}
                    onChange={(e) => updateDay(d.key, 'subtitle', e.target.value)}
                    placeholder="Subtitle (e.g. Sunday · Secondary Gym)"
                    className="w-full bg-stone-50 border border-stone-300 rounded-sm px-3 py-2 text-sm text-stone-900 focus:outline-none focus:border-stone-500"
                  />
                  <div className="text-[10px] uppercase tracking-widest text-stone-400">Tap the color bar to change day color</div>
                  <div className="space-y-1 pt-1">
                    {d.exercises.map((ex) => {
                      const allSources = daysArr.flatMap((day) => day.exercises.filter((e) => e.type === 'strength').map((e) => ({ ...e, dayLabel: day.label || 'Day', dayKey: day.key })));
                      const source = ex.derivedFrom ? allSources.find((e) => e.id === ex.derivedFrom.sourceId) : null;
                      const editingThis = linkEdit && linkEdit.dayKey === d.key && linkEdit.exId === ex.id;
                      const linkableSources = allSources.filter((e) => e.id !== ex.id).sort((a, b) => a.name.localeCompare(b.name));
                      return (
                        <div key={ex.id} className="bg-stone-50 border border-stone-200 rounded-sm px-3 py-2">
                          <div className="flex items-start justify-between gap-2">
                            <button
                              onClick={() => setNameEdit({ dayKey: d.key, exId: ex.id, value: ex.name })}
                              className="flex items-start gap-1.5 min-w-0 flex-1 text-left"
                            >
                              <span className="text-sm text-stone-800 leading-snug" style={{ overflowWrap: 'anywhere' }}>{ex.name}</span>
                              <span className="text-stone-400 text-xs shrink-0 mt-0.5">{ex.type === 'strength' ? 'w×r' : 'notes'}</span>
                            </button>
                            <div className="flex items-center gap-1 shrink-0">
                              <button onClick={() => moveExercise(d.key, ex.id, 'up')} className="text-stone-400 hover:text-stone-700 p-0.5" aria-label="Move up">
                                <ChevronUp size={15} />
                              </button>
                              <button onClick={() => moveExercise(d.key, ex.id, 'down')} className="text-stone-400 hover:text-stone-700 p-0.5" aria-label="Move down">
                                <ChevronDown size={15} />
                              </button>
                              {ex.type === 'strength' && (
                                <button onClick={() => openTargetEditor(d.key, ex)} className={(ex.target ? 'text-emerald-700' : 'text-stone-400') + ' hover:text-emerald-700 p-1'} aria-label="Set rep and RPE target">
                                  <Target size={14} />
                                </button>
                              )}
                              {ex.type === 'strength' && (
                                <button
                                  onClick={() => cycleSuperset(d.key, ex.id)}
                                  className={'text-[10px] font-black uppercase tracking-widest rounded-sm px-1.5 py-0.5 border ' + (ex.superset ? 'text-purple-700 border-purple-300 bg-purple-50' : 'text-stone-400 border-stone-200')}
                                  aria-label="Cycle superset group"
                                >
                                  {ex.superset ? 'SS·' + ex.superset : 'SS'}
                                </button>
                              )}
                              {ex.type === 'strength' && linkableSources.length > 0 && (
                                <button onClick={() => openLinkEditor(d.key, ex)} className={(ex.derivedFrom ? 'text-blue-700' : 'text-stone-400') + ' hover:text-blue-700 p-1'} aria-label="Link weight to another exercise">
                                  <Link2 size={14} />
                                </button>
                              )}
                              <button onClick={() => removeExerciseFromDay(d.key, ex.id)} className="text-stone-400 hover:text-red-600 p-1" aria-label="Remove exercise">
                                <X size={14} />
                              </button>
                            </div>
                          </div>
                          {ex.target && !(targetEdit && targetEdit.dayKey === d.key && targetEdit.exId === ex.id) && (
                            <div className="text-[11px] text-emerald-700 mt-0.5 flex items-center gap-1">
                              <Target size={10} /> {ex.target.lo}–{ex.target.hi} reps @ ≤{ex.target.cap}
                            </div>
                          )}
                          {targetEdit && targetEdit.dayKey === d.key && targetEdit.exId === ex.id && (
                            <div className="mt-2 space-y-2">
                              <div className="flex items-center gap-2">
                                <input type="number" inputMode="numeric" value={targetEdit.lo} onChange={(e) => setTargetEdit({ ...targetEdit, lo: e.target.value })} placeholder="Min" className="w-16 bg-white border border-stone-300 rounded-sm px-2 py-2 text-sm font-mono tabular-nums text-stone-900 focus:outline-none focus:border-stone-500" />
                                <span className="text-xs text-stone-500">to</span>
                                <input type="number" inputMode="numeric" value={targetEdit.hi} onChange={(e) => setTargetEdit({ ...targetEdit, hi: e.target.value })} placeholder="Max" className="w-16 bg-white border border-stone-300 rounded-sm px-2 py-2 text-sm font-mono tabular-nums text-stone-900 focus:outline-none focus:border-stone-500" />
                                <span className="text-xs text-stone-500">reps @ ≤</span>
                                <input type="number" inputMode="decimal" step="0.5" value={targetEdit.cap} onChange={(e) => setTargetEdit({ ...targetEdit, cap: e.target.value })} placeholder="RPE" className="w-16 bg-white border border-stone-300 rounded-sm px-2 py-2 text-sm font-mono tabular-nums text-stone-900 focus:outline-none focus:border-stone-500" />
                              </div>
                              <div className="flex gap-2">
                                <button onClick={saveTarget} className="flex-1 bg-stone-800 hover:bg-stone-700 text-white text-xs uppercase tracking-widest py-2 rounded-sm">Save Target</button>
                                {ex.target && (
                                  <button onClick={clearTarget} className="text-xs uppercase tracking-widest text-red-600 border border-red-300 rounded-sm px-3">Clear</button>
                                )}
                                <button onClick={() => setTargetEdit(null)} className="text-xs uppercase tracking-widest text-stone-500 border border-stone-300 rounded-sm px-3">Cancel</button>
                              </div>
                            </div>
                          )}
                          {ex.derivedFrom && !editingThis && (
                            <div className="text-[11px] text-blue-700 mt-0.5 flex items-center gap-1">
                              <Link2 size={10} /> {Math.round(ex.derivedFrom.factor * 100)}% of {source ? source.name + (source.dayKey !== d.key ? ' · ' + source.dayLabel : '') : 'missing exercise'}
                            </div>
                          )}
                          {editingThis && (
                            <div className="mt-2 space-y-2">
                              <select
                                value={linkEdit.sourceId}
                                onChange={(e) => setLinkEdit({ ...linkEdit, sourceId: e.target.value })}
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
                                  value={linkEdit.pct}
                                  onChange={(e) => setLinkEdit({ ...linkEdit, pct: e.target.value })}
                                  className="w-20 bg-white border border-stone-300 rounded-sm px-2 py-2 text-sm font-mono tabular-nums text-stone-900 focus:outline-none focus:border-stone-500"
                                />
                                <span className="text-xs text-stone-500">% of source weight</span>
                              </div>
                              <div className="flex gap-2">
                                <button onClick={saveLink} className="flex-1 bg-stone-800 hover:bg-stone-700 text-white text-xs uppercase tracking-widest py-2 rounded-sm">Save Link</button>
                                {ex.derivedFrom && (
                                  <button onClick={clearLink} className="text-xs uppercase tracking-widest text-red-600 border border-red-300 rounded-sm px-3">Unlink</button>
                                )}
                                <button onClick={() => setLinkEdit(null)} className="text-xs uppercase tracking-widest text-stone-500 border border-stone-300 rounded-sm px-3">Cancel</button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {open && (
                    <ExerciseAutocomplete
                      query={newExName}
                      known={knownExercises || []}
                      excludeIds={d.exercises.map((e) => e.id)}
                      onPick={(m) => addExerciseToDay(d.key, m)}
                    />
                  )}
                  <div className="flex gap-2 pt-1">
                    <input
                      value={newExName}
                      onChange={(e) => setNewExName(e.target.value)}
                      placeholder="Add exercise"
                      className="flex-1 min-w-0 bg-stone-50 border border-stone-300 rounded-sm px-3 py-2 text-sm text-stone-900 focus:outline-none focus:border-stone-500"
                    />
                    <button
                      onClick={() => setNewExType(newExType === 'strength' ? 'conditioning' : 'strength')}
                      className="shrink-0 text-xs uppercase tracking-widest text-stone-600 border border-stone-300 rounded-sm px-2"
                    >
                      {newExType === 'strength' ? 'w×r' : 'notes'}
                    </button>
                    <button onClick={() => addExerciseToDay(d.key)} className="shrink-0 bg-stone-200 hover:bg-stone-300 rounded-sm px-3 text-stone-800" aria-label="Add exercise">
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button onClick={addDay} className="mt-3 w-full border border-dashed border-stone-300 rounded-sm py-2.5 text-xs uppercase tracking-widest text-stone-500 hover:text-stone-800 hover:border-stone-400 flex items-center justify-center gap-1">
        <Plus size={14} /> Add Day
      </button>

      <div className="h-24" />
      <div className="fixed bottom-0 left-0 right-0 bg-stone-100 border-t border-stone-200 p-4">
        <div className="max-w-md mx-auto">
          <button onClick={save} className="w-full bg-stone-800 hover:bg-stone-700 text-white font-black uppercase tracking-wide py-4 rounded-sm flex items-center justify-center gap-2">
            <Check size={18} /> Save Template
          </button>
        </div>
      </div>

      {nameEdit && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.45)', zIndex: 70 }}
        >
          <div className="bg-white rounded-sm border border-stone-300 w-full max-w-sm p-4">
            <div className="text-xs uppercase tracking-widest text-stone-500 mb-2">Exercise Name</div>
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
                  updateExerciseName(nameEdit.dayKey, nameEdit.exId, nameEdit.value.trim() || 'Exercise');
                  setNameEdit(null);
                }}
                className="flex-1 bg-stone-800 hover:bg-stone-700 text-white text-xs uppercase tracking-widest py-2.5 rounded-sm"
              >
                Save Name
              </button>
              <button
                onClick={() => setNameEdit(null)}
                className="text-xs uppercase tracking-widest text-stone-500 border border-stone-300 rounded-sm px-4"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
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
      <div className="flex items-center gap-1.5">
        {[90, 180, 300].map((sec) => (
          <button
            key={sec}
            onClick={() => onStart(sec)}
            className={'text-xs font-mono tabular-nums rounded-sm px-2 py-1.5 border ' + (activePreset === sec ? 'text-stone-900 border-stone-500 bg-stone-100 font-bold' : 'text-stone-600 border-stone-300 hover:bg-stone-100')}
          >
            {Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0')}
          </button>
        ))}
      </div>
    </div>
  );
}

function FloatingTimer({ endsAt, onDismiss, audioCtxRef }) {
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
      if (navigator.vibrate) navigator.vibrate([300, 120, 300, 120, 300]);
      if (audioCtxRef.current) playBeep(audioCtxRef.current);
    }
  }, [done, audioCtxRef]);

  return (
    <button
      onClick={onDismiss}
      style={{ top: 'calc(env(safe-area-inset-top) + 0.5rem)' }}
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

function RecordsView({ sessions, unit }) {
  const records = buildRecords(sessions);
  const [expanded, setExpanded] = useState(null);
  return (
    <div>
      <div className="mb-5">
        <div className="text-xs uppercase tracking-widest text-stone-500 mb-1">Personal Records</div>
        <h1 className="text-2xl font-black uppercase tracking-tight text-stone-900">Best Lifts</h1>
        <p className="text-xs text-stone-500 mt-1">Best set per exercise by estimated 1RM (Epley). Estimates lose accuracy above ~10 reps.</p>
      </div>
      {records.length === 0 && <div className="text-sm text-stone-500">Log some strength work and your records will build here.</div>}
      <div className="space-y-2">
        {records.map((r) => {
          const open = expanded === r.name;
          const trend = open ? buildExerciseTrend(sessions, r.name).slice(-8) : [];
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

function SettingsView({ unit, onSetUnit, sessions, onBack }) {
  const d = unitDef(unit);
  // Show the switch against a real lift from the log — abstract units are easy
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

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-1 text-stone-500 text-sm py-2 mb-3">
        <ChevronLeft size={18} /> Back
      </button>
      <div className="mb-5">
        <div className="text-xs uppercase tracking-widest text-stone-500 mb-1">Preferences</div>
        <h1 className="text-2xl font-black uppercase tracking-tight text-stone-900">Settings</h1>
      </div>

      <div className="bg-white border border-stone-200 rounded-sm p-4 mb-3">
        <div className="text-xs uppercase tracking-widest text-stone-500 mb-3 flex items-center gap-1.5">
          <Scale size={13} /> Weight Units
        </div>
        <div className="grid grid-cols-2 gap-2">
          {['kg', 'lb'].map((u) => {
            const active = unit === u;
            return (
              <button
                key={u}
                onClick={() => onSetUnit(u)}
                className={
                  'rounded-sm py-3 border text-center transition-colors ' +
                  (active
                    ? 'bg-stone-800 border-stone-800 text-white'
                    : 'bg-stone-50 border-stone-300 text-stone-600 hover:border-stone-400')
                }
              >
                <div className="text-lg font-black font-mono tabular-nums leading-none">{UNITS[u].label}</div>
                <div className={'text-[10px] uppercase tracking-widest mt-1 ' + (active ? 'text-stone-300' : 'text-stone-400')}>
                  {UNITS[u].name}
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-4 space-y-1.5 text-xs font-mono tabular-nums text-stone-600">
          <div className="flex justify-between"><span className="text-stone-400">Stepper</span><span>{d.stepper.map((s) => (s > 0 ? '+' + s : String(s))).join('  ')}</span></div>
          <div className="flex justify-between"><span className="text-stone-400">Rounds to</span><span>{d.step}{d.label}</span></div>
          <div className="flex justify-between"><span className="text-stone-400">Empty bar</span><span>{d.bar}{d.label}</span></div>
        </div>
      </div>

      {sample && (
        <div className="bg-white border border-stone-200 rounded-sm p-4 mb-3">
          <div className="text-xs uppercase tracking-widest text-stone-500 mb-2">From your log</div>
          <div className="text-sm text-stone-900 font-mono tabular-nums">
            {sample.name} — <span className="font-bold">{formatWeight(sample.kg, unit)}</span>
          </div>
        </div>
      )}

      <div className="bg-stone-50 border border-stone-200 rounded-sm px-3 py-2.5 text-xs text-stone-500 leading-relaxed">
        Weights are stored in kilograms and converted for display, so switching units
        never rewrites what you logged. Your history, PRs, and estimated 1RMs stay
        comparable across the switch — only the numbers on screen, the stepper
        increments, and plate rounding change.
      </div>
      <div className="h-8" />
    </div>
  );
}

const TABS = [
  { key: 'home', label: 'Today', icon: Dumbbell },
  { key: 'templates', label: 'Templates', icon: Layers },
  { key: 'history', label: 'History', icon: HistoryIcon },
  { key: 'records', label: 'PRs', icon: Trophy },
  { key: 'export', label: 'Export', icon: Download },
];

function BottomTabs({ active, onSelect }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200">
      <div className="max-w-md mx-auto flex">
        {TABS.map((t) => {
          const Icon = t.icon;
          const isActive = active === t.key;
          return (
            <button
              key={t.key}
              onClick={() => onSelect(t.key)}
              className={'flex-1 flex flex-col items-center gap-0.5 pt-2.5 pb-3 ' + (isActive ? 'text-stone-900' : 'text-stone-400')}
            >
              <Icon size={19} strokeWidth={isActive ? 2.5 : 2} />
              <span className={'text-[10px] uppercase tracking-widest ' + (isActive ? 'font-bold' : '')}>{t.label}</span>
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

function ExerciseCard({ exercise, lastData, suggestion, editMode, unit, onUpdateSet, onAddSet, onRemoveSet, onUpdateNotes, onRemoveExercise, onMoveExercise, onToggleCollapse, onRpeBlur, onFocusField, onBlurField }) {
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
          className="flex items-center gap-1.5 text-left min-w-0"
          disabled={!collapsible}
        >
          <h3 className="font-black uppercase tracking-tight text-stone-900 text-base leading-tight truncate">{exercise.name}</h3>
          {collapsible && (isCollapsed ? <ChevronDown size={15} className="text-stone-400 shrink-0" /> : <ChevronUp size={15} className="text-stone-300 shrink-0" />)}
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
              {lastData && lastData.sets && lastData.sets.length ? 'Last: ' + lastData.sets.map(formatSet).join('  ') : 'No previous data logged'}
            </div>
            {rampWeight !== '' && (
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
          {showRamp && rampWeight !== '' && (
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
                <button onClick={() => onRemoveSet(exercise.exerciseId, i)} className="text-stone-500 hover:text-red-600 flex items-center justify-center" aria-label="Remove set">
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
            return best !== null ? (
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
        placeholder="New exercise name"
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

function HomeView({ template, dayOrder, templateName, sessions, unit, onStart, onHistory, onSettings, newPRs, onDismissPRs, backupDue, lastExportAt }) {
  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-widest text-stone-500 mb-1 flex items-center gap-1.5">
            <Sailboat size={14} className="text-amber-600" /> Yawl <span className="normal-case tracking-normal text-stone-400">· yet another workout logger</span>
          </div>
          <h1 className="text-2xl font-black uppercase tracking-tight text-stone-900">Pick Today's Session</h1>
          {templateName && <div className="text-xs uppercase tracking-widest text-stone-400 mt-1">{templateName}</div>}
        </div>
        <button onClick={onSettings} className="shrink-0 text-stone-400 hover:text-stone-700 p-2 -mr-2" aria-label="Settings">
          <SettingsIcon size={20} />
        </button>
      </div>
      {newPRs && newPRs.length > 0 && (
        <div className="bg-green-50 border border-green-300 rounded-sm p-3 mb-4 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-widest font-bold text-green-700 flex items-center gap-1 mb-1"><Trophy size={12} /> New PR{newPRs.length > 1 ? 's' : ''}!</div>
            <div className="text-sm text-green-800">
              {newPRs.map((p) => p.name + ' — est 1RM ' + formatWeight(p.e1rm, unit)).join(' · ')}
            </div>
          </div>
          <button onClick={onDismissPRs} className="shrink-0 text-green-700 p-1" aria-label="Dismiss"><X size={15} /></button>
        </div>
      )}
      {backupDue && (
        <div className="bg-amber-50 border border-amber-300 rounded-sm px-3 py-2 mb-4 text-xs text-amber-800">
          {lastExportAt ? 'Last backup was over a week ago' : 'No backup yet'} — copy your data from the Export tab.
        </div>
      )}
      {(() => {
        const weekday = new Date().toLocaleDateString('en-US', { weekday: 'long' });
        const anyMatch = dayOrder.some((k) => ((template[k] || {}).subtitle || '').toLowerCase().includes(weekday.toLowerCase()));
        if (weekday === 'Saturday' && !anyMatch) {
          return (
            <div className="bg-white border border-stone-200 rounded-sm px-4 py-3 mb-3 text-sm text-stone-500">
              Rest day — nothing scheduled for Saturday.
            </div>
          );
        }
        return null;
      })()}
      <div className="space-y-3">
        {dayOrder.map((dayType) => {
          const day = template[dayType];
          if (!day) return null;
          const daySessions = sessions.filter((s) => s.dayType === dayType);
          const last = daySessions.length ? daySessions[daySessions.length - 1] : null;
          const colors = COLOR_MAP[day.colorKey];
          const weekday = new Date().toLocaleDateString('en-US', { weekday: 'long' });
          const isToday = (day.subtitle || '').toLowerCase().includes(weekday.toLowerCase());
          return (
            <div key={dayType} className={'flex items-stretch bg-white border rounded-sm overflow-hidden ' + (isToday ? 'border-amber-400 ring-1 ring-amber-300' : 'border-stone-200')}>
              <div className={'w-1.5 ' + colors.stripe} />
              <button onClick={() => onStart(dayType)} className="flex-1 text-left px-4 py-3.5 active:bg-stone-50 transition-colors">
                <div className="flex items-center gap-2">
                  <div className="font-black uppercase tracking-tight text-stone-900">{day.label}</div>
                  {isToday && <span className="text-[10px] uppercase tracking-widest font-bold text-amber-700 bg-amber-100 rounded-sm px-1.5 py-0.5">Today</span>}
                </div>
                <div className="text-xs text-stone-500 mt-0.5">{day.subtitle}</div>
                <div className="text-xs text-stone-500 mt-1.5 font-mono tabular-nums">
                  {last
                    ? 'Last ' + formatDate(last.date) + (last.durationSec ? ' · ' + formatDuration(last.durationSec) : '') + ' · ' + last.exercises.length + ' logged'
                    : 'Not logged yet'}
                </div>
              </button>
              {daySessions.length > 0 && (
                <button onClick={() => onHistory(dayType)} className="px-3 flex items-center justify-center text-stone-500 hover:text-stone-700 border-l border-stone-200" aria-label="View history">
                  <HistoryIcon size={16} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ExportView({ templates, sessions, onImport, onCopied }) {
  const text = buildExportText(templates, sessions);
  const [copied, setCopied] = useState(false);
  const [importText, setImportText] = useState('');
  const [importMsg, setImportMsg] = useState(null);

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (onCopied) onCopied();
      setTimeout(() => setCopied(false), 1600);
    } catch (e) {
      setCopied(false);
    }
  }

  async function runImport() {
    try {
      const incoming = parseImportText(importText);
      const result = await onImport(incoming);
      const parts = [];
      parts.push(result.addedSessions + ' session' + (result.addedSessions === 1 ? '' : 's'));
      parts.push(result.addedTemplates + ' template' + (result.addedTemplates === 1 ? '' : 's'));
      const skipped = result.skippedSessions + result.skippedTemplates;
      setImportMsg({ ok: true, text: 'Imported ' + parts.join(' and ') + (skipped ? ' (' + skipped + ' duplicates skipped)' : '') + '.' });
      setImportText('');
    } catch (e) {
      setImportMsg({ ok: false, text: 'Could not read that — paste the exact JSON from an Export page.' });
    }
  }

  return (
    <div>
      <div className="flex items-center justify-end mb-5">
        <button onClick={copyAll} className="flex items-center gap-1 text-xs uppercase tracking-widest py-2 px-2.5 border border-stone-300 rounded-sm text-stone-700 hover:text-stone-900">
          <Copy size={13} /> {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <div className="mb-4">
        <div className="text-xs uppercase tracking-widest text-stone-500 mb-1">Export</div>
        <h1 className="text-2xl font-black uppercase tracking-tight text-stone-900">Your Full Log</h1>
        <p className="text-xs text-stone-500 mt-2">Copy this JSON as a full backup — it includes your templates and all sessions — or paste it into a chat for coaching. If Copy doesn't work, tap the box and select all.</p>
      </div>
      <textarea
        readOnly
        value={text}
        onFocus={(e) => e.target.select()}
        rows={12}
        className="w-full bg-white border border-stone-200 rounded-sm px-3 py-3 text-xs font-mono text-stone-700 focus:outline-none focus:border-stone-400 resize-none"
      />

      <div className="mt-8 mb-3">
        <div className="text-xs uppercase tracking-widest text-stone-500 mb-1">Import</div>
        <h2 className="text-lg font-black uppercase tracking-tight text-stone-900">Restore From Export</h2>
        <p className="text-xs text-stone-500 mt-1">Paste a previous export here. Sessions you already have are skipped, so it's safe to import the same backup twice.</p>
      </div>
      <textarea
        value={importText}
        onChange={(e) => { setImportText(e.target.value); setImportMsg(null); }}
        placeholder='Paste exported JSON here...'
        rows={6}
        className="w-full bg-white border border-stone-300 rounded-sm px-3 py-3 text-xs font-mono text-stone-900 focus:outline-none focus:border-stone-500 resize-none"
      />
      {importMsg && (
        <div className={'text-xs mt-2 ' + (importMsg.ok ? 'text-green-700' : 'text-red-600')}>{importMsg.text}</div>
      )}
      <button
        onClick={runImport}
        disabled={!importText.trim()}
        className="mt-3 w-full bg-stone-800 hover:bg-stone-700 disabled:opacity-40 text-white font-black uppercase tracking-wide py-3 rounded-sm flex items-center justify-center gap-2"
      >
        <Download size={16} /> Import Sessions
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

function LogView({ dayType, template, draft, editMode, setEditMode, unit, onBack, onUpdateSet, onAddSet, onRemoveSet, onUpdateNotes, onAddExercise, onRemoveExercise, onMoveExercise, onFinish, onCancel, saving, getLastExerciseData, getSuggestion, onToggleDeload, onUpdateSessionNote, onToggleCollapse, onRpeBlur, knownExercises, onFetchHR, timerEndsAt, timerPreset, onTimerStart, onTimerStop, audioCtxRef }) {
  const day = template[dayType];
  const colors = COLOR_MAP[day.colorKey];
  const [confirm, setConfirm] = useState(null);
  const [focusedField, setFocusedField] = useState(null);
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
        <button onClick={() => setConfirm('cancel')} className="flex items-center gap-1 text-stone-500 text-sm py-2">
          <ChevronLeft size={18} /> Back
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
        <div className="flex items-center gap-1.5 text-stone-500 text-sm mt-2">
          <Clock size={14} /> <SessionTimer startedAt={draft.startedAt} />
        </div>
      </div>

      <RestStarter activePreset={timerPreset} running={!!timerEndsAt} onStart={onTimerStart} />
      {timerEndsAt && <FloatingTimer endsAt={timerEndsAt} onDismiss={onTimerStop} audioCtxRef={audioCtxRef} />}
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
              onUpdateSet={onUpdateSet}
              onAddSet={onAddSet}
              onRemoveSet={onRemoveSet}
              onUpdateNotes={onUpdateNotes}
              onRemoveExercise={onRemoveExercise}
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

      <div className="fixed bottom-0 left-0 right-0 bg-stone-100 border-t border-stone-200 p-4">
        <div className="max-w-md mx-auto">
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
        </div>
      </div>
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

function SessionEditView({ session, template, unit, onBack, onSave, onDelete, onFetchSessionHR }) {
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
      await navigator.clipboard.writeText(buildSessionText(template, { ...session, exercises, durationSec: session.durationSec }, unit));
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
        ) : (
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

      <div className="fixed bottom-0 left-0 right-0 bg-stone-100 border-t border-stone-200 p-4">
        <div className="max-w-md mx-auto">
          <button
            onClick={save}
            className={'w-full ' + colors.solidBg + ' ' + colors.solidBgHover + ' text-white font-black uppercase tracking-wide py-4 rounded-sm flex items-center justify-center gap-2 transition-colors'}
          >
            <Check size={18} /> Save Changes
          </button>
        </div>
      </div>
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
  const firstDow = new Date(year, month, 1).getDay();
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
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
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
  const PAGE_SIZE = 5;
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
      <div className="mb-5 flex items-end justify-between gap-2">
        <div>
          <div className="text-xs uppercase tracking-widest text-stone-500 mb-1">History</div>
          <h1 className="text-2xl font-black uppercase tracking-tight text-stone-900">{isAll ? 'All Sessions' : day.label}</h1>
        </div>
        {isAll && (
          <div className="flex border border-stone-300 rounded-sm overflow-hidden shrink-0">
            <button onClick={() => onSetMode('list')} className={'p-2 ' + (mode !== 'calendar' ? 'bg-stone-800 text-white' : 'bg-white text-stone-500')} aria-label="List view">
              <List size={15} />
            </button>
            <button onClick={() => onSetMode('calendar')} className={'p-2 ' + (mode === 'calendar' ? 'bg-stone-800 text-white' : 'bg-white text-stone-500')} aria-label="Calendar view">
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

export default function WorkoutTracker() {
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState([]);
  const currentTemplate = templates.find((t) => t.current) || templates[0] || { id: null, name: '', dayOrder: [], days: {} };
  const template = currentTemplate.days || {};
  const [editingTemplateId, setEditingTemplateId] = useState(null);
  const [sessions, setSessions] = useState([]);
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

  const [unit, setUnit] = useState('kg');

  function setHistoryModePersist(m) {
    setHistoryMode(m);
    storage.set('history-view-mode', m).catch(() => {});
  }

  function setUnitPersist(u) {
    if (!UNITS[u]) return;
    setUnit(u);
    storage.set('weight-unit', u).catch(() => {});
  }
  const [timerPreset, setTimerPreset] = useState(180);
  const audioCtxRef = React.useRef(null);
  const draftRef = React.useRef(null);

  function startRestTimer(sec, ctx) {
    const s = sec || timerPreset;
    setTimerPreset(s);
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
    onNotificationAction(({ inputValue, extra }) => {
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
      startRestTimer(undefined, { exerciseId: targetId, index: targetIdx });
    });
  }, []);

  // Continuously persist where the user is + any in-progress workout draft, so an
  // accidental close restores exactly where they left off.
  useEffect(() => {
    if (loading) return;
    const snapshot = {
      view: ['log', 'home', 'templates', 'history', 'records', 'export', 'settings'].includes(view) ? view : 'home',
      activeDayType,
      draft: view === 'log' ? draft : null,
    };
    storage.set('ui-state', JSON.stringify(snapshot)).catch(() => {});
  }, [loading, view, activeDayType, draft]);

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
      let sess = [];
      try {
        const res2 = await storage.get('workout-sessions');
        if (res2 && res2.value) sess = JSON.parse(res2.value);
      } catch (e) {
        // none logged yet
      }
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
      try {
        const uRes = await storage.get('weight-unit');
        if (uRes && UNITS[uRes.value] && !cancelled) setUnit(uRes.value);
      } catch (e) {
        // default to kg
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
        if (restored && restored.view) {
          if (restored.view === 'log' && restored.draft && restored.activeDayType) {
            setActiveDayType(restored.activeDayType);
            setDraft(restored.draft);
            setView('log');
          } else if (restored.view !== 'log') {
            setActiveDayType(restored.activeDayType || null);
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

  async function persistTemplate(newDays) {
    if (!currentTemplate.id) return;
    await persistTemplates(templates.map((t) => (t.id === currentTemplate.id ? { ...t, days: newDays } : t)));
  }

  function setCurrentTemplate(id) {
    persistTemplates(templates.map((t) => ({ ...t, current: t.id === id })));
  }

  function addTemplate(name) {
    const id = newId();
    const next = [...templates, { id, name, current: false, dayOrder: [], days: {} }];
    persistTemplates(next);
    setEditingTemplateId(id);
    setView('templateEdit');
  }

  function deleteTemplate(id) {
    const next = templates.filter((t) => t.id !== id);
    if (next.length && !next.some((t) => t.current)) next[0] = { ...next[0], current: true };
    persistTemplates(next);
  }

  function saveTemplateEdits(id, changes) {
    persistTemplates(templates.map((t) => (t.id === id ? { ...t, ...changes } : t)));
    setEditingTemplateId(null);
    setView('templates');
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
    Object.keys(template).forEach((dk) => {
      const found = (template[dk].exercises || []).find((e) => e.id === exerciseId);
      if (found && found.target) target = found.target;
    });
    return buildSuggestion(hist, target, unit);
  }

  function applyDeloadTransform(exercises) {
    return exercises.map((ex) => {
      if (ex.type !== 'strength') return ex;
      let base = ex.sets[0] && ex.sets[0].weight !== '' ? parseFloat(ex.sets[0].weight) : NaN;
      if (isNaN(base)) {
        const last = getLastExerciseData(ex.exerciseId);
        if (last && last.sets && last.sets[0] && last.sets[0].weight != null) base = parseFloat(last.sets[0].weight);
      }
      const dw = !isNaN(base) ? String(roundWeightToStep(base * 0.6, unit)) : '';
      const keep = ex.sets.slice(0, 2).map((s) => ({ weight: dw, reps: s.reps, rpe: '' }));
      while (keep.length < 2) keep.push({ weight: dw, reps: '', rpe: '' });
      return { ...ex, sets: keep, touched: true };
    });
  }

  function toggleDeload() {
    if (!draft || !activeDayType) return;
    if (draft.deload) {
      // Rebuild the day fresh at normal loads (wipes entered sets).
      const startedAt = draft.startedAt;
      const note = draft.note;
      startSession(activeDayType);
      setDraft((prev) => ({ ...prev, startedAt, note, deload: false }));
    } else {
      setDraft((prev) => ({ ...prev, deload: true, exercises: applyDeloadTransform(prev.exercises) }));
    }
  }

  function startSession(dayType) {
    // Re-entering a day that already has an in-progress draft resumes it
    // instead of rebuilding empty — otherwise a stray tap wipes logged sets.
    if (draft && draft.dayType === dayType && draftHasData(draft)) {
      setActiveDayType(dayType);
      setEditMode(false);
      setView('log');
      return;
    }
    const day = template[dayType];
    const draftExercises = day.exercises.map((ex) => {
      if (ex.type !== 'strength') {
        return { exerciseId: ex.id, name: ex.name, type: 'conditioning', notes: '' };
      }
      const last = getLastExerciseData(ex.id);
      let sets;
      if (last && last.sets && last.sets.length) {
        sets = last.sets.map(() => ({ weight: '', reps: '', rpe: '' }));
      } else {
        const n = ex.defaultSets || 2;
        sets = Array.from({ length: n }, () => ({ weight: '', reps: '', rpe: '' }));
      }
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
            const derived = String(roundWeightToStep(w * ex.derivedFrom.factor, unit));
            ex.sets = ex.sets.map((s) => ({ ...s, weight: derived }));
          }
        }
      }
    });

    setActiveDayType(dayType);
    setDraft({ exercises: draftExercises, startedAt: Date.now(), dayType });
    setEditMode(false);
    setView('log');
  }

  function goBack() {
    setView('home');
    setActiveDayType(null);
    setDraft(null);
    setEditMode(false);
  }

  function openHistory(dayType) {
    setActiveDayType(dayType);
    setView('history');
  }

  function openAllHistory() {
    setActiveDayType(null);
    setView('history');
  }

  async function importData(incoming) {
    const existingSessionIds = new Set(sessions.map((s) => s.id));
    const freshSessions = incoming.sessions.filter((s) => !existingSessionIds.has(s.id));
    if (freshSessions.length) {
      const merged = [...sessions, ...freshSessions].sort((a, b) => new Date(a.date) - new Date(b.date));
      await persistSessions(merged);
    }

    const existingTemplateIds = new Set(templates.map((t) => t.id));
    let freshTemplates = incoming.templates.filter((t) => !existingTemplateIds.has(t.id));
    if (freshTemplates.length) {
      // Never import a second "current" template — the one already on this device wins.
      const hasCurrent = templates.some((t) => t.current);
      freshTemplates = freshTemplates.map((t) => ({ ...t, current: hasCurrent ? false : t.current }));
      if (!hasCurrent && !freshTemplates.some((t) => t.current) && !templates.length) {
        freshTemplates[0] = { ...freshTemplates[0], current: true };
      }
      await persistTemplates([...templates, ...freshTemplates]);
    }

    return {
      addedSessions: freshSessions.length,
      skippedSessions: incoming.sessions.length - freshSessions.length,
      addedTemplates: freshTemplates.length,
      skippedTemplates: incoming.templates.length - freshTemplates.length,
    };
  }

  async function fetchDraftHR() {
    if (!draft || !draft.startedAt) return;
    setDraft((prev) => ({ ...prev, hrError: null, hrLoading: true }));
    try {
      const full = await fetchHRSummary(draft.startedAt, Date.now());
      const hr = { avg: full.avg, max: full.max, min: full.min, count: full.count };
      setDraft((prev) => ({
        ...prev,
        hr,
        hrLoading: false,
        exercises: backfillSetHRs(prev.exercises, full.samples),
      }));
    } catch (e) {
      setDraft((prev) => ({ ...prev, hrError: e.message || 'Could not read heart rate', hrLoading: false }));
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
  }

  function saveSessionEdits(sessionId, exercises, durationSec, note) {
    const updated = sessions.map((s) => (s.id === sessionId ? { ...s, exercises, durationSec, note } : s));
    persistSessions(updated);
    setEditingSession(null);
    setView('history');
  }

  function updateSet(exerciseId, idx, field, value) {
    if (field === 'rpe' && value !== '' && view === 'log') {
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
              const derived = String(roundWeightToStep(w * ex.derivedFrom.factor, unit));
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
        return { ...ex, sets: [...ex.sets, { weight: (lastSet && lastSet.weight) || '', reps: (lastSet && lastSet.reps) || '', rpe: '' }] };
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
    const id = existingId || newId();
    // Guard: if the exercise is already in today's draft, don't add it twice.
    if (existingId && draft && draft.exercises.some((e) => e.exerciseId === existingId)) return;
    const alreadyInDay = template[dayType].exercises.some((e) => e.id === id);
    if (!alreadyInDay) {
      const newTemplate = {
        ...template,
        [dayType]: {
          ...template[dayType],
          exercises: [...template[dayType].exercises, { id, name, type }],
        },
      };
      persistTemplate(newTemplate);
    }
    setDraft((prev) => ({
      ...prev,
      exercises: [
        ...prev.exercises,
        type === 'strength'
          ? { exerciseId: id, name, type, sets: [{ weight: '', reps: '', rpe: '' }, { weight: '', reps: '', rpe: '' }], touched: false, derivedFrom: null }
          : { exerciseId: id, name, type, notes: '' },
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
        return isLast && filled ? { ...stamped, collapsed: true } : stamped;
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

  function removeExercise(exerciseId) {
    const newTemplate = {
      ...template,
      [activeDayType]: {
        ...template[activeDayType],
        exercises: template[activeDayType].exercises.filter((e) => e.id !== exerciseId),
      },
    };
    persistTemplate(newTemplate);
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
      dayType: activeDayType,
      dayLabel: (template[activeDayType] || {}).label,
      colorKey: (template[activeDayType] || {}).colorKey,
      date: new Date().toISOString(),
      durationSec,
      note: draft.note && draft.note.trim() ? draft.note.trim() : undefined,
      deload: draft.deload || undefined,
      hr: draft.hr || undefined,
      exercises: cleanExercises,
    };
    // PR check: compare this session's best e1RM per exercise against all prior history.
    const prior = bestE1rmByName(sessions);
    const prs = [];
    cleanExercises.forEach((ex) => {
      if (ex.type !== 'strength') return;
      let best = null;
      ex.sets.forEach((set) => {
        const e = epley(set.weight, set.reps);
        if (e !== null && (best === null || e > best)) best = e;
      });
      if (best !== null && best > (prior[ex.name] || 0)) prs.push({ name: ex.name, e1rm: Math.round(best * 2) / 2 });
    });

    const ok = await persistSessions([...sessions, newSession]);
    setSaving(false);
    if (ok) {
      setNewPRs(!draft.deload && prs.length ? prs : null);
      goBack();
    }
    // if save failed, stay on the log screen with the banner showing — nothing is lost, user can hit Retry
  }

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900">
      <style>{`
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
        /* iOS Safari auto-zooms on focus when input font-size < 16px; pin everything to 16px */
        input, textarea, select { font-size: 16px !important; }
      `}</style>
      <div className="max-w-md mx-auto px-4 pb-28 pt-6">
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
        {loading ? (
          <LoadingState />
        ) : view === 'home' ? (
          <HomeView template={template} dayOrder={currentTemplate.dayOrder || []} templateName={currentTemplate.name} sessions={sessions} unit={unit} onStart={startSession} onHistory={openHistory} onSettings={() => setView('settings')} newPRs={newPRs} onDismissPRs={() => setNewPRs(null)} backupDue={!lastExportAt || (Date.now() - new Date(lastExportAt).getTime()) > 7 * 86400000} lastExportAt={lastExportAt} />
        ) : view === 'settings' ? (
          <SettingsView unit={unit} onSetUnit={setUnitPersist} sessions={sessions} onBack={() => setView('home')} />
        ) : view === 'export' ? (
          <ExportView templates={templates} sessions={sessions} onImport={importData} onCopied={recordBackup} />
        ) : view === 'log' ? (
          <LogView
            dayType={activeDayType}
            template={template}
            draft={draft}
            editMode={editMode}
            setEditMode={setEditMode}
            unit={unit}
            onBack={goBack}
            onUpdateSet={updateSet}
            onAddSet={addSet}
            onRemoveSet={removeSet}
            onUpdateNotes={updateNotes}
            onAddExercise={addExercise}
            onRemoveExercise={removeExercise}
            onMoveExercise={moveDraftExercise}
            onToggleCollapse={toggleCollapse}
            onRpeBlur={handleRpeBlur}
            knownExercises={collectKnownExercises(templates, sessions)}
            onFetchHR={fetchDraftHR}
            timerEndsAt={timerEndsAt}
            timerPreset={timerPreset}
            onTimerStart={startRestTimer}
            onTimerStop={stopRestTimer}
            audioCtxRef={audioCtxRef}
            onFinish={finishSession}
            saving={saving}
            getLastExerciseData={getLastExerciseData}
            getSuggestion={getSuggestion}
            onToggleDeload={toggleDeload}
            onUpdateSessionNote={updateSessionNote}
            onCancel={goBack}
          />
        ) : view === 'records' ? (
          <RecordsView sessions={sessions} unit={unit} />
        ) : view === 'templates' ? (
          <TemplatesView templates={templates} onSetCurrent={setCurrentTemplate} onEdit={(id) => { setEditingTemplateId(id); setView('templateEdit'); }} onAdd={addTemplate} onDelete={deleteTemplate} />
        ) : view === 'templateEdit' && templates.find((t) => t.id === editingTemplateId) ? (
          <TemplateEditView template={templates.find((t) => t.id === editingTemplateId)} onBack={() => { setEditingTemplateId(null); setView('templates'); }} onSave={saveTemplateEdits} knownExercises={collectKnownExercises(templates, sessions)} />
        ) : (
          view === 'history' ? (
          <HistoryView dayType={activeDayType} template={template} sessions={sessions} unit={unit} onBack={goBack} onOpenSession={openSession} mode={historyMode} onSetMode={setHistoryModePersist} />
        ) : (
          <SessionEditView session={editingSession} template={template} unit={unit} onBack={() => { setEditingSession(null); setView('history'); }} onSave={saveSessionEdits} onDelete={deleteSession} onFetchSessionHR={fetchSessionHR} />
        )
        )}
        </ErrorBoundary>
      </div>
      {['home', 'templates', 'history', 'records', 'export', 'settings'].includes(view) && (
        <BottomTabs
          active={(view === 'history' && activeDayType) || view === 'settings' ? 'home' : view}
          onSelect={(key) => {
            setEditingSession(null);
            setEditingTemplateId(null);
            setDraft(null);
            if (key === 'history') {
              openAllHistory();
            } else {
              setActiveDayType(null);
              setView(key);
            }
          }}
        />
      )}
    </div>
  );
}
