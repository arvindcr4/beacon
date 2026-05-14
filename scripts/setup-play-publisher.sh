#!/usr/bin/env bash
# Beacon — Play Console publisher bootstrap.
#
# Prereqs:
#   • You've paid the $25 Play Console developer fee with this Google account.
#   • You've run `gcloud auth login` (or are about to be prompted).
#
# What this script does, end-to-end:
#   1. Creates a Google Cloud project named beacon-play-publisher-<ts>.
#   2. Links a billing account (if one is available; otherwise it stays in
#      the Always-Free tier — Play API calls don't require billing).
#   3. Enables the Google Play Android Developer API.
#   4. Creates a service account: beacon-publisher@<project>.iam.gserviceaccount.com.
#   5. Generates a JSON key for that service account at ~/secrets/beacon-play.json.
#   6. Prints the next manual steps for Play Console (3 clicks).
#
# Idempotent: re-running won't fail if the project / SA already exists.

set -euo pipefail

PROJECT_NAME="beacon-play-publisher"
SA_NAME="beacon-publisher"
KEY_OUT="$HOME/secrets/beacon-play.json"
mkdir -p "$(dirname "$KEY_OUT")"

# 1. Ensure gcloud is authenticated.
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q '@'; then
  echo "✗ gcloud is not authenticated. Run:"
  echo "    gcloud auth login"
  exit 1
fi
ACTIVE_ACCT=$(gcloud auth list --filter=status:ACTIVE --format="value(account)" | head -1)
echo "▸ gcloud authenticated as $ACTIVE_ACCT"

# 2. Pick (or create) the project.
PROJECT_ID=$(gcloud projects list --filter="name:$PROJECT_NAME" --format="value(projectId)" | head -1 || true)
if [ -z "$PROJECT_ID" ]; then
  # Project IDs must be 6-30 chars, lowercase, can't start with a digit.
  PROJECT_ID="${PROJECT_NAME}-$(date +%s | tail -c 7)"
  echo "▸ creating GCP project $PROJECT_ID"
  gcloud projects create "$PROJECT_ID" --name="$PROJECT_NAME" --quiet
else
  echo "▸ reusing GCP project $PROJECT_ID"
fi
gcloud config set project "$PROJECT_ID" --quiet

# 3. Enable the Google Play Android Developer API. Idempotent.
echo "▸ enabling androidpublisher API"
gcloud services enable androidpublisher.googleapis.com --quiet

# 4. Create the service account if it doesn't exist.
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
if ! gcloud iam service-accounts describe "$SA_EMAIL" --quiet >/dev/null 2>&1; then
  echo "▸ creating service account $SA_EMAIL"
  gcloud iam service-accounts create "$SA_NAME" \
    --display-name="Beacon Play Publisher" \
    --description="Uploads AABs to Google Play Console for Beacon" \
    --quiet
else
  echo "▸ reusing service account $SA_EMAIL"
fi

# 5. Generate a new JSON key for the SA.
if [ -f "$KEY_OUT" ]; then
  BAK="$KEY_OUT.$(date +%Y%m%d-%H%M%S).bak"
  mv "$KEY_OUT" "$BAK"
  echo "▸ existing key backed up to $BAK"
fi
echo "▸ creating JSON key at $KEY_OUT"
gcloud iam service-accounts keys create "$KEY_OUT" \
  --iam-account="$SA_EMAIL" \
  --quiet
chmod 600 "$KEY_OUT"

# 6. Print next steps. Play Console linking + role grant cannot be done via
#    a Google Cloud API — it's a Play Console-only action.
cat <<EOF

✅ Google Cloud side complete.

  Project:           $PROJECT_ID
  Service account:   $SA_EMAIL
  Key file:          $KEY_OUT
  API enabled:       androidpublisher.googleapis.com

────────────────────────────────────────────────────────────
3 last manual steps (Play Console only — no API for these):
────────────────────────────────────────────────────────────

1. Open https://play.google.com/console
   Setup → API access → "Link Google Cloud project"
   Pick project: $PROJECT_ID  →  Link

2. Same page → find "$SA_EMAIL" in the service-account list
   → Grant access → check "Releases" (Release Manager)
   → Apply → Invite user

3. Create the Beacon app row:
   All apps → Create app
   - App name: Beacon — AI-First Inbox
   - Default language: English (United States)
   - App or game: App
   - Free or paid: Free
   - Tick both declaration boxes
   - Create app

When all three are done, run:

  GOOGLE_APPLICATION_CREDENTIALS=$KEY_OUT \\
    pnpm tsx scripts/upload-to-play.ts \\
      --aab android/app-release-bundle.aab \\
      --track internal \\
      --release-name "1.0.0" \\
      --release-notes "First release of Beacon."

────────────────────────────────────────────────────────────
EOF
