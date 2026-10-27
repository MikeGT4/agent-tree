# Agent Tree guide

1. Install inside Claude Code:
   `/plugin install agent-tree --marketplace MikeGT4/agent-tree`
2. `/agent-tree` opens the pane. ctrl+x tab moves the focus into it.
3. The main box shows effort, context and cost; each sub-agent gets a box.
4. Click a running agent's model, or Tab to it and press Enter, then pick 0 to 4. "Sub-agent model" (m) sets new ones.
5. Click an agent's type for its task and latest answer. Click into the field, type, press Enter to correct it at its next step; Esc leaves the field.
6. ■ on a box or the stop button in the details stops an agent.
7. a opens the look: style, colors, glow. `/agent-tree style braille` works too.
8. The advisor box turns the advisor on or off as your default.
9. `/agent-tree stop` closes the pane, `/agent-tree clear` starts afresh.
