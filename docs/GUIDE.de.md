# Agent Tree Anleitung

Agent Tree zeigt deine Agenten in Claude Code als lebenden Baum neben dem Chat, mit einem Hebel für jeden.

## Was du siehst

![Baum](https://github.com/MikeGT4/agent-tree/releases/download/v0.7.0/guide-de-1.png)

Hauptsitzung: Modell, Denkstufe, Kontext, Kosten.

Kasten je Unteragent: Aufgabe, aktueller Schritt, Kontext (gelb ab 70 %, rot ab 85 %).

⚠: Zwei laufende Agenten ändern dieselbe Datei.

## Was du tun kannst

![Aktionszeile](https://github.com/MikeGT4/agent-tree/releases/download/v0.7.0/guide-de-2.png)

Kasten anklicken, oder ctrl+x tab, Tab, Enter: Stoppen (s), Schreiben, Modell, Denkstufe, Details.

Schreiben füllt deine Eingabe, der Agent liest sie beim nächsten Schritt.

e: Denkstufe der Hauptsitzung, m: neue Unteragenten, a: Aussehen.

## Tabs

![Berichte](https://github.com/MikeGT4/agent-tree/releases/download/v0.7.0/guide-de-3.png)

Berichte: Aufgabe und ganze Antwort jedes Agenten.

![Dateien](https://github.com/MikeGT4/agent-tree/releases/download/v0.7.0/guide-de-4.png)

Dateien: geändert und gelesen je Agent, doppelte oben. Gelesene mit geschätzten Tokens (~), die schwerste zuerst.

![Verbrauch](https://github.com/MikeGT4/agent-tree/releases/download/v0.7.0/guide-de-5.png)

Verbrauch: Limits, Kontext, Werkzeugaufrufe, Laufzeit.

![Verlauf](https://github.com/MikeGT4/agent-tree/releases/download/v0.7.0/guide-de-6.png)

Verlauf: jedes Ereignis, nach Quelle.

![Hilfe](https://github.com/MikeGT4/agent-tree/releases/download/v0.7.2/guide-de-7.png)

Hilfe: Tasten, Zeichen, Befehle.

## Code Mode

Läuft Claude Code im Code Mode, steht „CODE MODE“ im Titel. Jeder Codeblock eines Agenten zählt als Schritt („führt Code aus“), die Aufrufe darin erscheinen einzeln. Stoppen: Der laufende Aufruf endet noch, jeder weitere aus dem Code des Agenten wird abgelehnt, auch wenn der Code den Agenten überdauert. Schreiben: Die Nachricht erreicht den laufenden Agenten. Endet er, bevor er sie liest, bleibt sie als „geschickt“ stehen; nach einem Stopp gilt sie als „nicht zugestellt“.

## Nach einem Update

Startet Agent Tree zum ersten Mal in einer neuen Version, steht für 3 Sekunden eine Karte in der Leiste: alte und neue Versionsnummer und was neu ist. Ein Klick auf „weiter“ oder Tippen schließt sie früher. Nach einer Erstinstallation kommt keine Karte.

## Was es dir bringt

Einen Agenten stoppen statt der ganzen Sitzung.

Einen laufenden Agenten auf ein günstigeres Modell setzen.
