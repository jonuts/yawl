# Yawl — yet another workout logger (native iOS)

Your app, wrapped in Capacitor, running as a real iOS app.

## What changed from the web version

| | Web version | This version |
|---|---|---|
| Storage | Safari IndexedDB (wipeable) | Native Preferences (survives everything) |
| Rest timer alert | Only while app is open | **Fires with phone locked in your bag** |
| Offline | Needs signal on first load | Fully offline, always |
| Screen | Browser chrome | True full-screen |

Your React code is otherwise unchanged — same templates, suggestions, deload
mode, calendar, autocomplete, all of it.

---

## Setup (one time, ~15 min)

Open Terminal, `cd` into this folder, then run these in order.

### 1. Install dependencies
```bash
npm install
```

### 2. Build the web assets
```bash
npm run build
```
This creates `dist/`. Capacitor copies that into the iOS app.

### 3. Add the iOS platform
```bash
npx cap add ios
```
This generates the `ios/` folder containing the Xcode project. Only needed once.

### 4. Sync and open Xcode
```bash
npx cap sync ios
npx cap open ios
```
Xcode launches with your project.

---

## First run in Xcode

1. In the left sidebar, click the blue **App** project at the top.
2. Select the **App** target → **Signing & Capabilities** tab.
3. Check **Automatically manage signing**.
4. **Team**: pick your Apple ID. If none listed:
   Xcode → Settings → Accounts → **+** → Apple ID → sign in.
5. **Bundle Identifier**: if Xcode complains it's taken, change
   `com.jonah.workoutlog` to something unique like `com.jonah.workoutlog2`.
6. Plug in your iPhone via USB. Unlock it. Tap **Trust** if prompted.
7. In the device dropdown at the top of Xcode, select **your iPhone**
   (not a simulator — the simulator can't do notifications properly).
8. Hit the **▶️ Play** button.

First build takes a few minutes. Then on your phone:
**Settings → General → VPN & Device Management → your Apple ID → Trust.**
Then launch the app from your home screen.

---

## Important: the 7-day thing

With a **free** Apple ID, the app signature expires after **7 days** — the app
stops opening and you re-run it from Xcode (plug in, hit ▶️, ~1 min).

With the **$99/year Apple Developer Program**, signatures last a year, and you
can install over the air via TestFlight without the cable.

My advice: run it free for a couple of weeks first. If it earns its place in
your routine, then pay the $99.

---

## Moving your data over

This is a fresh app with its own storage, so your log doesn't come automatically.

1. Open your current web app, go to the **Export** tab, tap **Copy**.
2. Open the native app, go to **Export**, paste into the Import box.
3. Tap **Import Sessions**.

Everything — both templates and every session — comes across.

---

## Making changes later

When I hand you an updated `src/WorkoutTracker.jsx`, drop it in and run:
```bash
npm run ios
```
That rebuilds, syncs, and opens Xcode. Hit ▶️. Your logged data is untouched —
it lives on the device, not in the app bundle.

---

## Notifications

On first launch the app asks permission to send notifications. **Say yes** —
that's what makes the rest timer fire when your phone is in your bag. If you
tap no by accident: Settings → Yawl → Notifications → Allow.

---

## About HealthKit / Apple Watch

Not wired up yet — deliberately. Get the app running and stable first. HealthKit
needs extra entitlements and an Apple Developer account, and it's a separate
piece of work. Once this is solid, we add:
- Reading workout heart rate from your Watch (for conditioning days)
- Writing your sessions to Apple Health

Ask me when you're ready for that step.

---

## Troubleshooting

**`npx cap add ios` fails** — make sure Xcode is fully installed and you've
opened it once to accept the license. Then: `sudo xcode-select --install`.

**"No such module 'Capacitor'"** — CocoaPods didn't install. Run:
```bash
cd ios/App && pod install && cd ../..
```
If `pod` isn't found: `brew install cocoapods`.

**White screen on launch** — the web build didn't get copied. Run
`npm run build && npx cap sync ios` then rebuild in Xcode.

**Build fails on M2 with signing errors** — usually the bundle ID is taken.
Change it to something unique in Signing & Capabilities.
