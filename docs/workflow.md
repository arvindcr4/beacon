# Beacon — Build Workflow

This is the workflow that produced Beacon. It's a working example of running
Claude Code with the *Agent OS* discipline — specs first, agents for fan-out,
hooks for safety, slash-skills for repeatable expansions.

## Five phases

### 1. Specify (CLAUDE.md + architecture)

The first commit was `CLAUDE.md` and `docs/architecture.md` — not code. Those
documents define the contracts (the `MailProvider` interface, the security
rules, the model choices) that every later change must respect. Spec-driven
development means a future Claude Code session re-reads `CLAUDE.md` first and
inherits all the prior decisions without re-deriving them.

### 2. Scaffold (single root prompt)

A single goal-prompt seeded the project layout: `next.config.mjs`,
`tsconfig.json`, the Drizzle schema, the encryption vault, and the empty
`MailProvider` interface. No business logic — just the shapes.

### 3. Fan out (subagents in parallel)

Three concerns were independent and went out in parallel as subagents:

- **`provider-adapter`** built `imap.ts`, `gmail.ts`, `o365.ts`. The interface
  enforced uniformity so the agents couldn't drift.
- **`ai-feature`** built `lib/ai/{summarize,draft,prioritize}.ts` with prompt
  caching and the `ai_cache` table.
- **`ui-component`** built the mobile shell, the inbox list, the message view
  with streaming AI drafts, the compose form, and the add-account form.

Each agent had a tight scope and a tight contract. Conflicts were rare
because the contracts (`MailProvider`, `MODELS`, design tokens) were already
written down in step 1.

### 4. Verify (test-author + hooks)

`test-author` wrote Vitest tests that mock the Anthropic SDK at the import
boundary and verify intent ("falls back to medium when Claude returns
malformed output — never leaves UI empty"). The Playwright smoke test runs
against mobile viewports and asserts the PWA manifest, the service worker,
and the tap-target size of the sign-in button.

The `pre-commit-checks.sh` hook ran `pnpm typecheck`, `pnpm lint`, and
`pnpm test --run` before every commit. The `post-edit-format.sh` hook
Prettier-formatted every file Claude Code touched. Together they make it
impossible to land an unformatted or untyped change.

### 5. Iterate via skills

Adding a new provider, action, or AI feature is a single slash-skill away
(`add-provider`, `add-mail-action`, `ship-ai-feature`). The skill is a
checklist Claude Code follows — interface change first, every adapter second,
route third, UI fourth, test fifth, docs sixth. The same checklist works for
a human contributor.

## What we deliberately did *not* do

- **No flag-flipping refactors.** No "while we're here" cleanups. Surgical
  changes only, per Rule 3 of the user-level CLAUDE.md.
- **No multi-ORM accident.** Drizzle is the only ORM. No raw SQL outside
  migrations. Anyone tempted to add Prisma "for the better TS types" has to
  argue against `CLAUDE.md` first.
- **No half-shipped backends.** Every provider has every method implemented
  and tested. Gmail and O365 ship their full OAuth flow including state
  validation and encrypted refresh-token rotation, not a TODO.
- **No mocked AI.** The AI features call real Anthropic Haiku/Sonnet at
  runtime against real email bodies. Tests mock the boundary, but the app
  never does.

## Reviewer reproduction

```bash
git clone <repo> && cd beacon
pnpm install
cp .env.example .env.local && $EDITOR .env.local  # fill secrets
pnpm db:push
pnpm dev                  # http://localhost:3000
pnpm check-all            # typecheck + lint + vitest
pnpm test:e2e:install     # one-time Playwright browsers
pnpm test:e2e             # mobile smoke test
```

The whole project is reproducible from `CLAUDE.md` + the goal prompt + the
skill set. That's the point of the workflow: a different Claude Code agent
can land the same code given the same artifacts.
