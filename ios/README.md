# Salah iOS

This directory contains the native iOS foundation for Salah.

## Phase 1 Scope

- SwiftUI app target with prayer times, qiblah, and local settings screens.
- Local settings persisted with `UserDefaults`.
- `adhan-swift` through Swift Package Manager.
- Unit-test parity fixtures generated from the existing PWA `adhan-js` behavior.

Live Activities, App Intents, APNs, and backend registration are intentionally not included in this phase. They should start only after this app builds and the parity tests pass on macOS/Xcode.

## Requirements

- Xcode 15.2 or newer.
- iOS deployment target 17.2.
- A signing team and bundle ID before device testing.

## Useful Commands

```bash
open ios/Salah.xcodeproj
xcodebuild -project ios/Salah.xcodeproj -scheme Salah -destination 'platform=iOS Simulator,name=iPhone 15' test
```

This Linux workspace does not include Swift or Xcode, so native compilation must be verified on a macOS host.
