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

The app is branded **Yawl** (yet another workout logger) but the bundle ID is
still `com.jonah.workoutlog` — **do not "fix" it to match**: changing the
bundle ID installs a fresh app and orphans all logged data on the device.

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
(`home`, `log`, `history`, `records`, `templates`, `exercises`, `settings`, `export`) are function
components in that one file, switched by a `view` string in state. All app
state lives in the default-exported `WorkoutTracker()` at the bottom of the
file (~line 2162); every view is a pure prop-driven child. When adding a
feature, expect to touch both the child component and the state/handlers at
the bottom.

### Native bridge modules

Four thin wrappers isolate everything platform-specific:

- `storage.js` — Capacitor Preferences (iOS UserDefaults) behind an async
  `get`/`set` shim. `set` only stores strings; **callers `JSON.stringify`
  themselves.** `get` returns `{ value }` or `null`.
- `notifications.js` — rest-timer local notifications. The notification
  registers a text-input action (`LOG_RPE`), so an RPE replied from the lock
  screen or Apple Watch logs against the specific set carried in the
  notification's `extra` payload, then starts the next rest period.
- `haptics.js` — the "rest is over" buzz. Capacitor Haptics on the device (iOS
  has no `navigator.vibrate`), `navigator.vibrate` in a browser. Never throws.
- `healthkit.js` — heart rate via a hand-written Swift plugin. Fails **silently**
  by design (`fetchRecentMaxHR` returns `null`, never throws) so it can run
  mid-workout without error spam.

The HealthKit plugin is custom, not a package: `ios/App/App/HealthKitPlugin.swift`
implements `CAPBridgedPlugin`, and Capacitor 6 requires explicit registration —
done in `MyViewController.swift`, which `Main.storyboard` must point at. Adding
a native plugin method means editing both files.

### Persistence keys

All under Capacitor Preferences: `templates`, `workout-sessions`, `exercises`,
`settings`, `sync-state`, `ui-state`, `last-export`, `history-view-mode`, `storage-probe`
(`weight-unit` is still written for older builds; `settings.unit` is the truth). Legacy key
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
`defaultSets` (see "Default sets" below), `target: { lo, hi, cap }` for double progression,
`superset`, and `derivedFrom: { sourceId, factor }`.

A **session** is a saved draft: `{ id, dayType, dayLabel, colorKey, date,
durationSec, note?, deload?, hr?, exercises }`. Sets are
`{ weight, reps, rpe, hr?, hrAt? }` — **stored as strings**, parsed at use
site. `sessions` is chronological (oldest first); history lookups iterate
backwards.

### Starter templates

A brand-new install is seeded by `buildSampleTemplates()` with two programs,
**Push Pull Legs** (current) and **5x5**, plus `SAMPLE_LIBRARY` entries with
equipment and a short explanatory note each. They exist to demonstrate the
template features (targets, linked weights, supersets, set-count overrides,
weekdays, notes-only exercises), so keep every feature represented if you edit
them. The big lifts share ids across both (`ex-squat`, `ex-bench`, ...).

Seeded templates and exercises carry `sample: true` until edited. On the first
sync after sign-in, a device with no logged sessions that finds templates
already in the account drops its untouched starters instead of adding them.
The legacy `program-template` key still migrates into a single template.

### Settings

`settings` is one object (`DEFAULT_SETTINGS` / `normalizeSettings` at the top of
`WorkoutTracker.jsx`): unit, per-unit plate step / fine step / bar weight, rest
presets, RPE ceiling, deload percent and sets, default sets, week start, etc.
The root component assigns the live copy to the module-level `RT` at the top of
every render, and the pure helpers (`unitDef`, `buildSuggestion`, `buildRamp`,
...) read `RT` instead of taking settings as a parameter. Add a setting by
adding it to `DEFAULT_SETTINGS`, `normalizeSettings`, and `SettingsView`.

### Exercise library

`exercises` is the global pool: `{ id, name, type, equipment, notes,
defaultSets?, restSec?, hold?, archived? }`. Templates still embed
`{ id, name, type }` per exercise (old exports and older builds keep working),
but the library is the source of truth for names: renaming in the Exercises tab
or in the template editor renames it in every template. History, PRs and
suggestions follow the **id**; records are grouped by the id's *current* library
name (`nameOf`), so a rename carries its history along. `syncLibrary` runs on
load and after imports and adds anything a template or session references.
Removing an exercise that has logged history only sets `archived` (hidden,
restorable) and strips it from templates; one with no history is deleted.

### Default sets

Most specific wins (`resolveDefaultSets`): the exercise inside a template day
(`defaultSets` on the embedded entry) -> the library exercise -> the template
(`template.defaultSets`) -> `settings.defaultSets` (3). With
`settings.setCountSource === 'history'` (the default) a new session opens each
exercise with last session's set count and the default is only the fallback;
`'defaults'` always uses the default.

### Web build

