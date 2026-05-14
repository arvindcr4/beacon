# Beacon — Android (TWA)

This directory ships Beacon as a native Android app via **Trusted Web Activity**
(TWA) — a thin Chrome Custom Tab shell that loads the production PWA at
`https://beacon-dun-one.vercel.app/inbox` without browser chrome.

## Why TWA over Capacitor / React Native

- **976 KB APK.** No bundled web content; the shell loads the live PWA.
- **Updates ship with `vercel deploy`.** No Play Store re-submission for content changes.
- **One codebase.** The mobile-web app *is* the Android app — same React, same Tailwind tokens, same service worker.
- **Real Play Store eligibility.** The AAB here is what you upload to Google Play Console.

## What's in this folder

| File | Purpose |
|------|---------|
| `twa-manifest.json` | Bubblewrap config (package id, theme tokens, signing key, fingerprint). |
| `beacon-release.keystore` | Release signing keystore (gitignored). |
| `.keystore-pass` | Keystore password (gitignored). |
| `build.expect` | Drives Bubblewrap's interactive password prompts. |
| `app/`, `build.gradle`, `gradle/`, `gradlew` | Gradle Android project Bubblewrap generated. |
| `app-release-signed.apk` | Sideloadable APK (signed). |
| `app-release-bundle.aab` | Play Console upload bundle. |

## Install on a device

### Option A — sideload the APK
1. Transfer `app-release-signed.apk` to the phone (AirDrop to a Mac, USB,
   or just download it from a private link).
2. On the phone, allow installs from the source (Settings → Apps → Special
   access → Install unknown apps).
3. Tap the APK to install. Open **Beacon** from your launcher.

### Option B — `adb install`
```bash
adb install android/app-release-signed.apk
```

### Option C — Play Store (production rollout)
1. https://play.google.com/console → Create app → Internal testing → upload
   `app-release-bundle.aab`.
2. Add the device's Google account as an internal tester.
3. Install from the Play Store internal-testing link.

## Why the address bar is hidden

The TWA shows the URL bar **unless** Digital Asset Links verifies that the
APK's signing certificate matches the PWA origin. Our setup:

- The APK is signed with `beacon-release.keystore`, fingerprint:
  `4B:EE:94:88:3B:3A:0F:F1:D8:8B:72:C8:BB:D5:FB:EC:97:2A:D3:85:4A:E1:CB:2F:03:25:DD:2B:2D:A5:86:65`
- The PWA serves [`/.well-known/assetlinks.json`](https://beacon-dun-one.vercel.app/.well-known/assetlinks.json)
  declaring that fingerprint can act on its behalf.
- On first launch, Chrome (the underlying TWA renderer) checks the
  declaration and drops the URL bar.

Both sides must stay in sync — if you regenerate the keystore, regenerate
the fingerprint and redeploy the assetlinks file.

## Rebuilding

Prerequisites:
- JDK 21 (`brew install openjdk@21`)
- Android command-line tools (Bubblewrap can install them; see notes)
- Bubblewrap CLI (`npm install -g @bubblewrap/cli`)
- `expect` (`brew install expect`) for non-interactive password input

```bash
cd android
export JAVA_HOME=/opt/homebrew/opt/openjdk@21
export PATH="$JAVA_HOME/bin:$PATH"
export ANDROID_HOME=$HOME/.bubblewrap/android_sdk

# Bump the version
# Edit twa-manifest.json: increment "appVersionCode" and "appVersionName"

KEYSTORE_PASS=$(grep '^KEYSTORE_PASS=' .keystore-pass | cut -d= -f2)
./build.expect "$KEYSTORE_PASS"
```

Outputs land at `./app-release-signed.apk` and `./app-release-bundle.aab`.

## Releasing a new keystore (only if compromised)

If the keystore is ever lost, replacement requires a full reinstall by every
user (Android keys identity by signing cert). Do this only as a last resort:

```bash
keytool -genkeypair -keystore beacon-release.keystore -alias beacon \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -dname "CN=Beacon, O=Beacon, C=US"

# Extract new SHA-256
keytool -list -v -keystore beacon-release.keystore -alias beacon | grep SHA256:

# Update public/.well-known/assetlinks.json with the new fingerprint,
# git push, vercel deploy --prod, then rebuild the APK.
```
