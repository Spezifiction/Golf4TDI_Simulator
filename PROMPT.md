# PROMPT: Golf 4 TDI Motor Simulator - Recreation Guide

This document contains all technical specifications needed to recreate the Golf 4 TDI Motor Simulator application using an LLM.

---

## PROJECT OVERVIEW

Create a **responsive web application** that simulates a VW Golf 4 1.9 TDI diesel engine with realistic behavior.

### Core Requirements
- **Language**: HTML5, CSS3, Vanilla JavaScript (ES6+)
- **API**: Web Audio API for audio processing
- **Target**: Modern browsers (Chrome, Firefox, Safari, Edge)
- **Deployment**: GitHub Pages compatible
- **Mobile**: Touch-optimized, responsive design

---

## FILE STRUCTURE

```
project/
├── index.html          # Main HTML file
├── style.css           # All styles
├── script.js           # Main logic
├── manifest.webmanifest # PWA manifest
├── sw.js               # Service worker (optional)
├── README.md           # Project documentation
├── PROMPT.md           # This file
├── icons/              # App icons
│   ├── favicon.ico
│   ├── favicon.svg
│   ├── favicon-96x96.png
│   ├── apple-touch-icon.png
│   ├── web-app-manifest-192x192.png
│   └── web-app-manifest-512x512.png
└── audio/              # Audio samples
    ├── leerlauf-loop.mp3
    ├── fahr-loop.mp3
    └── drehzahl-anhebung.mp3
```

---

## TECHNICAL SPECIFICATIONS

### 1. Engine Parameters

```javascript
// Engine constants
const IDLE = 850;           // Idle RPM
const MAX_RPM = 4200;       // Maximum RPM
const SHIFT_UP = 2000;      // Automatic upshift RPM
const SHIFT_DOWN = 1200;    // Automatic downshift RPM

// Gear ratios (Motor to Wheel) - Golf 4 TDI 1.9
const ratios = [0, 12.804, 6.991, 4.568, 3.277, 2.521];
// Index: 0=Neutral, 1=1st gear, 2=2nd gear, etc.
```

### 2. Speed Calculation Formula

```javascript
// Speed in km/h = RPM × 0.114 / ratio
// Derived from: wheel circumference ≈ 1.98m, gear ratio calculation
function calcSpeedFromRpm(rpm, gear) {
  if (gear > 0) return rpm * 0.114 / ratios[gear];
  return 0;
}
```

### 3. Shifting Behavior

#### Automatic Shifting
- **Upshift**: When RPM ≥ 2000 U/min (except in 5th gear)
- **Downshift**: When RPM ≤ 1200 U/min (except in 1st gear)
- **Shift cooldown**: 600ms between shifts
- **Neutral to 1st**: Automatic when RPM ≥ 1000 U/min

#### Manual Shifting (via click)
- **Upshift**: RPM decreases, speed remains constant
- **Downshift**: RPM increases, speed reduces by 2% (engine braking)
- **Formula**: `newRPM = newSpeed * ratios[newGear] / 0.114`

### 4. Diesel Engine Characteristics

```javascript
// RPM response rates
const responseUp = 1.5;    // Slower RPM increase (diesel characteristic)
const responseDown = 2.2;  // Moderate RPM decrease

// Throttle response
const throttleIncrease = 0.7;   // Throttle rises slowly (per second)
const throttleDecrease = 1.8;   // Throttle drops faster
const throttleIdleDecay = 0.02;  // Very slow decay when no input
```

### 5. Audio Behavior

#### Audio Sources
- **Idle loop**: Continuous engine idle sound
- **Drive loop**: Continuous driving sound
- **Rev sweep**: One-shot engine acceleration sound

#### Audio Mixing
- **Crossfading** between idle and drive samples based on RPM
- **Playback rate** adjustments based on RPM
- **Filter frequency** adjustments based on RPM and load
- **Volume modulation** for realistic variation

#### Audio Logic
```javascript
// Volume balance
const idleVolume = (1 - driveFactor) * modulation * 0.8;
const driveVolume = driveFactor * modulation * 0.9;

// Playback rates
const idleRate = Math.max(0.82, Math.min(1.2, 0.88 + norm * 0.22));
const driveRate = Math.max(0.72, Math.min(1.62, rpm / 1850));

// Filter frequencies
const driveFilterFreq = 1800 + load * 6800 + norm * 900;
const idleFilterFreq = 2400 + load * 1600;
```

