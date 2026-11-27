# Agent Tree

[Deutsch](README.de.md)

A side pane for Claude Code that shows a session's agents as a live tree.

Stop and correct running sub-agents, switch model and effort for them and the main session, toggle the advisor, change the look, watch your limits.

Tabs: full reports, files, log, cost, terminals.

Optional: Claude Code hands simple tasks to your [local model](docs/LOCAL.md) (Ollama, LM Studio) and saves tokens.

<a href="https://github.com/MikeGT4/agent-tree/releases/download/v0.7.21/agent-tree-tour.mp4"><img src="https://github.com/MikeGT4/agent-tree/releases/download/v0.7.21/agent-tree-tour.jpg" width="560" alt="Video tour"></a>

## Install

In your terminal:

```bash
claude plugin install agent-tree --marketplace MikeGT4/agent-tree
```

Then start Claude Code; the pane opens.

Inside a session: `/plugin install agent-tree --marketplace MikeGT4/agent-tree`

Needs Claude Code 2.1.292+, tested with 2.1.328.

## What it runs

Once a day it reads the latest version from raw.githubusercontent.com and, if newer, runs `plugin update agent-tree`. Beyond that it sends only the tasks for a local model you set ([PRIVACY.md](PRIVACY.md)).

[Guide](docs/GUIDE.md) · [PDF](https://github.com/MikeGT4/agent-tree/releases/download/v0.7.20/agent-tree-guide.pdf)

MIT, © 2026 Mike Pollow, [Digitalroots](https://www.digitalroots.de/en/leistungen/software/agent-tree/)
