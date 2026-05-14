import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db/client";
import { ComposeForm } from "@/components/compose-form";

export const dynamic = "force-dynamic";

export default async function ComposePage() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const accounts = await db.query.mailAccounts.findMany({
    where: eq(schema.mailAccounts.userId, session.user.id),
  });
  return (
    <ComposeForm
      accounts={accounts.map((a) => ({
        id: a.id,
        emailAddress: a.emailAddress,
        displayName: a.displayName,
      }))}
    />
  );
}
