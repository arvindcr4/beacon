# Beacon — Play Store Submission Kit

Everything you need to publish Beacon to Google Play, packaged so submission
is paste-and-click (or one CLI command if you provide a service-account JSON).

## What's in this folder

| File | What it is |
|------|------------|
| `listing.md` | All Play Console copy: title, short/full description, what's-new, categorization, contact, target audience. |
| `data-safety.md` | Pre-filled answers to the Data Safety questionnaire. |
| `content-rating.md` | Pre-filled answers to the IARC content rating questionnaire. |
| `feature-graphic.png` | 1024 × 500 marquee banner shown at the top of the Play listing. |
| `play-icon-512.png` | 512 × 512 app icon (separate from the in-APK icon). |
| `screenshots/01-inbox.png` | 1080 × 1920 — Unified inbox with AI priority + summaries. |
| `screenshots/02-message-ai.png` | 1080 × 1920 — Message view with AI summary + 5-tone draft. |
| `screenshots/03-compose-ai.png` | 1080 × 1920 — Compose with AI-from-intent. |
| `screenshot-templates/*.html` | Source HTML for the screenshots — re-render via `node scripts/render-shots.js`. |

Source AAB: `../android/app-release-bundle.aab` (1.1 MB).
Source APK: `../android/app-release-signed.apk` (976 KB).

## Two paths to live

### Path A — Upload via the Play Developer API (no clicking)

Prereqs (one-time, per the Play Console you control):
1. Create a Google Cloud project (or reuse `arvindcr4` if you have one).
2. Enable **Google Play Android Developer API** on that project.
3. Create a service account → grant role `Service Account User`.
4. Generate a JSON key for that service account → download.
5. Play Console → Setup → API access → Invite → paste the service-account
   email → grant **Release manager** for the Beacon app.
6. Play Console → Beacon → App content → fill in:
   - Privacy policy URL: `https://beacon-dun-one.vercel.app/privacy`
   - Data safety form (copy from `data-safety.md`)
   - Content rating questionnaire (copy from `content-rating.md`)
   - Target audience (18+, see `listing.md`)
   - Ads declaration (No)
   - The first manual upload of an AAB through the UI (Play won't accept API
     uploads until at least one bundle has been Console-uploaded; this is a
     Play Console quirk).

Then for every subsequent release:

```bash
GOOGLE_APPLICATION_CREDENTIALS=~/secrets/beacon-play.json \
  pnpm tsx scripts/upload-to-play.ts \
    --aab android/app-release-bundle.aab \
    --track internal \
    --release-name "1.0.0" \
    --release-notes "First release of Beacon."
```

Flip `--track internal` → `production` when you're ready for the public listing.

### Path B — All clicks in the Play Console UI

1. Play Console → Create app
   - App name: **Beacon — AI-First Inbox**
   - Default language: English (US)
   - Type: App
   - Free / Paid: Free
   - Declarations: accept
2. App content (left nav):
   - Privacy policy → `https://beacon-dun-one.vercel.app/privacy`
   - Ads → No
   - App access → "All functionality is available without special access"
     (Beacon supports email-only signup)
   - Content rating → paste answers from `content-rating.md`
   - Target audience → 18 and over (see `listing.md`)
   - News app? → No
   - COVID-19 contact tracing? → No
   - Data safety → paste from `data-safety.md`
   - Government app? → No
   - Financial features? → No
   - Health → No
3. Main store listing:
   - App name, short description, full description → copy from `listing.md`
   - Icon → `play-icon-512.png`
   - Feature graphic → `feature-graphic.png`
   - Phone screenshots → `screenshots/01-inbox.png`,
     `screenshots/02-message-ai.png`, `screenshots/03-compose-ai.png`
     (need at least 2, max 8)
   - Application type: App. Category: Productivity. Tags: Email, Productivity, AI.
4. Production (or Internal testing) → Create new release
   - Upload `android/app-release-bundle.aab`
   - Release name: `1.0.0`
   - What's new → copy from `listing.md`
   - Save → Review → Start rollout to Production (or Internal)

## Heads-up about the Gmail scope

If the production listing claims Gmail support, Play + Google API Trust &
Safety will hold the release for a **CASA Tier-2 security assessment**:

- Privacy policy must declare the use of `mail.google.com` (✓ already does).
- Demo video walking through how the user grants the scope and what data
  flows where (~3 minutes; need to record before submitting).
- Independent CASA security review (~$400 third-party assessor, ~3 weeks).

This only blocks **Production** distribution. **Internal testing** with up
to 100 testers is exempt and goes live within minutes of upload.

## Pre-flight checklist

Before clicking "Start rollout":

- [ ] `https://beacon-dun-one.vercel.app/privacy` returns 200
- [ ] `https://beacon-dun-one.vercel.app/.well-known/assetlinks.json` returns
      200 with the correct SHA-256 fingerprint
- [ ] AAB version code is greater than any prior published version
- [ ] All required screens filled in App content
- [ ] At least 2 phone screenshots uploaded
- [ ] At least one APK / AAB uploaded (required for the listing to publish)
