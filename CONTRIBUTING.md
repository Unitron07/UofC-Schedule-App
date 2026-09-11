# Contributing

Follow the README's build and test instructions. Keep changes focused; describe user-visible behavior and checks performed.

- Use synthetic calendars. Never commit student exports, machine-specific paths, tokens, signing keys, or private screenshots.
- Preserve the version 1 local-storage schedule shape unless providing a migration.
- Escape imported and manually entered text before inserting HTML. Restrict the Android bridge to packaged assets.
- Preserve offline operation and Calgary time semantics.
- Run `npm test`, `npm run test:ui`, `npm run format:check`, and `./gradlew assembleDebug` for relevant changes.
- Check compact portrait and landscape layouts. Verify native imports on Android when changing the Java host.
- Update the changelog. Keep versions in `app/build.gradle`, `app.js`, and `package.json` aligned.

Release assets belong in GitHub Releases. Build with a privately retained signing key, verify APK signatures and contents, and publish SHA-256 checksums.
