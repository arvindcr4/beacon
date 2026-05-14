---
name: ship-ai-feature
description: Use when the user wants a new AI-powered feature — e.g. "add a translate button", "auto-categorize newsletters", "extract action items". Walks through prompt + lib + route + cache + UI + tests, the way the existing summarize/draft/prioritize features are structured.
---

# ship-ai-feature

Ship a new AI feature end-to-end in the Beacon house style.

## Step 1 — Pick a model and a shape

- Tone-sensitive output (drafts, paraphrasing) → `MODELS.smart` (Sonnet 4.6).
- Classification / extraction / summarization → `MODELS.fast` (Haiku 4.5).
- JSON output → instruct strict-JSON and parse defensively. See
  `lib/ai/prioritize.ts` for the canonical pattern with code-fence fallback.
- Long output → stream (see `draftReplyStream` in `lib/ai/draft.ts`).

## Step 2 — Implement under `lib/ai/`

Create `lib/ai/<feature>.ts`. Re-use these helpers from `lib/ai/client.ts`:
- `client()` — singleton Anthropic client.
- `MODELS` — model IDs.
- `bodyToText`, `clampBody` — preprocess HTML emails.
- `hashFor`, `lookupCache`, `writeCache` — for deterministic outputs.

If the output is deterministic (same input → same answer), cache it. If it's
generative, don't.

## Step 3 — Build the route

Create `app/api/ai/<feature>/route.ts` with:
- `export const runtime = "nodejs"`.
- `await auth()` → 401 if no session.
- Zod-validate the body.
- Re-check `mail_accounts` ownership if the feature works on a specific
  message.
- Stream the response if the body is long.

## Step 4 — Surface in the UI

The two places to plug in:
- For features that act on one open message: extend `components/message-view.tsx`.
- For features that act across the inbox: extend `components/inbox-list.tsx`.
- For features that need their own screen: add a new page under `app/(app)/`.

Show a streaming indicator (loading state) and never leave the UI empty on
failure — show a one-line error and let the user retry.

## Step 5 — Test

Add `tests/unit/ai/<feature>.test.ts`. Cover at minimum:
- Happy path: mocked Anthropic returns expected text → feature outputs it.
- Cache hit: second call doesn't hit Anthropic.
- Malformed model output: graceful fallback, not a crash.

## Step 6 — Docs

Add a row to the "AI features" table in `docs/architecture.md`.

## Definition of done
- Feature works in the UI with no console errors.
- `pnpm check-all` is green.
- Cached results are observable in the `ai_cache` table after first use.
