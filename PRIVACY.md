# Privacy

Agent Tree runs inside Claude Code and keeps session events in memory.

Once a day, in interactive sessions, it compares its version with the latest on GitHub (raw.githubusercontent.com), which sees only your IP address, and installs a newer one. The Auto-update option, DO_NOT_TRACK=1, DISABLE_AUTOUPDATER, DISABLE_UPDATES and Claude Code's switch for nonessential traffic turn this off.

The plugin storage on your computer keeps settings, update state, a star-hint count and, for the Terminals tab, each session's folder, branch, agents, cost and changed Markdown files (other paths hashed) until it ends or an hour passes. A local model you set gets its tasks at the address you entered. No telemetry, account or cookie.

## Hooks

They act only on your actions in the pane: model or effort picks, stops, messages to agents (noted in the transcript), `/advisor`, `/fast` and `/model`. Typing only ends the intro or update card.

Questions: github.com/MikeGT4/agent-tree/issues