### 6. UI Elements

#### Main Displays
- **Speed**: km/h, large display
- **RPM**: U/min, with thousands separator
- **Gear**: N, 1, 2, 3, 4, 5 (highlighted when selected)
- **State**: BEREIT / MOTOR LÄUFT / MOTOR AUS

#### Controls
- **Start/Stop button**: Toggles engine on/off
- **Gas pedal**: Hold to accelerate
- **Brake pedal**: Hold to brake
- **Speed slider**: Manual speed control
- **Load slider**: Manual throttle control
- **RPM slider**: Manual RPM control
- **Mute button**: Toggle audio on/off
- **Modulation toggle**: Enable/disable RPM modulation

#### Gear Selection
- **Clickable gear buttons**: N, 1, 2, 3, 4, 5
- **Automatic mode**: Shifts at 1200/2000 RPM
- **Manual mode**: Click to select gear

#### Visual Indicators
- **Tachometer fill**: Percentage of RPM/MAX_RPM
- **Shift markers**: Red lines at 1200 RPM (30%) and 2000 RPM (50%)
- **Live indicator**: Dot shows engine running state

---

## FUNCTIONAL REQUIREMENTS

### 1. Engine State Management

```javascript
const state = {
  running: false,      // Engine running
  muted: false,         // Audio muted
  speed: 0,            // Current speed in km/h
  load: 0,             // Throttle position (0-1)
  rpm: 0,              // Current RPM
  gear: 0,             // Current gear (0=neutral)
  gasHeld: false,       // Gas pedal pressed
  brakeHeld: false,     // Brake pedal pressed
  useManualRpm: false,  // Manual RPM mode active
  manualRpmTarget: null // Target RPM in manual mode
};
```

### 2. Core Functions

#### init()
- Initialize Web Audio API context
- Load audio samples (idle, drive, rev)
- Create audio nodes (sources, filters, gains)
- Set up audio routing

#### start()
- Resume audio context
- Set engine to running state
- Initialize RPM to IDLE
- Start animation frame loop
- Enable audio

#### stop()
- Stop all audio sources
- Set engine to stopped state
- Reset RPM to 0
- Reset speed and gear

#### tick(now)
- Main animation loop
- Update throttle based on inputs
- Handle gear shifting
- Calculate target RPM
- Update RPM with response rates
- Calculate target speed
- Update speed with inertia
- Update UI
- Update audio

#### shift()
- Check if gear change needed
- Handle upshift/downshift
- Calculate new RPM based on speed
- Apply shift cooldown (600ms)
- Show shift hint

#### selectGearManually(gearNum)
- Handle manual gear selection
- Calculate new RPM: `speed * ratios[gear] / 0.114`
- Apply engine braking on downshift (speed × 0.98)
- Update load based on new RPM
- Maintain manual RPM mode

#### targetRPM()
- Return target RPM based on mode
- Manual mode: return manualRpmTarget
- Automatic mode: `IDLE + load * (MAX_RPM - IDLE)`

#### calcSpeedFromRpm()
- Return speed: `rpm * 0.114 / ratios[gear]`

#### audio()
- Update audio parameters based on current state
- Crossfade between idle and drive samples
- Adjust playback rates and filter frequencies
- Mute when RPM = 0

#### playRevSweep()
- Play acceleration sound when throttle applied
- Adjust playback rate based on current RPM

---

## UI/UX SPECIFICATIONS

### HTML Structure

```html
<!-- Header -->
<header>
  <logo>TDI</logo>
  <title>Golf 4 1.9 TDI</title>
  <live-indicator/>
</header>

<!-- Dashboard -->
<section class="dash">
  <main-readout>
    <speed-display/>
    <rpm-display/>
  </main-readout>
  <tachometer>
    <tach-top>0 1 2 3 4</tach-top>
    <tach-track><fill/></tach-track>
    <tach-bottom>×1000 U/min, <gear-label/></tach-bottom>
  </tachometer>
  <gear-strip>
    <gear-buttons>N 1 2 3 4 5</gear-buttons>
    <shift-hint/>
  </gear-strip>
</section>

<!-- Controls -->
<section class="controls">
  <pedals>
    <brake-button/>
    <start-button/>
    <gas-button/>
  </pedals>
  <sliders>
    <speed-slider/>
    <load-slider/>
    <rpm-slider/>
  </sliders>
  <bottom-row>
    <modulation-toggle/>
    <mute-button/>
  </bottom-row>
</section>

<!-- Audio Panel -->
<details class="source-panel">
  <summary>Audio-Quellen & Hinweise</summary>
  <file-inputs for idle and drive samples/>
</details>
```

