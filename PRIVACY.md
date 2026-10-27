# Privacy

Agent Tree runs inside Claude Code and makes no network requests of its own. It reads the session's events and keeps them in memory for the running session. It stores only your chosen look, in Claude Code's plugin storage. No telemetry, no account, no cookie.

## Hooks

They act only after you act in the pane. A model you pick applies to new sub-agents (`agent.spawn`) or to a running agent's next step (`turn.step`). Stopping an agent makes that step hand back a short report; `tool.call` declines its further tool calls. A message you send joins the agent's conversation; the main session and a running parent get a note, all kept in the transcript. An agent that finished, or ended before reading it, restarts with it. While a message is unread, `tool.call` holds the agent's handback once. The advisor button runs `/advisor`, which Claude Code saves as your default.

Questions: github.com/MikeGT4/agent-tree/issues
