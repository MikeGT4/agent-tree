# Agent Tree

[Deutsch](README.de.md)

A terminal side pane for Claude Code that shows a session's agents as a live tree.

Stop a running sub-agent with one click, send it new instructions while it works, switch its model, and give the pane your own look.

![Agent Tree](https://github.com/MikeGT4/agent-tree/releases/download/v0.4.1/agent-tree-opener.gif)

## Install

In your terminal (not inside Claude Code):

```bash
claude plugin install agent-tree --marketplace MikeGT4/agent-tree
```

Then start Claude Code and type `/agent-tree`.

Inside a session: `/plugin install agent-tree --marketplace MikeGT4/agent-tree`

Needs Claude Code 2.1.292 or later, tested with 2.1.312. Updates install themselves once a day.

## Use

Click an agent's type to see its task and send it new instructions; ■ stops it.

Five styles, four color schemes, a glow color: press a in the pane.

Step by step: [docs/GUIDE.md](docs/GUIDE.md)

Privacy: one version check a day, nothing else ([PRIVACY.md](PRIVACY.md)).

## License

MIT, © 2026 Mike Pollow, Digitalroots
