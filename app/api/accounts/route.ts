import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db/client";
import { encryptJSON } from "@/lib/crypto/vault";
import { IMAP_PRESETS, type ImapPreset } from "@/lib/providers";
import type { ImapCredentials } from "@/lib/providers/types";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const rows = await db.query.mailAccounts.findMany({
    where: eq(schema.mailAccounts.userId, session.user.id),
  });

  return NextResponse.json({
    accounts: rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      displayName: r.displayName,
      emailAddress: r.emailAddress,
      color: r.color,
      lastSyncedAt: r.lastSyncedAt,
    })),
  });
}

const ImapBody = z.object({
  kind: z.literal("imap"),
  displayName: z.string().min(1),
  emailAddress: z.string().email(),
  preset: z.enum(["yahoo", "aol", "icloud", "fastmail", "custom"]),
  password: z.string().min(1),
  username: z.string().optional(),
  host: z.string().optional(),
  port: z.number().optional(),
  secure: z.boolean().optional(),
  smtpHost: z.string().optional(),
  smtpPort: z.number().optional(),
  smtpSecure: z.boolean().optional(),
  color: z.string().optional(),
});

export async function POST(req: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const json = await req.json();
  const parsed = ImapBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const body = parsed.data;
  const username = body.username ?? body.emailAddress;

  const preset = body.preset === "custom" ? null : IMAP_PRESETS[body.preset as ImapPreset];
  const credentials: ImapCredentials = {
    host: preset?.host ?? body.host ?? "",
    port: preset?.port ?? body.port ?? 993,
    secure: preset?.secure ?? body.secure ?? true,
    username,
    password: body.password,
    smtpHost: preset?.smtpHost ?? body.smtpHost ?? "",
    smtpPort: preset?.smtpPort ?? body.smtpPort ?? 465,
    smtpSecure: preset?.smtpSecure ?? body.smtpSecure ?? true,
  };

  if (!credentials.host || !credentials.smtpHost) {
    return NextResponse.json(
      { error: "Custom IMAP requires host and smtpHost" },
      { status: 400 },
    );
  }

  const [inserted] = await db
    .insert(schema.mailAccounts)
    .values({
      userId: session.user.id,
      kind: "imap",
      displayName: body.displayName,
      emailAddress: body.emailAddress,
      credentials: encryptJSON(credentials),
      color: body.color ?? null,
    })
    .returning();

  return NextResponse.json({ account: { id: inserted!.id } }, { status: 201 });
}
