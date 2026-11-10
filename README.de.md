# Agent Tree

[English](README.md)

Seitenleiste für Claude Code, die die Agenten einer Sitzung als lebenden Baum zeigt.

Laufende Unteragenten stoppen und korrigieren, ihr Modell und ihre Denkstufe wechseln, die Denkstufe der Hauptsitzung einstellen, den Berater umschalten, das Aussehen ändern, die Limits sehen.

Tabs: ganzer Bericht jedes Agenten, Dateien, Verlauf, Verbrauch.

<img src="https://github.com/MikeGT4/agent-tree/releases/download/v0.7.1/readme-agent-tree-5.gif" width="560" alt="Demo der Funktionen oben">

## Installation

Im Terminal:

```bash
claude plugin install agent-tree --marketplace MikeGT4/agent-tree
```

Danach Claude Code starten, die Leiste öffnet sich.

In einer Sitzung: `/plugin install agent-tree --marketplace MikeGT4/agent-tree`

Braucht Claude Code 2.1.292+, getestet mit 2.1.322.

## Was es ausführt

Einmal am Tag, in Sitzungen mit Bedienung, ruft es Claude Codes `plugin list --json` auf, liest seine Version von raw.githubusercontent.com und startet bei einer neueren `plugin update agent-tree`. Sonst sendet es nichts ([PRIVACY.md](PRIVACY.md)).

Seine Hooks greifen nur, wenn du in der Leiste handelst; Tippen beendet nur das Start-Intro.

[Anleitung](docs/GUIDE.de.md) · [PDF](https://github.com/MikeGT4/agent-tree/releases/download/v0.7.0/agent-tree-anleitung.pdf)

MIT, © 2026 Mike Pollow, Digitalroots
