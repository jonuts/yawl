# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Where the code actually lives

**All real work happens in `native-ios/`.** The repo root contains a stale
earlier copy of the web app (`index.html`, `storage.js`, `notifications.js`,
`package.json`) with **no `src/` directory** — root `npm run dev` will fail.
The root `notifications.js` and `storage.js` are older versions of their
`native-ios/src/` counterparts. Treat the root copies as dead; edit only
`native-ios/src/`.

Also note: `node_modules` is committed (8,522 of ~8,567 tracked files) and there
is no `.gitignore`. Two zip archives (`workoutlog.zip`, `workout-log-ios.zip`)
are also tracked at root.

## Commands

Run everything from `native-ios/`:

```bash
npm run dev      # Vite dev server — fastest loop for UI work
npm run build    # builds dist/ (what Capacitor copies into the iOS app)
npm run sync     # build + npx cap sync ios
npm run ios      # build + sync + open Xcode
```

There are no tests, linter, or typechecker configured. There is no test command
to run.

Native changes (Swift, Info.plist, entitlements) require a rebuild in Xcode;
`npm run sync` alone only refreshes web assets. HealthKit and local
notifications do **not** work correctly in the Simulator — they need a real
device, which means Xcode signing (see `README.md` for the free-Apple-ID
7-day expiry caveat).

## Architecture

A Capacitor 6 wrapper around a single-page React app. React 18 + Vite +
Tailwind, no router and no state library — one component holds everything.

### The one big component

`native-ios/src/WorkoutTracker.jsx` is ~2,900 lines and *is* the app. All views
(`home`, `log`, `history`, `records`, `templates`, `export`) are function
components in that one file, switched by a `view` string in state. All app
state lives in the default-exported `WorkoutTracker()` at the bottom of the
file (~line 2162); every view is a pure prop-driven child. When adding a
feature, expect to touch both the child component and the state/handlers at
the bottom.

### Native bridge modules

Three thin wrappers isolate everything platform-specific:

- `storage.js` — Capacitor Preferences (iOS UserDefaults) behind an async
  `get`/`set` shim. `set` only stores strings; **callers `JSON.stringify`
  themselves.** `get` returns `{ value }` or `null`.
- `notifications.js` — rest-timer local notifications. The notification
  registers a text-input action (`LOG_RPE`), so an RPE replied from the lock
  screen or Apple Watch logs against the specific set carried in the
  notification's `extra` payload, then starts the next rest period.
- `healthkit.js` — heart rate via a hand-written Swift plugin. Fails **silently**
  by design (`fetchRecentMaxHR` returns `null`, never throws) so it can run
  mid-workout without error spam.

The HealthKit plugin is custom, not a package: `ios/App/App/HealthKitPlugin.swift`
implements `CAPBridgedPlugin`, and Capacitor 6 requires explicit registration —
done in `MyViewController.swift`, which `Main.storyboard` must point at. Adding
a native plugin method means editing both files.

### Persistence keys

All under Capacitor Preferences: `templates`, `workout-sessions`, `ui-state`,
`last-export`, `history-view-mode`, `storage-probe`. Legacy key
`program-template` migrates into `templates` on first load.

On startup the app runs a **storage self-test** (writes `storage-probe`, reads
it back) and shows a persistent warning banner if the round-trip fails, rather
than silently losing a workout. Save failures keep the user on the log screen
with a Retry button — never navigate away on a failed save.

`ui-state` is written on every view/draft change so an accidental app close
restores the in-progress workout exactly where it was.

### Data model

A **template** is `{ id, name, current, dayOrder, days }` where `days` maps a
day key (`lowerA`, `upper1`, …) to `{ label, subtitle, colorKey, exercises }`.
Multiple templates can exist; exactly one has `current: true`.

An **exercise** in a template is `{ id, name, type }` where `type` is
`'strength'` or `'conditioning'`. Conditioning exercises have `notes` instead
of sets and are skipped by every volume/PR/suggestion calculation — check
`type !== 'strength'` guards when touching that code. Optional fields:
`defaultSets` (default 2), `target: { lo, hi, cap }` for double progression,
`superset`, and `derivedFrom: { sourceId, factor }`.

A **session** is a saved draft: `{ id, dayType, dayLabel, colorKey, date,
durationSec, note?, deload?, hr?, exercises }`. Sets are
`{ weight, reps, rpe, hr?, hrAt? }` — **stored as strings**, parsed at use
site. `sessions` is chronological (oldest first); history lookups iterate
backwards.

### Domain logic worth knowing before editing

- **`derivedFrom`** links an exercise's weight to a fraction of another's
  (e.g. RDL = 0.75 × deadlift). It's *perpetual* — `forceDerive` re-derives
  every session even when the exercise has its own history. Same-day sources
  read from the live draft; cross-day sources read history.
- **`buildSuggestion`** drives the next-session prescription. With a `target`
  it does double progression (fill the rep range at or under the RPE cap, then
  +2.5kg); without one it falls back to an e1RM-trend heuristic. Weights round
  to 2.5.
- **Deload** (`applyDeloadTransform`) rewrites the draft to 60% of top-set
  weight, capped at 2 sets. Deload sessions are excluded from suggestion
  history and suppress PR notifications; `getLastExerciseData` only falls back
  to a deload session if no normal one exists.
- **e1RM is Epley** (`epley`) and underpins records, PR detection, and the
  trend heuristic.
- **Per-set HR** is captured on RPE entry via a timestamp (`hrAt`), then
  **backfilled** at session end (`backfillSetHRs`) from the full sample list.
  This is deliberate: Watch→iPhone sync latency makes a live query at entry
  time unreliable.

### iOS-specific CSS constraints

`index.css` fixes `html, body` and scrolls `#root` instead. This is load-bearing:
the WKWebView's own scroll view rubber-bands on iOS and drags `position: fixed`
elements (rest timer, tab bar, save bars) with it. Don't restore scrolling to
the body. Inputs are pinned to `16px` because iOS auto-zooms below that. The
app is portrait-locked in `Info.plist` (iPhone only).

### Export format

`{ app: 'workout-log', formatVersion: 2, exportedAt, templates, sessions }`.
Import accepts either this envelope or a bare session array, and filters out
malformed entries rather than rejecting the whole payload.
