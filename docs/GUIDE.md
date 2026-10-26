# Agent Tree guide

1. Install inside Claude Code:
   `/plugin install agent-tree --marketplace MikeGT4/agent-tree`
   The install asks for your settings, language included.
2. `/agent-tree` opens the pane. ctrl+x tab moves the focus into it.
3. The main session box shows effort, context and cost. Every sub-agent gets a box of its own. Answers return on the way back, and the session log keeps each step. The advisor box counts the calls.
4. To switch a model, click a running agent's model, or select the agent with Tab and press m, then 0 to 4. Its next step runs on the new model. "Model" above the sub-agents picks one for new ones.
5. Click an agent's type for its task and latest answer. s stops it at its next step, x closes the details.
6. `/agent-tree stop` closes the pane, `/agent-tree clear` starts afresh.
