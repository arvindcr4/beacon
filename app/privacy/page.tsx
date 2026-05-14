import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Beacon handles your data: encrypted credential vault, no analytics, no third-party tracking.",
};

const UPDATED = "May 14, 2026";

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10 text-[var(--color-fg)]">
      <h1 className="mb-2 text-3xl font-bold">Privacy Policy</h1>
      <p className="mb-8 text-sm text-[var(--color-fg-muted)]">Last updated: {UPDATED}</p>

      <section className="space-y-4 text-base leading-relaxed">
        <p>
          Beacon is an AI-first universal email client. This document describes
          exactly what data we collect, what we do with it, and what we
          don&apos;t do with it. It applies to <strong>beacon-dun-one.vercel.app</strong>{" "}
          and to the official Beacon Android app
          (<code>app.vercel.beacon_dun_one.twa</code>).
        </p>

        <h2 className="mt-8 text-xl font-semibold">1. Data we store about you</h2>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <strong>Your Beacon identity:</strong> the email address you use to
            sign in, plus a randomly-generated user id.
          </li>
          <li>
            <strong>Connected mailbox credentials</strong> (Gmail OAuth refresh
            tokens, Office 365 OAuth refresh tokens, IMAP server +
            username + app-password). These are encrypted with{" "}
            <strong>AES-256-GCM</strong> using a per-deployment master key
            before being written to the database. Plaintext credentials never
            leave your browser&apos;s memory after the connect step.
          </li>
          <li>
            <strong>Cached message metadata</strong> (sender, subject, snippet,
            received-at, read/flagged flags) for inbox rendering and AI
            triage. Used only to make the inbox feel fast and to compute
            priority badges.
          </li>
          <li>
            <strong>AI output cache</strong>: summaries and priority labels we
            generated for your messages, keyed by a SHA-256 hash of the message
            metadata, so we don&apos;t bill you twice for the same input.
          </li>
        </ul>

        <h2 className="mt-8 text-xl font-semibold">2. Data we never collect</h2>
        <ul className="list-disc space-y-2 pl-6">
          <li>No analytics, no Google Analytics, no Mixpanel, no Sentry.</li>
          <li>No advertising identifiers, no cross-app tracking.</li>
          <li>No third-party SDKs that phone home.</li>
          <li>
            We do not read, store, or send your email <em>contents</em> to any
            third party other than: (a) Anthropic, for the AI summary / draft /
            triage features you explicitly trigger, and (b) the email provider
            you connect (Google, Microsoft, your IMAP host), which is whose
            inbox we&apos;re fetching from in the first place.
          </li>
        </ul>

        <h2 className="mt-8 text-xl font-semibold">3. How AI features work</h2>
        <p>
          When you ask Beacon to summarize a message, draft a reply, or
          prioritize the inbox, the relevant message body (or a clamped excerpt,
          capped at 12,000 characters) is sent to{" "}
          <a
            className="text-[var(--color-accent)] underline"
            href="https://www.anthropic.com/legal/privacy"
          >
            Anthropic&apos;s API
          </a>{" "}
          (model: Claude Haiku 4.5 for triage / summary, Claude Sonnet 4.6 for
          drafts). Anthropic processes the message to generate a response, then
          returns it. Beacon caches the response in its own database keyed by a
          content hash; Anthropic&apos;s retention and training policies are
          governed by their privacy policy linked above.
        </p>
        <p>
          If you don&apos;t want this, simply don&apos;t click the AI buttons —
          the rest of Beacon (inbox, compose, reply, archive, delete, search)
          works without ever calling Anthropic.
        </p>

        <h2 className="mt-8 text-xl font-semibold">4. Google user data (Gmail)</h2>
        <p>
          Beacon&apos;s use and transfer of information received from Google APIs
          adheres to the{" "}
          <a
            className="text-[var(--color-accent)] underline"
            href="https://developers.google.com/terms/api-services-user-data-policy"
          >
            Google API Services User Data Policy
          </a>, including the Limited Use requirements:
        </p>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            We use <code>https://mail.google.com/</code> only to fetch the
            messages you see in the unified inbox and to send messages on your
            behalf when you click Send.
          </li>
          <li>
            Gmail data is never sold, never used for ads, never used to train
            ML models, and never transferred to third parties other than as
            described in §3 (Anthropic, for AI features <em>you</em> trigger).
          </li>
          <li>
            Tokens are encrypted at rest and revocable at any time from your
            Google Account → Security → Third-party apps.
          </li>
        </ul>

        <h2 className="mt-8 text-xl font-semibold">5. Microsoft (Office 365 / Outlook)</h2>
        <p>
          Same posture as §4: Beacon uses{" "}
          <code>Mail.ReadWrite + Mail.Send</code> only for fetching + sending,
          stores refresh tokens encrypted, and never resells or trains on your
          mail contents.
        </p>

        <h2 className="mt-8 text-xl font-semibold">6. Your controls</h2>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <strong>Disconnect a mailbox:</strong> Settings → Mailboxes → trash
            icon. Beacon deletes the encrypted credential row immediately.
          </li>
          <li>
            <strong>Delete your Beacon account entirely:</strong> email{" "}
            <a className="text-[var(--color-accent)] underline" href="mailto:arvindcr4@gmail.com">
              arvindcr4@gmail.com
            </a>{" "}
            with the subject &quot;Delete my Beacon data&quot; from the address
            you signed up with. We respond within 30 days.
          </li>
          <li>
            <strong>Revoke OAuth grants:</strong> Google
            (myaccount.google.com/permissions), Microsoft
            (account.live.com/consent/Manage).
          </li>
        </ul>

        <h2 className="mt-8 text-xl font-semibold">7. Security</h2>
        <p>
          All credentials at rest are encrypted with AES-256-GCM. Authenticated
          encryption ensures tampering is detected. All transport is HTTPS /
          TLS 1.3. The application is served from Vercel&apos;s edge with the
          standard security headers (CSP, X-Frame-Options: DENY,
          Referrer-Policy: strict-origin-when-cross-origin).
        </p>

        <h2 className="mt-8 text-xl font-semibold">8. Children</h2>
        <p>Beacon is not directed to children under 13.</p>

        <h2 className="mt-8 text-xl font-semibold">9. Changes</h2>
        <p>
          We&apos;ll update the &quot;Last updated&quot; date at the top of this
          page when this policy materially changes.
        </p>

        <h2 className="mt-8 text-xl font-semibold">10. Contact</h2>
        <p>
          Questions? Email{" "}
          <a className="text-[var(--color-accent)] underline" href="mailto:arvindcr4@gmail.com">
            arvindcr4@gmail.com
          </a>
          .
        </p>
      </section>
    </main>
  );
}