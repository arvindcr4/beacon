"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send, Sparkles } from "lucide-react";
import { Button } from "./ui/button";
import { Input, Label, Textarea } from "./ui/input";

type Account = { id: string; emailAddress: string; displayName: string };

export function ComposeForm({ accounts }: { accounts: Account[] }) {
  const router = useRouter();
  const [fromId, setFromId] = useState(accounts[0]?.id ?? "");
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [intent, setIntent] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    if (!intent.trim() || !subject.trim()) {
      setError("Subject and intent are needed to draft from scratch.");
      return;
    }
    setError(null);
    setBusy(true);
    setBody("");
    try {
      // For a fresh compose we just call summarize with a tiny synthetic message,
      // routing through the draft endpoint would require an existing messageId.
      // Instead, hit the draft endpoint with a stub messageId not supported —
      // simpler: use a small fetch to /api/ai/draft would need a real msg.
      // For new compose we POST a /api/ai/compose-style helper:
      const resp = await fetch("/api/ai/compose-draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subject, intent, to }),
      });
      if (!resp.ok) {
        setError("Couldn't draft this one.");
        return;
      }
      const reader = resp.body!.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        setBody(buf);
      }
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    if (!fromId || !to.trim() || !subject.trim()) {
      setError("From, To, and Subject are required.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const recipients = to
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((address) => ({ address }));
      const resp = await fetch(`/api/send/${fromId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ to: recipients, subject, text: body }),
      });
      if (!resp.ok) {
        setError("Send failed. Check the recipients and try again.");
        return;
      }
      router.push("/inbox");
    } finally {
      setBusy(false);
    }
  }

  if (accounts.length === 0) {
    return (
      <div className="px-4 py-10 text-center text-sm text-[var(--color-fg-muted)]">
        Connect a mailbox first.{" "}
        <a href="/settings" className="text-[var(--color-accent)] hover:underline">
          Add account
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 px-4 py-4">
      <h1 className="text-lg font-semibold">New message</h1>

      <div className="flex flex-col gap-1">
        <Label htmlFor="from">From</Label>
        <select
          id="from"
          value={fromId}
          onChange={(e) => setFromId(e.target.value)}
          className="h-10 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm"
        >
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.displayName} ({a.emailAddress})
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="to">To</Label>
        <Input
          id="to"
          type="email"
          placeholder="someone@example.com, another@example.com"
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="subject">Subject</Label>
        <Input
          id="subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-2">
        <div className="flex items-center gap-2 text-xs text-[var(--color-fg-muted)]">
          <Sparkles className="h-3.5 w-3.5 text-[var(--color-accent)]" />
          Tell Beacon what to say (optional):
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="e.g. politely decline, ask for the slides"
            value={intent}
            onChange={(e) => setIntent(e.target.value)}
          />
          <Button type="button" variant="secondary" onClick={generate} disabled={busy}>
            Draft
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="body">Message</Label>
        <Textarea
          id="body"
          rows={12}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </div>

      {error && <div className="text-sm text-[var(--color-danger)]">{error}</div>}

      <div className="flex justify-end gap-2">
        <Button onClick={send} disabled={busy}>
          <Send className="h-4 w-4" />
          Send
        </Button>
      </div>
    </div>
  );
}
