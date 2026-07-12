# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

ChickenInventoryApp — React Native (Android-only) inventory/sales/delivery-route management app for a
chicken distribution business. Firebase (Auth, Firestore, Storage, Crashlytics, Functions, App Check) is
the backend. Spanish is the language used in UI strings, code comments, and commit messages.

## Repository layout quirk

You are inside `android/`, the native Android project folder — but the app's JS/TS source also lives here,
under `android/app/src/` (screens, services, navigation, context, hooks, helpers, styles, utils). Only
`android/app/src/main/java` is actual native Android code.

The RN entry points (`App.tsx`, `index.js`) sit at the **repository root** (one level up) and import
screens via relative paths like `./android/app/src/screens/...`. So a change to a screen usually only
touches files under `android/app/src/`, but navigation wiring (adding a new screen/route) means editing
`../App.tsx`.

`../functions/` is a separate Node project (Firebase Cloud Functions) with its own `package.json`.

## Commands

Run from the repository root (one level up from here) unless noted:

```bash
npm install                # install JS deps
npm start                  # metro bundler (--reset-cache)
npm run android             # build + run on device/emulator
npm run lint                 # eslint .
npx jest                     # run tests — npm test is stubbed to a no-op echo, use jest directly
npx jest path/to.test.js     # run a single test file
```

From `android/`:

```bash
./gradlew :app:assembleDebug     # debug APK
./gradlew :app:assembleRelease   # release APK (needs my-release-key.keystore + gradle.properties secrets)
./gradlew :app:lint
./gradlew clean
```

Secrets required locally but gitignored (see `../README.md` for setup): `app/google-services.json`,
`app/my-release-key.keystore`, upload credentials in `android/gradle.properties`.

## Architecture

- **Firestore is the source of truth**, real-time synced. Access rules live in `../firebase/firestore.rules`
  and are role-gated via `isAdmin()` / `isVendedor()` / `isEntregador()` / `isBodeguero()` helpers. The four
  roles (`admin`, `vendedor`, `entregador`, `bodeguero`) map directly to app navigation/permissions — when
  adding a write path for a role, update the matching rule too.
- **Feature-module screens**: each `app/src/screens/<module>/` (e.g. `sales`, `presales`, `quicksalesNew`,
  `Warehouse`, `credits`, `customer`, `reports`, `users`, `routes`) is self-contained with its own
  `components/`, `hooks/`, `services/`, `styles/`, and sometimes `context/` or `store/`. Follow the
  existing module's internal layout rather than inventing a new shape.
- **State**: `contexts/AuthContext.jsx` holds the Firebase user/role/session; `context/RouteContext.js`
  holds the active delivery route; presales has its own `PreSaleProvider`. Zustand is used per-module
  (e.g. `quicksalesNew/store/useQuickCartStore.js`) rather than one global store.
- **Session timeout**: `utils/SessionManager.js` + `hooks/useSessionTimeout.js` auto-logout after
  inactivity (default 15 min), wired at the top of `../App.tsx`.
- **Error monitoring**: `services/errorMonitoring.js` wraps Crashlytics — use `captureError(error, context)`
  instead of ad-hoc `console.error`/try-catch swallowing.
- **Hardware**: Bluetooth ticket printing (`react-native-bluetooth-classic`, `react-native-ble-plx`) under
  `screens/settings/printers`; barcode scanning (ML Kit + vision-camera) under `screens/productsNew1`.

## Design system

**Read `../DESIGN.md` before writing or changing any UI** (colors, styles, layout, new screens or
components). It is the source of truth for the app's visual language; `../.impeccable/design.json` is the
same system in machine-readable form. Don't invent colors, shadows, or type scales — take them from there.

The short version, so you know when you're deviating:

- **Field Blue `#007AFF` is the one accent** — headers, primary buttons, FABs, active/selected states. If a
  component needs an accent, use it before introducing a new hue.
- **Green `#34C759` / red `#FF3B30` are semantic only** (paid/success, danger/delete). Never decorative.
- **One shadow, everywhere**: `shadowColor #0A2540, offset {0,2}, opacity 0.05, radius 6, elevation 2`.
  No second, heavier shadow "for emphasis".
- **Hierarchy via weight on the system font (Roboto)**: 800/700 for titles and numbers, 500/600 for body
  and labels. No custom typeface.
- **Radii**: `30px` pill for primary buttons/FABs, `16px` cards, `8-12px` inputs and nested containers.
- White cards on the tinted canvas (`#F5F6FA` / `#F0F4F8`). No gradients, glassmorphism, or blur.

Known drift to fix when you touch it, not before: the `Warehouse` module uses a green `#2DCE89` for tabs and
primary actions instead of Field Blue / `#34C759`.

## Editing conventions

These carry over from this repo's existing Copilot instructions and reflect how this codebase has been
maintained — keep following them:

- Prefer surgical diffs over rewriting whole files; don't refactor unrelated code or touch files outside
  the bug/feature's scope.
- For printed ticket text, preserve exact width/alignment and the `C$` currency formatting — don't
  reformat it incidentally.
- Reuse existing date utilities instead of adding new date-formatting helpers; validate nulls in discount
  logic (customer discount/credit fields are commonly `null`).
