"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, Plus, Trash2, LogOut } from "lucide-react";
import { Button } from "./ui/button";
import { AccountChip } from "./account-chip";

type Account = {
  id: string;
  kind: "imap" | "gmail" | "o365";
  displayName: string;
  emailAddress: string;
  color: string | null;
};

const KIND_LABEL: Record<Account["kind"], string> = {
  imap: "IMAP",
  gmail: "Gmail",
  o365: "Office 365",
};

export function SettingsPanel({ accounts, user }: { accounts: Account[]; user: { email?: string | null } }) {
  const router = useRouter();

  async function remove(id: string) {
    if (!confirm("Disconnect this mailbox? Beacon will forget its credentials.")) return;
    const resp = await fetch(`/api/accounts/${id}`, { method: "DELETE" });
    if (resp.ok) router.refresh();
  }

  return (
    <div className="flex flex-col gap-6 px-4 py-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold">Settings</h1>
        <p className="text-sm text-[var(--color-fg-muted)]">
          Signed in as <strong>{user.email}</strong>
        </p>
      </header>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-fg-muted)]">
            Mailboxes
          </h2>
          <Button asChild size="sm" variant="secondary">
            <Link href="/add-account">
              <Plus className="h-4 w-4" />
              Add
            </Link>
          </Button>
        </div>
        <ul className="flex flex-col divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
          {accounts.map((a) => (
            <li key={a.id} className="flex items-center gap-3 p-3">
              <AccountChip name={a.displayName} color={a.color} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{a.displayName}</div>
                <div className="truncate text-xs text-[var(--color-fg-muted)]">
                  {a.emailAddress} · {KIND_LABEL[a.kind]}
                </div>
              </div>
              <button
                onClick={() => remove(a.id)}
                className="rounded-md p-2 text-[var(--color-fg-muted)] hover:text-[var(--color-danger)]"
                aria-label="Disconnect"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
          {accounts.length === 0 && (
            <li className="flex flex-col items-center gap-2 px-3 py-8 text-center">
              <Mail className="h-6 w-6 text-[var(--color-fg-muted)]" />
              <p className="text-sm text-[var(--color-fg-muted)]">
                No mailboxes connected yet.
              </p>
              <Button asChild size="sm">
                <Link href="/add-account">Connect your first mailbox</Link>
              </Button>
            </li>
          )}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-[var(--color-fg-muted)]">
          Account
        </h2>
        <form action="/api/auth/signout" method="post">
          <Button type="submit" variant="outline" size="sm">
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </form>
      </section>
    </div>
  );
}
