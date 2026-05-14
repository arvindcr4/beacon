import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AddAccountForm } from "@/components/add-account-form";

export default async function AddAccountPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-6">
      <header className="flex flex-col gap-1">
        <Link href="/settings" className="text-xs text-[var(--color-fg-muted)]">
          ← Settings
        </Link>
        <h1 className="text-xl font-semibold">Connect a mailbox</h1>
        <p className="text-sm text-[var(--color-fg-muted)]">
          Beacon stores credentials encrypted server-side with AES-256-GCM. They never reach the
          browser after this page.
        </p>
      </header>
      <AddAccountForm />
    </div>
  );
}