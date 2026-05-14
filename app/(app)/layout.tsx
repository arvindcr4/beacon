import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db/client";
import { BottomNav } from "@/components/bottom-nav";
import { AccountChip } from "@/components/account-chip";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const accounts = await db.query.mailAccounts.findMany({
    where: eq(schema.mailAccounts.userId, session.user.id),
  });

  return (
    <div className="flex min-h-screen flex-col">
      <header
        className="glass sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-[var(--color-border)] px-4 py-3"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}
      >
        <Link href="/inbox" className="flex items-center gap-2">
          <BeaconLogo />
          <span className="text-sm font-semibold tracking-wide">Beacon</span>
        </Link>
        <div className="flex items-center gap-1">
          {accounts.slice(0, 4).map((a) => (
            <AccountChip key={a.id} name={a.displayName} color={a.color} />
          ))}
          {accounts.length === 0 && (
            <Link
              href="/settings"
              className="text-xs text-[var(--color-accent)] hover:underline"
            >
              Add account →
            </Link>
          )}
        </div>
      </header>

      <main className="flex-1 pb-28">{children}</main>

      <BottomNav />
    </div>
  );
}

function BeaconLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5">
      <circle cx="12" cy="12" r="3.5" fill="var(--color-accent)" />
      <g fill="var(--color-accent)">
        <path d="M12 1 L14 5 L10 5 Z" opacity="0.55" />
        <path d="M23 12 L19 14 L19 10 Z" opacity="0.4" />
        <path d="M12 23 L10 19 L14 19 Z" opacity="0.55" />
        <path d="M1 12 L5 10 L5 14 Z" opacity="0.4" />
      </g>
    </svg>
  );
}
