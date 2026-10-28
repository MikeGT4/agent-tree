# Agent Tree

[English](README.md)

Seitenleiste für Claude Code im Terminal, die die Agenten einer Sitzung als Kästen zeichnet: Hauptsitzung, Unteragenten, Rückweg, Berater und Sitzungsprotokoll.

![Agent Tree](https://github.com/MikeGT4/agent-tree/releases/download/v0.3.0/agent-tree-opener.gif)

## Installation

```
/plugin install agent-tree --marketplace MikeGT4/agent-tree
```

Getestet mit 2.1.309 bis 2.1.312, braucht die Mod-Schnittstelle. Updates: `/plugin` → Marketplaces → agent-tree → Enable auto-update.

## Bedienung

`/agent-tree` öffnet die Leiste, `/agent-tree stop` schließt sie, `/agent-tree clear` beginnt den Baum neu. Ein Klick auf den Typ zeigt Auftrag, Werkzeuge und letzte Antwort; dort lässt sich ein laufender Agent korrigieren, er liest die Nachricht beim nächsten Schritt. ■ stoppt einen Agenten, ein Klick aufs Modell stellt ihn um. Tasten: ctrl+x tab wählt die Leiste, m Modell, a Aussehen, x schließt.

Personalisierbar: fünf Stile (Linie, Pixel, Braille, HUD, ASCII), vier Farbschemata, eine Lichtfarbe. Der Berater-Kasten schaltet den Berater ein und aus.

Datenschutz: nur lokal, sendet nichts ([PRIVACY.md](PRIVACY.md)).

## Lizenz

MIT, © 2026 Mike Pollow, Digitalroots
