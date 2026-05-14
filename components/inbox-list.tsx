"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { Archive, RefreshCw, Search, Sparkles, Trash2 } from "lucide-react";
import { AccountChip } from "./account-chip";
import { PriorityBadge } from "./priority-badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { cn, formatRelativeTime, truncate } from "@/lib/utils";

type EnvelopeRow = {
  id: string;
  accountId: string;
  accountName: string;
  accountColor: string | null;
  from: { name?: string; address: string };
  subject: string;
  snippet: string;
  receivedAt: string;
  isRead: boolean;
  isFlagged: boolean;
  hasAttachments: boolean;
  priority?: "high" | "medium" | "low";
  priorityReason?: string;
};

export function InboxList({ initialMessages }: { initialMessages: EnvelopeRow[] }) {
  const [messages, setMessages] = useState<EnvelopeRow[]>(initialMessages);
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  const abortRef = useRef<AbortController | null>(null);

  async function refresh(opts: { prioritize?: boolean } = {}) {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const params = new URLSearchParams();
    if (opts.prioritize) params.set("prioritize", "1");
    params.set("limit", "50");
    const resp = await fetch(`/api/messages?${params}`, { signal: ctrl.signal });
    if (!resp.ok) return;
    const data = (await resp.json()) as { messages: EnvelopeRow[] };
    setMessages(data.messages);
  }

  async function runSearch() {
    if (!query.trim()) {
      await refresh();
      return;
    }
    const resp = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    if (!resp.ok) return;
    const data = (await resp.json()) as { messages: EnvelopeRow[] };
    setMessages(data.messages);
  }

  async function quickAction(m: EnvelopeRow, action: "archive" | "trash") {
    setMessages((prev) => prev.filter((x) => x.id !== m.id));
    await fetch(`/api/messages/${m.accountId}/${m.id}/action`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    });
  }

  useEffect(() => {
    // Auto-prioritize the visible inbox on first mount, in background.
    startTransition(() => {
      void refresh({ prioritize: true });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col">
      <div className="sticky top-[64px] z-10 glass border-b border-[var(--color-border)] p-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void runSearch();
          }}
          className="flex gap-2"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-fg-muted)]" />
            <Input
              type="search"
              placeholder="Search across all accounts…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
              enterKeyHint="search"
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            aria-label="Refresh"
            onClick={() => startTransition(() => void refresh({ prioritize: true }))}
            disabled={pending}
          >
            <RefreshCw className={cn("h-4 w-4", pending && "animate-spin")} />
          </Button>
        </form>
      </div>

      <ul className="divide-y divide-[var(--color-border)]">
        {messages.map((m) => (
          <li key={`${m.accountId}:${m.id}`}>
            <MessageCard
              m={m}
              onArchive={() => void quickAction(m, "archive")}
              onTrash={() => void quickAction(m, "trash")}
            />
          </li>
        ))}
        {messages.length === 0 && (
          <li className="px-4 py-16 text-center text-sm text-[var(--color-fg-muted)]">
            Inbox is empty. Either nothing new, or no account is connected yet.
          </li>
        )}
      </ul>
    </div>
  );
}

function MessageCard({
  m,
  onArchive,
  onTrash,
}: {
  m: EnvelopeRow;
  onArchive: () => void;
  onTrash: () => void;
}) {
  const displayName = m.from.name ?? m.from.address;
  return (
    <div className="group relative">
      <Link
        href={`/message/${m.accountId}/${m.id}`}
        className={cn(
          "flex flex-col gap-1.5 px-4 py-3 transition-colors hover:bg-[var(--color-surface)]",
          !m.isRead && "bg-[color-mix(in_oklab,var(--color-surface)_60%,transparent)]",
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <AccountChip name={m.accountName} color={m.accountColor} />
            <span
              className={cn(
                "truncate text-sm",
                m.isRead ? "text-[var(--color-fg-muted)]" : "font-semibold text-[var(--color-fg)]",
              )}
            >
              {truncate(displayName, 38)}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <PriorityBadge priority={m.priority} />
            <span className="text-[11px] text-[var(--color-fg-muted)]">
              {formatRelativeTime(m.receivedAt)}
            </span>
          </div>
        </div>
        <div
          className={cn(
            "truncate text-sm",
            m.isRead ? "text-[var(--color-fg-muted)]" : "text-[var(--color-fg)]",
          )}
        >
          {m.subject}
        </div>
        <div className="truncate-2 text-xs text-[var(--color-fg-muted)]">
          {m.priorityReason ? (
            <span className="inline-flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-[var(--color-accent)]" />
              {m.priorityReason}
            </span>
          ) : (
            m.snippet
          )}
        </div>
      </Link>
      <div className="absolute right-2 top-1/2 hidden -translate-y-1/2 gap-1 group-hover:flex">
        <button
          onClick={onArchive}
          className="rounded-md bg-[var(--color-surface-elevated)] p-1.5 text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
          aria-label="Archive"
        >
          <Archive className="h-4 w-4" />
        </button>
        <button
          onClick={onTrash}
          className="rounded-md bg-[var(--color-surface-elevated)] p-1.5 text-[var(--color-fg-muted)] hover:text-[var(--color-danger)]"
          aria-label="Delete"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
