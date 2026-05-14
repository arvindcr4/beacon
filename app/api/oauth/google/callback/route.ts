import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db/client";
import { encryptJSON } from "@/lib/crypto/vault";

export const runtime = "nodejs";

export async function GET(req: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get("beacon_oauth_state")?.value;

  if (!code) return NextResponse.json({ error: "missing code" }, { status: 400 });
  if (!state || state !== expectedState) {
    return NextResponse.json({ error: "state mismatch" }, { status: 400 });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: "Google OAuth not configured" }, { status: 500 });
  }

  const baseUrl = process.env.NEXTAUTH_URL ?? url.origin;
  const redirectUri = `${baseUrl}/api/oauth/google/callback`;

  const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenResp.ok) {
    const text = await tokenResp.text();
    return NextResponse.json({ error: "token exchange failed", detail: text }, { status: 502 });
  }
  const tokens = (await tokenResp.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope?: string;
  };

  const profileResp = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { authorization: `Bearer ${tokens.access_token}` },
  });
  const profile = (await profileResp.json()) as { email: string; name?: string };

  await db.insert(schema.mailAccounts).values({
    userId: session.user.id,
    kind: "gmail",
    displayName: profile.name ?? profile.email,
    emailAddress: profile.email,
    credentials: encryptJSON({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? "",
      expiresAt: Date.now() + tokens.expires_in * 1000,
      scope: tokens.scope,
    }),
  });

  cookieStore.delete("beacon_oauth_state");
  return NextResponse.redirect(`${baseUrl}/settings?added=gmail`);
}
