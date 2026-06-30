# Salah Product Spec

## Purpose

Salah helps Muslims find prayer times and qiblah direction without giving up unnecessary location privacy. The app should be useful as an installable mobile-first PWA and should continue working for a saved location after the first visit.

## Privacy Promise

- No account is required.
- No analytics are included in v1.
- Prayer times and qiblah are calculated locally in the browser.
- Browser geolocation is requested only after a user action.
- Saved location and settings stay in browser storage.
- City search works offline for bundled cities.
- Optional online city lookup must be explicit and isolated from normal app load.

## V1 User Flows

- View prayer times and qiblah for the saved location.
- Select an offline bundled city.
- Enter coordinates manually.
- Use browser geolocation after pressing a button.
- Adjust calculation method, madhab/asr preference, and time format.
- Install the PWA and reopen it offline for the saved location.

## V1 Outputs

- Current selected location.
- Today's Fajr, Sunrise, Dhuhr, Asr, Maghrib, and Isha times.
- Qiblah direction as a degree bearing.
- Privacy state that makes clear whether location is local, browser-provided, or manually entered.

## Non-Goals

- User accounts.
- Backend API.
- Analytics.
- Push notifications.
- Monetization.
- Mosque/community features.
- Automatic reverse geocoding from coordinates.
