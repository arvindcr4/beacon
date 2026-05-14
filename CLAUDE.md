# Beacon — CLAUDE.md

Operating manual for Claude Code working inside the Beacon repo.
This file overrides general defaults. Read it before any non-trivial change.

---

## 1. What Beacon is

An AI-first, mobile-ready PWA email client. One UI over three transport
backends (IMAP, Gmail REST, Microsoft Graph). All three implement a single
`MailProvider` interface in `lib/providers/types.ts` — the rest of the app
never knows which backend it is talking to.

If you find yourself branching on `kind === "gmail"` outside of
`lib/providers/`, stop. The branch belongs in the adapter.

## 2. Stack (don't drift)

| Layer | Choice | Why |
|-------|--------|-----|
| Framework | Next.js 15 App Router | RSC + route handlers + edge-friendly |
| Language | TypeScript strict | `noUncheckedIndexedAccess` is on, mind it |
| Styling | Tailwind v4 + design tokens in `app/globals.css` | tokens-first, no ad-hoc colors |
| UI | Radix primitives + small in-repo components | no shadcn install — own the code |
| DB | LibSQL (Turso) via Drizzle ORM | one schema, file://`dev` and `libsql://` prod |
| Auth | Auth.js v5 (NextAuth) with Drizzle adapter | session = user-of-Beacon, NOT a mailbox |
| AI | Anthropic SDK — Haiku 4.5 for fast, Sonnet 4.6 for tone | see `lib/ai/client.ts` |
| Tests | Vitest (unit) + Playwright (mobile-viewport smoke) | required for CI |
| Deploy | Vercel | Node runtime for routes that touch IMAP / mail libs |

Do not add another ORM, another auth lib, or another AI provider unless the
user explicitly asks. If a feature seems to need a new lib, surface it first.

## 3. Security rules (hard)

1. **Credentials never leave the server.** Provider credentials live in
   `mail_accounts.credentials` encrypted with AES-256-GCM via
   `lib/crypto/vault.ts`. The browser only sees `accountId`. Never return a
   raw token or password from any route.
2. **OAuth state is validated.** The `beacon_oauth_state` cookie must match
   the `state` query param. Don't shortcut this — it stops CSRF on the
   callback.
3. **HTML email is sanitized.** `MessageView` runs every HTML body through
   `isomorphic-dompurify` before rendering. Never `dangerouslySetInnerHTML`
   raw provider HTML.
4. **Route handlers always re-check ownership.** Every API route that takes
   an `accountId` re-queries `mail_accounts` with
   `WHERE id = ? AND user_id = session.user.id`. Do not trust the path alone.
5. **Vault key requirement.** `BEACON_ENCRYPTION_KEY` must be a 64-char hex
   string in production. The fallback scrypt derivation is a dev convenience.

## 4. Provider invariants

- One adapter per file in `lib/providers/`.
- Adapters are stateless — open a connection per call, close it in `finally`.
  IMAP `withFolder()` is the canonical pattern.
- OAuth adapters take an `onTokenRefresh` callback. Use it. The token vault
  must always hold the freshest refresh token.
- Never log credentials or full message bodies. Subjects + From are OK at
  debug level; bodies and recipients are not.

## 5. AI invariants

- Everything goes through `lib/ai/client.ts`. Don't `import Anthropic` outside
  that file.
- Prompts are **system + cache_control: ephemeral**. The system prompt is
  intentionally repeated across requests so the cache hit pays for itself.
- Use `MODELS.fast` (Haiku 4.5) for summarization and triage. Use
  `MODELS.smart` (Sonnet 4.6) for drafts where tone matters.
- Cache deterministic outputs (summary, priority) in the `ai_cache` table
  keyed by `sha256(kind + payload)`. Drafts intentionally don't cache —
  users want fresh variations.
- Never invent facts in a draft. Use `[placeholder]` inline if information
  is missing. The system prompt enforces this; don't undo it.

## 6. UX invariants

- Mobile-first. Every page must be usable in a 390×844 viewport.
- Tap targets ≥ 40px (the Playwright smoke test enforces this on the sign-in
  button — extend the test if you change the button height system).
- The bottom nav owns navigation. Don't add a sidebar.
- The accent color is `var(--color-accent)` — never `#ffb84d`. If you need
  a new color, add a token.

## 7. Testing rules

- Unit tests live in `tests/unit/**`. Mock the Anthropic SDK at the module
  boundary (see `summarize.test.ts`). Never call the real API in tests.
- Playwright tests live in `tests/e2e/**`. They run against the mobile-viewport
  projects defined in `playwright.config.ts`.
- Every test should encode WHY a behavior matters, not just WHAT. If a future
  refactor changes the implementation but preserves the intent, the test
  should still pass.
- Run `pnpm check-all` (typecheck + lint + unit tests) before declaring done.

## 8. Commit + PR discipline

- Conventional-style commits: `feat:`, `fix:`, `chore:`, `docs:`.
- Never commit `.env` or `local.db`. The `.gitignore` already covers this —
  if you find yourself widening it, stop and ask.
- Keep PRs scoped. A new provider is one PR. A new AI feature is one PR.
  Don't bundle UI polish with backend work.

## 9. Slash-commands and skills

Skills live in `.claude/skills/`. The three big ones are:

- **`add-provider`** — scaffold a new `MailProvider` adapter end-to-end.
- **`add-mail-action`** — add a new mailbox action (e.g. snooze) across
  every adapter + the action endpoint.
- **`ship-ai-feature`** — add a new AI feature with caching, prompts,
  streaming endpoint, and unit tests.

If you're about to do one of those tasks, read the skill first.

## 10. Agents

- **`provider-adapter`** — domain expert on IMAP/Gmail/Graph. Spawn for
  cross-provider semantics questions.
- **`ui-component`** — mobile-first React + Tailwind v4 component author.
- **`ai-feature`** — Claude prompt engineer (caching, streaming, JSON outputs).
- **`test-author`** — writes Vitest/Playwright tests in the project style.

## 11. Hooks

- `pre-commit-checks` (in `.claude/settings.json`) runs `pnpm typecheck`
  and `pnpm lint` before any commit-class tool call. Don't bypass it.
- `post-edit-format` autoformats with Prettier after every Edit/Write.

## 12. Twelve-rule baseline

The user-level rules at `~/.claude/CLAUDE.md` apply here too. The two
most relevant for this codebase:

- *Rule 3 — Surgical changes.* Don't reformat or refactor adjacent code.
- *Rule 11 — Match the codebase's conventions.* The provider pattern, the
  vault pattern, and the AI client pattern are the conventions. Use them.
