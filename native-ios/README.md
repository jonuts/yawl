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
