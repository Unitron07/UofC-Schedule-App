# Changelog

## 1.2 — 2026-09-11

Tag: `v1.2.0`. Android version name: `1.2`; version code: `4`.

### Added

- Automatically show the next calendar day once today's final meeting ends, on launch/resume and while following the default view. Manual date navigation remains available.
- Named holidays and term breaks in daily and weekly views, including the National Day for Truth and Reconciliation and overlapping Remembrance Day/fall term break labels.
- Bundled public academic dates for offline use, refreshed from UCalgary's academic schedule after each confirmed calendar import.
- Refresh status and safe fallback when offline or if the university page changes format. Imported meetings are never deleted because of a holiday label.

### Changed

- Added Internet permission for one fixed public HTTPS calendar request. No student schedule or manually entered details are uploaded.
- Added tests for class-end boundaries, midnight, DST, manual selection, resume behavior, published versus draft date tables, cache updates, and failed refreshes.

## 1.1 — 2026-09-11

Tag: `v1.1.0`. Android version name: `1.1`; version code: `3`.

### Added

- Course code and full-name display, with manual editing for missing calendar fields.
- Lecture, tutorial, and lab labels inferred from supported section identifiers.
- Tappable subjects with teaching staff, rooms, sections, dates, and session counts.
- Saved course instructors, section instructors/TAs, office hours, and notes.
- Optional post-import setup with **Skip for now** and later editing.
- Five accent palettes and persistent appearance preferences.

### Changed

- Distributable builds start empty and use generic imported data only. No student-specific course, instructor, or online-course presets are bundled.
- Build number advanced to 3 so this release can update an earlier development build of 1.1.
- Added Gradle wrapper, portable tests, fictional fixture, example screenshots, and CI.

## 1.0 — 2026-09-11

Tag: `v1.0.0`. Android version name: `1.0`; version code: `1`.

### Added

- Offline Android app with ICS file import, preview, and replacement.
- Daily timetable, upcoming class, free-time gaps, weekly view, and subject list.
- Class times, locations, date navigation, and Calgary time-zone handling.
- Recurrence expansion, exception dates, moved/cancelled meetings, and import limits.
- Light/dark/system appearance and 12/24-hour time settings.
- Android file picker and compatible Open with / Share intents.

### Distribution

- Rebuilt the initial app for this repository release. No real calendar or user data is bundled.
- Source, build instructions, tests, and synthetic examples accompany the release.

Dates are repository publication dates. Release APKs are clean rebuilds, not copies of earlier development artifacts. Imported data already on a phone remains local and is not part of an APK.
