# Privacy

Agent Tree runs inside Claude Code on your machine and makes no network requests of its own. It reads the session's events (agents, models, tasks, tools, answers, timings, context use, cost) and keeps them in memory for the running session. It stores one thing: your chosen look, in Claude Code's plugin storage on your machine. No telemetry, no account, no cookie.

## Hooks

They act only after you act in the pane. A model you pick applies to new sub-agents (`agent.spawn`) or to a running agent's next step (`turn.step`). Stopping an agent makes that step hand back a short report, and `tool.call` declines its further tool calls. A message you send joins the agent's conversation and the main session gets a note; both stay in the session transcript. A finished agent restarts with your message. While a message is unread, `tool.call` holds the agent's handback once.

Questions: github.com/MikeGT4/agent-tree/issues
