import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db/client";
import { prioritizeBatch } from "@/lib/ai/prioritize";
import type { MailEnvelope } from "@/lib/providers/types";

export const runtime = "nodejs";

const Body = z.object({
  accountId: z.string(),
  envelopes: z
    .array(
      z.object({
        id: z.string(),
        from: z.object({ name: z.string().optional(), address: z.string() }),
        to: z.array(z.object({ name: z.string().optional(), address: z.string() })).default([]),
        subject: z.string(),
        snippet: z.string(),
        receivedAt: z.union([z.string(), z.number(), z.date()]),
      }),
    )
    .min(1)
    .max(100),
});

export async function POST(req: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { accountId, envelopes } = parsed.data;

  const row = await db.query.mailAccounts.findFirst({
    where: and(
      eq(schema.mailAccounts.id, accountId),
      eq(schema.mailAccounts.userId, session.user.id),
    ),
  });
  if (!row) return NextResponse.json({ error: "account not found" }, { status: 404 });

  const normalized: MailEnvelope[] = envelopes.map((e) => ({
    id: e.id,
    folder: "INBOX",
    from: e.from,
    to: e.to,
    subject: e.subject,
    snippet: e.snippet,
    receivedAt: new Date(e.receivedAt),
    isRead: false,
    isFlagged: false,
    labels: [],
    hasAttachments: false,
  }));

  const results = await prioritizeBatch(normalized, row.emailAddress);
  return NextResponse.json({ results });
}
