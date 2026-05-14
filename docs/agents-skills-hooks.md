# Beacon — Agents, Skills, Hooks, Plugins

This is the Claude Code automation surface that drives Beacon development.
Each entry includes its file and what it does.

## Agents (`.claude/agents/`)

| Agent | File | Purpose |
|-------|------|---------|
| `provider-adapter` | `provider-adapter.md` | Domain expert on the `MailProvider` interface and the three adapters (IMAP / Gmail / Graph). Use for cross-provider semantics and for scaffolding new adapters. |
| `ui-component` | `ui-component.md` | Mobile-first React + Tailwind v4 component author. Enforces design tokens, ≥40px tap targets, safe-area awareness. |
| `ai-feature` | `ai-feature.md` | Claude prompt engineer. Owns model choice (Haiku 4.5 vs Sonnet 4.6), prompt caching, streaming, JSON-output discipline, and the `ai_cache` table. |
| `test-author` | `test-author.md` | Writes Vitest unit tests and Playwright mobile-viewport E2E tests in the project style — tests encode WHY, not just WHAT. |

## Skills (`.claude/skills/`)

| Skill | File | Trigger |
|-------|------|---------|
| `add-provider` | `add-provider/SKILL.md` | "add ProtonMail", "support JMAP", or any request for a new mailbox backend. Walks the developer through interface → adapter → factory → onboarding → tests. |
| `add-mail-action` | `add-mail-action/SKILL.md` | "add snooze", "add mark-as-spam" — coordinates the change across the interface, all three adapters, the action route, and the UI. |
| `ship-ai-feature` | `ship-ai-feature/SKILL.md` | "add a translate button", "categorize newsletters" — end-to-end checklist matching the existing summarize/draft/prioritize structure. |

## Hooks (`.claude/hooks/` + `.claude/settings.json`)

| Hook | Event | What it does |
|------|-------|--------------|
| `pre-commit-checks.sh` | `PreToolUse` on `Bash` matching `git commit` | Runs `pnpm typecheck`, `pnpm lint`, `pnpm test` before allowing the commit. Lets non-commit Bash calls through untouched. |
| `post-edit-format.sh` | `PostToolUse` on `Edit \| Write \| MultiEdit` | Runs Prettier on the file that was just touched. Soft-fails so a Prettier error never blocks a write. |

## Plugins

Beacon ships no custom Claude Code plugins. The slash-commands the
development workflow relies on are stock (`/init`, `/review`, `/security-review`)
plus the user-level skills already in `~/.claude/CLAUDE.md`.

If Beacon needed a plugin later — e.g. a one-shot "connect Beacon to my
desktop terminal so reviewers can `pnpm dlx beacon-eval` and get a full
report" — it would go in `.claude/plugins/` and be wired through
`marketplace.json`. Not in scope for v1.

## Allow-list (from `.claude/settings.json`)

These commands are pre-allowed so reviewers can reproduce the workflow without
prompts:

```
pnpm typecheck    pnpm lint        pnpm test
pnpm build        pnpm db:generate pnpm db:push
pnpm format       pnpm install     pnpm dlx
```

Anything else (publish, deploy, push) still requires an explicit user
permission grant — by design.
