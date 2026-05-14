"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { Input, Label } from "./ui/input";

type Kind = "gmail" | "o365" | "imap";
type Preset = "yahoo" | "aol" | "icloud" | "fastmail" | "custom";

export function AddAccountForm() {
  const router = useRouter();
  const [kind, setKind] = useState<Kind>("gmail");
  const [preset, setPreset] = useState<Preset>("yahoo");
  const [displayName, setDisplayName] = useState("");
  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [host, setHost] = useState("");
  const [smtpHost, setSmtpHost] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitImap(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const resp = await fetch("/api/accounts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "imap",
          displayName: displayName || emailAddress,
          emailAddress,
          preset,
          password,
          host: preset === "custom" ? host : undefined,
          smtpHost: preset === "custom" ? smtpHost : undefined,
        }),
      });
      if (!resp.ok) {
        const data = (await resp.json().catch(() => ({}))) as { error?: unknown };
        setError(
          typeof data.error === "string" ? data.error : "Couldn't add this account.",
        );
        return;
      }
      router.push("/inbox");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-1">
        {(["gmail", "o365", "imap"] as Kind[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={`rounded px-3 py-2 text-sm font-medium ${
              kind === k
                ? "bg-[var(--color-accent)] text-[var(--color-accent-fg)]"
                : "text-[var(--color-fg-muted)]"
            }`}
          >
            {k === "gmail" ? "Gmail" : k === "o365" ? "Office 365" : "IMAP"}
          </button>
        ))}
      </div>

      {kind === "gmail" && (
        <div className="flex flex-col gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <p className="text-sm">
            Sign in with Google to grant Beacon read/send access on your Gmail account.
            Beacon stores your refresh token encrypted server-side.
          </p>
          <Button asChild>
            <a href="/api/oauth/google/start">Continue with Google</a>
          </Button>
        </div>
      )}

      {kind === "o365" && (
        <div className="flex flex-col gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <p className="text-sm">
            Sign in with Microsoft to grant Beacon mailbox access (Mail.ReadWrite + Mail.Send).
            Works for Outlook.com, Microsoft 365 work/school accounts.
          </p>
          <Button asChild>
            <a href="/api/oauth/microsoft/start">Continue with Microsoft</a>
          </Button>
        </div>
      )}

      {kind === "imap" && (
        <form
          onSubmit={submitImap}
          className="flex flex-col gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
        >
          <div className="flex flex-col gap-1">
            <Label htmlFor="preset">Provider</Label>
            <select
              id="preset"
              value={preset}
              onChange={(e) => setPreset(e.target.value as Preset)}
              className="h-10 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 text-sm"
            >
              <option value="yahoo">Yahoo</option>
              <option value="aol">AOL</option>
              <option value="icloud">iCloud</option>
              <option value="fastmail">Fastmail</option>
              <option value="custom">Custom IMAP</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={emailAddress}
              onChange={(e) => setEmailAddress(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="displayName">Display name (optional)</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Yahoo personal"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="password">App password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="off"
            />
            <p className="text-xs text-[var(--color-fg-muted)]">
              Yahoo/AOL/iCloud require an <strong>app password</strong>, not your login password.
            </p>
          </div>
          {preset === "custom" && (
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <Label htmlFor="host">IMAP host</Label>
                <Input
                  id="host"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  placeholder="imap.example.com"
                  required
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="smtpHost">SMTP host</Label>
                <Input
                  id="smtpHost"
                  value={smtpHost}
                  onChange={(e) => setSmtpHost(e.target.value)}
                  placeholder="smtp.example.com"
                  required
                />
              </div>
            </div>
          )}
          {error && <div className="text-sm text-[var(--color-danger)]">{error}</div>}
          <Button type="submit" disabled={busy}>
            {busy ? "Connecting…" : "Connect mailbox"}
          </Button>
        </form>
      )}
    </div>
  );
}
