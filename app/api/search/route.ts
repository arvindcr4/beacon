import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { forEachAccount } from "@/lib/providers";
import type { MailEnvelope } from "@/lib/providers/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Query = z.object({
  q: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export async function GET(req: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const parsed = Query.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { q, limit } = parsed.data;

  const fanOut = await forEachAccount(session.user.id, async (provider, acct) => {
    const list = await provider.search(q, { limit });
    return list.map((e: MailEnvelope) => ({
      ...e,
      accountId: acct.id,
      accountName: acct.displayName,
      accountColor: acct.color,
    }));
  });

  const messages = fanOut
    .flatMap((r) => (r.result instanceof Error ? [] : r.result))
    .sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime())
    .slice(0, limit ?? 50);

  return NextResponse.json({ messages });
}
