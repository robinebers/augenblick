# AGENTS.md

Version: 0.21 (2026-01-26)

Start: say hi + 1 motivating line.
Work style: telegraph; noun-phrases ok; drop grammar; min tokens.

## Agent Protocol
- Contact: Robin Ebers (@robinebers, rob@robinebers.com).
- “Make a note” => edit AGENTS.md (Ignore `CLAUDE.md`, symlink for AGENTS.md).
- Editor: `cursor <path>`.
- New deps: quick health check (recent releases/commits, adoption).
- Style: telegraph. Drop filler/grammar. Min tokens.
- When asked to update the `AGENTS.md` to the latest version:
  1. Fetch `https://raw.githubusercontent.com/robinebers/agents.md/main/AGENTS.md`.
  2. Check if newer version version and merge without losing local changes.

## Use Available Skills
- You have access to agent skills, which are very useful.
- Before creating a plan or spec, verify if there are skills available for it.
- Examples include: React Best Practices, Convex Best Practices, and similar.
- Prefer skills (often first-party) over Exa/Ref when available.

## Guardrails
- Use `trash` for deletes.
- Bugs: add regression test when it fits.
- Keep files <~400 LOC; split/refactor as needed.
- Simplicity first: handle only important cases; no enterprise over-engineering.
- New functionality: small OR absolutely necessary.
- NEVER delete files or folders without explicit consent.
- MCPs: Use Exa to websearch early, and Ref to seek specific documention or web fetch.
- Quote exact errors; prefer 2024-2026 sources; fallback web server if unavailable

## Git
- Always use `gh` to communicate with GitHub.
- GitHub CLI for PRs/CI/releases. Given issue/PR URL (or `/pull/5`): use `gh`, not web search.
- Examples: `gh issue view <url> --comments -R owner/repo`, `gh pr view <url> --comments --files -R owner/repo`.
- Commits: Conventional Commits (`feat|fix|refactor|build|ci|chore|docs|style|perf|test`).
- CI: `gh run list/view` (rerun/fix til green).
- Safe by default: `git status/diff/log`. Push only when user asks.
- `git checkout` ok for PR review / explicit request.
- Branch changes require user consent.
- Destructive ops forbidden unless explicit (`reset --hard`, `clean`, `restore`, `rm`, …).
- No repo-wide S/R scripts; keep edits small/reviewable.
- Avoid manual `git stash`; if Git auto-stashes during pull/rebase, that’s fine (hint, not hard guardrail).
- If user types a command (“pull and push”), that’s consent for that command.
- Big review: `git --no-pager diff --color=never`.

## Error Handling
- Expected issues: explicit result types (not throw/try/catch).
  - Exception: external systems (git, gh) → try/catch ok.
  - Exception: React Query mutations → throw ok.
- Unexpected issues: fail loud (throw/console.error + toast.error); NEVER add fallbacks.

## Backwards Compat
- Local/uncommitted: none needed; rewrite as if fresh.
- In main, unreleased: probably not; ask user.
- Released: probably needed.

## Critical Thinking
- Fix root cause (not band-aid).
- Unsure: read more code; if still stuck, ask w/ short options.
- Conflicts: stop. call out; pick safer path.
- Unrecognized changes: assume other agent; keep going; focus your changes. If it causes issues, stop + ask user.
- Leave breadcrumb notes in thread.

## Completion and Autonomy Gate
- Assume "continue" unless the user explicitly says "stop" or "pause".
- Do not ask "should I continue?" or similar questions.
- If more progress is possible without user input, continue.
- BEFORE you end a turn or ask the user a question, run this checklist
-- Answer these privately, then act:
   1) Was the initial task fully completed?
   2) If a definition-of-done was provided, did you run and verify every item?
   3) Are you about to stop to ask a question?
      - If yes: is the question actually blocking forward progress?
   4) Can the question be answered by choosing an opinionated default?
      - If yes: choose a default, document it in , and continue.
- When you choose opinionated defaults, document them in `/docs/choices.md` as you work through.
- If you must ask the user:
-- Ask exactly one blocking question.
-- Explain why it is blocking and what you will do once answered.
-- Provide your best default/assumption as an alternative if the user does not care.

## Useful Tidbits
- When using Vercel AI Gateway, use a single API key across the project, not individual providers.
- When using Convex, run `bunx convex dev --once` to verify, not `bunx convex codegen`

## User Notes
Use below list to store and recall user notes when asked to do so.

- Dialog backgrounds missing when Tailwind v4 `@theme inline` tokens lacked `hsl()`; fix by wrapping `--color-*` with `hsl(var(--...))`.