`native-ios/web/` builds the same `src/` as a plain static site without Vite or
Capacitor: `NODE_MODULES_DIR=... node web/build.mjs` writes `web/dist/`. It
aliases the Capacitor packages (and `lucide-react`) to small stand-ins in
`web/shims/`; storage uses the same `CapacitorStorage.<key>` localStorage names
as Capacitor's own web fallback. `npm run build` (Vite) is still what the iOS
app uses. New icons must exist in both `lucide-react` and `web/shims/lucide-react.jsx`.

### Native vs web differences in the UI

`hrAvailable()` (true only inside the Capacitor app) is the one platform switch
the views use: it shows the Watch HR cards, and on the Backup screen swaps the
browser "Save as file" download for a "Share / Save" button that hands the
backup file to the iOS share sheet (`navigator.share`, feature-detected).

### The in-progress workout (draft) and minimizing

`draft` is the workout being logged: `{ exercises, startedAt, dayType,
templateId, dayLabel, colorKey, note?, deload? }`. It is independent of `view`:
**Minimize** on the log screen switches to the tab screens and leaves `draft`
(and the rest timer) alive; a `SessionBar` strip above the tab bar resumes it.
Only Finish & Save or Cancel -> Discard clear it. `ui-state` persists the draft
whichever screen is showing.

The draft belongs to the template it was started from (`templateId`), not the
current one — use `draftTemplate` / `draftDays` / `draftDay` in the root, never
`template[...]`, for anything about the running workout. `activeDayType` is
only the per-day History filter. One workout at a time: starting another day
while a draft holds data asks to resume or discard. `FloatingTimer` is rendered
by the root (not `LogView`) so rest keeps counting while minimized.

**Swap** on an exercise card (log screen only, hidden in edit mode) replaces
that exercise in the same slot of the draft via `SwapModal` -> `swapExercise`
in the root: pick a library exercise of the same type (or type a new name),
then "just for today" (draft only) or "from now on" (also rewrites the template
day entry). The replacement keeps the slot and `superset`, but not the old
entry's `target` / `derivedFrom`; sets already entered for the old one are dropped.

### Cloud sync

Optional, off until the user signs in (Settings -> Cloud sync). Local storage
stays the working copy; the server holds a master copy that every signed-in
device syncs with. Sign-in is a 6-digit emailed code, no password.

- **Client:** `src/sync.js` (pure helpers + fetch wrapper) and the `runSync`
  block in the root component. Data is synced one record at a time — `session`,
  `template` (without its `current` flag), `exercise`, `settings`, and a
  `state/current` pointer to the current template. The in-progress draft and
  `ui-state` are per-device and never synced.
- **Change detection:** `sync-state` (storage key) holds the token, `lastRev`,
  a `shadow` (hash of every record as the server last had it) and `pending`
  (records that differ from the shadow, with the time the change was seen).
  An effect on the four collections recomputes `pending`; nothing in the
  persist functions needs to know about sync.
- **Conflicts:** last write wins per record, by device time; deletions are
  tombstones. Changes that predate the first sync after sign-in are stamped 0,
  so a second device merges in and the server copy wins for records both have.
  A record edited while a request is in flight keeps its local version.
- **Ordering trap:** in `runSync`, `saveSync` (shadow update) must run *before*
  the `persist*` calls that apply remote data, or the change-detection effect
  would see the merged data as local edits and push it back.
- **Server:** `native-ios/web/server/` — one Netlify Function
  (`netlify/functions/api.mts`, routes under `/api/*`) on Netlify Database
  (Postgres; schema in `netlify/database/migrations/`). Schema changes are new
  migration files, never edits to applied ones. Env vars are listed at the top
  of `api.mts`; `YAWL_DEV_ECHO_CODES=1` is for a test site only.
- **Deploying:** `node web/build.mjs && node web/bundle.mjs` assembles
  `web/deploy/` (server + prebuilt site); that folder is what gets uploaded.
  The iOS app calls the production site by absolute URL (`SYNC_SITE` in
  `sync.js`); the web app calls whichever site served it.

### Domain logic worth knowing before editing

- **`derivedFrom`** links an exercise's weight to a fraction of another's
  (e.g. RDL = 0.75 × deadlift). It's *perpetual* — `forceDerive` re-derives
  every session even when the exercise has its own history. Same-day sources
  read from the live draft; cross-day sources read history.
- **`buildSuggestion`** drives the next-session prescription. With a `target`
  it does double progression (fill the rep range at or under the RPE cap, then
  +2.5kg); without one it falls back to an e1RM-trend heuristic. Weights round
  to 2.5.
- **Deload** (`applyDeloadTransform`) rewrites the draft to `settings.deloadPct`
  (60%) of first-set weight, capped at `settings.deloadSets` (2) sets. Deload sessions are excluded from suggestion
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

`{ app: 'yawl', formatVersion: 3, weightUnit: 'kg', exportedAt, settings, exercises, templates, sessions }`
(`settings` and `exercises` are optional on import; v2 files still load)
(pre-rename exports say `app: 'workout-log'`; import ignores the field).
Import accepts either this envelope or a bare session array, and filters out
malformed entries rather than rejecting the whole payload.
