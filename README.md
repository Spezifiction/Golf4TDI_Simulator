# Golf 4 TDI Motor Simulator

Eine interaktive Web-App zur realistischen Simulation des Motorverhaltens eines **VW Golf 4 1.9 TDI**. Die Anwendung simuliert Drehzahl, Geschwindigkeit, Gangwechsel und Motorcharakteristik mit physikalisch korrekten Übersetzungsverhältnissen und authentischem Dieselmotor-Verhalten.

Seite über folgenden Link öffnen:

https://spezifiction.github.io/Golf4TDI_Simulator/

## ✨ Features

### 🔧 Realistische Motorphysik
- **Physikalisch korrekte Übersetzungsverhältnisse** (Motor zu Rad) basierend auf Golf 4 TDI 1.9 Spezifikationen
- **Authentisches Dieselmotor-Verhalten**: langsamer Drehzahlanstieg, Motorbremse beim Runterschalten
- **Realistische Schaltpunkte**: Hochschalten bei **2000 U/min**, Runterschalten bei **1200 U/min**
- **Geschwindigkeitsberechnung**: `v (km/h) = RPM × 0.114 / Übersetzungsverhältnis`

### 🎮 Interaktive Steuerung
- **Gas- und Bremspedal** (halten zum Aktivieren, mit Trägheit für realistische Reaktion)
- **Motor Start/Stop** – Motor ist bei 0 U/min und ohne Ton
- **Manuelle Gangwahl** durch Klicken auf die Gang-Buttons (N, 1, 2, 3, 4, 5)
- **Manuelle Drehzahlvorgabe** via Slider
- **Geschwindigkeits- und Lastregelung** via Slider
- **Stadtfahrt-Modus** (30s Endlosloop mit Anfahren, Beschleunigen, Schalten, Bremsen, Ampelstopp)

