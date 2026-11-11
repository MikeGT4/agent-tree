# Agent Tree

[Deutsch](README.de.md)

A side pane for Claude Code that shows a session's agents as a live tree.

Stop and correct running sub-agents, switch their model and effort, set the main session's effort, toggle the advisor, change the look, watch your limits.

Tabs: each agent's full report, files, log, usage.

<img src="https://github.com/MikeGT4/agent-tree/releases/download/v0.7.1/readme-agent-tree-6.gif" width="560" alt="Demo of the functions above">

## Install

In your terminal:

```bash
claude plugin install agent-tree --marketplace MikeGT4/agent-tree
```

Then start Claude Code; the pane opens.

Inside a session: `/plugin install agent-tree --marketplace MikeGT4/agent-tree`

Needs Claude Code 2.1.292+, tested with 2.1.322.

## What it runs

Once a day, in interactive sessions, it runs Claude Code's `plugin list --json`, reads its version from raw.githubusercontent.com and, if newer, runs `plugin update agent-tree`. It sends nothing else ([PRIVACY.md](PRIVACY.md)).

Its hooks act only after you act in the pane; typing only ends the start intro.

[Guide](docs/GUIDE.md) · [PDF](https://github.com/MikeGT4/agent-tree/releases/download/v0.7.2/agent-tree-guide.pdf)

MIT, © 2026 Mike Pollow, Digitalroots
