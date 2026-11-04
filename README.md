# Golf 4 TDI Motor Simulator

Eine interaktive Web-App zur Simulation des Motorverhaltens eines VW Golf 4 1.9 TDI. Die Anwendung simuliert realistisch Drehzahl, Geschwindigkeit, Gangwechsel und Motorcharakteristik eines Dieselmotors.

![Golf 4 TDI Simulator Screenshot](https://via.placeholder.com/600x400/0b1015/ffffff?text=Golf+4+TDI+Simulator)

## Features

- **Realistische Motorphysik**
  - Physikalisch korrekte Übersetzungsverhältnisse (Motor zu Rad)
  - Authentisches Dieselmotor-Verhalten (Motorbremse, langsamer Drehzahlanstieg)
  - Realistische Schaltpunkte (Hochschalten bei 2000 U/min, Runterschalten bei 1200 U/min)

- **Interaktive Steuerung**
  - Gas- und Bremspedal (halten zum Aktivieren)
  - Motor Start/Stop
  - Manuelle Gangwahl durch Klicken auf die Gang-Buttons
  - Manuelle Drehzahlvorgabe via Slider
  - Geschwindigkeits- und Lastregelung via Slider

- **Visuelles Feedback**
  - Echtzeit-Tachometer mit Drehzahlbalken
  - Ganganzeige mit aktuellem Gang
  - Geschwindigkeits- und Drehzahlanzeige
  - Gelbe/rote Markierungen für Schaltpunkte (1200 U/min, 2000 U/min)

- **Audio**
  - Leerlauf- und Fahr-Samples
  - Dynamischer Drehzahl-Anstieg beim Gasgeben
  - Benutzerdefinierte Audio-Samples können hochgeladen werden

## Verwendung

### Lokale Nutzung
1. Klone das Repository oder lade die Dateien herunter
2. Öffne `index.html` in einem modernen Browser (Chrome, Firefox, Safari, Edge)
3. Klicke auf "Motor Starten" um die Simulation zu beginnen

### GitHub Pages
1. Erstelle ein neues GitHub Repository
2. Lade alle Dateien (inkl. `icons/` und `audio/` Ordner) hoch
3. Aktiviere GitHub Pages in den Repository-Einstellungen
4. Die App ist dann unter `https://[dein-benutzername].github.io/[repository-name]/` erreichbar

## Dateistruktur

```
golf4_tdi_racing/
├── index.html          # Haupt-HTML-Datei
├── style.css           # Stylesheets
├── script.js           # Haupt-JavaScript-Logik
├── manifest.webmanifest # PWA Manifest
├── sw.js               # Service Worker (optional)
├── README.md           # Diese Datei
├── icons/              # App-Icons
│   ├── favicon.ico
│   ├── favicon.svg
│   ├── favicon-96x96.png
│   ├── apple-touch-icon.png
│   ├── web-app-manifest-192x192.png
│   └── web-app-manifest-512x512.png
└── audio/              # Audio-Samples
    ├── leerlauf-loop.mp3
    ├── fahr-loop.mp3
    └── drehzahl-anhebung.mp3
```

## Technische Details

### Übersetzungsverhältnisse (Motor zu Rad)

| Gang | Verhältnis | Beispiel (2000 U/min) |
|------|------------|------------------------|
| 1    | 12.804     | ~17.8 km/h             |
| 2    | 6.991      | ~32.4 km/h             |
| 3    | 4.568      | ~49.1 km/h             |
| 4    | 3.277      | ~68.4 km/h             |
| 5    | 2.521      | ~88.1 km/h             |

### Schaltpunkte
- **Hochschalten**: 2000 U/min
- **Runterschalten**: 1200 U/min

### Geschwindigkeitsberechnung
```
Geschwindigkeit (km/h) = RPM × 0.114 / Übersetzungsverhältnis
```

### Motorbremse
- Beim Runterschalten: Geschwindigkeit wird um 2% reduziert
- Drehzahl steigt entsprechend dem Übersetzungsverhältnis

## Browser-Kompatibilität

- **Chrome**: Voll unterstütz (empfohlen)
- **Firefox**: Voll unterstützt
- **Safari**: Voll unterstützt (iOS & macOS)
- **Edge**: Voll unterstützt
- **Mobile Browser**: Voll unterstützt (Touch-optimiert)

**Hinweis**: Die Web Audio API muss verfügbar sein. Für beste Ergebnisse HTTPS oder localhost verwenden.

## Audio-Samples

Die Simulation verwendet drei Audio-Dateien:
1. **leerlauf-loop.mp3** - Leerlauf-Sound (Loop)
2. **fahr-loop.mp3** - Fahr-Sound (Loop)
3. **drehzahl-anhebung.mp3** - Drehzahl-Anstieg (einmalig beim Gasgeben)

### Benutzerdefinierte Samples
Im Abschnitt "Audio-Quellen & Hinweise" können eigene Audio-Dateien hochgeladen werden:
- Leerlauf-Sample (ersetzt leerlauf-loop.mp3)
- Fahr-Sample (ersetzt fahr-loop.mp3)

**Wichtig**: Audiodateien werden nur lokal verarbeitet und nicht an Server übertragen.

## Lizenz

Dieses Projekt ist für den persönlichen Gebrauch bestimmt. Die Audio-Samples unterliegen möglicherweise Urheberrechten.

## Beitrag

Pull Requests sind willkommen. Bitte stellt sicher, dass:
- Die Übersetzungsverhältnisse realistisch bleiben
- Das Dieselmotor-Verhalten erhalten bleibt
- Die Benutzeroberfläche intuitiv bleibt

## Credits

- **Motor-Daten**: Basierend auf VW Golf 4 1.9 TDI Spezifikationen
- **Audio-Engine**: Web Audio API
- **Design**: Responsives, mobiles First

---

**Erstellt mit Web Audio API und Vanilla JavaScript**