### 🎨 Visuelles Feedback
- **Echtzeit-Tachometer** mit Drehzahlbalken (blau-lila Farbschema wie Golf 4 Tacho)
- **Ganganzeige** mit aktuellem Gang und farbiger Hervorhebung
- **Geschwindigkeits- und Drehzahlanzeige** in Echtzeit
- **Rote Markierungslinien** für Schaltpunkte (1200 U/min, 2000 U/min)
- **Golf 4 Tacho-Design**: dunkler Hintergrund (#05080d), lila-blaue Ziffern (#7a8fc8), rote Akzente (#ff3300)

### 🔊 Audio
- **Leerlauf-Loop** und **dezent zugemischter Fahr-Loop** für kontinuierlichen Sound; das hochfrequente Diesel-Nageln wird bei steigender Drehzahl durch geringeren Fahr-Layer-Pegel, langsamere Sample-Wiedergabe und einen tieferen Filter reduziert.
- **Dynamischer Drehzahl-Anstieg** beim Gasgeben
- **Benutzerdefinierte Audio-Samples** können hochgeladen werden (Leerlauf & Fahrt)
- **iOS-kompatibel**: Audio wird nach erster Nutzerinteraktion (z.B. "Motor Starten") aktiviert

### 📱 Plattformunterstützung
- **Responsive Design**: Optimiert für Mobile, Tablet und Desktop
- **PWA-fähig**: Kann als App auf dem Homescreen installiert werden (Android/iOS)
- **Touch-optimiert**: Große Bedienelemente für Touchscreens

## 📥 Verwendung

### Lokale Nutzung
1. Klone das Repository oder lade alle Dateien herunter
2. Stelle sicher, dass die Ordnerstruktur erhalten bleibt:
   ```
   golf4_tdi_racing/
   ├── index.html
   ├── style.css
   ├── script.js
   ├── manifest.webmanifest
   ├── icons/
   │   ├── favicon.ico
   │   ├── favicon.svg
   │   ├── favicon-96x96.png
   │   ├── apple-touch-icon.png
   │   ├── web-app-manifest-192x192.png
   │   └── web-app-manifest-512x512.png
   └── audio/
       ├── leerlauf-loop.mp3
       ├── fahr-loop.mp3
       └── drehzahl-anhebung.mp3
   ```
3. Öffne `index.html` in einem modernen Browser (Chrome, Firefox, Safari, Edge)
4. Klicke auf **"MOTOR STARTEN"** um die Simulation zu beginnen
5. Nutze die Gas/Bremspedale oder Slider für die Steuerung

### Wichtig für Audio
- **HTTPS oder localhost** erforderlich (Browser-Beschränkung für Web Audio API)
- **Erste Nutzerinteraktion** nötig (z.B. "Motor Starten" klicken) bevor Audio funktioniert
- Auf iOS muss der Benutzer zuerst eine Interaktion durchführen

## 📊 Technische Details

### Übersetzungsverhältnisse (Motor zu Rad)
| Gang | Verhältnis | Beispiel bei 2000 U/min |
|------|------------|--------------------------|
| 1    | 12.804     | ~17.8 km/h               |
| 2    | 6.991      | ~32.4 km/h               |
| 3    | 4.568      | ~49.1 km/h               |
| 4    | 3.277      | ~68.4 km/h               |
| 5    | 2.521      | ~88.1 km/h               |

### Schaltpunkte
- **Hochschalten**: **2000 U/min** (rote Markierung im Tachometer)
- **Runterschalten**: **1200 U/min** (rote Markierung im Tachometer)
- **Schaltverzögerung**: 600ms (realistisch für manuelles Getriebe)

### Geschwindigkeitsberechnung
```
Geschwindigkeit (km/h) = RPM × 0.114 / Übersetzungsverhältnis
```

### Motorbremse
- Beim **Runterschalten**: Geschwindigkeit wird um 2% reduziert
- Drehzahl steigt entsprechend dem neuen Übersetzungsverhältnis

### Drehzahlberechnung
```
Ziel-RPM = Leerlaufdrehzahl (850) + Last × (Max-RPM - Leerlaufdrehzahl)
Leerlaufdrehzahl = 850 U/min
Max-RPM = 4200 U/min
```

### Stadtfahrt-Modus
- **30-Sekunden-Endlosloop** mit Geschwindigkeitsprofil: Anfahren, Schalten, Konstantfahrt bei ca. 45–50 km/h, Verzögern, Ampelstopp und anschließende Wartephase bis zum nächsten Anfahren.
- Die Stadtfahrt verwendet feste Geschwindigkeitsziele mit begrenzter Beschleunigung und Verzögerung. Die Motordrehzahl folgt Geschwindigkeit und Gang mit kurzer Trägheit, damit Schaltvorgänge nicht sprunghaft klingen. Sie wird nicht direkt aus der Gaspedal-Last bis zur Maximaldrehzahl hochgeregelt.
- Beim Ampelstopp wird die Geschwindigkeit auf 0 km/h abgebremst; die Motordrehzahl bleibt im Leerlauf.
- **Manuelle Übersteuerung**: Nutzeraktionen (Gas, Bremse, Gangwahl oder manuelle Drehzahlvorgabe) beenden den Stadtfahrt-Modus.

## 🎨 Farbdesign (Golf 4 Tacho)
- **Hintergrund**: Dunkelblau/Schwarz (#05080d)
- **Ziffern & Skala**: Lila-Blau (#7a8fc8)
- **Schaltpunkt-Markierungen**: Rot (#ff0000)
- **Aktiver Gang**: Rot (#ff3300) auf blauem Hintergrund
- **Tachometer-Füllung**: Gradient von #2a385c zu #4a5c8a zu #7a8fc8

## 📁 Dateistruktur
```
golf4_tdi_racing/
├── index.html              # Haupt-HTML-Datei
├── style.css               # Stylesheets (Golf 4 Tacho-Design)
├── script.js               # Haupt-JavaScript-Logik
├── manifest.webmanifest    # PWA Manifest für App-Installation
├── README.md               # Diese Datei
├── icons/                  # App-Icons für alle Plattformen
│   ├── favicon.ico
│   ├── favicon.svg
│   ├── favicon-96x96.png
│   ├── apple-touch-icon.png          # iOS Home-Bildschirm (180x180)
│   ├── web-app-manifest-192x192.png  # Android PWA
│   └── web-app-manifest-512x512.png  # Android (hochauflösend)
└── audio/                  # Audio-Samples
    ├── leerlauf-loop.mp3   # Leerlauf-Sound (Loop)
    ├── fahr-loop.mp3        # Fahr-Sound (Loop)
    └── drehzahl-anhebung.mp3 # Drehzahl-Anstieg (einmalig)
```

## 🌐 Browser-Kompatibilität
| Browser       | Unterstützung | Hinweise |
|---------------|---------------|----------|
| Chrome        | ✅ Voll       | Empfohlen |
| Firefox       | ✅ Voll       |          |
| Safari        | ✅ Voll       | iOS & macOS |
| Edge          | ✅ Voll       |          |
| Mobile Browser| ✅ Voll       | Touch-optimiert |

**Voraussetzung**: Web Audio API muss verfügbar sein. Für beste Ergebnisse **HTTPS** oder **localhost** verwenden.

## 🔊 Audio-Samples
Die Simulation verwendet fünf Audio-Dateien:
1. **leerlauf-loop.mp3** – Leerlauf-Sound Golf 4 TDI (Loop)
2. **leerlauf-t5-loop.mp3** – Leerlauf-Sound T5 TDI (Loop)
3. **fahr-loop.mp3** – Fahr-Sound Golf 4 TDI (Loop)
4. **fahrt-t5-cruise-loop.mp3** – Fahr-Sound T5 TDI (Loop)
4. **ffahrt-t5-last-loop.mp3** – Fahr-Sound T5 TDI mit höherer Last (Loop)
5. **drehzahl-anhebung.mp3** – Drehzahl-Anstieg (wird beim Gasgeben abgespielt)

### Benutzerdefinierte Samples
Im Abschnitt **"Audio-Quellen & Hinweise"** können eigene Audio-Dateien hochgeladen werden:
- **Leerlauf-Sample** (ersetzt `leerlauf-loop.mp3`)
- **Fahr-Sample** (ersetzt `fahr-loop.mp3`)

**Wichtig**:
- Audiodateien werden **nur lokal** verarbeitet
- Keine Übertragung an Server
- Format: MP3 empfohlen
- Das Drehzahl-Sweep-Sample ist fest integriert

## 📝 Changelog / Letzte Änderungen
- **Farben**: An Golf 4 Tacho angepasst (lila-blaue Ziffern statt Babyblau)
- **Schaltpunkte**: Gelbe/rote Markierungen bei 1200 U/min und 2000 U/min
- **Stadtfahrt-Modus**: 30s Endlosloop mit realistischer Abfolge
- **Manueller Modus**: Gangwechsel per Klick, Drehzahlvorgabe via Slider
- **Motorbremse**: Realistische Verzögerung beim Runterschalten
- **PWA**: Icons für Android/iOS/Homescreen hinzugefügt

## 🛠️ Beitrag
Pull Requests sind willkommen! Bitte beachte:
- **Übersetzungsverhältnisse** müssen realistisch bleiben
- **Dieselmotor-Verhalten** sollte erhalten bleiben (langsamer Drehzahlanstieg, Motorbremse)
- **Benutzeroberfläche** sollte intuitiv bleiben
- **Farben** sollten dem Golf 4 Tacho entsprechen (#7a8fc8 für Ziffern, #05080d für Hintergrund)

## 📄 Lizenz
Dieses Projekt ist für den **persönlichen Gebrauch** bestimmt. Die Audio-Samples unterliegen möglicherweise Urheberrechten.

## 🙏 Credits
- **Motor-Daten**: Basierend auf VW Golf 4 1.9 TDI Spezifikationen
- **Audio-Engine**: Web Audio API
- **Design**: Responsives, mobiles First mit Golf 4 Tacho-Farben

---

**Erstellt mit Web Audio API und Vanilla JavaScript**


## Aktualisierte Bedienung (v5)

- Das Soundmodell ist fest integriert; eigene Audiosamples können nicht mehr hochgeladen werden.
- Die automatischen Schaltpunkte sind über zwei Regler einstellbar (Standard: Runterschalten 1.200 U/min, Hochschalten 2.000 U/min). Die Logik hält mindestens 100 U/min Abstand zwischen den Schaltpunkten.
- Die Oberfläche verwendet eine blau-violette Tachobeleuchtung mit roten Akzenten.
- Für iOS wird `AudioContext.resume()` unmittelbar beim Antippen des Start-Buttons angestoßen. Ein zusätzlicher Touch-Start-Handler wurde entfernt, damit Startaktionen nicht doppelt ausgelöst werden.
- Bei einem iOS-Audiostartfehler erscheint höchstens ein Hinweis pro Seitenaufruf. Er weist auch auf das vollständige Schließen und Neuladen der Web-App hin.
- Der Service-Worker-Cache wurde auf v5 angehoben. Nach dem GitHub-Pages-Update die Web-App einmal vollständig schließen und neu öffnen.

Hinweis: Die Audio-Routine wurde code-seitig robuster gestaltet und die JavaScript-Syntax geprüft. Ein physischer Test auf einem iPhone mit iOS 27.2 war in dieser Bearbeitung nicht möglich.
