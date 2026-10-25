# Privacy

Agent Tree runs inside Claude Code on your machine. It sends no data anywhere and makes no network requests of its own. To draw the pane it reads the running session's events: agent types and descriptions, models, tasks, tool names, latest answers, timings, context use and cost. It keeps this in memory for the running session only and writes no files. There is no telemetry, no account and no cookie.

## Hooks

Three hooks change what happens, and only after you act in the pane. If you picked a model for new sub-agents, `agent.spawn` starts them with it. If you picked a model for a running agent, `turn.step` runs its next step on it, and if you stop an agent, that step hands back a short report instead. `tool.call` declines further tool calls of an agent you stopped. The other hooks only read events.

Questions: github.com/MikeGT4/agent-tree/issues
