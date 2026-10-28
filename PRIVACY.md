# Privacy

Agent Tree runs inside Claude Code and keeps the session's events in memory.

Once a day, in interactive sessions, it runs Claude Code's `plugin list --json` for its installed version and reads its latest version number from GitHub (raw.githubusercontent.com); the request carries nothing about you; GitHub sees your IP address.

If it came from a marketplace and a newer version exists, it runs Claude Code's `plugin update agent-tree`.

The Auto-update option turns this off, as do DO_NOT_TRACK=1, DISABLE_AUTOUPDATER, DISABLE_UPDATES and Claude Code's switch for nonessential traffic.

Claude Code's plugin storage keeps your look, the sub-agent model and effort, the update state and whether it asked for a star. No telemetry, account or cookie.

## Hooks

They act only after you act in the pane: a model or effort you pick, a stop, a message to an agent (noted in the transcript) and the advisor button (`/advisor`).

Questions: github.com/MikeGT4/agent-tree/issues
