import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db/client";
import { SettingsPanel } from "@/components/settings-panel";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const accounts = await db.query.mailAccounts.findMany({
    where: eq(schema.mailAccounts.userId, session.user.id),
  });
  return (
    <SettingsPanel
      user={{ email: session.user.email }}
      accounts={accounts.map((a) => ({
        id: a.id,
        kind: a.kind,
        displayName: a.displayName,
        emailAddress: a.emailAddress,
        color: a.color,
      }))}
    />
  );
}
