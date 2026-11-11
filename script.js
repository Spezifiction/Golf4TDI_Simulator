/* Zwei Layer (Leerlauf/Fahrt) werden wie in einer vereinfachten Game-Audioengine
   überblendet. Rate-Änderungen beeinflussen auch die Tonhöhe. Für echte RPM-
   Samples wäre eine größere, separat aufgenommene Samplebank erforderlich. */
(() => {
  "use strict";
  const $=id=>document.getElementById(id);
  // iOS Erkennung - wichtig für Audio Autoplay Policies
  // iOS 17+: Web Audio auch bei aktivem Stummschalter hörbar machen
  try{if(navigator.audioSession)navigator.audioSession.type='playback'}catch(_){}
  const isIOS = /iPad|iPhone|iPod/.test(navigator.platform) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  
  const s={ctx:null,initPromise:null,master:null,idleGain:null,driveGain:null,idleFilter:null,driveFilter:null,
    t5IdleGain:null,t5CruiseGain:null,t5LoadGain:null,t5IdleFilter:null,t5DriveFilter:null,
    idleSource:null,driveSource:null,t5IdleSource:null,t5CruiseSource:null,t5LoadSource:null,
    idleBuffer:null,driveBuffer:null,t5IdleBuffer:null,t5CruiseBuffer:null,t5LoadBuffer:null,revBuffer:null,revGain:null,revFilter:null,revSource:null,running:false,muted:false,
    speed:0,load:0,rpm:0,gear:0,gasHeld:false,brakeHeld:false,lastTime:0,raf:0,mod:1,modTimer:0,urls:[],
    useManualRpm:false,manualRpmTarget:null,shiftCooldown:0,
    cityDriveActive:false,cityDriveStartTime:0,cityDriveLoopInterval:null,lastCityAction:0,cityDriveCycle:0,cityDriveGasPlayed:false,cityDriveLoadTarget:0,cityDriveSpeedTarget:0,cityDriveBrakeActive:false};
  // Realistische Übersetzungsverhältnisse Motor zu Rad für Golf 4 TDI 1.9
  // v (km/h) = (RPM * 0.13) / ratio (angepasst an reale Tabellenwerte)
  const ratios=[0,12.804,6.991,4.568,3.277,2.521], IDLE=850, MAX_RPM=4200;
  let SHIFT_UP=2000, SHIFT_DOWN=1200, startInProgress=false, iosAudioNoticeShown=false;
  
  // Stadtfahrt mit expliziten Geschwindigkeitszielen und Ampelstopp.
  const cityDriveSequence = [
    [0,     {gear: 1, load: 0.25, speed: 0}],
    [2500,  {gear: 2, load: 0.22, speed: 24}],
    [4500,  {gear: 3, load: 0.20, speed: 36}],
    [7000,  {load: 0.18, speed: 45}],
    [10000, {gear: 4, load: 0.17, speed: 49}],
    [13000, {load: 0.12, speed: 42}],
    [14500, {gear: 3, load: 0.10, speed: 31}],
    [16500, {gear: 2, load: 0.08, speed: 22}],
    [18500, {brake: true, load: 0, speed: 0}],
    [20000, {gear: 0, brake: false, load: 0, speed: 0}]
  ];
  // Überlandfahrt: 60-s-Loop zwischen 60 und 110 km/h (Start = Ende bei ca. 60 km/h im 4. Gang).
  const overlandSequence = [
    [0,     {gear: 4, load: 0.15, speed: 60}],
    [4000,  {load: 0.30, speed: 78}],
    [7000,  {gear: 5, load: 0.20, speed: 90}],
    [11000, {load: 0.22, speed: 100}],
    [15000, {load: 0.30, speed: 110}],
    [21000, {load: 0.16, speed: 110}],
    [24000, {load: 0.00, speed: 88}],
    [30000, {gear: 4, load: 0.12, speed: 80}],
    [34000, {load: 0.32, speed: 92}],
    [38000, {gear: 5, load: 0.20, speed: 100}],
    [42000, {load: 0.00, speed: 75}],
    [52000, {gear: 4, load: 0.05, speed: 62}],
    [58000, {load: 0.15, speed: 60}]
  ];
  const driveProfiles = {
    city:     {seq: cityDriveSequence, duration: 30000, toggle: "cityToggle",     label: "Stadtfahrt", start: {speed: 0,  gear: 0, rpm: IDLE}},
    gps:      {seq: [],               duration: 3600000, toggle: "gpsToggle",      label: "GPS",        start: {speed: 0,  gear: 0, rpm: IDLE}},
    overland: {seq: overlandSequence,  duration: 60000, toggle: "overlandToggle", label: "Überland",   start: {speed: 60, gear: 4, rpm: 60 * ratios[4] / 0.13}}
  };
  const txt=(id,v)=>$(id).textContent=v;

  function ui(){
    txt("speedValue",Math.round(s.speed));txt("speedOut",`${Math.round(s.speed)} km/h`);
    txt("rpmValue",Math.round(s.rpm).toLocaleString("de-DE"));txt("loadOut",`${Math.round(s.load*100)} %`);
    // Bei RPM = 0: "AUS" anzeigen, sonst normal
    if(s.rpm <= 0 && !s.running){
      txt("gearLabel","MOTOR AUS");
    } else {
      txt("gearLabel",s.gear?`GANG ${s.gear}`:"LEERLAUF");
    }
    txt("rpmOut",`${Math.round(s.rpm)} U/min`);
    $("tachFill").style.width=`${Math.max(0,Math.min(100,s.rpm/MAX_RPM*100))}%`;
    ["N","1","2","3","4","5"].forEach((g,i)=>{const el=$("gear"+g);if(el)el.classList.toggle("selected",s.gear===i)});
    if(!s.useManualRpm) $("rpmSlider").value=Math.round(s.rpm);
  }
  async function getBuffer(url,ctx=s.ctx){
    try {
      const r = await fetch(url, {cache: "no-cache"});
      if(!r.ok) throw Error(`Audio fehlt: ${url} (HTTP ${r.status})`);
      const arrayBuffer = await r.arrayBuffer();
      if(arrayBuffer.byteLength === 0) throw Error(`Audio-Datei ist leer: ${url}`);
      return ctx.decodeAudioData(arrayBuffer);
    } catch(e) {
      // Auf iOS: manchmal scheitert fetch ohne CORS - falls Datei lokal ist, direkt versuchen
      if(e.name === "TypeError" && isIOS) {
        console.warn(`fetch failed for ${url}, retrying...`, e);
        try {
          const response = await fetch(url);
          if(response.ok) {
            return ctx.decodeAudioData(await response.arrayBuffer());
          }
        } catch(e2) {
          console.error(`Final fetch failed for ${url}:`, e2);
        }
      }
      throw Error(`Audio konnte nicht geladen werden: ${url} - ${e.message}`);
    }
  }
function makeLoop(buffer,filter){
    if(!buffer||!s.ctx||s.ctx.state==="closed")return null;
    const src=s.ctx.createBufferSource();
    src.buffer=buffer;src.loop=true;src.connect(filter);src.start();
    return src;
  }
  function connectLoopSources(){
    if(!s.ctx||s.ctx.state!=="running")return;
    const now = s.ctx.currentTime;
    
    function startSource(sourceKey, buffer, filter) {
      // alte Quelle stoppen
      if(s[sourceKey]) {
        try { s[sourceKey].stop(); s[sourceKey].disconnect(); } catch(_) {}
      }
      
      if(buffer) {
        const src = s.ctx.createBufferSource();
        src.buffer = buffer;
        src.loop = true;
        src.connect(filter);
        src.start(now);
        s[sourceKey] = src;
      }
    }
    
    startSource("idleSource", s.idleBuffer, s.idleFilter);
    startSource("driveSource", s.driveBuffer, s.driveFilter);
    startSource("t5IdleSource", s.t5IdleBuffer, s.t5IdleFilter);
    startSource("t5CruiseSource", s.t5CruiseBuffer, s.t5DriveFilter);
    startSource("t5LoadSource", s.t5LoadBuffer, s.t5DriveFilter);
  }
  async function init(){
    // Wenn Buffer schon geladen sind, nichts tun
    if(s.idleBuffer&&s.driveBuffer&&s.t5IdleBuffer&&s.t5CruiseBuffer&&s.t5LoadBuffer&&s.revBuffer)return;
    if(s.initPromise)return s.initPromise;
    
    s.initPromise=(async()=>{
      // AudioContext erstellen (aber nicht resume - das passiert in start())
      const C=window.AudioContext||window.webkitAudioContext;
      if(!C)throw Error("Web Audio API nicht verfügbar");
      const ctx=s.ctx || new C();s.ctx=ctx;
      
      // Alle Quellen auf null setzen
      s.idleSource=s.driveSource=s.t5IdleSource=s.t5CruiseSource=s.t5LoadSource=s.revSource=null;
      
      // Knoten erstellen und verkabeln
      s.master=ctx.createGain();s.master.gain.value=s.muted?0:.82;
      s.idleFilter=ctx.createBiquadFilter();s.driveFilter=ctx.createBiquadFilter();
      [s.idleFilter,s.driveFilter].forEach(f=>{f.type="lowpass";f.frequency.value=9000;f.Q.value=.55});
      s.t5IdleFilter=ctx.createBiquadFilter();s.t5IdleFilter.type="lowpass";s.t5IdleFilter.frequency.value=5200;s.t5IdleFilter.Q.value=.65;
      s.t5DriveFilter=ctx.createBiquadFilter();s.t5DriveFilter.type="lowpass";s.t5DriveFilter.frequency.value=6800;s.t5DriveFilter.Q.value=.6;
      s.idleGain=ctx.createGain();s.driveGain=ctx.createGain();
      s.t5IdleGain=ctx.createGain();s.t5CruiseGain=ctx.createGain();s.t5LoadGain=ctx.createGain();
      [s.idleGain,s.driveGain,s.t5IdleGain,s.t5CruiseGain,s.t5LoadGain].forEach(g=>g.gain.value=0);
      s.revFilter=ctx.createBiquadFilter();s.revFilter.type="bandpass";s.revFilter.frequency.value=1900;s.revFilter.Q.value=.65;
      s.revGain=ctx.createGain();s.revGain.gain.value=0;
      
      // Verkabelung
      s.idleFilter.connect(s.idleGain);s.driveFilter.connect(s.driveGain);
      s.t5IdleFilter.connect(s.t5IdleGain);s.t5DriveFilter.connect(s.t5CruiseGain);s.t5DriveFilter.connect(s.t5LoadGain);
      [s.idleGain,s.driveGain,s.t5IdleGain,s.t5CruiseGain,s.t5LoadGain,s.revGain].forEach(g=>g.connect(s.master));
      s.revFilter.connect(s.revGain);s.master.connect(ctx.destination);
      
      // Buffer laden
      const [idle,drive,rev,t5Idle,t5Cruise,t5Load]=await Promise.all([
        getBuffer("audio/leerlauf-loop.mp3",ctx),getBuffer("audio/fahr-loop.mp3",ctx),
        getBuffer("audio/drehzahl-anhebung.mp3",ctx),getBuffer("audio/leerlauf-t5-loop.mp3",ctx),
        getBuffer("audio/fahrt-t5-cruise-loop.mp3",ctx),getBuffer("audio/fahrt-t5-last-loop.mp3",ctx)
      ]);
      s.idleBuffer=idle;s.driveBuffer=drive;s.revBuffer=rev;
      s.t5IdleBuffer=t5Idle;s.t5CruiseBuffer=t5Cruise;s.t5LoadBuffer=t5Load;
      
      // State Listener
      ctx.addEventListener("statechange",updateAudioStatus);
      
      if(ctx.state==="closed")throw Error("AudioContext wurde geschlossen");
    })();
    try{await s.initPromise}
    catch(err){
      const old=s.ctx;s.ctx=null;s.idleBuffer=s.driveBuffer=s.revBuffer=null;
      s.t5IdleBuffer=s.t5CruiseBuffer=s.t5LoadBuffer=null;
      if(old&&old.state!=="closed")try{await old.close()}catch(_){}
      throw err;
    } finally {s.initPromise=null}
  }
  async function recoverAudio(){
    // resume() direkt im Tap-Handler anstoßen, bevor init() asynchron wartet.
    let resumePromise;
    if(s.ctx && s.ctx.state!=="closed") {
      try{resumePromise=s.ctx.resume()}catch(err){resumePromise=Promise.reject(err)}
    }
    await init();
    if(resumePromise)await resumePromise;
    if(s.ctx.state === "suspended" || s.ctx.state === "interrupted") {
      await s.ctx.resume();
    }

    if(s.ctx.state !== "running") {
      throw Error(`AudioContext ist ${s.ctx.state}`);
    }
    
    const now = s.ctx.currentTime;
    s.master.gain.cancelScheduledValues(now);
    s.master.gain.setTargetAtTime(s.muted ? 0 : .82, now, .035);
    
    connectLoopSources();
    if(s.running) audio();
    return true;
  }
  function selectGear(){
    // Fliehkraftkupplung: Gang N -> 1 ab 1000 RPM
    if(s.gear===0 && s.rpm>=1000) return 1;
    // Kein Gangwechsel im Leerlauf
    if(s.gear===0) return 0;
    // Drehzahl-Modus: Gang bleibt, Drehzahl wird vom Nutzer vorgegeben
    if(s.useManualRpm) return s.gear;
    
    // Schaltverzögerung: nur alle 600ms schalten (realistischer für manuelles Getriebe)
    if(s.shiftCooldown>Date.now()) return s.gear;
    
    // Nur EINEN Gang hoch oder runter
    // Hochschalten bei hoher Drehzahl (aber nicht im 5. Gang)
    if(s.rpm>=SHIFT_UP && s.gear<5) return s.gear+1;
    // Runterschalten bei niedriger Drehzahl (aber nicht im 1. Gang)
    if(s.rpm<=SHIFT_DOWN && s.gear>1) return s.gear-1;
    
    return s.gear;
  }
  function targetRPM(){
    // Wenn Motor aus, Ziel ist 0
    if(!s.running) return 0;
    // Wenn manuelle RPM-Steuerung aktiv
    if(s.useManualRpm && s.manualRpmTarget !== null) {
      return s.manualRpmTarget;
    }
    // Drehzahl aus Gaspedalstellung
    return IDLE + s.load * (MAX_RPM - IDLE);
  }
  function calcSpeedFromRpm(){
    // Realistische Berechnung für Golf 4 TDI 1.9 (90 PS)
    // v (km/h) = RPM * 0.13 / ratio
    // Anpassung basierend auf Tabellenwerten:
    // - 30 km/h, Gang 2: ~1700 U/min (Faktor: 0.1234)
    // - 50 km/h, Gang 3: ~1800 U/min (Faktor: 0.1269)
    // - 80 km/h, Gang 4: ~2000 U/min (Faktor: 0.1311)
    // - 100 km/h, Gang 5: ~1900 U/min (Faktor: 0.1327)
    // - 150 km/h, Gang 5: ~2900 U/min (Faktor: 0.1294)
    // Durchschnittsfaktor: 0.13
    if(s.gear>0)return s.rpm*0.13/ratios[s.gear];
    return 0;
  }
  function audio(){
    if(!s.ctx||s.ctx.state!=="running"||!s.running)return;
    const now=s.ctx.currentTime;
    if(s.rpm<=0){
      [s.idleGain,s.driveGain,s.t5IdleGain,s.t5CruiseGain,s.t5LoadGain,s.revGain].forEach(g=>g.gain.setTargetAtTime(0,now,.08));
      return;
    }
    const norm=Math.max(0,Math.min(1,(s.rpm-850)/2700));
    const moving=Math.max(0,Math.min(1,s.speed/12));
    const modulation=s.mod;
    const idleLevel=s.muted?0:Math.max(.025,.20-norm*.12-moving*.08)*modulation;
    const driveLevel=s.muted?0:Math.min(.92,.30+norm*.34+moving*.16+s.load*.12)*modulation;
    // Die T5-Aufnahmen ergänzen den ursprünglichen Klang: ruhiger T5-Leerlauf
    // unten, gleichmäßiger Fahrtklang bei Bewegung und Last-Sample bei Gas.
    const t5IdleLevel=s.muted?0:Math.max(.015,.16-norm*.10-moving*.035)*modulation;
    const t5CruiseLevel=s.muted?0:Math.min(.18,.035+moving*.075+norm*.025)*modulation;
    const t5LoadLevel=s.muted?0:Math.min(.17,.025+norm*.035+s.load*.105)*modulation;
    s.idleGain.gain.setTargetAtTime(idleLevel,now,.24);
    s.driveGain.gain.setTargetAtTime(driveLevel,now,.20);
    s.t5IdleGain.gain.setTargetAtTime(t5IdleLevel,now,.28);
    s.t5CruiseGain.gain.setTargetAtTime(t5CruiseLevel,now,.30);
    s.t5LoadGain.gain.setTargetAtTime(t5LoadLevel,now,.24);
    if(s.idleSource)s.idleSource.playbackRate.setTargetAtTime(Math.max(.86,Math.min(1.18,.88+norm*.28)),now,.22);
    if(s.driveSource)s.driveSource.playbackRate.setTargetAtTime(Math.max(.82,Math.min(1.62,.82+norm*.76)),now,.18);
    if(s.t5IdleSource)s.t5IdleSource.playbackRate.setTargetAtTime(.92+norm*.22,now,.25);
    if(s.t5CruiseSource)s.t5CruiseSource.playbackRate.setTargetAtTime(.88+norm*.42,now,.22);
    if(s.t5LoadSource)s.t5LoadSource.playbackRate.setTargetAtTime(.86+norm*.50,now,.18);
    s.driveFilter.frequency.setTargetAtTime(1900+s.load*3000+norm*1900,now,.24);
    s.idleFilter.frequency.setTargetAtTime(1250+s.load*350,now,.30);
    s.t5IdleFilter.frequency.setTargetAtTime(1100+norm*2300,now,.30);
    s.t5DriveFilter.frequency.setTargetAtTime(1800+s.load*2800+norm*2300,now,.24);
  }
  function playRevSweep(){
    if(!s.ctx||!s.running||!s.revBuffer||s.muted||s.rpm<=0)return;
    // Ein echter Gasstoß aus der neuen Aufnahme; ein vorheriger Sweep wird sauber ersetzt.
    try{if(s.revSource){s.revSource.stop();s.revSource.disconnect()}}catch(_){}
    const src=s.ctx.createBufferSource();src.buffer=s.revBuffer;
    const norm=Math.max(0,Math.min(1,(s.rpm-850)/3000));
    src.playbackRate.value=.92+norm*.16;
    src.connect(s.revFilter);s.revSource=src;
    const now=s.ctx.currentTime;
    s.revGain.gain.cancelScheduledValues(now);s.revGain.gain.setValueAtTime(0,now);
    s.revGain.gain.linearRampToValueAtTime(.16,now+.16);
    s.revGain.gain.setTargetAtTime(.085,now+1.0,.8);
    src.onended=()=>{if(s.revSource===src){s.revGain.gain.setTargetAtTime(0,s.ctx.currentTime,.12);s.revSource=null}};
    src.start();
  }
  function shift(){
    const next=selectGear();
    if(next!==s.gear && s.shiftCooldown<=Date.now()){
      s.shiftCooldown=Date.now()+600; // 600ms Schaltverzögerung
      const wasNeutral=s.gear===0;
      const oldGear = s.gear;
      s.gear=next;
      
      // Berechne aktuelle Geschwindigkeit vor dem Schalten
      const currentSpeed = s.speed;
      
      // Bei Schaltvorgang N->1: Drehzahl basierend auf Gaspedalstellung
      if(wasNeutral && next===1){
        // Aus dem Stand: Drehzahl steigt auf IDLE + Lastanteil
        s.rpm = Math.max(IDLE, Math.min(MAX_RPM, IDLE + s.load * 500));
      }
      // Bei Hochschalten: Drehzahl sinkt, Geschwindigkeit bleibt erhalten
      else if(next > oldGear && oldGear > 0 && next <= 5){
        const oldSpeed = s.rpm * 0.13 / ratios[oldGear];
        s.rpm = Math.min(MAX_RPM - 200, Math.max(IDLE, oldSpeed * ratios[next] / 0.13));
        s.speed = oldSpeed;
      }
      // Bei Runterschalten: Drehzahl steigt, Motorbremse wirkt
      else if(next < oldGear && next >= 1){
        const oldSpeed = s.rpm * 0.13 / ratios[oldGear];
        const newSpeed = oldSpeed * 0.98; // Motorbremse
        s.rpm = Math.min(MAX_RPM - 100, Math.max(IDLE, newSpeed * ratios[next] / 0.13));
        s.speed = newSpeed;
      }
      
      txt("shiftHint",`SCHALTVORGANG → ${next===0?'N':next+'. GANG'}`);
      setTimeout(()=>txt("shiftHint",`Automatik · ↑${SHIFT_UP} / ↓${SHIFT_DOWN} U/min`),650);
    }
  }
  function tick(now){
    if(!s.running)return;const dt=Math.min(.05,(now-s.lastTime)/1000||.016);s.lastTime=now;
    

    
    // Last durch Gas/Bremse steuern - Gaspedal träger
    if(s.cityDriveActive) {
      s.load = Math.max(0, Math.min(1, s.cityDriveLoadTarget));
      s.gasHeld = false; // Simuliertes Gas ist keine manuelle Nutzeraktion.
    }
    else if(s.gasHeld){s.load=Math.min(1,s.load+dt*0.3);}
    else if(s.brakeHeld){s.load=Math.max(0,s.load-dt*1.8);}
    else if(s.useManualRpm) {
      // Bei manueller RPM: Load basierend auf aktueller Drehzahl und Gang
      s.load = Math.max(0, Math.min(1, (s.rpm - IDLE) / (MAX_RPM - IDLE)));
    }
    else {s.load=Math.max(0,s.load-dt*0.02);} // Langsame Reduktion
    
    // Gang wechseln (RPM-basiert) - nicht bei Stadtfahrt
    if(!s.cityDriveActive) {
      shift();
    } else {
      // Bei Stadtfahrt: Gang aus der Sequenz verwenden, nicht automatisch schalten
      // Der Gang wird direkt in applyCityAction gesetzt
    }
    
    if(s.cityDriveActive) {
      // Die Stadtfahrt steuert die Geschwindigkeit direkt über ihr Fahrprofil.
      const speedError = s.cityDriveSpeedTarget - s.speed;
      if(s.cityDriveBrakeActive) {
        s.speed = Math.max(0, s.speed - 24 * dt);
      } else if(s.driveKind === "gps") {
        s.speed += speedError * Math.min(1, dt * 2.5);
        if(Math.abs(speedError) < 0.05) s.speed = s.cityDriveSpeedTarget;
      } else if(speedError > 0) {
        const acceleration = Math.min(10, 2.5 + s.load * 30);
        s.speed = Math.min(s.cityDriveSpeedTarget, s.speed + acceleration * dt);
      } else if(speedError < 0) {
        const deceleration = Math.min(3.0, Math.max(1.2, Math.abs(speedError) * 0.35));
        s.speed = Math.max(s.cityDriveSpeedTarget, s.speed - deceleration * dt);
      }
      // Drehzahl folgt Geschwindigkeit und Gang mit kurzer Trägheit.
      // So bleiben Schaltvorgänge hörbar, ohne dass die Drehzahl sprunghaft springt.
      const targetCityRpm = (s.gear > 0 && s.speed > 0.5)
        ? Math.max(IDLE, Math.min(MAX_RPM, s.speed * ratios[s.gear] / 0.13))
        : IDLE;
      const rpmResponse = targetCityRpm > s.rpm ? 2.8 : 4.2;
      s.rpm += (targetCityRpm - s.rpm) * Math.min(1, dt * rpmResponse);
      s.rpm = Math.max(IDLE, Math.min(MAX_RPM, s.rpm));
    } else {
      const targetRpm = targetRPM();
      if(s.gear > 0 && !s.useManualRpm){
        // Gang eingelegt: Geschwindigkeit strebt dem Gang/Last-Ziel zu, die Drehzahl folgt
        // starr der Geschwindigkeit. Dadurch greifen die Schaltpunkte (Slider) wirklich:
        // nach dem Hochschalten fällt die Drehzahl, Runterschalten bei zu niedriger Drehzahl.
        const targetSpeed = targetRpm * 0.13 / ratios[s.gear];
        const k = targetSpeed > s.speed ? 0.8 : 0.5;
        s.speed += (targetSpeed - s.speed) * Math.min(1, dt * k);
        if(s.brakeHeld) s.speed = Math.max(0, s.speed - 24 * dt);
        s.speed = Math.max(0, Math.min(MAX_RPM * 0.13 / ratios[s.gear], s.speed));
        s.rpm = Math.max(IDLE, Math.min(MAX_RPM, s.speed * ratios[s.gear] / 0.13));
      } else {
        const response = s.useManualRpm ? 8 : (targetRpm > s.rpm ? 0.8 : 1.8);
        s.rpm += (targetRpm - s.rpm) * Math.min(1, dt * response);
        s.rpm = Math.max(s.running ? IDLE : 0, Math.min(MAX_RPM, s.rpm));
        const targetSpeed = calcSpeedFromRpm();
        if(s.gear > 0) s.speed += (targetSpeed - s.speed) * Math.min(1, dt * 1.5);
        else s.speed = 0;
        if(s.brakeHeld) s.speed = Math.max(0, s.speed - 24 * dt);
        const maxPossibleSpeed = s.gear > 0 ? MAX_RPM * 0.13 / ratios[s.gear] : 200;
        s.speed = Math.max(0, Math.min(maxPossibleSpeed, s.speed));
      }
    }

    // UI aktualisieren
    $("speedSlider").value=Math.round(s.speed);
    $("loadSlider").value=Math.round(s.load*100);
    ui();audio();s.raf=requestAnimationFrame(tick);
  }
  async function start(){
    setMediaInfo();
    if(startInProgress)return;
    startInProgress=true;
    try{
      keepAliveOn(); // synchron im Tap-Handler, damit play() erlaubt ist
      if(s.running){await recoverAudio();return}

      // Safari/iOS: Context im direkten Tap-Handler erzeugen und resume()
      // synchron anstoßen, bevor ein await die User Activation verlieren kann.
      const C=window.AudioContext||window.webkitAudioContext;
      if(!C)throw Error("Web Audio API nicht verfügbar");
      if(!s.ctx || s.ctx.state==="closed")s.ctx=new C();
      let unlockPromise;
      try{unlockPromise=s.ctx.resume()}catch(err){unlockPromise=Promise.reject(err)}
      await Promise.all([init(),unlockPromise]);
      if(s.ctx.state==="suspended" || s.ctx.state==="interrupted")await s.ctx.resume();

      if(s.ctx.state !== "running") {
        throw Error("AudioContext konnte nicht gestartet werden - iOS erfordert Nutzerinteraktion");
      }
      
      // 3. Master Gain einstellen
      const now = s.ctx.currentTime;
      s.master.gain.cancelScheduledValues(now);
      s.master.gain.setTargetAtTime(s.muted ? 0 : .82, now, .025);
      
      // 4. ALLE Quellen starten (MUSS in User Gesture passieren!)
      // Dies ist der entscheidende Punkt: src.start() muss hier aufgerufen werden
      connectLoopSources();
      
      if(!s.idleSource || !s.driveSource || !s.t5IdleSource || !s.t5CruiseSource || !s.t5LoadSource) {
        throw Error("Audioquellen konnten nicht gestartet werden");
      }
      
      // 5. Motor-Status setzen
      s.running = true;
      s.lastTime = performance.now();
      s.rpm = IDLE; s.load = 0; s.speed = 0; s.gear = 0;
      s.manualRpmTarget = s.useManualRpm ? IDLE : null; s.shiftCooldown = 0;
      
      $("startBtn").classList.add("running");
      txt("startLabel", "MOTOR STOPPEN");
      txt("stateLabel", "MOTOR LÄUFT");
      $("liveDot").classList.add("on");
      
      shift(); audio();
      cancelAnimationFrame(s.raf);
      s.raf = requestAnimationFrame(tick);
      modulate();
      txt("rpmOut", `${Math.round(s.rpm)} U/min`);
      $("rpmSlider").value = Math.round(s.rpm);
      ui();
    }catch(e){
      console.error("Start/Audio:", e);
      if(!s.running)keepAliveOff();
      txt("stateLabel", "TON NICHT VERFÜGBAR");
      txt("startLabel", "ERNEUT TON STARTEN");
      
      if(isIOS && !iosAudioNoticeShown) {
        iosAudioNoticeShown=true;
        alert("iPhone-Audio konnte nicht aktiviert werden. Tippe erneut auf „TON AKTIVIEREN“. Falls es weiterhin stumm bleibt: Web-App vollständig schließen und die Seite in Safari neu laden.");
      } else if(!isIOS) {
        console.warn("Ton konnte nicht gestartet werden:",e.message);
      }
    } finally {
      startInProgress=false;
    }
  }
  function stop(){
    s.running=false;stopCityDrive();keepAliveOff();
    s.gasHeld=false;s.brakeHeld=false;cancelAnimationFrame(s.raf);clearInterval(s.modTimer);
    if(s.ctx&&s.master){
      const now=s.ctx.currentTime;s.master.gain.cancelScheduledValues(now);
      s.master.gain.setTargetAtTime(0,now,.045);
    }
    [ "revSource","idleSource","driveSource","t5IdleSource","t5CruiseSource","t5LoadSource" ].forEach(key=>{
      const src=s[key];if(src){try{src.onended=null;src.stop();src.disconnect()}catch(_){}s[key]=null}
    });
    $("startBtn").classList.remove("running");$("gasBtn").classList.remove("active");$("brakeBtn").classList.remove("active");
    txt("startLabel","MOTOR STARTEN");txt("stateLabel","BEREIT");$("liveDot").classList.remove("on");
    s.manualRpmTarget=null;s.shiftCooldown=0;
    s.rpm=0;s.load=0;s.speed=0;s.gear=0;$("rpmSlider").value=0;txt("rpmOut","0 U/min");ui();
  }
  function modulate(){clearInterval(s.modTimer);s.modTimer=setInterval(()=>{s.mod=.985+Math.random()*.03;if(s.running)audio()},1800+Math.random()*1600)}
  
  async function startCityDrive(kind = "city"){
    stopCityDrive(false);
    s.driveKind = kind;
    Object.keys(driveProfiles).forEach(k => { if(k !== kind) $(driveProfiles[k].toggle).checked = false; });
    // Warten, bis Motor und Audio vollständig gestartet sind (auch bei langsamem Laden).
    if(!s.running) {
      await start();
      if(!s.running || !$(driveProfiles[kind].toggle).checked) return;
    }
    startCityDriveInternal();
    if(kind === "gps") startGps();
  }

  // ---- GPS-Modus: reale Geschwindigkeit -> Gang, Drehzahl, Last ----
  function showGpsDialog(msg){
    txt("gpsDialogText", msg);
    $("gpsDialog").hidden = false;
    $("gpsDialogOk").focus();
  }
  function gpsFail(msg){
    stopCityDrive();          // setzt Toggle zurück und geht in den Leerlauf
    showGpsDialog(msg);
  }
  function startGps(){
    if(!("geolocation" in navigator)) return gpsFail("Dieses Gerät bzw. dieser Browser unterstützt keine Standortabfrage. Der GPS-Modus ist am PC meist nicht nutzbar – bitte auf einem Smartphone verwenden.");
    if(window.isSecureContext === false) return gpsFail("Der Standortzugriff funktioniert nur über eine gesicherte Verbindung (HTTPS). Bitte die Seite über HTTPS öffnen.");
    s.gpsFixes = 0; s.gpsNullCount = 0; s.gpsRef = null; s.gpsLastSpeed = 0; s.gpsAccel = 0; s.gpsLastFix = performance.now(); s.gpsGearTime = 0;
    s.gpsWatch = navigator.geolocation.watchPosition(pos => {
      let v = pos.coords.speed;
      s.gpsFixes++;
      const c = pos.coords, ts = pos.timestamp || Date.now();
      if(v === null || v === undefined || isNaN(v)) {
        // Backup: Geschwindigkeit aus der Positionsänderung berechnen (iOS/WLAN-Ortung liefern oft speed=null)
        const ref = s.gpsRef;
        if(!ref) { s.gpsRef = {lat: c.latitude, lon: c.longitude, t: ts}; return; }
        const dt = (ts - ref.t) / 1000;
        if(dt < 1) return;
        const R = 6371000, rad = Math.PI / 180;
        const dLat = (c.latitude - ref.lat) * rad, dLon = (c.longitude - ref.lon) * rad;
        const h = Math.sin(dLat/2)**2 + Math.cos(ref.lat*rad) * Math.cos(c.latitude*rad) * Math.sin(dLon/2)**2;
        const dist = 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
        const noise = Math.max(3, (c.accuracy || 10) * 0.5);   // Positionsrauschen im Stand ignorieren
        if(dist < noise) { v = 0; if(dt > 5) s.gpsRef = {lat: c.latitude, lon: c.longitude, t: ts}; }
        else { v = dist / dt; s.gpsRef = {lat: c.latitude, lon: c.longitude, t: ts}; }
      }
      s.gpsNullCount = 0;
      const kmh = Math.max(0, v * 3.6);
      const now = performance.now(), dtg = Math.max(0.3, (now - s.gpsLastFix) / 1000);
      const a = (kmh - s.gpsLastSpeed) / dtg;
      s.gpsAccel += (a - s.gpsAccel) * 0.5;
      s.gpsLastSpeed = kmh; s.gpsLastFix = now;
      s.cityDriveSpeedTarget = Math.min(160, kmh);
    }, err => {
      if(err.code === 1) gpsFail("Der Zugriff auf den Standort wurde verweigert. Bitte die Standortberechtigung für diese Seite in den Browser-/Geräteeinstellungen erlauben.");
      else if(err.code === 2) gpsFail("Es ist kein GPS-Signal verfügbar. Bitte im Freien erneut versuchen und die Ortungsdienste aktivieren.");
      else if(s.gpsFixes === 0) gpsFail("Es konnte kein GPS-Signal ermittelt werden (Zeitüberschreitung). Bitte im Freien erneut versuchen.");
    }, {enableHighAccuracy: true, maximumAge: 0, timeout: 20000});

    s.gpsTimer = setInterval(() => {
      if(!s.cityDriveActive || s.driveKind !== "gps") return;
      // Signalverlust: Geschwindigkeit langsam gegen 0 laufen lassen
      if(performance.now() - s.gpsLastFix > 8000) { s.cityDriveSpeedTarget = 0; s.gpsAccel = 0; }
      const v = s.speed;
      // Gangwahl mit Hysterese (Hochschalten > 2200, Runterschalten < 1200 U/min)
      if(v < 1) { s.gear = 0; }
      else if(s.gear === 0) { s.gear = 1; }
      else if(Date.now() > s.gpsGearTime) {
        const rpmIn = g => v * ratios[g] / 0.13;
        if(s.gear < 5 && rpmIn(s.gear) > 2200) { s.gear++; s.gpsGearTime = Date.now() + 1200; txt("shiftHint", `GPS → ${s.gear}. GANG`); }
        else if(s.gear > 1 && rpmIn(s.gear) < 1200) { s.gear--; s.gpsGearTime = Date.now() + 1200; txt("shiftHint", `GPS → ${s.gear}. GANG`); }
      }
      // Last aus Beschleunigung und Grundlast für Fahrtwiderstand
      let load = 0;
      if(v >= 1) load = 0.08 + Math.max(0, s.gpsAccel) * 0.06 + (v / 160) * 0.12;
      if(s.gpsAccel < -1) load = 0;
      s.cityDriveLoadTarget = Math.max(0, Math.min(1, load));
    }, 100);
  }

  function startCityDriveInternal() {
    const prof = driveProfiles[s.driveKind || "city"];
    s.cityDriveActive = true;
    s.cityDriveStartTime = performance.now();
    s.lastCityAction = 0;
    s.cityDriveCycle = 0;
    s.cityDriveGasPlayed = false;
    s.cityDriveLoadTarget = 0;
    s.cityDriveSpeedTarget = prof.start.speed;
    s.cityDriveBrakeActive = false;

    s.gasHeld = false;
    s.brakeHeld = false;
    setRpmMode(false);
    s.shiftCooldown = 0;
    s.speed = prof.start.speed;
    s.gear = prof.start.gear;
    s.rpm = prof.start.rpm;

    const loopDuration = prof.duration;
    const sequence = prof.seq;
    s.cityDriveLoopInterval = setInterval(() => {
      if(!s.cityDriveActive) return;
      const elapsed = performance.now() - s.cityDriveStartTime;
      const cycle = Math.floor(elapsed / loopDuration);
      const loopElapsed = elapsed - cycle * loopDuration;

      // Jede neue Runde beginnt reproduzierbar am Stillstand und spielt
      // den ersten Sequenzpunkt erneut ab – ohne fragilen Reset-Zeitpunkt.
      if(cycle !== s.cityDriveCycle) {
        s.cityDriveCycle = cycle;
        s.lastCityAction = 0;
      }

      // Bei verzögerten Browser-Ticks alle inzwischen fälligen Aktionen abarbeiten.
      while(s.lastCityAction < sequence.length) {
        const [time, action] = sequence[s.lastCityAction];
        if(loopElapsed < time) break;
        applyCityAction(action);
        s.lastCityAction++;
        if(!s.cityDriveActive) break;
      }
    }, 40);

    $(prof.toggle).parentElement.classList.add("active");
    ui();
    if(s.running) audio();
  }

  function stopCityDrive(resetToggle = true){
    const wasGps = s.driveKind === "gps";
    if(s.gpsWatch !== undefined && s.gpsWatch !== null) { navigator.geolocation.clearWatch(s.gpsWatch); s.gpsWatch = null; }
    if(s.gpsTimer) { clearInterval(s.gpsTimer); s.gpsTimer = null; }
    if(wasGps && s.cityDriveActive) {
      // Fallback: zurück in den Leerlauf
      s.speed = 0; s.gear = 0; s.load = 0; s.rpm = Math.max(s.rpm, IDLE);
    }
    s.cityDriveActive = false;
    if(resetToggle) Object.values(driveProfiles).forEach(p => { $(p.toggle).checked = false; });
    if(s.cityDriveLoopInterval) {
      clearInterval(s.cityDriveLoopInterval);
      s.cityDriveLoopInterval = null;
    }
    // Reset ONLY city drive specific states
    s.cityDriveLoadTarget = 0;
    s.cityDriveSpeedTarget = 0;
    s.cityDriveBrakeActive = false;
    // Note: Do NOT reset gasHeld, brakeHeld, useManualRpm here
    // User may be manually controlling
    
    // Update UI
    Object.values(driveProfiles).forEach(p => $(p.toggle).parentElement.classList.remove("active"));
    $("brakeBtn").classList.remove("active");
    ui();
    if(s.running) audio();
  }
  
  function applyCityAction(action) {
    // Don't apply if user is manually controlling
    if(s.gasHeld || s.brakeHeld || s.useManualRpm) {
      stopCityDrive();
      return;
    }
    
    if(action.action === 'loop_reset') return;
    
    // Set states directly for city drive
    if(action.gear !== undefined) {
      // Direct gear change without using selectGearManually
      const oldGear = s.gear;
      if(action.gear !== oldGear && action.gear >= 0 && action.gear <= 5) {
        const currentSpeed = s.speed;
        if(oldGear === 0 && action.gear >= 1) {
          // From neutral to gear
          if(currentSpeed <= 1) {
            s.rpm = Math.max(IDLE, Math.min(MAX_RPM, IDLE + s.load * 300));
          } else {
            s.rpm = Math.min(MAX_RPM, Math.max(IDLE, currentSpeed * ratios[action.gear] / 0.13));
          }
          s.gear = action.gear;
        }
        else if(oldGear >= 1 && action.gear >= 0) {
          // Gear change while moving
          if(currentSpeed > 0) {
            const newSpeed = action.gear > oldGear ? currentSpeed : currentSpeed * 0.98;
            s.rpm = Math.min(MAX_RPM, Math.max(IDLE, newSpeed * ratios[action.gear] / 0.13));
            s.speed = newSpeed;
          } else {
            s.rpm = Math.max(IDLE, Math.min(MAX_RPM, IDLE + s.load * 300));
          }
          s.gear = action.gear;
        }
        s.shiftCooldown = Date.now() + 600;
        txt("shiftHint",`${driveProfiles[s.driveKind||"city"].label} → ${action.gear===0?'N':action.gear+'. GANG'}`);
        setTimeout(()=>txt("shiftHint",`Automatik · ↑${SHIFT_UP} / ↓${SHIFT_DOWN} U/min oder klicke Gang`),650);
      }
    }
    if(action.speed !== undefined) {
      s.cityDriveSpeedTarget = Math.max(0, Math.min(160, action.speed));
    }
    if(action.load !== undefined) {
      s.cityDriveLoadTarget = Math.max(0, Math.min(1, action.load));
      s.load = s.cityDriveLoadTarget; // Set directly for immediate effect
      if(action.load > 0.2 && !s.cityDriveGasPlayed) {
        playRevSweep();
        s.cityDriveGasPlayed = true;
      } else if(action.load <= 0.2) {
        s.cityDriveGasPlayed = false;
      }
    }
    if(action.brake !== undefined) {
      s.cityDriveBrakeActive = action.brake;
      if(action.brake) {
        s.load = 0; // Bremse = kein Gas
        s.cityDriveLoadTarget = 0;
      }
    }
    
    // Update pedal UI
    $("gasBtn").classList.toggle("active", s.load > 0.1);
    $("brakeBtn").classList.toggle("active", s.cityDriveBrakeActive);
    $("loadSlider").value = Math.round(s.load * 100);
    ui();
    if(s.running) audio();
  }
  

  function hold(id,key){const b=$(id);b.addEventListener("pointerdown",async e=>{e.preventDefault();
    if(s.running&&s.ctx&&s.ctx.state!=="running") {
      await recoverAudio().catch(console.warn);
    }
    if(s.useManualRpm) setRpmMode(false); // Pedal beendet Drehzahl-Modus
    s[key]=true;b.classList.add("active");
    if(key==="gasHeld")playRevSweep();
    if(s.cityDriveActive)stopCityDrive();
  });
    ["pointerup","pointercancel","pointerleave"].forEach(ev=>b.addEventListener(ev,e=>{e.preventDefault();s[key]=false;b.classList.remove("active");if(s.cityDriveActive)stopCityDrive();}))}
  function selectGearManually(gearNum) {
    if(!s.running || s.shiftCooldown>Date.now()) return;
    
    const oldGear = s.gear;
    if(gearNum === oldGear) return;
    
    s.shiftCooldown=Date.now()+600;
    
    // Geschwindigkeit vor dem Schalten speichern
    const currentSpeed = s.speed;
    
    // Spezialfall: Von N in einen Gang
    if(oldGear === 0 && gearNum >= 1) {
      // Wenn Fahrzeug steht: Motor dreht bei IDLE + Last
      if(currentSpeed <= 1) {
        s.rpm = Math.max(IDLE, Math.min(MAX_RPM, IDLE + s.load * 300));
      } else {
        // Geschwindigkeit beibehalten: rpm = speed * ratio / 0.13
        s.rpm = Math.min(MAX_RPM, Math.max(IDLE, currentSpeed * ratios[gearNum] / 0.13));
      }
      s.gear = gearNum;
    }
    // Normaler Gangwechsel
    else if(oldGear >= 1 && gearNum >= 0) {
      // Geschwindigkeit beibehalten, RPM basierend auf neuem Gang
      if(currentSpeed > 0) {
        // Motorbremse: leichte Geschwindigkeitsreduktion beim Runterschalten
        const newSpeed = gearNum > oldGear ? currentSpeed : currentSpeed * 0.98;
        s.rpm = Math.min(MAX_RPM, Math.max(IDLE, newSpeed * ratios[gearNum] / 0.13));
        s.speed = newSpeed;
      } else {
        s.rpm = Math.max(IDLE, Math.min(MAX_RPM, IDLE + s.load * 300));
      }
      s.gear = gearNum;
    }
    
    // Im manuellen Modus bleiben, aber mit neuer Drehzahl (nur wenn keine Stadtfahrt aktiv)
    if(s.useManualRpm) s.manualRpmTarget = Math.max(IDLE, s.rpm);
    
    // Update Load basierend auf neuer Drehzahl (nur wenn keine Stadtfahrt aktiv)
    if(s.gear > 0 && !s.cityDriveActive) {
      s.load = Math.max(0, Math.min(1, (s.rpm - IDLE) / (MAX_RPM - IDLE)));
    }
    
    txt("shiftHint",`Manuell → ${gearNum===0?'N':gearNum+'. GANG'}`);
    setTimeout(()=>txt("shiftHint",`Automatik · ↑${SHIFT_UP} / ↓${SHIFT_DOWN} U/min oder klicke Gang`),650);
    ui();
    if(s.running) audio();
  }
  // Start Button Event Listener - wichtig für iOS User Gesture
  $("startBtn").addEventListener("click", async () => {
    if(!s.running) {
      await start();
      return;
    }
    if(s.ctx && s.ctx.state !== "running") {
      try {
        await recoverAudio();
        txt("stateLabel", "MOTOR LÄUFT");
        txt("startLabel", "MOTOR STOPPEN");
        $("liveDot").classList.add("on");
      } catch(e) {
        console.warn(e);
        txt("stateLabel", "TON AKTIVIEREN");
        txt("startLabel", "TON AKTIVIEREN");
      }
    } else {
      stop();
    }
  });
  
  // Ein click-Handler deckt Touch und Maus ab; kein doppeltes touchstart.
  hold("gasBtn","gasHeld");hold("brakeBtn","brakeHeld");
  // Gang-Buttons klickbar
  ["N","1","2","3","4","5"].forEach((g,i)=>{const btn=$("gear"+g);if(btn)btn.addEventListener("click",()=>{if(s.cityDriveActive)stopCityDrive();if(s.useManualRpm)setRpmMode(false);selectGearManually(i)})});
  
  // Stadtfahrt Toggle
  Object.entries(driveProfiles).forEach(([kind, p]) => {
    $(p.toggle).addEventListener("change", (e) => {
      if(e.target.checked) startCityDrive(kind);
      else stopCityDrive();
    });
  });
  $("speedSlider").addEventListener("input",e=>{
    s.speed=+e.target.value;stopCityDrive();if(s.useManualRpm)setRpmMode(false);
    // Wenn manuell Geschwindigkeit gesetzt wird, Drehzahl anpassen
    if(s.running && s.gear>0){
      // v = rpm * 0.13 / ratio => rpm = v * ratio / 0.13
      s.rpm=Math.min(MAX_RPM,s.speed*ratios[s.gear]/0.13);
      shift();
    }
    if(s.running){audio()}ui();
  });
  $("loadSlider").addEventListener("input",e=>{s.load=+e.target.value/100;stopCityDrive();if(s.useManualRpm)setRpmMode(false);if(s.running)audio();ui()});
  function setRpmMode(on){
    s.useManualRpm=!!on;
    s.manualRpmTarget=on?Math.max(IDLE,s.rpm||IDLE):null;
    if(on){s.gasHeld=false;s.brakeHeld=false;$("gasBtn").classList.remove("active");$("brakeBtn").classList.remove("active")}
    if(on)$("rpmSlider").value=Math.round(s.rpm);
  }
  $("rpmSlider").addEventListener("input",e=>{
    if(!s.useManualRpm){stopCityDrive();setRpmMode(true)}
    s.manualRpmTarget=Math.max(IDLE,Math.min(MAX_RPM,+e.target.value));
    txt("rpmOut",`${Math.round(s.manualRpmTarget)} U/min`);
  });
  setRpmMode(false);
  function updateShiftOutputs(){
    $("shiftDownMarker").value=SHIFT_DOWN;
    $("shiftUpMarker").value=SHIFT_UP;
    $("shiftDownMarker").style.zIndex = SHIFT_DOWN > SHIFT_UP ? "6" : "5";
    $("shiftUpMarker").style.zIndex = "5";
    txt("shiftHint",`Schaltpunkte · ↑ ${SHIFT_UP.toLocaleString("de-DE")} / ↓ ${SHIFT_DOWN.toLocaleString("de-DE")} U/min`);
  }
  $("shiftDownMarker").addEventListener("input",e=>{
    SHIFT_DOWN=+e.target.value;
    if(SHIFT_DOWN>=SHIFT_UP){
      SHIFT_UP=Math.min(4200,SHIFT_DOWN+100);
    }
    updateShiftOutputs();
  });
  $("shiftUpMarker").addEventListener("input",e=>{
    SHIFT_UP=+e.target.value;
    if(SHIFT_UP<=SHIFT_DOWN){
      SHIFT_DOWN=Math.max(1000,SHIFT_UP-100);
    }
    updateShiftOutputs();
  });
  $("muteBtn").addEventListener("click",()=>{
    s.muted=!s.muted;txt("muteBtn",s.muted?"TON AUS":"TON AN");
    if(s.ctx&&s.master){const now=s.ctx.currentTime;s.master.gain.cancelScheduledValues(now);s.master.gain.setTargetAtTime(s.muted?0:.82,now,.035)}
    if(s.running)audio();
  });
  if("serviceWorker"in navigator&&(location.protocol==="https:"||location.hostname==="localhost"))addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(console.warn));
  ui();
  updateShiftOutputs();
  // Initialisiere RPM-Schieberegler Anzeige - Motor ist AUS
  txt("rpmOut","0 U/min");
  $("rpmSlider").value=0;
  
  // iOS spezifischer Hinweis beim Laden
  if(isIOS) {
    console.log("iOS erkannt - Audio muss durch Nutzerinteraktion entsperrt werden");
    // Optional: Hinweis in der UI anzeigen
    // txt("stateLabel", "TIPPEN ZUM AKTIVIEREN");
  }
  function updateAudioStatus(){
    if(!s.running)return;
    if(s.ctx&&s.ctx.state==="running"){
      txt("stateLabel","MOTOR LÄUFT");txt("startLabel","MOTOR STOPPEN");$("liveDot").classList.add("on");
    }else{
      txt("stateLabel","TON PAUSIERT");txt("startLabel","TON AKTIVIEREN");$("liveDot").classList.remove("on");
    }
  }
  function setMediaInfo(){
    try{
      if("mediaSession" in navigator && window.MediaMetadata){
        navigator.mediaSession.metadata=new MediaMetadata({title:"TDI Simulator",artist:"Golf 4 TDI",album:"TDI Simulator"});
      }
    }catch(e){}
  }
  setMediaInfo();

  // Hintergrund-/Sperrbildschirm-Betrieb: stilles <audio> + Media Session + Wake Lock
  let keepAudio=null,wakeLock=null;
  function keepAliveOn(){
    try{
      if(!keepAudio){
        keepAudio=new Audio("audio/silence.wav");
        keepAudio.loop=true;keepAudio.volume=.02;keepAudio.setAttribute("playsinline","");
      }
      const p=keepAudio.play();if(p&&p.catch)p.catch(()=>{});
    }catch(_){}
    try{
      if("mediaSession" in navigator){
        navigator.mediaSession.playbackState="playing";
        navigator.mediaSession.setActionHandler("play",()=>{if(!s.running)start()});
        navigator.mediaSession.setActionHandler("pause",()=>{if(s.running)stop()});
        navigator.mediaSession.setActionHandler("stop",()=>{if(s.running)stop()});
      }
    }catch(_){}
    requestWakeLock();
  }
  function keepAliveOff(){
    try{if(keepAudio)keepAudio.pause()}catch(_){}
    try{if("mediaSession" in navigator)navigator.mediaSession.playbackState="none"}catch(_){}
    try{if(wakeLock){wakeLock.release();wakeLock=null}}catch(_){}
  }
  async function requestWakeLock(){
    try{
      if(!("wakeLock" in navigator)||wakeLock||document.hidden)return;
      wakeLock=await navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release",()=>{wakeLock=null});
    }catch(_){wakeLock=null}
  }

  function onForeground(){
    if(!document.hidden&&s.running){
      requestWakeLock();
      try{if(keepAudio&&keepAudio.paused)keepAudio.play().catch(()=>{})}catch(_){}
    }
    if(!document.hidden&&s.running&&s.ctx){
      // iOS pausiert AudioContext-Instanzen beim Wechsel in den Hintergrund.
      // Ein Resume-Versuch ist hilfreich; falls iOS eine Geste verlangt,
      // aktiviert ein Tippen auf Start/Gas/Bremse die Session erneut.
      s.ctx.resume().then(()=>{
        if(s.ctx&&s.ctx.state==="running"){
          const now=s.ctx.currentTime;s.master.gain.cancelScheduledValues(now);
          s.master.gain.setTargetAtTime(s.muted?0:.82,now,.04);
          connectLoopSources();audio();updateAudioStatus();
        }
      }).catch(()=>updateAudioStatus());
      
      // iOS spezifisch: manchmal müssen Quellen neu gestartet werden nach foreground
      if(isIOS && s.running) {
        setTimeout(() => {
          if(s.ctx && s.ctx.state === "running") {
            connectLoopSources();
          }
        }, 200);
      }
    }
  }
  document.addEventListener("visibilitychange",()=>{
    if(document.hidden){s.gasHeld=false;s.brakeHeld=false;$("gasBtn").classList.remove("active");$("brakeBtn").classList.remove("active")}
    else onForeground();
  });
  window.addEventListener("pageshow",onForeground);
  $("gpsDialogOk").addEventListener("click",()=>{$("gpsDialog").hidden=true});
})();
