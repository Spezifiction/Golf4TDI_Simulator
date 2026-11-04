# Aktuelle verbindliche Ergänzungen (November 2026)

Diese Ergänzungen haben Vorrang vor älteren Codebeispielen und Beschreibungen weiter unten:

- Die Stadtfahrt muss als dauerhaft laufender 30-Sekunden-Zyklus funktionieren. Nach 30 Sekunden beginnt sie wieder am Stillstand und spielt alle Sequenzaktionen erneut ab. Der Zyklus darf nicht von einem einzelnen `loop_reset`-Timer-Ereignis abhängen; bei verzögerten Browser-Ticks müssen alle fälligen Sequenzschritte abgearbeitet werden.
- Das Fahrprofil besteht aus Anfahren, Beschleunigen und Hochschalten, kurzer Konstantfahrt bei etwa 45–50 km/h, anschließendem Verzögern, Ampelbremsung bis 0 km/h und einer kurzen Wartephase.
- Geschwindigkeit wird mit begrenzter Beschleunigung/Verzögerung angenähert. Die Drehzahl folgt der Geschwindigkeit und dem eingelegten Gang mit kurzer Trägheit, damit Gangwechsel hörbar, aber nicht sprunghaft sind.
- Beim Motor-Sound darf das Diesel-Nageln bei steigender Drehzahl nicht dominieren: Fahr-Layer leiser als den Grund-/Leerlauf-Layer mischen, obere Frequenzen stärker filtern und die Wiedergaberate moderater verändern. Den einmaligen Drehzahl-Sweep ebenfalls zurückhaltend einblenden.
- Nutzerbedienung (Gas, Bremse, Gangwahl oder manuelle Drehzahlvorgabe) darf die automatische Stadtfahrt weiterhin beenden.

---

# 🚗 Golf 4 TDI Motor Simulator - Rekonstruktions-Prompt

**Verwendung**: Dieser Prompt enthält alle technischen Details, um den **Golf 4 TDI Motor Simulator** mit einem LLM (Large Language Model) zu rekonstruieren. Er beschreibt die vollständige Architektur, Logik, Design und Dateistruktur der Anwendung.

---

## 📋 Projektübersicht

**Name**: Golf 4 TDI Motor Simulator  
**Zweck**: Interaktive Web-App zur realistischen Simulation eines VW Golf 4 1.9 TDI Motors  
**Technologie**: Vanilla JavaScript, Web Audio API, HTML5, CSS3  
**Zielgruppe**: Enthusiasten, Entwickler, Mechaniker, Bildung  

---

## 🎯 Kernanforderungen

### 1. Realistische Motorphysik
- **Übersetzungsverhältnisse** (Motor zu Rad):
  - Gang 1: 12.804
  - Gang 2: 6.991
  - Gang 3: 4.568
  - Gang 4: 3.277
  - Gang 5: 2.521

- **Geschwindigkeitsformel**:
  ```javascript
  velocity_kmh = rpm * 0.114 / ratio[gear]
  ```

- **Drehzahlberechnung**:
  ```javascript
  targetRPM = IDLE_RPM + (load * (MAX_RPM - IDLE_RPM))
  IDLE_RPM = 850
  MAX_RPM = 4200
  ```

### 2. Schaltlogik
- **Hochschalten**: Automatisch bei **2000 U/min** (wenn Gang < 5)
- **Runterschalten**: Automatisch bei **1200 U/min** (wenn Gang > 1)
- **Manueller Modus**: Gangwechsel per Klick (bleibt im manuellen Modus)
- **Schaltverzögerung**: 600ms (realistisch für manuelles Getriebe)
- **Motorbremse**: Beim Runterschalten wird Geschwindigkeit um 2% reduziert

### 3. Gaspedal-Verhalten
- **Trägheit**: Gaspedal reagiert langsam (dt * 1.2 beim Drücken, dt * 1.8 beim Loslassen)
- **Load-Berechnung**: `load = 0-1` (0 = kein Gas, 1 = Vollgas)
- **Drehzahl follows Load**: `rpm += (targetRPM - rpm) * dt * response`
  - `response = 1.5` beim Beschleunigen
  - `response = 2.2` beim Verzögern

### 4. Stadtfahrt-Modus
- **30-Sekunden-Endlosloop** mit Geschwindigkeitsprofil und Ampelwartezeit.
- Die Stadtfahrt verwendet explizite Geschwindigkeitsziele je Sequenzpunkt. `load` steuert nur die Beschleunigungsintensität und darf die Motordrehzahl nicht direkt bis `MAX_RPM` hochregeln.
- Die Geschwindigkeit nähert sich dem jeweiligen Fahrziel mit begrenzter Beschleunigung bzw. Verzögerung.
- Die Motordrehzahl wird aus Geschwindigkeit und Gang berechnet: `rpm = speed * ratios[gear] / 0.13`. Bei Stillstand bleibt sie auf Leerlaufdrehzahl.
- Sequenz: Anfahren im 1. Gang → Hochschalten in 2. und 3. Gang → Konstantfahrt um 45 km/h → 4. Gang und ca. 49 km/h → Verzögern → Runterschalten in 3. und 2. Gang → Bremsen bis 0 km/h → Ampelwartezeit → nächster Loop.
- Die simulierte Bremse ist von einer manuellen Bremsbetätigung getrennt, damit die eigene Bremsphase den Stadtfahrt-Modus nicht abbricht.
- Der Loop-Reset setzt Zeitgeber und Sequenzindex gemeinsam zurück; der erste Sequenzpunkt darf nicht übersprungen werden.
- **Manuelle Übersteuerung**: Nutzeraktionen (Gas, Bremse, Gangwahl oder manuelle Drehzahlvorgabe) beenden den Stadtfahrt-Modus.

---

## 🎨 Design-Spezifikationen (Golf 4 Tacho)

### Farbpalette
| Element | Farbe | Hex-Code | Verwendung |
|---------|-------|----------|------------|
| Hintergrund | Dunkelblau | `#05080d` | Körper, Dashboard |
| Hintergrund (Gradient) | | `#0a141d` → `#05080d` | Radialer Hintergrund |
| Ziffern & Text | Lila-Blau | `#7a8fc8` | Tachometer-Zahlen, Beschriftungen |
| Highlight | Hell-Lila | `#8a9fdd` | Hover-Effekte |
| Rot | Rot | `#ff0000` | Schaltpunkt-Markierungen |
| Rot (Akzent) | | `#ff3300` | Aktiver Gang, Toggle |
| Grau | | `#4a6a7a` | Sekundärer Text |
| Grau (hell) | | `#a8b7bf` | Beschriftungen |

