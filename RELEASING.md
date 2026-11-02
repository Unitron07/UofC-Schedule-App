# Release signing

Starting with Campus Day 1.3, the release signing key is stored in this repository's encrypted **Settings → Secrets and variables → Actions** secrets:

- `ANDROID_KEYSTORE_BASE64`: base64-encoded JKS keystore.
- `ANDROID_KEYSTORE_PASSWORD`: keystore password.
- `ANDROID_KEY_ALIAS`: signing alias.
- `ANDROID_KEY_PASSWORD`: signing key password.

The private key and passwords are not committed or attached to releases. GitHub hides saved secret values, but the release workflow can use them. Keep an independent private backup of the original keystore and passwords.

To create future APKs, open **Actions → Build signed release APK → Run workflow**, choose the intended release branch or tag, and run it. Download the `signed-release` artifact after the workflow succeeds. It contains the APK, SHA-256 checksum, and public certificate information. Use the same secrets for future updates; do not generate a replacement key for each release.

The workflow verifies the signing certificate's SHA-256 fingerprint:

```text
299609ae0a8c38f14ebf3443342e9f88bc73b82c8a4e102a08ff34ae69bdd40d
```

Version 1.3 uses a different certificate from versions 1.0–1.2 because the old private key was unavailable. Android requires uninstalling the older version before installing 1.3, which removes saved timetable data and preferences. Import the timetable again afterward. Later APKs built with the 1.3 key can update 1.3 in place.
