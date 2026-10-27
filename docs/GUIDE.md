# Agent Tree guide

1. Install inside Claude Code:
   `/plugin install agent-tree --marketplace MikeGT4/agent-tree`
   The install asks for your settings.
2. `/agent-tree` opens the pane. ctrl+x tab moves the focus into it.
3. The main box shows effort, context and cost; every sub-agent gets a box, answers return on the way back.
4. To switch a model, click a running agent's model, or select it with Tab and press m, then 0 to 4. "Model" sets it for new sub-agents.
5. Click an agent's type for its task and latest answer. Click into the field, type, press Enter to correct it at its next step; Esc leaves the field.
6. ■ on a box, or s in the details, stops an agent at its next step.
7. a opens the look: style, colors, light. `/agent-tree style braille` works too.
8. `/agent-tree stop` closes the pane, `/agent-tree clear` starts afresh.
