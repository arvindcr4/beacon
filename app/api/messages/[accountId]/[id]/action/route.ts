import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db/client";
import { providerForAccount } from "@/lib/providers";

export const runtime = "nodejs";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("archive"), folder: z.string().optional() }),
  z.object({ action: z.literal("trash"), folder: z.string().optional() }),
  z.object({ action: z.literal("markRead"), read: z.boolean(), folder: z.string().optional() }),
  z.object({ action: z.literal("flag"), flagged: z.boolean(), folder: z.string().optional() }),
  z.object({ action: z.literal("addLabel"), label: z.string(), folder: z.string().optional() }),
  z.object({ action: z.literal("removeLabel"), label: z.string(), folder: z.string().optional() }),
]);

export async function POST(
  req: Request,
  { params }: { params: Promise<{ accountId: string; id: string }> },
): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { accountId, id } = await params;

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const row = await db.query.mailAccounts.findFirst({
    where: and(
      eq(schema.mailAccounts.id, accountId),
      eq(schema.mailAccounts.userId, session.user.id),
    ),
  });
  if (!row) return NextResponse.json({ error: "account not found" }, { status: 404 });

  const provider = await providerForAccount(accountId);
  try {
    const body = parsed.data;
    switch (body.action) {
      case "archive":
        await provider.archive(id, body.folder);
        break;
      case "trash":
        await provider.trash(id, body.folder);
        break;
      case "markRead":
        await provider.markRead(id, body.read, body.folder);
        break;
      case "flag":
        await provider.flag(id, body.flagged, body.folder);
        break;
      case "addLabel":
        await provider.addLabel(id, body.label, body.folder);
        break;
      case "removeLabel":
        await provider.removeLabel(id, body.label, body.folder);
        break;
    }
    return NextResponse.json({ ok: true });
  } finally {
    await provider.close();
  }
}
