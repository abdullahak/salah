# Salah Architecture

## Runtime Shape

Salah is a static client-only PWA. The production build contains HTML, CSS, JavaScript, manifest, icons, and service worker assets. No Node process or backend API is needed for v1.

## Core Decisions

- Framework: React + Vite + TypeScript.
- Prayer calculation: `adhan-js`, executed locally in the browser.
- Qiblah calculation: `adhan-js`, executed locally in the browser.
- Persistence: local browser storage with a versioned payload.
- Location inputs: browser geolocation, bundled offline cities, manual coordinates.
- Optional online city lookup: adapter boundary only; no automatic calls.
- Hosting: nginx static serving on the Raspberry Pi, exposed as `salah.abdlh.com`.

## Module Boundaries

- `src/calculation`: pure prayer time, qiblah, settings, and formatting logic.
- `src/location`: location types, bundled city data, local search, and browser geolocation wrapper.
- `src/settings`: local persistence and default app state.
- `src/ui`: React-facing components and app composition.

## Privacy Invariants

- Normal app load must not make network requests beyond static assets.
- Geolocation must be triggered by a user action.
- Coordinates must not be sent to a geocoder in v1.
- Optional online lookup must stay outside calculation and persistence code.

## Deployment Notes

`npm run build` emits static files to `dist/`. A production deployment should copy or sync `dist/` into a stable nginx-served release directory on the Pi. nginx should serve `index.html` for app routes and set conservative caching for the HTML shell while allowing longer caching for fingerprinted assets.

The intended public domain is `https://salah.abdlh.com`. PWA scope, manifest start URL, and service worker registration assume hosting from the domain root.
