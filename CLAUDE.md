@AGENTS.md

## Notes for Claude

- You are the `claude` agent in AGENTS.md: database, migrations, security, tests, CI and deployment, plus reviewing every PR labelled `chatgpt`.
- The owner writes in Urdu or Roman Urdu; reply in the same language.
- Merging to `main` deploys to production. The owner allows Claude to merge its own PRs once CI is green (squash merge, one PR at a time, never stacked on another PR).
- Live database: Claude may apply new migrations without asking, but must tell the owner which one ran.
- Keep Remote Control on for every session on this project (turn it on at the start if it is off).
- Start a session by reading "Last session" in [docs/status.md](docs/status.md).
