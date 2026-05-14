import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db/client";
import { providerForAccount } from "@/lib/providers";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ accountId: string; id: string }> },
): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { accountId, id } = await params;
  const url = new URL(req.url);
  const folder = url.searchParams.get("folder") ?? undefined;

  const row = await db.query.mailAccounts.findFirst({
    where: and(
      eq(schema.mailAccounts.id, accountId),
      eq(schema.mailAccounts.userId, session.user.id),
    ),
  });
  if (!row) return NextResponse.json({ error: "account not found" }, { status: 404 });

  const provider = await providerForAccount(accountId);
  try {
    const message = await provider.getMessage(id, folder);
    return NextResponse.json({ message });
  } finally {
    await provider.close();
  }
}
