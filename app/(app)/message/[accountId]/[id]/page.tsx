import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db/client";
import { providerForAccount } from "@/lib/providers";
import { MessageView } from "@/components/message-view";

export const dynamic = "force-dynamic";

export default async function MessagePage({
  params,
  searchParams,
}: {
  params: Promise<{ accountId: string; id: string }>;
  searchParams: Promise<{ folder?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const { accountId, id } = await params;
  const { folder } = await searchParams;

  const account = await db.query.mailAccounts.findFirst({
    where: and(
      eq(schema.mailAccounts.id, accountId),
      eq(schema.mailAccounts.userId, session.user.id),
    ),
  });
  if (!account) notFound();

  const provider = await providerForAccount(accountId);
  try {
    const msg = await provider.getMessage(id, folder);
    return (
      <MessageView
        accountId={accountId}
        accountName={account.displayName}
        accountColor={account.color}
        message={{
          id: msg.id,
          folder: msg.folder,
          from: msg.from,
          to: msg.to,
          subject: msg.subject,
          receivedAt: msg.receivedAt.toISOString(),
          textBody: msg.textBody,
          htmlBody: msg.htmlBody,
          headers: msg.headers,
          isFlagged: msg.isFlagged,
        }}
      />
    );
  } finally {
    await provider.close();
  }
}
