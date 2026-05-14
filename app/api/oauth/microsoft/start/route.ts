import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";

const SCOPES = [
  "openid",
  "email",
  "profile",
  "offline_access",
  "Mail.ReadWrite",
  "Mail.Send",
  "User.Read",
];

export async function GET(req: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const tenant = process.env.MICROSOFT_TENANT_ID || "common";
  if (!clientId) {
    return NextResponse.json(
      { error: "MICROSOFT_CLIENT_ID not configured" },
      { status: 500 },
    );
  }

  const baseUrl = process.env.NEXTAUTH_URL ?? new URL(req.url).origin;
  const redirectUri = `${baseUrl}/api/oauth/microsoft/callback`;
  const state = randomBytes(16).toString("hex");

  const cookieStore = await cookies();
  cookieStore.set("beacon_oauth_state", state, {
    httpOnly: true,
    secure: baseUrl.startsWith("https"),
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  const url = new URL(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("response_mode", "query");
  url.searchParams.set("scope", SCOPES.join(" "));
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);

  return NextResponse.redirect(url.toString());
}
