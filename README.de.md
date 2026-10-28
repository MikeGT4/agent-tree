# Agent Tree

[English](README.md)

Seitenleiste für Claude Code, die die Agenten einer Sitzung als lebenden Baum zeigt.

Laufende Unteragenten stoppen, ihnen während der Arbeit neue Anweisungen geben, das Modell wechseln, das Aussehen ändern.

![Agent Tree](https://github.com/MikeGT4/agent-tree/releases/download/v0.4.1/agent-tree-opener.gif)

## Installation

Im Terminal (nicht in Claude Code):

```bash
claude plugin install agent-tree --marketplace MikeGT4/agent-tree
```

Danach Claude Code starten, die Leiste öffnet sich von selbst.

In einer laufenden Sitzung: `/plugin install agent-tree --marketplace MikeGT4/agent-tree`

Braucht Claude Code 2.1.292 oder neuer, getestet mit 2.1.312.

## Was es ausführt

Einmal am Tag, in Sitzungen mit Bedienung, ruft es Claude Codes `plugin list --json` auf, liest seine Versionsnummer von raw.githubusercontent.com und startet bei einer neueren `plugin update agent-tree`. Sonst sendet es nichts ([PRIVACY.md](PRIVACY.md)).

Seine Hooks greifen nur, wenn du in der Leiste handelst: Modellwahl, Stopp, neue Anweisung, Berater-Knopf (`/advisor`).

Anleitung (englisch): [docs/GUIDE.md](docs/GUIDE.md)

MIT, © 2026 Mike Pollow, Digitalroots
