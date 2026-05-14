import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db/client";
import { providerForAccount } from "@/lib/providers";

export const runtime = "nodejs";

const Address = z.object({ name: z.string().optional(), address: z.string().email() });

const Body = z.object({
  to: z.array(Address).min(1),
  cc: z.array(Address).optional(),
  bcc: z.array(Address).optional(),
  subject: z.string().min(1),
  text: z.string().optional(),
  html: z.string().optional(),
  inReplyTo: z.string().optional(),
  references: z.array(z.string()).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ accountId: string }> },
): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { accountId } = await params;

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
    const sent = await provider.sendMessage(parsed.data);
    return NextResponse.json({ ok: true, ...sent });
  } finally {
    await provider.close();
  }
}
