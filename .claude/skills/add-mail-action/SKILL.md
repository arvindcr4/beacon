---
name: add-mail-action
description: Use when the user wants a new mailbox action that must work across every provider — e.g. "add snooze", "add mark-as-spam", "add reply-with-template". Coordinates the change across the MailProvider interface, all three adapters, the action endpoint, and the UI.
---

# add-mail-action

Adding a new action is a fan-out task: one interface change, three adapter
changes, one route change, and one UI affordance. Do it in this order.

## Step 1 — Extend the interface

Add the method signature to `MailProvider` in `lib/providers/types.ts`.
Use a verb + object (`snooze(id, until)`, `markSpam(id)`). If the action
returns data, type the return.

## Step 2 — Implement in each adapter

In this order (the IMAP one is hardest):

1. **`lib/providers/imap.ts`** — use `withFolder()`. If IMAP doesn't have
   a native operation, fall back to flags / move-to-folder.
2. **`lib/providers/gmail.ts`** — usually `users.messages.modify` with
   `addLabelIds` / `removeLabelIds`.
3. **`lib/providers/o365.ts`** — usually a `PATCH /me/messages/{id}` or a
   `/move` POST.

If a provider can't support the action, document the fallback in
`docs/architecture.md` and degrade gracefully (don't throw a 500).

## Step 3 — Add to the action endpoint

In `app/api/messages/[accountId]/[id]/action/route.ts`:
- Add the new variant to the Zod `Body` discriminated union.
- Add the case to the switch.

## Step 4 — Surface in the UI

The two places that use actions:
- `components/inbox-list.tsx` — `quickAction()` and the hover affordance.
- `components/message-view.tsx` — `doAction()` and the top-right button row.

Use a `lucide-react` icon. If the action is reversible, show a confirmation
toast with an undo (we don't have toasts yet — add `components/ui/toast.tsx`
before adding the first one that needs it).

## Step 5 — Test

`tests/unit/providers/<adapter>.test.ts` should cover at least:
- the action doesn't crash with a missing target,
- the action propagates errors instead of swallowing them.

Update `tests/e2e/inbox.spec.ts` if the action has a visible UI element on
the inbox list.

## Definition of done
- Action works in all three providers (or degrades cleanly).
- `pnpm check-all` passes.
- A keyboard-only user can trigger the action from `MessageView`.
