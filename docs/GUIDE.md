# Agent Tree guide

1. In your terminal, then start Claude Code:
   `claude plugin install agent-tree --marketplace MikeGT4/agent-tree`
2. The pane opens by itself; `/agent-tree` reopens it, ctrl+x tab focuses it.
3. The main box shows effort, context and cost; sub-agents get boxes.
4. Click a running agent's model, or Tab to it and press Enter: pick a model (0 to 4) and an effort. "Sub-agent model" (m) sets both for sub-agents, even over an agent's own model, and keeps them.
5. Click an agent's type for its task, latest answer and a message field: type, press Enter to correct it at its next step.
6. ■ on a box or in the details stops an agent.
7. a opens the look: style, colors, glow, also `/agent-tree style braille`.
8. The advisor box switches the advisor as your default.
9. `/agent-tree stop` closes the pane, `/agent-tree clear` starts afresh.
