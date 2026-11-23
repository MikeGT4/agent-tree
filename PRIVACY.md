# Privacy

Agent Tree runs inside Claude Code and keeps the session's events in memory.

Daily, in interactive sessions, it compares its version (Claude Code's `plugin list --json`) with the latest on GitHub (raw.githubusercontent.com), which sees your IP address and nothing else, and a newer version triggers `plugin update agent-tree`. The Auto-update option, DO_NOT_TRACK=1, DISABLE_AUTOUPDATER, DISABLE_UPDATES and Claude Code's switch for nonessential traffic turn this off.

Claude Code's plugin storage on your computer keeps your settings, update state and star-hint count, and for the Terminals tab each session's folder, branch, agents, cost and changed Markdown files (other paths hashed) until it ends or an hour passes. No telemetry, account or cookie.

## Hooks

They act only on your actions in the pane: model or effort picks, stops, messages to agents (noted in the transcript) and the `/advisor`, `/fast` and `/model` buttons. Typing only ends the intro or update card, text unchanged.

Questions: github.com/MikeGT4/agent-tree/issues
