# Agent Tree

[Deutsch](README.de.md)

A side pane for Claude Code that shows a session's agents as a live tree.

Set the main session's effort, stop and correct running sub-agents, switch their model and effort, change the look, watch 5-hour and weekly limits.

![Agent Tree pane with sub-agent boxes](https://github.com/MikeGT4/agent-tree/releases/download/v0.5.4/readme-agent-tree.gif)

## Install

In your terminal (not inside Claude Code):

```bash
claude plugin install agent-tree --marketplace MikeGT4/agent-tree
```

Then start Claude Code; the pane opens.

Inside a session: `/plugin install agent-tree --marketplace MikeGT4/agent-tree`

Needs Claude Code 2.1.292 or later, tested with 2.1.314.

## What it runs

Once a day, in interactive sessions, it runs Claude Code's `plugin list --json`, reads its version number from raw.githubusercontent.com and, when a newer one exists, runs `plugin update agent-tree`. It sends nothing else ([PRIVACY.md](PRIVACY.md)).

Its hooks act only after you act in the pane; typing in the prompt only ends the start intro.

Guide: [docs/GUIDE.md](docs/GUIDE.md)

MIT, © 2026 Mike Pollow, Digitalroots
