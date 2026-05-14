import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db/client";
import { forEachAccount, providerForAccount } from "@/lib/providers";
import { prioritizeBatch } from "@/lib/ai/prioritize";
import type { MailEnvelope } from "@/lib/providers/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Query = z.object({
  account: z.string().optional(),
  folder: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  prioritize: z.coerce.boolean().optional(),
});

export async function GET(req: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const params = Query.safeParse(Object.fromEntries(url.searchParams));
  if (!params.success) {
    return NextResponse.json({ error: params.error.flatten() }, { status: 400 });
  }
  const { account, folder, limit, prioritize } = params.data;

  type Row = MailEnvelope & {
    accountId: string;
    accountName: string;
    accountColor: string | null;
    priority?: "high" | "medium" | "low";
    priorityReason?: string;
  };

  let envelopes: Row[] = [];

  if (account) {
    const row = await db.query.mailAccounts.findFirst({
      where: and(
        eq(schema.mailAccounts.id, account),
        eq(schema.mailAccounts.userId, session.user.id),
      ),
    });
    if (!row) return NextResponse.json({ error: "account not found" }, { status: 404 });
    const provider = await providerForAccount(row.id);
    try {
      const list = await provider.listMessages({ folder, limit });
      envelopes = list.map((e) => ({
        ...e,
        accountId: row.id,
        accountName: row.displayName,
        accountColor: row.color,
      }));
    } finally {
      await provider.close();
    }
  } else {
    const fanOut = await forEachAccount(session.user.id, async (provider, acct) => {
      const list = await provider.listMessages({ folder, limit });
      return list.map((e) => ({
        ...e,
        accountId: acct.id,
        accountName: acct.displayName,
        accountColor: acct.color,
      }));
    });
    envelopes = fanOut
      .flatMap((r) => (r.result instanceof Error ? [] : (r.result as Row[])))
      .sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime())
      .slice(0, limit ?? 50);
  }

  if (prioritize && envelopes.length > 0) {
    const byAcct = new Map<string, Row[]>();
    for (const e of envelopes) {
      const arr = byAcct.get(e.accountId) ?? [];
      arr.push(e);
      byAcct.set(e.accountId, arr);
    }
    await Promise.all(
      [...byAcct.entries()].map(async ([accountId, arr]) => {
        const acct = await db.query.mailAccounts.findFirst({
          where: eq(schema.mailAccounts.id, accountId),
        });
        if (!acct) return;
        const results = await prioritizeBatch(arr, acct.emailAddress);
        const map = new Map(results.map((r) => [r.id, r] as const));
        for (const e of arr) {
          const r = map.get(e.id);
          if (r) {
            e.priority = r.priority;
            e.priorityReason = r.reason;
          }
        }
      }),
    );
  }

  return NextResponse.json({ messages: envelopes });
}
