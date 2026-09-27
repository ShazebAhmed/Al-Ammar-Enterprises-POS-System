# Working agreement for AI agents

Two AI agents work on this repository: **ChatGPT (Codex)** and **Claude (Claude Code)**. The owner, ShazebAhmed, decides what ships. This file is the shared rulebook; read it before starting any task.

## The project

Al-Ammar Store: a Next.js 15 / React 19 storefront on Vercel, backed by Supabase (auth, Postgres, storage). See [README.md](README.md) for setup and [docs/rollout.md](docs/rollout.md) for database releases.

- Live site: https://al-ammar-enterprises-pos-system.vercel.app (deploys automatically from `main`)
- Every branch and PR gets its own Vercel preview.
- Supabase is on the free plan and pauses after about a week without activity. If the site shows no data, check that first.

## Who owns what

| Area | Owner | Reviewer |
| --- | --- | --- |
| UI, design, layout, copy, customer-facing features | ChatGPT | Claude |
| Database, migrations, RLS/security, tests, CI, deployment | Claude | ChatGPT |

Ownership decides who writes the change. It does not stop either agent from raising a concern in review.

## How a task flows

1. **Task = GitHub issue.** Each issue carries a label, `chatgpt` or `claude`, naming the agent who does it. Do not start work on an issue labelled for the other agent. If you think it should be yours, comment on the issue.
2. **One branch per task.** Branch from the latest `main` as `chatgpt/<short-name>` or `claude/<short-name>`. Never commit directly to `main`, and never push to the other agent's branch.
3. **Open a PR** that links the issue (`Closes #N`), fill in the PR template, and add the `needs-review` label.
4. **Cross-review.** The other agent reviews the PR. Comments must be specific: file, line, what is wrong, and a suggested fix. The author replies to each comment and either fixes it or explains why not.
5. **Owner merges.** When the reviewer approves and CI is green, the reviewer replaces `needs-review` with `ready-to-merge`. Only the owner merges.

Keep PRs small: one task per PR. Big redesigns are hard to review and are where mistakes hide.

## Rules that prevent the mistakes we already made

These come from real problems found while releasing PR #1:

- **Check the live database, not an assumed schema.** The repository has no baseline migration for the original tables. Before writing a migration, compare it against the real triggers, functions, policies and storage buckets. PR #1 missed two existing triggers (`compute_order_total`, `restock_on_cancel`) that would have deducted and restored stock twice.
- **Names must match exactly.** The code used a `product-images` bucket while the project only had `Product Images`, so image uploads never worked.
- **Frontend and migration ship together.** If a PR needs a database change, say so at the top of the PR and add the migration under `supabase/migrations/` with the next timestamp. Never edit a migration that has already been applied; add a new one.
- **Never put a Supabase service-role key, password or other secret in code, `NEXT_PUBLIC_*` variables, issues or PR comments.**
- **Say what you did not verify.** A passing build is not a tested feature. If you could not test with real data or on mobile, write that in the PR.

## Before opening a PR

```
npm ci
npm run format:check
npm test
npm run build
```

All four must pass. CI runs the same checks.

## Talking to each other

- Write in English in code, commits and PRs; the owner may comment in Urdu.
- Keep discussion on the issue or PR, not in private chats, so the owner and the other agent can see it.
- If the two agents disagree, state both options briefly on the PR and let the owner decide.
