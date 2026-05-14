# Beacon — Architecture (one page)

## Topology

```
                            ┌─────────────────────────────────────┐
                            │     Mobile PWA (Next.js 15 RSC)     │
                            │  · Unified inbox / message view     │
                            │  · Compose, reply (AI), forward     │
                            │  · Account switcher, search         │
                            │  · Service worker → installable     │
                            └───────────────┬─────────────────────┘
                                            │ HTTPS
                            ┌───────────────▼─────────────────────┐
                            │      Route handlers (Node.js)       │
                            │  /api/messages   /api/send          │
                            │  /api/search     /api/accounts      │
                            │  /api/ai/*       /api/oauth/*       │
                            │  · Auth.js v5 session gate           │
                            │  · Zod-validated bodies              │
                            │  · Always re-checks user ownership   │
                            └──┬──────────────┬──────────────┬────┘
                               │              │              │
                ┌──────────────▼─┐  ┌─────────▼────────┐  ┌──▼──────────┐
                │  Provider layer │  │ AI layer        │  │ DB layer    │
                │ (lib/providers) │  │ (lib/ai)        │  │ (Drizzle +  │
                │                 │  │                 │  │  LibSQL)    │
                │  ┌───────────┐  │  │ Anthropic SDK   │  │             │
                │  │ImapProvider│  │  │ · Haiku 4.5    │  │ users       │
                │  │GmailProvider│ │  │ · Sonnet 4.6   │  │ mail_accts  │
                │  │O365Provider │ │  │ · prompt cache │  │ msg_cache   │
                │  └───────────┘  │  │ · ai_cache DB  │  │ ai_cache    │
                └────────┬────────┘  └─────────┬───────┘  └─────────────┘
                         │                     │
              ┌──────────┴──────┐  ┌───────────▼─────────┐
              │ Yahoo / AOL /   │  │ Anthropic API       │
              │ iCloud / IMAP   │  │ (api.anthropic.com) │
              │ + SMTP          │  └─────────────────────┘
              ├─────────────────┤
              │ Gmail API       │
              │ (googleapis)    │
              ├─────────────────┤
              │ MS Graph API    │
              │ (graph.MS.com)  │
              └─────────────────┘
```

## Layers

| Layer | Files | Responsibility |
|-------|-------|----------------|
| UI shell | `app/(app)/layout.tsx`, `components/bottom-nav.tsx` | Mobile chrome, account chip, install affordance |
| Pages | `app/(app)/{inbox,compose,settings,message/[accountId]/[id]}/page.tsx` | RSC fetches; hand data to client components |
| Client components | `components/{inbox-list,message-view,compose-form,settings-panel,add-account-form}.tsx` | Interactivity, streaming UI |
| Route handlers | `app/api/**/route.ts` | Auth, validation, ownership check, call into lib |
| Provider layer | `lib/providers/{imap,gmail,o365}.ts` + `types.ts` + `index.ts` | One `MailProvider` interface; one adapter per backend |
| AI layer | `lib/ai/{client,summarize,draft,prioritize}.ts` | Anthropic calls + prompt + DB caching |
| DB | `lib/db/{client,schema}.ts` + Drizzle migrations | Encrypted credential vault + message + AI caches |
| Crypto | `lib/crypto/vault.ts` | AES-256-GCM for credentials at rest |
| Auth | `lib/auth.ts` | Auth.js v5 (Drizzle adapter), JWT session |

## Read path (unified inbox)

1. `app/(app)/inbox/page.tsx` (RSC) calls `forEachAccount` → loops every
   mailbox in parallel, opens a per-call IMAP / Gmail / Graph connection.
2. Envelopes merge, sort by `receivedAt`, slice 50, hand to `<InboxList>`.
3. Client mounts → fires `/api/messages?prioritize=1` → server batches into
   `prioritizeBatch` → Haiku returns JSON priorities → cards re-render with
   priority dots + AI reasons.

## Write path (reply)

1. User clicks "Draft with AI" → `POST /api/ai/draft` (streaming).
2. Server fetches the original message via the provider, then streams
   Anthropic Sonnet's tokens straight to the client.
3. User edits, clicks Send → `POST /api/send/<accountId>` → provider's
   `sendMessage()` builds RFC-compliant MIME and hits SMTP / Gmail / Graph.

## Providers (capability matrix)

| Action | IMAP | Gmail | O365 |
|--------|------|-------|------|
| list / get / send | ✅ | ✅ | ✅ |
| markRead | `\Seen` flag | `UNREAD` label | `isRead` patch |
| flag | `\Flagged` | `STARRED` label | `flag.flagStatus` |
| archive | move to `Archive` / fallback | remove `INBOX` | move to `archive` |
| trash | move to `Trash` | `trash()` | move to `deleteditems` |
| labels | IMAP keywords | first-class | `categories[]` |
| search | `SEARCH text` | `q=` query | `$search` |

## AI features

| Feature | Model | Cached? | Streamed? |
|---------|-------|---------|-----------|
| Summary | Haiku 4.5 | ✅ (db) | ❌ |
| Reply draft | Sonnet 4.6 | ❌ | ✅ |
| Compose draft | Sonnet 4.6 | ❌ | ✅ |
| Prioritize | Haiku 4.5 | ✅ (db) | ❌ |

## Security

- **Vault.** Per-mailbox credentials → AES-256-GCM (`lib/crypto/vault.ts`)
  before `INSERT`. Decrypted only inside route handlers when constructing
  a `MailProvider`. Never serialized to the client.
- **OAuth.** `state` cookie validated against query param. Tokens refreshed
  via the `onTokenRefresh` callback wired into the provider factory →
  re-encrypted → persisted.
- **Authorization.** Every route handler that takes an `accountId` runs
  `WHERE id = ? AND user_id = session.user.id`. Path can't be forged.
- **HTML sanitization.** `message-view.tsx` runs every HTML body through
  `isomorphic-dompurify` before render.
- **Session.** Auth.js v5 with `strategy: "jwt"`. The user-of-Beacon identity
  is independent of any mailbox identity.

## Deploy

- Target: Vercel.
- Runtime: all API routes that touch mail libs (`imapflow`, `nodemailer`,
  `mailparser`) are marked `runtime = "nodejs"`. `serverExternalPackages`
  in `next.config.mjs` keeps them out of bundling.
- DB: LibSQL — file in dev (`file:./local.db`), Turso in prod.
- Env vars (required): `BEACON_ENCRYPTION_KEY`, `AUTH_SECRET`,
  `ANTHROPIC_API_KEY`, `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, plus
  `GOOGLE_CLIENT_ID/SECRET` and `MICROSOFT_CLIENT_ID/SECRET/TENANT_ID`
  for OAuth providers.
