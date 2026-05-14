import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db/client";
import { providerForAccount } from "@/lib/providers";
import { summarizeMailMessage } from "@/lib/ai/summarize";

export const runtime = "nodejs";

const Body = z.object({
  accountId: z.string(),
  messageId: z.string(),
  folder: z.string().optional(),
});

export async function POST(req: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { accountId, messageId, folder } = parsed.data;

  const row = await db.query.mailAccounts.findFirst({
    where: and(
      eq(schema.mailAccounts.id, accountId),
      eq(schema.mailAccounts.userId, session.user.id),
    ),
  });
  if (!row) return NextResponse.json({ error: "account not found" }, { status: 404 });

  const provider = await providerForAccount(accountId);
  try {
    const message = await provider.getMessage(messageId, folder);
    const summary = await summarizeMailMessage(message);
    return NextResponse.json({ summary });
  } finally {
    await provider.close();
  }
}
