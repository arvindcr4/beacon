import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";

const SCOPES = [
  "openid",
  "email",
  "profile",
  "https://mail.google.com/",
];

export async function GET(req: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "GOOGLE_CLIENT_ID not configured" },
      { status: 500 },
    );
  }

  const baseUrl = process.env.NEXTAUTH_URL ?? new URL(req.url).origin;
  const redirectUri = `${baseUrl}/api/oauth/google/callback`;
  const state = randomBytes(16).toString("hex");

  const cookieStore = await cookies();
  cookieStore.set("beacon_oauth_state", state, {
    httpOnly: true,
    secure: baseUrl.startsWith("https"),
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPES.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);

  return NextResponse.redirect(url.toString());
}
