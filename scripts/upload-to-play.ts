#!/usr/bin/env tsx
/**
 * Upload the Beacon AAB to a Google Play Console track.
 *
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json \
 *   pnpm tsx scripts/upload-to-play.ts \
 *     --aab android/app-release-bundle.aab \
 *     --track internal \
 *     --release-name "1.0.0" \
 *     --release-notes "First release of Beacon."
 *
 * Service-account JSON must belong to a Google Cloud project that has the
 * Google Play Android Developer API enabled, and the account must be invited
 * into Play Console (Users → Invite new user → grant 'Release manager' or
 * 'Admin' for the Beacon app).
 *
 * Flags:
 *   --aab           Path to the AAB to upload (default: android/app-release-bundle.aab)
 *   --package       Application id (default: app.vercel.beacon_dun_one.twa)
 *   --track         internal | alpha | beta | production (default: internal)
 *   --release-name  Display name for this release (default: AAB versionName)
 *   --release-notes UTF-8 string, max 500 chars (default: changelog from listing)
 *   --status        completed | inProgress | halted | draft (default: completed)
 *
 * Exits non-zero on any API error so this is safe in CI.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, basename } from "node:path";
import { google } from "googleapis";
import type { androidpublisher_v3 } from "googleapis";

interface Args {
  aab: string;
  package: string;
  track: "internal" | "alpha" | "beta" | "production";
  releaseName?: string;
  releaseNotes: string;
  status: "completed" | "inProgress" | "halted" | "draft";
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const get = (name: string, fallback?: string): string | undefined => {
    const i = argv.indexOf(`--${name}`);
    if (i < 0 || i === argv.length - 1) return fallback;
    return argv[i + 1];
  };
  const aab = resolve(get("aab", "android/app-release-bundle.aab")!);
  if (!existsSync(aab)) {
    throw new Error(`AAB not found at ${aab}`);
  }
  const track = (get("track", "internal") ?? "internal") as Args["track"];
  if (!["internal", "alpha", "beta", "production"].includes(track)) {
    throw new Error(`--track must be one of internal|alpha|beta|production`);
  }
  const status = (get("status", "completed") ?? "completed") as Args["status"];
  return {
    aab,
    package: get("package", "app.vercel.beacon_dun_one.twa")!,
    track,
    releaseName: get("release-name"),
    releaseNotes:
      get("release-notes") ??
      "First release of Beacon — universal AI-first email client.",
    status,
  };
}

async function main(): Promise<void> {
  const args = parseArgs();
  console.log(`▸ Uploading ${basename(args.aab)} → ${args.package} / ${args.track}`);

  // The googleapis SDK resolves credentials from GOOGLE_APPLICATION_CREDENTIALS
  // automatically. We just need to scope it to androidpublisher.
  const auth = new google.auth.GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/androidpublisher"],
  });
  const client = google.androidpublisher({ version: "v3", auth });

  // 1. Open an edit.
  const editRes = await client.edits.insert({ packageName: args.package });
  const editId = editRes.data.id!;
  console.log(`  ✓ opened edit ${editId}`);

  try {
    // 2. Upload the AAB.
    const upload = await client.edits.bundles.upload({
      packageName: args.package,
      editId,
      media: {
        mimeType: "application/octet-stream",
        body: readFileSync(args.aab),
      },
    });
    const versionCode = upload.data.versionCode!;
    console.log(`  ✓ uploaded versionCode=${versionCode}, sha1=${upload.data.sha1}`);

    // 3. Assign the new versionCode to the requested track.
    const release: androidpublisher_v3.Schema$TrackRelease = {
      name: args.releaseName ?? `v${versionCode}`,
      versionCodes: [String(versionCode)],
      status: args.status,
      releaseNotes: [
        {
          language: "en-US",
          text: args.releaseNotes,
        },
      ],
    };
    await client.edits.tracks.update({
      packageName: args.package,
      editId,
      track: args.track,
      requestBody: {
        track: args.track,
        releases: [release],
      },
    });
    console.log(`  ✓ assigned to track="${args.track}" status="${args.status}"`);

    // 4. Commit the edit.
    await client.edits.commit({ packageName: args.package, editId });
    console.log(`  ✓ committed edit`);

    console.log(`\n✅ Beacon ${args.releaseName ?? `v${versionCode}`} live on ${args.track}.`);
    console.log(
      `   Inspect: https://play.google.com/console/u/0/developers/-/app/4974094300094180/tracks/${args.track}`,
    );
  } catch (err) {
    console.error(`\n✗ Upload failed:`, err instanceof Error ? err.message : err);
    // Abandon the edit so the next run starts clean.
    try {
      await client.edits.delete({ packageName: args.package, editId });
      console.error(`  (abandoned edit ${editId})`);
    } catch {
      /* best-effort */
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
