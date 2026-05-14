"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Archive, Sparkles, Star, Trash2, Reply, Forward } from "lucide-react";
import DOMPurify from "isomorphic-dompurify";
import { Button } from "./ui/button";
import { Textarea } from "./ui/input";
import { AccountChip } from "./account-chip";
import { formatRelativeTime } from "@/lib/utils";

type MessageView = {
  id: string;
  folder: string;
  from: { name?: string; address: string };
  to: Array<{ name?: string; address: string }>;
  subject: string;
  receivedAt: string;
  textBody: string;
  htmlBody?: string;
  headers?: { messageId?: string; references?: string[] };
  isFlagged: boolean;
};

type Tone = "neutral" | "warm" | "direct" | "apologetic" | "enthusiastic";
const TONES: Tone[] = ["neutral", "warm", "direct", "apologetic", "enthusiastic"];

export function MessageView({
  message,
  accountId,
  accountName,
  accountColor,
}: {
  message: MessageView;
  accountId: string;
  accountName: string;
  accountColor: string | null;
}) {
  const router = useRouter();
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [tone, setTone] = useState<Tone>("neutral");
  const [intent, setIntent] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    setSummaryLoading(true);
    fetch("/api/ai/summarize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ accountId, messageId: message.id, folder: message.folder }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { summary?: string } | null) => setSummary(data?.summary ?? null))
      .finally(() => setSummaryLoading(false));
  }, [accountId, message.id, message.folder]);

  async function generateDraft() {
    setDrafting(true);
    setDraft("");
    const resp = await fetch("/api/ai/draft", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        accountId,
        messageId: message.id,
        folder: message.folder,
        intent: intent.trim() || undefined,
        tone,
      }),
    });
    if (!resp.body) {
      setDrafting(false);
      return;
    }
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      setDraft(buf);
    }
    setDrafting(false);
  }

  async function sendReply() {
    setSending(true);
    try {
      const subject = message.subject.startsWith("Re:")
        ? message.subject
        : `Re: ${message.subject}`;
      const refs = message.headers?.references ?? [];
      const inReplyTo = message.headers?.messageId;
      const resp = await fetch(`/api/send/${accountId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          to: [message.from],
          subject,
          text: draft,
          inReplyTo,
          references: inReplyTo ? [...refs, inReplyTo] : refs,
        }),
      });
      if (resp.ok) router.push("/inbox");
    } finally {
      setSending(false);
    }
  }

  async function doAction(action: "archive" | "trash" | "flag", flagged?: boolean) {
    const resp = await fetch(`/api/messages/${accountId}/${message.id}/action`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action,
        folder: message.folder,
        ...(action === "flag" ? { flagged: !flagged } : {}),
      }),
    });
    if (resp.ok && (action === "archive" || action === "trash")) router.push("/inbox");
  }

  const cleanHtml = message.htmlBody
    ? DOMPurify.sanitize(message.htmlBody, { USE_PROFILES: { html: true } })
    : null;

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <div className="flex items-center justify-between">
        <Button
          asChild
          variant="ghost"
          size="sm"
          aria-label="Back"
        >
          <Link href="/inbox">
            <ArrowLeft className="h-4 w-4" /> Inbox
          </Link>
        </Button>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" aria-label="Star" onClick={() => doAction("flag", message.isFlagged)}>
            <Star className={message.isFlagged ? "h-4 w-4 fill-[var(--color-accent)] text-[var(--color-accent)]" : "h-4 w-4"} />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Archive" onClick={() => doAction("archive")}>
            <Archive className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Delete" onClick={() => doAction("trash")}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <header className="flex flex-col gap-2 border-b border-[var(--color-border)] pb-3">
        <h1 className="text-xl font-semibold leading-snug">{message.subject}</h1>
        <div className="flex items-center gap-2 text-sm">
          <AccountChip name={accountName} color={accountColor} />
          <div className="flex flex-col">
            <span className="font-medium">{message.from.name ?? message.from.address}</span>
            <span className="text-xs text-[var(--color-fg-muted)]">
              {message.from.address} · {formatRelativeTime(message.receivedAt)}
            </span>
          </div>
        </div>
      </header>

      <section
        aria-label="AI summary"
        className="flex items-start gap-2 rounded-lg border border-[var(--color-accent)]/30 bg-[color-mix(in_oklab,var(--color-accent)_8%,transparent)] p-3 text-sm"
      >
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-accent)]" />
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-accent)]">
            Beacon summary
          </div>
          <div className="mt-1 text-[var(--color-fg)]">
            {summaryLoading ? "Reading the email…" : summary ?? "Summary unavailable."}
          </div>
        </div>
      </section>

      <article className="prose prose-invert max-w-none text-sm">
        {cleanHtml ? (
          <div className="rich-body" dangerouslySetInnerHTML={{ __html: cleanHtml }} />
        ) : (
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
            {message.textBody || "(no body)"}
          </pre>
        )}
      </article>

      <section className="mt-4 flex flex-col gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Reply className="h-4 w-4" />
            <span className="text-sm font-semibold">Quick reply</span>
          </div>
          <div className="flex gap-1">
            {TONES.map((t) => (
              <button
                key={t}
                onClick={() => setTone(t)}
                className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider ${
                  tone === t
                    ? "bg-[var(--color-accent)] text-[var(--color-accent-fg)]"
                    : "bg-[var(--color-surface-elevated)] text-[var(--color-fg-muted)]"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <input
          value={intent}
          onChange={(e) => setIntent(e.target.value)}
          placeholder="What should the reply say? (optional)"
          className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-1.5 text-sm placeholder:text-[var(--color-fg-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
        />
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Click ‘Draft with AI’ or type your own reply…"
          rows={6}
        />
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={generateDraft} disabled={drafting}>
            <Sparkles className="h-4 w-4" />
            {drafting ? "Drafting…" : "Draft with AI"}
          </Button>
          <Button size="sm" onClick={sendReply} disabled={!draft.trim() || sending}>
            {sending ? "Sending…" : "Send reply"}
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/compose?forward=${accountId}:${message.id}`}>
              <Forward className="h-4 w-4" />
              Forward
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
