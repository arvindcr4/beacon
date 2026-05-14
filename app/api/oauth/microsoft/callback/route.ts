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

  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const tenant = process.env.MICROSOFT_TENANT_ID || "common";
  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: "Microsoft OAuth not configured" }, { status: 500 });
  }

  const baseUrl = process.env.NEXTAUTH_URL ?? url.origin;
  const redirectUri = `${baseUrl}/api/oauth/microsoft/callback`;

  const tokenResp = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
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
    refresh_token: string;
    expires_in: number;
    scope: string;
  };

  const profileResp = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { authorization: `Bearer ${tokens.access_token}` },
  });
  const profile = (await profileResp.json()) as {
    mail?: string;
    userPrincipalName?: string;
    displayName?: string;
  };
  const emailAddress = profile.mail ?? profile.userPrincipalName ?? "unknown@outlook.com";

  await db.insert(schema.mailAccounts).values({
    userId: session.user.id,
    kind: "o365",
    displayName: profile.displayName ?? emailAddress,
    emailAddress,
    credentials: encryptJSON({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Date.now() + tokens.expires_in * 1000,
      scope: tokens.scope,
    }),
  });

  cookieStore.delete("beacon_oauth_state");
  return NextResponse.redirect(`${baseUrl}/settings?added=o365`);
}
