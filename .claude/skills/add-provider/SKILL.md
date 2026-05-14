---
name: add-provider
description: Use when the user wants Beacon to support a new mailbox provider — e.g. "add ProtonMail", "add a Zoho adapter", "support generic JMAP". Walks through implementing the MailProvider interface, wiring credentials, and shipping tests + onboarding.
---

# add-provider

You are walking the developer through adding a new mailbox provider to Beacon.

## Step 1 — Decide the credential shape

Pick one of:
- **Password / app-password** → use the `ImapCredentials` shape and route via
  the IMAP adapter if the provider speaks IMAP at all. (Most providers do.)
- **OAuth 2.0** → use `OAuthCredentials`. You'll need `start` and `callback`
  routes under `app/api/oauth/<name>/`.
- **API-key (rare)** → invent a credential type in `lib/providers/types.ts`.

If the provider supports IMAP, prefer IMAP and add a preset to `IMAP_PRESETS`
in `lib/providers/imap.ts` — that's a 5-minute add, not a new adapter.

## Step 2 — Implement the adapter

Create `lib/providers/<name>.ts` that exports a class implementing
`MailProvider`. Required methods:

- `listFolders` / `listMessages` / `getMessage`
- `sendMessage`
- `search`
- `markRead` / `flag`
- `archive` / `trash`
- `addLabel` / `removeLabel`
- `close`

Mirror the IMAP adapter's `withFolder` pattern: open a connection per call,
release in `finally`. Token-refreshing adapters take an `onTokenRefresh`
callback and call it whenever the SDK rotates a token (see `gmail.ts`).

## Step 3 — Wire the factory

Edit `lib/providers/index.ts`:
- Add a `case "<name>":` to the switch in `providerForAccount`.
- Update the `mailAccounts.kind` enum in `lib/db/schema.ts` and run
  `pnpm db:push`.

## Step 4 — Onboarding

If OAuth: add `app/api/oauth/<name>/start/route.ts` and
`app/api/oauth/<name>/callback/route.ts`. Mirror the Google routes exactly —
state cookie, code exchange, profile fetch, encrypted credential insert.

If password-based: extend the `AddAccountForm` Kind union and the route
handler in `app/api/accounts/route.ts`.

## Step 5 — Tests

Add `tests/unit/providers/<name>.test.ts`. At minimum:
- credentials never appear in thrown errors,
- `listFolders` returns at least Inbox when given a happy-path mock,
- adapter type is exported correctly.

## Step 6 — Docs

Add a row to the "Providers" section of `docs/architecture.md`.

## Definition of done
- `pnpm typecheck` passes.
- `pnpm test` includes the new file and passes.
- A user with no docs can connect the provider from `/add-account`.