### Tachometer
- **Hintergrund**: Dunkel (#1a2530)
- **Füllung**: Gradient von `#2a385c` → `#4a5c8a` → `#7a8fc8`
- **Skala**: 0-4 (×1000 U/min)
- **Schaltpunkt-Markierungen**: Rote Linien bei 1200 U/min (28.57%) und 2000 U/min (47.62%)
- **Zeiger**: Nicht sichtbar (digitale Anzeige)

### UI-Elemente
- **Pedale (Gas/Bremse)**: 
  - Hintergrund: #05080d
  - Rand: rgba(122, 143, 200, 0.05-0.1)
  - Text: #7a8fc8
  - Icon (Gas): #7a8fc8
  - Icon (Bremse): #ff0000

- **Start-Button**:
  - Standard: Hintergrund #7a8fc8, Text #05080d
  - Aktiv (Motor läuft): Hintergrund #0a1a2a, Text #7a8fc8

- **Gang-Buttons**:
  - Standard: Hintergrund #0a141d, Text #7a8fc8
  - Ausgewählt: Hintergrund #0a1a2a, Text #ff3300, Box-Shadow #7a8fc8

- **Slider**:
  - Accent-Color: #7a8fc8
  - Track: #1a2530

- **Toggle-Schalter**:
  - Hintergrund (aus): #05080d
  - Hintergrund (an): #0a1a2a
  - Knopf (aus): #4a6a7a
  - Knopf (an): #ff3300

---

## 📁 Dateistruktur

```
golf4_tdi_racing/
├── index.html              # Haupt-HTML-Datei
├── style.css               # Stylesheets
├── script.js               # JavaScript-Logik
├── manifest.webmanifest    # PWA Manifest
├── README.md               # Dokumentation
├── PROMPT.md               # Dieser Prompt
├── icons/                  # App-Icons
│   ├── favicon.ico         # Standard Favicon (16x16, 32x32, 48x48)
│   ├── favicon.svg         # SVG Favicon (skalierbar)
│   ├── favicon-96x96.png    # Browser-Tab (96x96)
│   ├── apple-touch-icon.png # iOS Home-Bildschirm (180x180)
│   ├── web-app-manifest-192x192.png  # Android PWA (192x192)
│   └── web-app-manifest-512x512.png  # Android (512x512)
└── audio/                  # Audio-Samples
    ├── leerlauf-loop.mp3   # Leerlauf-Sound (Loop, ~850 RPM)
    ├── fahr-loop.mp3       # Fahr-Sound (Loop, variabel)
    └── drehzahl-anhebung.mp3 # Drehzahl-Anstieg (einmalig)
```

---

## 📜 HTML-Struktur (`index.html`)

### Meta-Tags
```html
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#05080d">
<meta name="description" content="Interaktive Golf 4 TDI Motorensimulation">
<title>Golf 4 TDI · Motor-Simulator</title>

<!-- PWA Meta Tags -->
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Golf 4 TDI Simulator">
<meta name="application-name" content="Golf 4 TDI Simulator">
<meta name="msapplication-TileColor" content="#05080d">

<!-- Icons -->
<link rel="icon" type="image/x-icon" href="icons/favicon.ico">
<link rel="icon" type="image/svg+xml" href="icons/favicon.svg">
<link rel="icon" type="image/png" sizes="96x96" href="icons/favicon-96x96.png">
<link rel="apple-touch-icon" sizes="180x180" href="icons/apple-touch-icon.png">
<link rel="icon" type="image/png" sizes="192x192" href="icons/web-app-manifest-192x192.png">
<link rel="icon" type="image/png" sizes="512x512" href="icons/web-app-manifest-512x512.png">
<link rel="manifest" href="manifest.webmanifest">

<!-- Stylesheet -->
<link rel="stylesheet" href="style.css">
```

### DOM-Struktur
```html
<main class="app">
  <!-- Header -->
  <header class="header">
    <div class="logo">TDI</div>
    <div>
      <p class="eyebrow">INTERACTIVE ENGINE LAB</p>
      <h1>Golf 4 <span>1.9 TDI</span></h1>
    </div>
    <div class="live">
      <i id="liveDot"></i>
      <span id="stateLabel">BEREIT</span>
    </div>
  </header>

  <!-- Dashboard -->
  <section class="dash">
    <!-- Speed & RPM Display -->
    <div class="main-readout">
      <div>
        <span class="caption">GESCHWINDIGKEIT</span>
        <div class="speed-number">
          <strong id="speedValue">0</strong>
          <small>km/h</small>
        </div>
      </div>
      <div>
        <span class="caption">MOTORDREHZAHL</span>
        <div class="rpm-number">
          <strong id="rpmValue">0</strong>
          <small>U/min</small>
        </div>
      </div>
    </div>

    <!-- Tachometer -->
    <div class="tach">
      <div class="tach-top">
        <span>0</span><span>1</span><span>2</span><span>3</span><span>4</span>
        <i class="shift-mark" style="left:28.57%"></i>  <!-- 1200 U/min -->
        <i class="shift-mark" style="left:47.62%"></i>  <!-- 2000 U/min -->
      </div>
      <div class="tach-track">
        <div id="tachFill"></div>
      </div>
      <div class="tach-bottom">
        <span>× 1.000 U/min</span>
        <span id="gearLabel">LEERLAUF</span>
      </div>
    </div>

    <!-- Gear Selection -->
    <div class="gear-strip">
      <span class="caption">GETRIEBE</span>
      <div class="gear-values">
        <b id="gearN" class="selected">N</b>
        <b id="gear1">1</b>
        <b id="gear2">2</b>
        <b id="gear3">3</b>
        <b id="gear4">4</b>
        <b id="gear5">5</b>
      </div>
      <span class="shift-hint" id="shiftHint">
        Automatik · ↑2000 / ↓1200 U/min oder klicke Gang
      </span>
    </div>
  </section>

  <!-- Controls -->
  <section class="controls">
    <div class="section-head">
      <span>FAHRZEUGSTEUERUNG</span>
      <span class="mode-pill">SIMULATION</span>
    </div>

    <!-- Pedals -->
    <div class="pedals">
      <button id="brakeBtn" class="pedal brake" type="button">
        <span class="pedal-icon">▤</span>
        <strong>BREMSE</strong>
        <small>halten</small>
      </button>
      <button id="startBtn" class="start" type="button">
        <span class="start-icon">⏻</span>
        <strong id="startLabel">MOTOR STARTEN</strong>
        <small>Audio nach Berührung aktiv</small>
      </button>
      <button id="gasBtn" class="pedal gas" type="button">
        <span class="pedal-icon">⌁</span>
        <strong>GAS</strong>
        <small>halten</small>
      </button>
    </div>

    <!-- Sliders -->
    <div class="sliders">
      <label class="slider-row" for="speedSlider">
        <span><b>Geschwindigkeit</b><output id="speedOut">0 km/h</output></span>
        <input id="speedSlider" type="range" min="0" max="160" value="0">
      </label>
      <label class="slider-row" for="loadSlider">
        <span><b>Gaspedalstellung</b><output id="loadOut">0 %</output></span>
        <input id="loadSlider" type="range" min="0" max="100" value="0">
      </label>
      <label class="slider-row" for="rpmSlider">
        <span><b>Drehzahl (manuell)</b><output id="rpmOut">0 U/min</output></span>
        <input id="rpmSlider" type="range" min="0" max="4200" value="0">
      </label>
    </div>

    <!-- Bottom Controls -->
    <div class="bottom-row">
      <label class="toggle">
        <input id="modToggle" type="checkbox" checked>
        <span class="switch"></span>
        <span>Sanfte Modulation</span>
      </label>
      <label class="toggle">
        <input id="cityToggle" type="checkbox">
        <span class="switch"></span>
        <span>Stadtfahrt (30s Loop)</span>
      </label>
      <button id="muteBtn" class="mute" type="button">TON AN</button>
    </div>
  </section>

  <!-- Audio Sources Panel -->
  <details class="source-panel">
    <summary>Audio-Quellen & Hinweise</summary>
    <p>
      Die bereinigten Loop-Samples bilden Leerlauf und Fahrbetrieb ab. 
      Zusätzlich wird beim Gasgeben ein Drehzahl-Anstieg als kurzer 
      dynamischer Motorsound abgespielt.
    </p>
    <label>
      Leerlauf-Sample 
      <input id="idleFile" type="file" accept="audio/*">
    </label>
    <label>
      Fahr-Sample 
      <input id="driveFile" type="file" accept="audio/*">
    </label>
    <p><small>Das zusätzliche Drehzahl-Sweep-Sample ist fest integriert.</small></p>
    <small>Audiodateien werden nicht an einen Server übertragen.</small>
  </details>

  <footer>
    Demo-Audioengine · Web Audio API · Einstellungen vor Fahrtbeginn vornehmen.
  </footer>
</main>

<script src="script.js"></script>
```

---

## 🎯 CSS-Spezifikationen (`style.css`)

### Root-Variablen
```css
:root {
  color-scheme: dark;
  --bg: #05080d;
  --line: rgba(122, 143, 200, 0.15);
  --muted: #648c9c;
  --text: #7a8fc8;
  --mint: #7a8fc8;
  --amber: #ff3300;
  --red: #ff0000;
}
```

### Körper & Layout
```css
body {
  min-height: 100svh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: max(12px, env(safe-area-inset-top)) 14px max(12px, env(safe-area-inset-bottom));
  background: radial-gradient(ellipse at 50% -10%, #0a141d 0%, #05080d 48%, #020408 100%);
  color: #7a8fc8;
  font-family: Inter, system-ui, -apple-system, "Segoe UI", sans-serif;
}
```

### Wichtige Klassen
```css
/* Dashboard & Controls */
.dash, .controls {
  border: 1px solid rgba(122, 143, 200, 0.15);
  border-radius: 23px;
  background: linear-gradient(155deg, #0a141d, #05080d 72%);
  box-shadow: 0 20px 55px #0005;
}

/* Tachometer */
.tach-track > div {
  background: linear-gradient(90deg, #2a385c, #4a5c8a 65%, #7a8fc8);
}

/* Gear Buttons */
.gear-values b {
  background: #0a141d;
  color: #7a8fc8;
  border: 1px solid rgba(122, 143, 200, 0.1);
}
.gear-values b.selected {
  background: #0a1a2a;
  color: #ff3300;
  box-shadow: 0 0 15px rgba(122, 143, 200, 0.3);
}

/* Shift Marks (1200 & 2000 RPM) */
.tach-top .shift-mark {
  background: #ff0000;
}

/* Pedals */
.pedal {
  background: #05080d;
  color: #7a8fc8;
  border: 1px solid rgba(122, 143, 200, 0.05);
}
.gas .pedal-icon { color: #7a8fc8; }
.brake .pedal-icon { color: #ff0000; }

/* Start Button */
.start {
  background: #7a8fc8;
  color: #05080d;
}
.start.running {
  background: #0a1a2a;
  color: #7a8fc8;
}

/* Sliders */
input[type="range"] {
  accent-color: #7a8fc8;
}

/* Toggle Switch */
.switch {
  background: #05080d;
  border: 1px solid rgba(122, 143, 200, 0.1);
}
.switch:after {
  background: #4a6a7a;
}
.toggle input:checked + .switch {
  background: #0a1a2a;
}
.toggle input:checked + .switch:after {
  background: #ff3300;
}

/* Live Status */
.live i.on {
  background: #7a8fc8;
  box-shadow: 0 0 12px rgba(122, 143, 200, 0.6);
}
```

---

## ⚙️ JavaScript-Logik (`script.js`)

### 1. Globale Variablen & Konstanten
```javascript
const ratios = [0, 12.804, 6.991, 4.568, 3.277, 2.521]; // Gang 0-5
const IDLE = 850;    // Leerlaufdrehzahl
const SHIFT_UP = 2000;   // Hochschaltpunkt
const SHIFT_DOWN = 1200; // Runterschaltpunkt
const MAX_RPM = 4200;    // Maximal-Drehzahl

const s = {
  ctx: null,                  // AudioContext
  master: null,               // Master Gain
  idleGain: null,              // Leerlauf Gain
  driveGain: null,             // Fahr Gain
  idleFilter: null,            // Filter für Leerlauf
  driveFilter: null,           // Filter für Fahrt
  idleSource: null,           // Audio-Quelle Leerlauf
  driveSource: null,          // Audio-Quelle Fahrt
  revSource: null,            // Audio-Quelle Drehzahl-Anstieg
  idleBuffer: null,            // Leerlauf Audio-Buffer
  driveBuffer: null,           // Fahr Audio-Buffer
  revBuffer: null,             // Drehzahl-Anstieg Buffer
  running: false,              // Motor Status
  muted: false,                // Stummgeschaltet
  speed: 0,                    // Geschwindigkeit km/h
  load: 0,                     // Last 0-1
  rpm: 0,                      // Drehzahl U/min
  gear: 0,                     // Gang (0=N, 1-5)
  gasHeld: false,              // Gaspedal gedrückt
  brakeHeld: false,            // Bremse gedrückt
  mod: 1,                      // Modulation
  modTimer: 0,                 // Modulation Timer
  useManualRpm: false,        // Manuelle RPM-Steuerung
  manualRpmTarget: null,      // Ziel-RPM bei manueller Steuerung
  shiftCooldown: 0,           // Schalt-Sperre
  cityDriveActive: false,     // Stadtfahrt aktiv
  cityDriveStartTime: 0,      // Startzeit Stadtfahrt
  cityDriveLoopInterval: null,// Loop-Interval Stadtfahrt
  lastCityAction: 0,          // Letzte Aktion in Sequenz
  cityDriveGasPlayed: false,   // Gas-Sound abgespielt
  cityDriveLoadTarget: 0      // Ziel-Load für Stadtfahrt
};
```

### 2. Stadtfahrt-Sequenz
```javascript
const cityDriveSequence = [
  // [Zeit_in_ms, {gear, load, brake, action}]
  [0, {gear: 1, load: 0.25}],           // Anfahren 1. Gang
  [2500, {gear: 2, load: 0.22}],        // Hochschalten 2. Gang
  [4500, {gear: 3, load: 0.2}],         // Hochschalten 3. Gang
  [7000, {load: 0.18}],                 // Gleichmäßig 3. Gang
  [10000, {gear: 4, load: 0.17}],       // Hochschalten 4. Gang
  [13000, {load: 0.12}],                // Verzögern
  [14500, {gear: 3, load: 0.15}],       // Runterschalten 3. Gang
  [16500, {gear: 2, load: 0.18}],       // Runterschalten 2. Gang
  [18500, {brake: true, load: 0}],      // Bremse
  [20000, {brake: false, load: 0}],     // Stopp
  [21500, {gear: 1, load: 0.25}],       // Neues Anfahren
  [23500, {gear: 2, load: 0.22}],       // Hochschalten
  [26500, {load: 0.18}],                // Gleichmäßig
  [29500, {load: 0.12}],                // Langsam für Loop
  [29999, {action: 'loop_reset'}]       // Loop Zurücksetzen
];
```

### 3. Wichtige Funktionen

#### `init()` – Audio initialisieren
```javascript
async function init() {
  if(s.ctx) return;
  const C = window.AudioContext || window.webkitAudioContext;
  if(!C) throw Error("Web Audio API nicht verfügbar");
  
  s.ctx = new C();
  s.master = s.ctx.createGain();
  s.master.gain.value = 0.82;
  
  // Filter erstellen
  s.idleFilter = s.ctx.createBiquadFilter();
  s.driveFilter = s.ctx.createBiquadFilter();
  [s.idleFilter, s.driveFilter].forEach(f => {
    f.type = "lowpass";
    f.frequency.value = 9000;
    f.Q.value = 0.55;
  });
  
  // Gain Nodes
  s.idleGain = s.ctx.createGain();
  s.driveGain = s.ctx.createGain();
  s.revGain = s.ctx.createGain();
  s.idleGain.gain.value = 0;
  s.driveGain.gain.value = 0;
  s.revGain.gain.value = 0;
  
  // Audio-Dateien laden
  s.idleBuffer = await getBuffer("audio/leerlauf-loop.mp3");
  s.driveBuffer = await getBuffer("audio/fahr-loop.mp3");
  s.revBuffer = await getBuffer("audio/drehzahl-anhebung.mp3");
  
  // Rev Filter
  s.revFilter = s.ctx.createBiquadFilter();
  s.revFilter.type = "bandpass";
  s.revFilter.frequency.value = 1900;
  s.revFilter.Q.value = 0.65;
  s.revFilter.connect(s.revGain);
  s.revGain.connect(s.master);
  
  // Verbindungen herstellen
  s.idleGain.connect(s.master);
  s.driveGain.connect(s.master);
  s.master.connect(s.ctx.destination);
}
```

#### `makeLoop(buffer, filter, gain)` – Audio-Loop erstellen
```javascript
function makeLoop(buffer, filter, gain) {
  const src = s.ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  src.connect(filter);
  filter.connect(gain);
  src.start();
  return src;
}
```

#### `start()` – Motor starten
```javascript
async function start() {
  try {
    await init();
    await s.ctx.resume(); // Wichtig für iOS!
    
    // Audioquellen erstellen NACH resume()
    if(!s.idleSource) s.idleSource = makeLoop(s.idleBuffer, s.idleFilter, s.idleGain);
    if(!s.driveSource) s.driveSource = makeLoop(s.driveBuffer, s.driveFilter, s.driveGain);
    
    s.running = true;
    s.lastTime = performance.now();
    s.rpm = IDLE;
    s.load = 0;
    s.speed = 0;
    s.gear = 0;
    s.useManualRpm = false;
    s.manualRpmTarget = null;
    s.shiftCooldown = 0;
    
    // UI aktualisieren
    $("startBtn").classList.add("running");
    txt("startLabel", "MOTOR STOPPEN");
    txt("stateLabel", "MOTOR LÄUFT");
    $("liveDot").classList.add("on");
    
    shift();
    audio();
    cancelAnimationFrame(s.raf);
    s.raf = requestAnimationFrame(tick);
    if($("modToggle").checked) modulate();
    
    ui();
  } catch(e) {
    console.error(e);
    txt("stateLabel", "AUDIOFEHLER");
    alert("Audio konnte nicht geladen werden. Bitte Live Server oder HTTPS verwenden.");
  }
}
```

#### `stop()` – Motor stoppen
```javascript
function stop() {
  s.running = false;
  stopCityDrive();
  s.gasHeld = false;
  s.brakeHeld = false;
  cancelAnimationFrame(s.raf);
  clearInterval(s.modTimer);
  
  // Audio stoppen
  if(s.ctx && s.master) s.master.gain.setTargetAtTime(0, s.ctx.currentTime, 0.08);
  try { if(s.revSource) { s.revSource.stop(); s.revSource.disconnect(); s.revSource = null; } } catch(_) {}
  try { if(s.idleSource) { s.idleSource.stop(); s.idleSource.disconnect(); s.idleSource = null; } } catch(_) {}
  try { if(s.driveSource) { s.driveSource.stop(); s.driveSource.disconnect(); s.driveSource = null; } } catch(_) {}
  
  // UI aktualisieren
  $("startBtn").classList.remove("running");
  $("gasBtn").classList.remove("active");
  $("brakeBtn").classList.remove("active");
  txt("startLabel", "MOTOR STARTEN");
  txt("stateLabel", "BEREIT");
  $("liveDot").classList.remove("on");
  
  s.useManualRpm = false;
  s.manualRpmTarget = null;
  s.rpm = 0;
  s.load = 0;
  s.speed = 0;
  s.gear = 0;
  $("rpmSlider").value = 0;
  txt("rpmOut", "0 U/min");
  ui();
  
  setTimeout(() => {
    if(!s.running && s.master) s.master.gain.value = s.muted ? 0 : 0.82;
  }, 180);
}
```

#### `targetRPM()` – Ziel-Drehzahl berechnen
```javascript
function targetRPM() {
  if(!s.running) return 0;
  if(s.useManualRpm && s.manualRpmTarget !== null) {
    return s.manualRpmTarget;
  }
  return IDLE + s.load * (MAX_RPM - IDLE);
}
```

#### `calcSpeedFromRpm()` – Geschwindigkeit berechnen
```javascript
function calcSpeedFromRpm() {
  if(s.gear > 0) return s.rpm * 0.114 / ratios[s.gear];
  return 0;
}
```

#### `selectGear()` – Gang auswählen (automatisch)
```javascript
function selectGear() {
  // Fliehkraftkupplung: N -> 1 ab 1000 RPM
  if(s.gear === 0 && s.rpm >= 1000) return 1;
  if(s.gear === 0) return 0;
  
  // Schaltverzögerung
  if(s.shiftCooldown > Date.now()) return s.gear;
  
  // Hochschalten
  if(s.rpm >= SHIFT_UP && s.gear < 5) return s.gear + 1;
  // Runterschalten
  if(s.rpm <= SHIFT_DOWN && s.gear > 1) return s.gear - 1;
  
  return s.gear;
}
```

#### `shift()` – Gang wechseln
```javascript
function shift() {
  const next = selectGear();
  if(next !== s.gear && s.shiftCooldown <= Date.now()) {
    s.shiftCooldown = Date.now() + 600;
    const wasNeutral = s.gear === 0;
    const oldGear = s.gear;
    s.gear = next;
    
    // Geschwindigkeit vor dem Schalten
    const currentSpeed = s.speed;
    
    // N -> 1
    if(wasNeutral && next === 1) {
      s.rpm = Math.max(IDLE, Math.min(MAX_RPM, IDLE + s.load * 500));
    }
    // Hochschalten
    else if(next > oldGear && oldGear > 0 && next <= 5) {
      const oldSpeed = s.rpm * 0.114 / ratios[oldGear];
      s.rpm = Math.min(MAX_RPM - 200, Math.max(IDLE, oldSpeed * ratios[next] / 0.114));
      s.speed = oldSpeed;
    }
    // Runterschalten
    else if(next < oldGear && next >= 1) {
      const oldSpeed = s.rpm * 0.114 / ratios[oldGear];
      const newSpeed = oldSpeed * 0.98; // Motorbremse
      s.rpm = Math.min(MAX_RPM - 100, Math.max(IDLE, newSpeed * ratios[next] / 0.114));
      s.speed = newSpeed;
    }
    
    txt("shiftHint", `SCHALTVORGANG → ${next === 0 ? 'N' : next + '. GANG'}`);
    setTimeout(() => txt("shiftHint", `Automatik · ↑${SHIFT_UP} / ↓${SHIFT_DOWN} U/min`), 650);
  }
}
```

#### `selectGearManually(gearNum)` – Gang manuell wechseln
```javascript
function selectGearManually(gearNum) {
  if(!s.running || s.shiftCooldown > Date.now()) return;
  
  const oldGear = s.gear;
  if(gearNum === oldGear) return;
  
  s.shiftCooldown = Date.now() + 600;
  const currentSpeed = s.speed;
  
  // N -> Gang
  if(oldGear === 0 && gearNum >= 1) {
    if(currentSpeed <= 1) {
      s.rpm = Math.max(IDLE, Math.min(MAX_RPM, IDLE + s.load * 300));
    } else {
      s.rpm = Math.min(MAX_RPM, Math.max(IDLE, currentSpeed * ratios[gearNum] / 0.114));
    }
    s.gear = gearNum;
  }
  // Gangwechsel
  else if(oldGear >= 1 && gearNum >= 0) {
    if(currentSpeed > 0) {
      const newSpeed = gearNum > oldGear ? currentSpeed : currentSpeed * 0.98; // Motorbremse
      s.rpm = Math.min(MAX_RPM, Math.max(IDLE, newSpeed * ratios[gearNum] / 0.114));
      s.speed = newSpeed;
    } else {
      s.rpm = Math.max(IDLE, Math.min(MAX_RPM, IDLE + s.load * 300));
    }
    s.gear = gearNum;
  }
  
  // Im manuellen Modus bleiben
  if(!s.cityDriveActive) {
    s.useManualRpm = true;
    s.manualRpmTarget = s.rpm;
  }
  
  // Load anpassen
  if(s.gear > 0 && !s.cityDriveActive) {
    s.load = Math.max(0, Math.min(1, (s.rpm - IDLE) / (MAX_RPM - IDLE)));
  }
  
  txt("shiftHint", `Manuell → ${gearNum === 0 ? 'N' : gearNum + '. GANG'}`);
  setTimeout(() => txt("shiftHint", `Automatik · ↑${SHIFT_UP} / ↓${SHIFT_DOWN} U/min`), 650);
  ui();
  if(s.running) audio();
}
```

#### `tick(now)` – Haupt-Update-Schleife
```javascript
function tick(now) {
  if(!s.running) return;
  const dt = Math.min(0.05, (now - s.lastTime) / 1000 || 0.016);
  s.lastTime = now;
  
  // Load-Steuerung
  if(s.cityDriveActive) {
    s.load = Math.max(0, Math.min(1, s.cityDriveLoadTarget));
    if(s.brakeHeld) {
      s.load = Math.max(0, s.load - dt * 2.0);
    }
    s.gasHeld = s.load > 0.1 && !s.brakeHeld;
  }
  else if(s.gasHeld) {
    s.load = Math.min(1, s.load + dt * 1.2); // Gaspedal träger
  }
  else if(s.brakeHeld) {
    s.load = Math.max(0, s.load - dt * 1.8);
  }
  else if(s.useManualRpm) {
    s.load = Math.max(0, Math.min(1, (s.rpm - IDLE) / (MAX_RPM - IDLE)));
  }
  else {
    s.load = Math.max(0, s.load - dt * 0.02); // Langsame Reduktion
  }
  
  // Gang wechseln (nicht bei Stadtfahrt)
  if(!s.cityDriveActive) {
    shift();
  }
  
  // Ziel-Drehzahl
  const targetRpm = targetRPM();
  const response = targetRpm > s.rpm ? 1.5 : 2.2;
  s.rpm += (targetRpm - s.rpm) * Math.min(1, dt * response);
  s.rpm = Math.max(s.running ? IDLE : 0, Math.min(MAX_RPM, s.rpm));
  
  // Geschwindigkeit berechnen
  const targetSpeed = calcSpeedFromRpm();
  if(s.gear > 0) {
    s.speed += (targetSpeed - s.speed) * Math.min(1, dt * 5);
  } else {
    s.speed = 0;
  }
  
  // Bremse
  if(s.brakeHeld) {
    s.speed = Math.max(0, s.speed - 24 * dt);
  }
  
  s.speed = Math.max(0, Math.min(160, s.speed));
  
  // UI aktualisieren
  $("speedSlider").value = Math.round(s.speed);
  $("loadSlider").value = Math.round(s.load * 100);
  if(s.useManualRpm) {
    $("rpmSlider").value = Math.round(s.rpm);
    txt("rpmOut", `${Math.round(s.rpm)} U/min`);
  }
  ui();
  audio();
  s.raf = requestAnimationFrame(tick);
}
```

#### `audio()` – Audio aktualisieren
```javascript
function audio() {
  if(!s.ctx || !s.running) return;
  const now = s.ctx.currentTime;
  
  // Motor aus
  if(s.rpm <= 0 || !s.running) {
    s.idleGain.gain.setTargetAtTime(0, now, 0.08);
    s.driveGain.gain.setTargetAtTime(0, now, 0.08);
    s.revGain.gain.setTargetAtTime(0, now, 0.08);
    return;
  }
  
  const norm = Math.max(0, Math.min(1, (s.rpm - 800) / 3100));
  const drive = Math.max(0.06, Math.min(0.96, 0.12 + norm * 0.58 + s.load * 0.30));
  const audible = s.muted ? 0 : 1;
  
  s.idleGain.gain.setTargetAtTime((1 - drive) * audible * s.mod * 0.8, now, 0.22);
  s.driveGain.gain.setTargetAtTime(drive * audible * s.mod * 0.9, now, 0.22);
  
  s.idleSource.playbackRate.setTargetAtTime(Math.max(0.82, Math.min(1.2, 0.88 + norm * 0.22)), now, 0.18);
  s.driveSource.playbackRate.setTargetAtTime(Math.max(0.72, Math.min(1.62, s.rpm / 1850)), now, 0.14);
  
  s.driveFilter.frequency.setTargetAtTime(1800 + s.load * 6800 + norm * 900, now, 0.25);
  s.idleFilter.frequency.setTargetAtTime(2400 + s.load * 1600, now, 0.3);
}
```

#### `playRevSweep()` – Drehzahl-Anstieg Sound
```javascript
function playRevSweep() {
  if(!s.ctx || !s.running || !s.revBuffer || s.muted || s.rpm <= 0) return;
  
  try { if(s.revSource) { s.revSource.stop(); s.revSource.disconnect(); } } catch(_) {}
  
  const src = s.ctx.createBufferSource();
  src.buffer = s.revBuffer;
  const norm = Math.max(0, Math.min(1, (s.rpm - 850) / 3000));
  src.playbackRate.value = 0.92 + norm * 0.16;
  src.connect(s.revFilter);
  s.revSource = src;
  
  const now = s.ctx.currentTime;
  s.revGain.gain.cancelScheduledValues(now);
  s.revGain.gain.setValueAtTime(0, now);
  s.revGain.gain.linearRampToValueAtTime(0.34, now + 0.12);
  s.revGain.gain.setTargetAtTime(0.20, now + 1.0, 0.7);
  
  src.onended = () => {
    if(s.revSource === src) {
      s.revGain.gain.setTargetAtTime(0, s.ctx.currentTime, 0.12);
      s.revSource = null;
    }
  };
  src.start();
}
```

### 4. Stadtfahrt-Funktionen

#### `startCityDrive()` – Stadtfahrt starten
```javascript
function startCityDrive() {
  stopCityDrive();
  
  if(!s.running) {
    start();
    setTimeout(() => startCityDriveInternal(), 100);
    return;
  }
  startCityDriveInternal();
}

function startCityDriveInternal() {
  s.cityDriveActive = true;
  s.cityDriveStartTime = Date.now();
  s.lastCityAction = 0;
  s.cityDriveGasPlayed = false;
  s.cityDriveLoadTarget = 0;
  
  // States zurücksetzen
  s.gasHeld = false;
  s.brakeHeld = false;
  s.useManualRpm = false;
  s.manualRpmTarget = null;
  s.shiftCooldown = 0;
  
  // Loop starten
  s.cityDriveLoopInterval = setInterval(() => {
    const elapsed = Date.now() - s.cityDriveStartTime;
    const loopDuration = 30000; // 30 Sekunden
    const loopElapsed = elapsed % loopDuration;
    
    if(s.lastCityAction < cityDriveSequence.length) {
      const [time, action] = cityDriveSequence[s.lastCityAction];
      if(loopElapsed >= time) {
        applyCityAction(action);
        s.lastCityAction++;
      }
    }
  }, 50);
  
  $("cityToggle").parentElement.classList.add("active");
  ui();
  if(s.running) audio();
}
```

#### `stopCityDrive()` – Stadtfahrt stoppen
```javascript
function stopCityDrive() {
  s.cityDriveActive = false;
  if(s.cityDriveLoopInterval) {
    clearInterval(s.cityDriveLoopInterval);
    s.cityDriveLoopInterval = null;
  }
  s.cityDriveLoadTarget = 0;
  $("cityToggle").parentElement.classList.remove("active");
  ui();
  if(s.running) audio();
}
```

#### `applyCityAction(action)` – Stadtfahrt-Aktion anwenden
```javascript
function applyCityAction(action) {
  // Nicht anwenden wenn Nutzer eingreift
  if(s.gasHeld || s.brakeHeld || s.useManualRpm) {
    stopCityDrive();
    return;
  }
  
  if(action.action === 'loop_reset') {
    s.lastCityAction = 0;
    s.cityDriveStartTime = Date.now();
    return;
  }
  
  // Gang wechseln
  if(action.gear !== undefined) {
    const oldGear = s.gear;
    if(action.gear !== oldGear && action.gear >= 0 && action.gear <= 5) {
      const currentSpeed = s.speed;
      
      if(oldGear === 0 && action.gear >= 1) {
        if(currentSpeed <= 1) {
          s.rpm = Math.max(IDLE, Math.min(MAX_RPM, IDLE + s.load * 300));
        } else {
          s.rpm = Math.min(MAX_RPM, Math.max(IDLE, currentSpeed * ratios[action.gear] / 0.114));
        }
        s.gear = action.gear;
      }
      else if(oldGear >= 1 && action.gear >= 0) {
        if(currentSpeed > 0) {
          const newSpeed = action.gear > oldGear ? currentSpeed : currentSpeed * 0.98;
          s.rpm = Math.min(MAX_RPM, Math.max(IDLE, newSpeed * ratios[action.gear] / 0.114));
          s.speed = newSpeed;
        } else {
          s.rpm = Math.max(IDLE, Math.min(MAX_RPM, IDLE + s.load * 300));
        }
        s.gear = action.gear;
      }
      s.shiftCooldown = Date.now() + 600;
      txt("shiftHint", `Stadtfahrt → ${action.gear === 0 ? 'N' : action.gear + '. GANG'}`);
      setTimeout(() => txt("shiftHint", `Automatik · ↑${SHIFT_UP} / ↓${SHIFT_DOWN} U/min`), 650);
    }
  }
  
  // Load setzen
  if(action.load !== undefined) {
    s.cityDriveLoadTarget = Math.max(0, Math.min(1, action.load));
    s.load = s.cityDriveLoadTarget;
    if(action.load > 0.2 && !s.cityDriveGasPlayed) {
      playRevSweep();
      s.cityDriveGasPlayed = true;
    } else if(action.load <= 0.2) {
      s.cityDriveGasPlayed = false;
    }
  }
  
  // Bremse
  if(action.brake !== undefined) {
    s.brakeHeld = action.brake;
    if(action.brake) {
      s.load = 0;
      s.cityDriveLoadTarget = 0;
    }
  }
  
  // UI aktualisieren
  $("gasBtn").classList.toggle("active", s.load > 0.1);
  $("brakeBtn").classList.toggle("active", s.brakeHeld);
  $("loadSlider").value = Math.round(s.load * 100);
  ui();
  if(s.running) audio();
}
```

### 5. Event-Listener

#### Pedals
```javascript
function hold(id, key) {
  const b = $(id);
  b.addEventListener("pointerdown", e => {
    e.preventDefault();
    s[key] = true;
    b.classList.add("active");
    s.useManualRpm = false;
    if(key === "gasHeld") playRevSweep();
    if(s.cityDriveActive) stopCityDrive();
  });
  ["pointerup", "pointercancel", "pointerleave"].forEach(ev => 
    b.addEventListener(ev, e => {
      e.preventDefault();
      s[key] = false;
      b.classList.remove("active");
      if(s.cityDriveActive) stopCityDrive();
    })
  );
}

// Registrieren
$("startBtn").addEventListener("click", () => s.running ? stop() : start());
hold("gasBtn", "gasHeld");
hold("brakeBtn", "brakeHeld");
```

#### Gang-Buttons
```javascript
["N", "1", "2", "3", "4", "5"].forEach((g, i) => {
  const btn = $("gear" + g);
  if(btn) btn.addEventListener("click", () => selectGearManually(i));
});
```

#### Slider
```javascript
$("speedSlider").addEventListener("input", e => {
  s.speed = +e.target.value;
  s.useManualRpm = false;
  stopCityDrive();
  if(s.running && s.gear > 0) {
    s.rpm = Math.min(MAX_RPM, s.speed * ratios[s.gear] / 0.114);
    shift();
  }
  if(s.running) audio();
  ui();
});

$("loadSlider").addEventListener("input", e => {
  s.load = +e.target.value / 100;
  s.useManualRpm = false;
  stopCityDrive();
  if(s.running) audio();
  ui();
});

$("rpmSlider").addEventListener("input", e => {
  s.useManualRpm = true;
  stopCityDrive();
  s.manualRpmTarget = Math.max(IDLE, Math.min(MAX_RPM, +e.target.value));
  s.rpm = s.manualRpmTarget;
  txt("rpmOut", `${Math.round(s.rpm)} U/min`);
  if(s.running) { ui(); audio(); }
});
```

#### Toggle & Buttons
```javascript
$("cityToggle").addEventListener("change", e => {
  if(e.target.checked) startCityDrive();
  else stopCityDrive();
});

$("modToggle").addEventListener("change", e => {
  if(e.target.checked && s.running) modulate();
  else { clearInterval(s.modTimer); s.mod = 1; if(s.running) audio(); }
});

$("muteBtn").addEventListener("click", () => {
  s.muted = !s.muted;
  txt("muteBtn", s.muted ? "TON AUS" : "TON AN");
  if(s.running) audio();
});

$("idleFile").addEventListener("change", e => replace(e.target, "idle"));
$("driveFile").addEventListener("change", e => replace(e.target, "drive"));
```

#### Service Worker (optional)
```javascript
if("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
  addEventListener("load", () => 
    navigator.serviceWorker.register("./sw.js").catch(console.warn)
  );
}
```

---

## 📄 PWA Manifest (`manifest.webmanifest`)

```json
{
  "name": "Golf 4 TDI Simulator",
  "short_name": "TDI Simulator",
  "description": "Interaktive Simulation eines VW Golf 4 1.9 TDI Motors",
  "start_url": ".",
  "display": "standalone",
  "background_color": "#05080d",
  "theme_color": "#05080d",
  "icons": [
    {
      "src": "icons/favicon-96x96.png",
      "sizes": "96x96",
      "type": "image/png"
    },
    {
      "src": "icons/web-app-manifest-192x192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "icons/web-app-manifest-512x512.png",
      "sizes": "512x512",
      "type": "image/png"
    },
    {
      "src": "icons/apple-touch-icon.png",
      "sizes": "180x180",
      "type": "image/png"
    }
  ]
}
```

---

## 🎵 Audio-Dateien

### Anforderungen
- **leerlauf-loop.mp3**: 
  - Dauer: 1-3 Sekunden Loop
  - Tonhöhe: ~850 U/min
  - Inhalt: Leerlauf-Sound eines Dieselmotors

- **fahr-loop.mp3**:
  - Dauer: 1-3 Sekunden Loop
  - Tonhöhe: variabel (wird dynamisch angepasst)
  - Inhalt: Fahr-Sound bei mittlerer Drehzahl

- **drehzahl-anhebung.mp3**:
  - Dauer: 0.5-1.5 Sekunden
  - Inhalt: Drehzahl-Anstieg (Sweep)
  - Verwendung: Wird einmalig beim Gasgeben abgespielt

### Empfohlene Quellen
- Original VW Golf 4 TDI Audio-Aufnahmen
- Kostenlose Sound-Effekte von:
  - https://freesound.org/
  - https://zapsplat.com/
  - https://mixkit.co/free-sound-effects/

---

## 🔧 Entwicklungs-Tipps

### 1. Audio-Debugging
- Prüfe, ob `s.ctx` initialisiert ist
- iOS: `s.ctx.resume()` muss nach Nutzerinteraktion aufgerufen werden
- Chrome DevTools: Audio-Context kann im "Application" Tab überprüft werden

### 2. Performance
- `requestAnimationFrame` für flüssige Animationen
- `dt` (Delta Time) für frame-rate-unabhängige Berechnungen
- Maximal 60 FPS (dt ≈ 0.016s)

### 3. Responsive Design
- `min(100%, 560px)` für maximale Breite
- Media Queries für kleinere Bildschirme
- `env(safe-area-inset-*)` für iPhone Notch

### 4. Touch-Optimierung
- Große Bedienelemente (mind. 44x44px für Touch)
- `touch-action: manipulation` für bessere Scroll-Performance
- `user-select: none` für Buttons

---

## 📝 Zusammenfassung der wichtigsten Formeln

```
// Geschwindigkeit aus Drehzahl
velocity = rpm * 0.114 / ratio[gear]

// Drehzahl aus Geschwindigkeit
rpm = velocity * ratio[gear] / 0.114

// Ziel-Drehzahl aus Load
.targetRPM = IDLE + (load * (MAX_RPM - IDLE))

// Gangwechsel-Bedingungen
highGearShift: rpm >= 2000 && gear < 5
lowGearShift: rpm <= 1200 && gear > 1

// Motorbremse
newSpeed = oldSpeed * 0.98  // beim Runterschalten

// Drehzahl-Follow
rpm += (targetRPM - rpm) * dt * response
response = (targetRPM > rpm) ? 1.5 : 2.2

// Geschwindigkeit-Follow
speed += (targetSpeed - speed) * dt * 5

// Bremse
speed -= 24 * dt  // 24 km/h pro Sekunde
```

---

## 🚀 Schnellstart für LLM-Rekonstruktion

Um die App zu rekonstruieren:

1. **HTML erstellen** mit der DOM-Struktur aus Abschnitt 4
2. **CSS schreiben** mit den Styles aus Abschnitt 5
3. **JavaScript implementieren** mit den Funktionen aus Abschnitt 6
4. **Audio-Dateien** in `/audio/` ablegen
5. **Icons** in `/icons/` ablegen
6. **manifest.webmanifest** erstellen
7. **Testen** in Chrome/Firefox mit Live Server

### Minimale Test-Setup
```bash
# Ordnerstruktur erstellen
mkdir -p golf4_tdi_racing/{audio,icons}

# HTML, CSS, JS, Manifest erstellen
touch golf4_tdi_racing/{index.html,style.css,script.js,manifest.webmanifest}

# Mit Live Server testen (VS Code Extension)
# Oder mit Python:
python3 -m http.server 8000 --directory golf4_tdi_racing
```

---

**Hinweis**: Dieser Prompt sollte einem LLM ermöglichen, die komplette Golf 4 TDI Motor Simulator App zu rekonstruieren. Alle technischen Details, Farben, Formeln und Logik sind enthalten.


### Audio-Abmischung (aktualisiert)
- Leerlauf-Sample im Stand nur leise als Basis; während der Fahrt wird es weiter abgesenkt, damit das Diesel-Nageln nicht dominiert.
- Fahr-Sample übernimmt bei steigender Drehzahl und Geschwindigkeit deutlich stärker.
- Größerer, geglätteter Playback-Rate-Bereich des Fahr-Samples macht Beschleunigen und Hochschalten hörbarer.
- Filterung des Leerlauf-Samples reduziert scharfe Nagelanteile; der Fahr-Sound erhält mit Drehzahl mehr Obertöne.
