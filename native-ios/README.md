# Yawl — app source

This is where the app actually lives. All commands run from this directory:

```bash
npm install
npm run dev      # Vite dev server on :5173 — fastest loop for UI work
npm run build    # vite build -> dist/ (what Capacitor copies into the iOS app)
npm run sync     # build + cap sync ios
npm run ios      # build + sync + open Xcode
```

**Full documentation — what the app does, dev environment setup, project layout,
and gotchas — is in the [root README](../README.md).** Architecture notes for
working in the codebase are in [CLAUDE.md](../CLAUDE.md).

## Updating the app on your phone

Your log lives on the phone and survives an update, as long as the bundle ID
stays `com.jonah.workoutlog`. Export a backup first anyway (Settings → Export
or import data).

```bash
git pull
cd native-ios
npm install
npm run ios      # builds, syncs, opens Xcode
```

In Xcode pick your iPhone as the run target and press Run. The first launch
after an update builds the exercise library from your existing templates and
history; nothing needs importing.

## Web build

`web/` builds the same `src/` as a static site (no Vite, no Capacitor) into
`web/dist/`, which is what gets uploaded to the web host. See the "Web build"
section of [CLAUDE.md](../CLAUDE.md).
