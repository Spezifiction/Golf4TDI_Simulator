/* Zwei Layer (Leerlauf/Fahrt) werden wie in einer vereinfachten Game-Audioengine
   überblendet. Rate-Änderungen beeinflussen auch die Tonhöhe. Für echte RPM-
   Samples wäre eine größere, separat aufgenommene Samplebank erforderlich. */
(() => {
  "use strict";
  const $=id=>document.getElementById(id);
  const s={ctx:null,master:null,idleGain:null,driveGain:null,idleFilter:null,driveFilter:null,
    idleSource:null,driveSource:null,idleBuffer:null,driveBuffer:null,revBuffer:null,revGain:null,revFilter:null,revSource:null,running:false,muted:false,
    speed:0,load:0,rpm:0,gear:0,gasHeld:false,brakeHeld:false,lastTime:0,raf:0,mod:1,modTimer:0,urls:[],
    useManualRpm:false,manualRpmTarget:null,shiftCooldown:0,
    cityDriveActive:false,cityDriveStartTime:0,cityDriveLoopInterval:null,lastCityAction:0,cityDriveCycle:0,cityDriveGasPlayed:false,cityDriveLoadTarget:0,cityDriveSpeedTarget:0,cityDriveBrakeActive:false};
  // Realistische Übersetzungsverhältnisse Motor zu Rad für Golf 4 TDI 1.9
  // v (km/h) = (RPM * 0.13) / ratio (angepasst an reale Tabellenwerte)
  const ratios=[0,12.804,6.991,4.568,3.277,2.521], IDLE=850, SHIFT_UP=2000, SHIFT_DOWN=1200, MAX_RPM=4200;
  
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
    $("rpmSlider").value=Math.round(s.rpm);
  }
  async function getBuffer(url){const r=await fetch(url);if(!r.ok)throw Error(`Audio fehlt: ${url}`);return s.ctx.decodeAudioData(await r.arrayBuffer())}
  function makeLoop(buffer,filter,gain){const src=s.ctx.createBufferSource();src.buffer=buffer;src.loop=true;src.connect(filter);filter.connect(gain);src.start();return src}
  async function init(){
    if(s.ctx)return;
    const C=window.AudioContext||window.webkitAudioContext;if(!C)throw Error("Web Audio API nicht verfügbar");
    s.ctx=new C();s.master=s.ctx.createGain();s.master.gain.value=.82;
    s.idleFilter=s.ctx.createBiquadFilter();s.driveFilter=s.ctx.createBiquadFilter();
    [s.idleFilter,s.driveFilter].forEach(f=>{f.type="lowpass";f.frequency.value=9000;f.Q.value=.55});
    s.idleGain=s.ctx.createGain();s.driveGain=s.ctx.createGain();s.idleGain.gain.value=0;s.driveGain.gain.value=0;
    s.idleBuffer=await getBuffer("audio/leerlauf-loop.mp3");s.driveBuffer=await getBuffer("audio/fahr-loop.mp3");
    s.revBuffer=await getBuffer("audio/drehzahl-anhebung.mp3");
    s.revFilter=s.ctx.createBiquadFilter();s.revFilter.type="bandpass";s.revFilter.frequency.value=1900;s.revFilter.Q.value=.65;
    s.revGain=s.ctx.createGain();s.revGain.gain.value=0;s.revFilter.connect(s.revGain);s.revGain.connect(s.master);
    s.idleGain.connect(s.master);s.driveGain.connect(s.master);s.master.connect(s.ctx.destination);
    // Audioquellen werden erst beim Start erstellt, NICHT in init()
    s.idleSource=null;s.driveSource=null;s.revSource=null;
  }
  function selectGear(){
    // Fliehkraftkupplung: Gang N -> 1 ab 1000 RPM
    if(s.gear===0 && s.rpm>=1000) return 1;
    // Kein Gangwechsel im Leerlauf
    if(s.gear===0) return 0;
    
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
    if(!s.ctx||!s.running)return;
    const now=s.ctx.currentTime;
    if(s.rpm <= 0){
      s.idleGain.gain.setTargetAtTime(0,now,.08);
      s.driveGain.gain.setTargetAtTime(0,now,.08);
      s.revGain.gain.setTargetAtTime(0,now,.08);
      return;
    }

    // Der Leerlauf-Sample ist im Stand nur eine leise Basis. Sobald das
    // Fahrzeug fährt bzw. die Drehzahl steigt, übernimmt der Fahr-Sample
    // deutlich hörbar – so werden Last- und Drehzahländerungen wahrnehmbar.
    const norm=Math.max(0,Math.min(1,(s.rpm-850)/2700));
    const moving=Math.max(0,Math.min(1,s.speed/12));
    const audible=s.muted?0:1;
    const modulation=s.mod;

    // Leerlauf-Nageln stark zurücknehmen, besonders während der Fahrt.
    const idleLevel=(.20 - norm*.12 - moving*.08) * audible * modulation;
    // Fahrgeräusch trägt den Motorcharakter und folgt Drehzahl sowie Last.
    const driveLevel=(.30 + norm*.34 + moving*.16 + s.load*.12) * audible * modulation;
    s.idleGain.gain.setTargetAtTime(Math.max(.025,idleLevel),now,.24);
    s.driveGain.gain.setTargetAtTime(Math.min(.92,driveLevel),now,.20);

    // Größerer, aber begrenzter Drehzahlbereich: hörbarer Tonhöhenanstieg
    // beim Beschleunigen und hörbares Abfallen beim Hochschalten.
    s.idleSource.playbackRate.setTargetAtTime(Math.max(.86,Math.min(1.18,.88+norm*.28)),now,.22);
    s.driveSource.playbackRate.setTargetAtTime(Math.max(.82,Math.min(1.62,.82+norm*.76)),now,.18);

    // Das Leerlauf-Sample wird dunkler gefiltert; der Fahr-Layer darf
    // mit steigender Drehzahl mehr Obertöne und damit Motorcharakter zeigen.
    s.driveFilter.frequency.setTargetAtTime(1900+s.load*3000+norm*1900,now,.24);
    s.idleFilter.frequency.setTargetAtTime(1250+s.load*350,now,.30);
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
      const response = targetRpm > s.rpm ? 0.8 : 1.8;
      s.rpm += (targetRpm - s.rpm) * Math.min(1, dt * response);
      s.rpm = Math.max(s.running ? IDLE : 0, Math.min(MAX_RPM, s.rpm));
      const targetSpeed = calcSpeedFromRpm();
      if(s.gear > 0) s.speed += (targetSpeed - s.speed) * Math.min(1, dt * 1.5);
      else s.speed = 0;
      if(s.brakeHeld) s.speed = Math.max(0, s.speed - 24 * dt);
      const maxPossibleSpeed = s.gear > 0 ? MAX_RPM * 0.13 / ratios[s.gear] : 200;
      s.speed = Math.max(0, Math.min(maxPossibleSpeed, s.speed));
    }

    // UI aktualisieren
    $("speedSlider").value=Math.round(s.speed);
    $("loadSlider").value=Math.round(s.load*100);
    if(s.useManualRpm) {
      $("rpmSlider").value=Math.round(s.rpm);
      txt("rpmOut",`${Math.round(s.rpm)} U/min`);
    }
    ui();audio();s.raf=requestAnimationFrame(tick);
  }
  async function start(){
    try{await init();await s.ctx.resume();
      // Audioquellen erstellen und starten NUR nach resume() für iOS-Kompatibilität
      if(!s.idleSource)s.idleSource=makeLoop(s.idleBuffer,s.idleFilter,s.idleGain);
      if(!s.driveSource)s.driveSource=makeLoop(s.driveBuffer,s.driveFilter,s.driveGain);
      
      s.running=true;s.lastTime=performance.now();
      // Motor startet mit Leerlaufdrehzahl
      s.rpm = IDLE;
      s.load = 0;
      s.speed = 0;
      s.gear = 0;
      s.useManualRpm=false;s.manualRpmTarget=null;s.shiftCooldown=0;
      $("startBtn").classList.add("running");txt("startLabel","MOTOR STOPPEN");txt("stateLabel","MOTOR LÄUFT");$("liveDot").classList.add("on");
      shift();audio();cancelAnimationFrame(s.raf);s.raf=requestAnimationFrame(tick);if($("modToggle").checked)modulate();
      txt("rpmOut",`${Math.round(s.rpm)} U/min`);
      $("rpmSlider").value=Math.round(s.rpm);
      ui();
    }catch(e){console.error(e);txt("stateLabel","AUDIOFEHLER");alert("Audio konnte nicht geladen werden. Bitte Live Server oder HTTPS verwenden und erneut starten.");}
  }
  function stop(){
    s.running=false;
    stopCityDrive();
    s.gasHeld=false;s.brakeHeld=false;cancelAnimationFrame(s.raf);clearInterval(s.modTimer);
    // Motor komplett abstellen: 0 RPM, kein Ton
    if(s.ctx&&s.master)s.master.gain.setTargetAtTime(0,s.ctx.currentTime,.08);
    // Alle Audioquellen stoppen
    try{if(s.revSource){s.revSource.stop();s.revSource.disconnect();s.revSource=null}}catch(_){}
    try{if(s.idleSource){s.idleSource.stop();s.idleSource.disconnect();s.idleSource=null}}catch(_){}
    try{if(s.driveSource){s.driveSource.stop();s.driveSource.disconnect();s.driveSource=null}}catch(_){}
    
    $("startBtn").classList.remove("running");$("gasBtn").classList.remove("active");$("brakeBtn").classList.remove("active");
    txt("startLabel","MOTOR STARTEN");txt("stateLabel","BEREIT");$("liveDot").classList.remove("on");
    s.useManualRpm=false;s.manualRpmTarget=null;s.shiftCooldown=0;
    // Motor ist AUS: 0 RPM
    s.rpm=0;s.load=0;s.speed=0;s.gear=0;
    $("rpmSlider").value=0;
    txt("rpmOut","0 U/min");
    ui();
    setTimeout(()=>{if(!s.running&&s.master)s.master.gain.value=s.muted?0:.82},180);
  }
  function modulate(){clearInterval(s.modTimer);s.modTimer=setInterval(()=>{s.mod=.985+Math.random()*.03;if(s.running)audio()},1800+Math.random()*1600)}
  
  async function startCityDrive(){
    stopCityDrive(false);
    // Warten, bis Motor und Audio vollständig gestartet sind (auch bei langsamem Laden).
    if(!s.running) {
      await start();
      if(!s.running || !$("cityToggle").checked) return;
    }
    startCityDriveInternal();
  }

  function startCityDriveInternal() {
    s.cityDriveActive = true;
    s.cityDriveStartTime = performance.now();
    s.lastCityAction = 0;
    s.cityDriveCycle = 0;
    s.cityDriveGasPlayed = false;
    s.cityDriveLoadTarget = 0;
    s.cityDriveSpeedTarget = 0;
    s.cityDriveBrakeActive = false;

    s.gasHeld = false;
    s.brakeHeld = false;
    s.useManualRpm = false;
    s.manualRpmTarget = null;
    s.shiftCooldown = 0;
    s.speed = 0;
    s.gear = 0;
    s.rpm = IDLE;

    const loopDuration = 30000;
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
      while(s.lastCityAction < cityDriveSequence.length) {
        const [time, action] = cityDriveSequence[s.lastCityAction];
        if(loopElapsed < time) break;
        applyCityAction(action);
        s.lastCityAction++;
        if(!s.cityDriveActive) break;
      }
    }, 40);

    $("cityToggle").parentElement.classList.add("active");
    ui();
    if(s.running) audio();
  }

  function stopCityDrive(resetToggle = true){
    s.cityDriveActive = false;
    if(resetToggle) $("cityToggle").checked = false;
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
    $("cityToggle").parentElement.classList.remove("active");
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
        txt("shiftHint",`Stadtfahrt → ${action.gear===0?'N':action.gear+'. GANG'}`);
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
  

  function hold(id,key){const b=$(id);b.addEventListener("pointerdown",e=>{e.preventDefault();s[key]=true;b.classList.add("active");s.useManualRpm=false;if(key==="gasHeld")playRevSweep();if(s.cityDriveActive)stopCityDrive();});
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
    if(!s.cityDriveActive) {
      s.useManualRpm = true;
      s.manualRpmTarget = s.rpm;
    }
    
    // Update Load basierend auf neuer Drehzahl (nur wenn keine Stadtfahrt aktiv)
    if(s.gear > 0 && !s.cityDriveActive) {
      s.load = Math.max(0, Math.min(1, (s.rpm - IDLE) / (MAX_RPM - IDLE)));
    }
    
    txt("shiftHint",`Manuell → ${gearNum===0?'N':gearNum+'. GANG'}`);
    setTimeout(()=>txt("shiftHint",`Automatik · ↑${SHIFT_UP} / ↓${SHIFT_DOWN} U/min oder klicke Gang`),650);
    ui();
    if(s.running) audio();
  }
  $("startBtn").addEventListener("click",()=>s.running?stop():start());hold("gasBtn","gasHeld");hold("brakeBtn","brakeHeld");
  // Gang-Buttons klickbar
  ["N","1","2","3","4","5"].forEach((g,i)=>{const btn=$("gear"+g);if(btn)btn.addEventListener("click",()=>{if(s.cityDriveActive)stopCityDrive();selectGearManually(i)})});
  
  // Stadtfahrt Toggle
  const cityToggle = $("cityToggle");
  if(cityToggle) {
    cityToggle.addEventListener("change", (e) => {
      if(e.target.checked) {
        startCityDrive();
      } else {
        stopCityDrive();
      }
    });
  }
  $("speedSlider").addEventListener("input",e=>{
    s.speed=+e.target.value;s.useManualRpm=false;stopCityDrive();
    // Wenn manuell Geschwindigkeit gesetzt wird, Drehzahl anpassen
    if(s.running && s.gear>0){
      // v = rpm * 0.13 / ratio => rpm = v * ratio / 0.13
      s.rpm=Math.min(MAX_RPM,s.speed*ratios[s.gear]/0.13);
      shift();
    }
    if(s.running){audio()}ui();
  });
  $("loadSlider").addEventListener("input",e=>{s.load=+e.target.value/100;s.useManualRpm=false;stopCityDrive();if(s.running)audio();ui()});
  $("rpmSlider").addEventListener("input",e=>{
    s.useManualRpm=true;stopCityDrive();
    s.manualRpmTarget=Math.max(IDLE,Math.min(MAX_RPM,+e.target.value));
    s.rpm=s.manualRpmTarget;
    // Geschwindigkeit aus neuer RPM berechnen
    if(s.gear > 0) {
      s.speed = s.rpm * 0.13 / ratios[s.gear];
    } else {
      s.speed = 0;
    }
    txt("rpmOut",`${Math.round(s.rpm)} U/min`);
    if(s.running){ui();audio()}
  });
  $("modToggle").addEventListener("change",e=>{if(e.target.checked&&s.running)modulate();else{clearInterval(s.modTimer);s.mod=1;if(s.running)audio()}});
  $("muteBtn").addEventListener("click",()=>{s.muted=!s.muted;txt("muteBtn",s.muted?"TON AUS":"TON AN");if(s.running)audio()});
  async function replace(input,which){const f=input.files?.[0];if(!f)return;try{if(!s.ctx)await init();const buf=await s.ctx.decodeAudioData(await f.arrayBuffer());
    const filter=which==="idle"?s.idleFilter:s.driveFilter,gain=which==="idle"?s.idleGain:s.driveGain,old=which==="idle"?s.idleSource:s.driveSource;
    const src=s.ctx.createBufferSource();src.buffer=buf;src.loop=true;src.connect(filter);src.start();
    try{if(old){old.stop();old.disconnect()}}catch(_){}
    if(which==="idle"){s.idleSource=src;s.idleBuffer=buf}else{s.driveSource=src;s.driveBuffer=buf}
    txt("stateLabel","SAMPLE GELADEN");
    if(s.running)audio();
  }catch(e){console.error(e);alert("Audiodatei konnte nicht gelesen werden.")}}
  $("idleFile").addEventListener("change",e=>replace(e.target,"idle"));$("driveFile").addEventListener("change",e=>replace(e.target,"drive"));
  if("serviceWorker"in navigator&&(location.protocol==="https:"||location.hostname==="localhost"))addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(console.warn));
  ui();
  // Initialisiere RPM-Schieberegler Anzeige - Motor ist AUS
  txt("rpmOut","0 U/min");
  $("rpmSlider").value=0;
  document.addEventListener("visibilitychange",()=>{if(document.hidden){s.gasHeld=false;s.brakeHeld=false}});
})();
