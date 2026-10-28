# Agent Tree

[English](README.md)

Seitenleiste für Claude Code im Terminal, die die Agenten einer Sitzung als lebenden Baum zeigt.

Laufende Unteragenten mit einem Klick stoppen, ihnen während der Arbeit neue Anweisungen geben, das Modell wechseln und der Leiste ein eigenes Aussehen geben.

![Agent Tree](https://github.com/MikeGT4/agent-tree/releases/download/v0.4.1/agent-tree-opener.gif)

## Installation

Im Terminal (nicht in Claude Code):

```bash
claude plugin install agent-tree --marketplace MikeGT4/agent-tree
```

Danach Claude Code starten und `/agent-tree` eingeben.

In einer laufenden Sitzung: `/plugin install agent-tree --marketplace MikeGT4/agent-tree`

Braucht Claude Code 2.1.292 oder neuer, getestet mit 2.1.312. Updates installieren sich einmal am Tag selbst.

## Bedienung

Ein Klick auf den Typ eines Agenten zeigt seinen Auftrag, dort bekommt er neue Anweisungen; ■ stoppt ihn.

Fünf Stile, vier Farbschemata, eine Lichtfarbe: Taste a in der Leiste.

Schritt für Schritt (englisch): [docs/GUIDE.md](docs/GUIDE.md)

Datenschutz: täglich eine Versionsabfrage, sonst nichts ([PRIVACY.md](PRIVACY.md)).

## Lizenz

MIT, © 2026 Mike Pollow, Digitalroots
