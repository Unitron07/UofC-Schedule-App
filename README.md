# Campus Day 1.0

An offline Android timetable with calendar import, daily agenda, weekly overview, room details, subject search, and light/dark appearance. Independent project; not affiliated with the University of Calgary.

<img src="docs/images/daily.png" width="280" alt="Campus Day 1.0 with fictional classes">

The image shows the actual interface in a mobile browser test using `examples/demo.ics`. No real student data is included.

## Install

Download **Campus-Day-1.0.apk** from this tag's GitHub Release. Open it on Android and import a calendar using **Import timetable**. Import again to refresh meetings. This version does not include the subject editor or accent picker added in 1.1.

## Build

Use JDK 17, Android SDK Platform 35, and Build Tools 35.0.0. Set `ANDROID_HOME` to the SDK directory.

```sh
./gradlew assembleDebug
```

On Windows use `gradlew.bat assembleDebug`. The APK appears in `app/build/outputs/apk/debug/`. The wrapper pins Gradle 8.9 with checksum verification; the Android Gradle plugin is 8.7.3. The first build requires internet access to download dependencies. An optional Windows SDK-only builder is included as `build-apk.ps1`; run `Get-Help ./build-apk.ps1` for its required path arguments.

Signing keys are excluded. Local builds use a local key and cannot update a differently signed installed APK. Published versions share one project signing certificate.

## Development

Use Node.js 22 or later:

```sh
npm ci
npm test
npx playwright install chromium
npm run test:ui
npm run format:check
```

Tests use fictional data. Screenshots go to ignored `test-output/`; `CHROME_PATH` optionally selects an existing browser. Native Android file picking requires device testing.

Java hosting code lives in `app/src/main/java/ca/campusday/app/MainActivity.java`. Packaged HTML, CSS, UI logic, and the calendar parser are under `app/src/main/assets/`. Gradle configuration, wrapper, portable tests, CI, and example data are included.

Read [CHANGELOG.md](CHANGELOG.md) and [PRIVACY.md](PRIVACY.md). ICAL.js 2.2.1 is bundled unmodified under [MPL-2.0](ICAL-LICENSE.txt); its source is at https://github.com/kewisch/ical.js/tree/v2.2.1.
