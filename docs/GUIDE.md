# Agent Tree guide

1. In your terminal, then start Claude Code:
   `claude plugin install agent-tree --marketplace MikeGT4/agent-tree`
2. The pane opens by itself with the Agent Tree logo (click or type to skip); `/agent-tree` reopens it, ctrl+x tab focuses it.
3. The main box shows effort (e sets it), context and cost; sub-agents get boxes; the bottom line shows 5-hour and weekly limits.
4. Click a running agent's model (or Tab, Enter): pick an effort, then a model (0 to 4). "Sub-agent model" (m) sets both for new sub-agents and keeps them.
5. ✎ on a box puts `/agent-tree to <id>` into your prompt: type, press Enter; the agent reads it at its next step. Its type opens its details.
6. ■ on a box stops an agent.
7. a opens the look: style, colors, glow.
8. The advisor box switches your default advisor.
9. `/agent-tree stop` closes the pane, `/agent-tree clear` starts afresh.
