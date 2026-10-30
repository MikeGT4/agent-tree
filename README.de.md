# Agent Tree

[English](README.md)

Seitenleiste für Claude Code, die die Agenten einer Sitzung als lebenden Baum zeigt.

Die Denkstufe der Hauptsitzung einstellen, laufende Unteragenten stoppen und korrigieren, ihr Modell und ihre Denkstufe wechseln, das Aussehen ändern, 5-Stunden- und Wochenlimit im Blick behalten.

![Agent-Tree-Leiste mit Agenten-Kästen](https://github.com/MikeGT4/agent-tree/releases/download/v0.5.4/readme-agent-tree.gif)

## Installation

Im Terminal (nicht in Claude Code):

```bash
claude plugin install agent-tree --marketplace MikeGT4/agent-tree
```

Danach Claude Code starten, die Leiste öffnet sich von selbst.

In einer laufenden Sitzung: `/plugin install agent-tree --marketplace MikeGT4/agent-tree`

Braucht Claude Code 2.1.292 oder neuer, getestet mit 2.1.314.

## Was es ausführt

Einmal am Tag, in Sitzungen mit Bedienung, ruft es Claude Codes `plugin list --json` auf, liest seine Versionsnummer von raw.githubusercontent.com und startet bei einer neueren `plugin update agent-tree`. Sonst sendet es nichts ([PRIVACY.md](PRIVACY.md)).

Seine Hooks greifen nur, wenn du in der Leiste handelst; Tippen in der Eingabe beendet nur das Start-Intro.

Anleitung (englisch): [docs/GUIDE.md](docs/GUIDE.md)

MIT, © 2026 Mike Pollow, Digitalroots