### CSS Requirements

- **Color scheme**: Dark theme (#0b1015 background)
- **Typography**: Inter, system-ui font stack
- **Responsive**: Mobile-first, max-width 560px
- **Tachometer**: Circular design with gradient fill
- **Gear buttons**: Grid layout, selectable
- **Shift markers**: Red vertical lines at 30% and 50%
- **Pedals**: Visual feedback on press

### Color Variables

```css
:root {
  --bg: #080c10;
  --line: rgba(206, 224, 232, 0.10);
  --muted: #82929d;
  --text: #edf4f5;
  --mint: #a7d8c8;
  --amber: #d9b77c;
  --red: #d77d75;
}
```

---

## AUDIO FILE SPECIFICATIONS

### Required Files
1. **leerlauf-loop.mp3** - Engine idle loop (continuous)
2. **fahr-loop.mp3** - Engine driving loop (continuous)
3. **drehzahl-anhebung.mp3** - Engine acceleration sweep (one-shot)

### Audio Characteristics
- **Sample rate**: 44.1kHz or 48kHz recommended
- **Bit depth**: 16-bit or 24-bit
- **Format**: MP3 or WAV
- **Content**: Clean recordings of actual Golf 4 TDI engine

---

## DEPLOYMENT REQUIREMENTS

### GitHub Pages
1. All files in root directory
2. `index.html` as entry point
3. `manifest.webmanifest` for PWA support
4. All icons in `/icons/` directory
5. All audio files in `/audio/` directory

### manifest.webmanifest
```json
{
  "name": "Golf 4 TDI Motor Simulator",
  "short_name": "TDI Simulator",
  "description": "Interaktive Golf 4 TDI Motorensimulation",
  "start_url": ".",
  "display": "standalone",
  "background_color": "#0b1015",
  "theme_color": "#0b1015",
  "icons": [
    {"src": "icons/favicon-96x96.png", "sizes": "96x96", "type": "image/png"},
    {"src": "icons/apple-touch-icon.png", "sizes": "180x180", "type": "image/png", "purpose": "any"},
    {"src": "icons/web-app-manifest-192x192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable"},
    {"src": "icons/web-app-manifest-512x512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable"}
  ]
}
```

---

## TESTING CHECKLIST

- [ ] Engine starts at IDLE (850 RPM)
- [ ] Engine stops at 0 RPM
- [ ] Gas pedal increases RPM
- [ ] Brake pedal decreases load
- [ ] Automatic upshift at 2000 RPM
- [ ] Automatic downshift at 1200 RPM
- [ ] Manual gear selection works
- [ ] Manual RPM control works
- [ ] Speed matches RPM and gear
- [ ] Engine braking on downshift
- [ ] Audio crossfades correctly
- [ ] Mute button works
- [ ] Responsive on mobile
- [ ] Icons display correctly

---

## RECREATION INSTRUCTIONS

To recreate this application:

1. **Create HTML structure** with all sections (header, dash, controls)
2. **Implement CSS** with dark theme and responsive design
3. **Create Web Audio API context** with sources, filters, and gains
4. **Load audio samples** (leerlauf-loop.mp3, fahr-loop.mp3, drehzahl-anhebung.mp3)
5. **Implement engine physics** with correct gear ratios and speed calculation
6. **Add shifting logic** with automatic and manual modes
7. **Implement diesel characteristics** (slow RPM response, engine braking)
8. **Add UI controls** (gas, brake, start/stop, sliders)
9. **Add visual feedback** (tachometer, gear display, speed/RPM readouts)
10. **Test thoroughly** on desktop and mobile

---

**Note**: This document contains all necessary technical specifications to recreate the Golf 4 TDI Motor Simulator application. The implementation should follow these specifications precisely for accurate engine behavior simulation.
