# Lokales Modell

[English](LOCAL.md)

Agent Tree kann einfache Aufgaben an ein Modell auf deinem Rechner abgeben, sodass Claude Code für Zusammenfassungen oder Umformatieren weniger Tokens braucht.

## Einrichten

1. Ollama (ollama.com) oder LM Studio (lmstudio.ai) installieren.
2. Ein kleines Modell laden, etwa `ollama pull qwen2.5:3b`.
3. In der Leiste auf „Lokales Modell einrichten“ klicken, das Modell und die Stufe wählen.

„Einrichten lassen“ legt diese Schritte in deine Eingabe, und Claude Code fragt vor jedem Befehl.

## Stufen

Bei „aus“ gibt es kein Werkzeug, bei „auf Zuruf“ nur, wenn du danach fragst, und bei „selbstständig“ gibt Claude Code längere Texte von sich aus ab.

## Gut zu wissen

Kurze Aufgaben erledigt Claude Code selbst, weil der Aufruf mehr kosten würde, als er spart. Das lokale Modell sieht nur den Text, den es bekommt, und der geht nur an die gewählte Adresse. Kosten und Verlauf zählen jeden Aufruf.
