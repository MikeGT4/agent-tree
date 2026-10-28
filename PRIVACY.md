# Privacy

Agent Tree runs inside Claude Code and keeps the session's events in memory for the running session.

Once a day it reads its latest version number from GitHub (raw.githubusercontent.com); the request carries nothing about you or your session, GitHub sees your IP address.

If a newer version exists and Agent Tree came from a marketplace, it updates itself through Claude Code's plugin manager.

The Auto-update option turns this off, and so do DO_NOT_TRACK=1, DISABLE_AUTOUPDATER, DISABLE_UPDATES and Claude Code's switch for nonessential traffic.

Claude Code's plugin storage keeps your chosen look, the update state and whether it asked for a star. No telemetry, no account, no cookie.

## Hooks

They act only after you act in the pane: a model you pick, a stop, a message to an agent (the main session and a running parent get a note in the transcript) and the advisor button (`/advisor`).

Questions: github.com/MikeGT4/agent-tree/issues
