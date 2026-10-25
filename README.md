# Agent Tree

[Deutsch](README.de.md)

A terminal side pane for Claude Code that draws a session's agents as a tree of boxes: main session, sub-agents, the way back, the advisor and a session log.

![Agent Tree](docs/agent-tree-opener.gif)

## Install

```
/plugin install agent-tree --marketplace MikeGT4/agent-tree
```

Tested with 2.1.296 and 2.1.307 to 2.1.310; it needs the mod interface.

## Use

`/agent-tree` opens the pane, `/agent-tree stop` closes it, `/agent-tree clear` starts afresh. Click a type for its task, tools and latest answer, and to stop it. Clicking a model switches a running agent; "Model" sets it for new sub-agents. Keys: ctrl+x tab focuses the pane, m model, 0 to 4 pick, x close, s stop in the details.

Settings: width, agents kept, open on start, motion, language (auto, de, en).

Privacy: local only, sends nothing ([PRIVACY.md](PRIVACY.md)).

## License

MIT, © 2026 Mike Pollow, Digitalroots
