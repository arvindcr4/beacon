import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { forEachAccount } from "@/lib/providers";
import { InboxList } from "@/components/inbox-list";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const fanOut = await forEachAccount(session.user.id, async (provider, acct) => {
    const list = await provider.listMessages({ limit: 30 });
    return list.map((e) => ({
      ...e,
      receivedAt: e.receivedAt.toISOString(),
      accountId: acct.id,
      accountName: acct.displayName,
      accountColor: acct.color,
    }));
  });

  const messages = fanOut
    .flatMap((r) => (r.result instanceof Error ? [] : r.result))
    .sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime())
    .slice(0, 50);

  // Touch headers() so Next.js treats this as fully dynamic.
  await headers();

  return <InboxList initialMessages={messages} />;
}
