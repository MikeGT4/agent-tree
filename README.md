# Agent Tree

[Deutsch](README.de.md)

A terminal side pane for Claude Code that draws a session's agents as a tree of boxes: main session, sub-agents, the way back, the advisor and a session log.

![Agent Tree](https://github.com/MikeGT4/agent-tree/releases/download/v0.3.0/agent-tree-opener.gif)

## Install

```
/plugin install agent-tree --marketplace MikeGT4/agent-tree
```

Tested with 2.1.309 to 2.1.311; it needs the mod interface.

## Use

`/agent-tree` opens the pane, `/agent-tree stop` closes it, `/agent-tree clear` starts afresh. Click a type for task, tools and latest answer; type there to correct a running agent at its next step. ■ stops an agent, a click on its model switches it. Keys: ctrl+x tab focuses the pane, m model, a look, x close.

Customizable: five styles (line, pixel, braille, HUD, ASCII), four color schemes, a light color. Settings: width, agents kept, open on start, motion, language.

Privacy: local only, sends nothing ([PRIVACY.md](PRIVACY.md)).

## License

MIT, © 2026 Mike Pollow, Digitalroots
