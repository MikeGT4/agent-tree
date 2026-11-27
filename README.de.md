# Agent Tree

[English](README.md)

Seitenleiste für Claude Code, die die Agenten einer Sitzung als lebenden Baum zeigt.

Laufende Unteragenten stoppen und korrigieren, Modell und Denkstufe wechseln, auch für die Hauptsitzung, den Berater umschalten, das Aussehen ändern, die Limits sehen.

Tabs: ganzer Bericht jedes Agenten, Dateien, Verlauf, Kosten, andere Terminals.

Wahlweise gibt Claude Code einfache Aufgaben an dein [lokales Modell](docs/LOCAL.de.md) (Ollama, LM Studio) und spart Tokens.

<a href="https://github.com/MikeGT4/agent-tree/releases/download/v0.7.21/agent-tree-tour.mp4"><img src="https://github.com/MikeGT4/agent-tree/releases/download/v0.7.21/agent-tree-tour.jpg" width="560" alt="Videotour"></a>

## Installation

Im Terminal:

```bash
claude plugin install agent-tree --marketplace MikeGT4/agent-tree
```

Danach Claude Code starten, die Leiste öffnet sich.

In einer Sitzung: `/plugin install agent-tree --marketplace MikeGT4/agent-tree`

Braucht Claude Code 2.1.292+, getestet mit 2.1.328.

## Was es ausführt

Einmal am Tag liest es die neueste Version von raw.githubusercontent.com und startet bei einer neueren `plugin update agent-tree`. Sonst sendet es nur die Aufgaben an ein lokales Modell, das du einträgst ([PRIVACY.md](PRIVACY.md)).

[Anleitung](docs/GUIDE.de.md) · [PDF](https://github.com/MikeGT4/agent-tree/releases/download/v0.7.20/agent-tree-anleitung.pdf)

MIT, © 2026 Mike Pollow, [Digitalroots](https://www.digitalroots.de/leistungen/software/agent-tree/)
