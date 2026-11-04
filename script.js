/* Zwei Layer (Leerlauf/Fahrt) werden wie in einer vereinfachten Game-Audioengine
   überblendet. Rate-Änderungen beeinflussen auch die Tonhöhe. Für echte RPM-
   Samples wäre eine größere, separat aufgenommene Samplebank erforderlich. */
(() => {
  "use strict";
  const $=id=>document.getElementById(id);
  const s={ctx:null,master:null,idleGain:null,driveGain:null,idleFilter:null,driveFilter:null,
    idleSource:null,driveSource:null,idleBuffer:null,driveBuffer:null,revBuffer:null,revGain:null,revFilter:null,revSource:null,running:false,muted:false,
    speed:0,load:0,rpm:0,gear:0,gasHeld:false,brakeHeld:false,lastTime:0,raf:0,mod:1,modTimer:0,urls:[],
    useManualRpm:false,manualRpmTarget:null,shiftCooldown:0};
  // Realistische Übersetzungsverhältnisse Motor zu Rad für Golf 4 TDI 1.9
  // v (km/h) = (RPM * 0.114) / ratio
  const ratios=[0,12.804,6.991,4.568,3.277,2.521], IDLE=850, SHIFT_UP=2000, SHIFT_DOWN=1200, MAX_RPM=4200;
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
    // Audioquellen werden erst beim Start erstellt, nicht beim Init
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
    // Realistische Berechnung: v (km/h) = RPM * 0.114 / ratio
    // bei 2000 U/min im 1. Gang (12.804): v ≈ 17.8 km/h
    if(s.gear>0)return s.rpm*0.114/ratios[s.gear];
    return 0;
  }
  function audio(){
    if(!s.ctx||!s.running)return;const now=s.ctx.currentTime;
    
    // Wenn Motor aus (RPM = 0), alle Audioquellen stummschalten
    if(s.rpm <= 0 || !s.running){
      s.idleGain.gain.setTargetAtTime(0,now,.08);
      s.driveGain.gain.setTargetAtTime(0,now,.08);
      s.revGain.gain.setTargetAtTime(0,now,.08);
      return;
    }
    
    const norm=Math.max(0,Math.min(1,(s.rpm-800)/3100));
    const drive=Math.max(.06,Math.min(.96,.12+norm*.58+s.load*.30)), audible=s.muted?0:1;
    s.idleGain.gain.setTargetAtTime((1-drive)*audible*s.mod*.8,now,.22);
    s.driveGain.gain.setTargetAtTime(drive*audible*s.mod*.9,now,.22);
    s.idleSource.playbackRate.setTargetAtTime(Math.max(.82,Math.min(1.2,.88+norm*.22)),now,.18);
    s.driveSource.playbackRate.setTargetAtTime(Math.max(.72,Math.min(1.62,s.rpm/1850)),now,.14);
    s.driveFilter.frequency.setTargetAtTime(1800+s.load*6800+norm*900,now,.25);
    s.idleFilter.frequency.setTargetAtTime(2400+s.load*1600,now,.3);
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
    s.revGain.gain.linearRampToValueAtTime(.34,now+.12);
    s.revGain.gain.setTargetAtTime(.20,now+1.0,.7);
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
        const oldSpeed = s.rpm * 0.114 / ratios[oldGear];
        s.rpm = Math.min(MAX_RPM - 200, Math.max(IDLE, oldSpeed * ratios[next] / 0.114));
        s.speed = oldSpeed;
      }
      // Bei Runterschalten: Drehzahl steigt, Motorbremse wirkt
      else if(next < oldGear && next >= 1){
        const oldSpeed = s.rpm * 0.114 / ratios[oldGear];
        const newSpeed = oldSpeed * 0.98; // Motorbremse
        s.rpm = Math.min(MAX_RPM - 100, Math.max(IDLE, newSpeed * ratios[next] / 0.114));
        s.speed = newSpeed;
      }
      
      txt("shiftHint",`SCHALTVORGANG → ${next===0?'N':next+'. GANG'}`);
      setTimeout(()=>txt("shiftHint",`Automatik · ↑${SHIFT_UP} / ↓${SHIFT_DOWN} U/min`),650);
    }
  }
  function tick(now){
    if(!s.running)return;const dt=Math.min(.05,(now-s.lastTime)/1000||.016);s.lastTime=now;
    
    // Last durch Gas/Bremse steuern - Gaspedal träger
    if(s.gasHeld){s.load=Math.min(1,s.load+dt*0.7);}
    else if(s.brakeHeld){s.load=Math.max(0,s.load-dt*1.8);}
    else if(s.useManualRpm) {
      // Bei manueller RPM: Load basierend auf aktueller Drehzahl und Gang
      // load = (rpm - IDLE) / (MAX_RPM - IDLE)
      s.load = Math.max(0, Math.min(1, (s.rpm - IDLE) / (MAX_RPM - IDLE)));
    }
    else {s.load=Math.max(0,s.load-dt*0.02);} // Langsame Reduktion (reduziert Diesel-Nageln)
    
    // Gang wechseln (RPM-basiert)
    shift();
    
    // Ziel-Drehzahl aus Gaspedalstellung
    const targetRpm = targetRPM();
    // Dieselmotor: langsamerer Anstieg, mäßiger Abfall (Motorbremse weniger dominant)
    const response = targetRpm > s.rpm ? 1.5 : 2.2;
    s.rpm+=(targetRpm-s.rpm)*Math.min(1,dt*response);
    // RPM sollte nicht unter IDLE fallen, wenn Motor läuft
    s.rpm=Math.max(s.running ? IDLE : 0, Math.min(MAX_RPM,s.rpm));
    
    // Geschwindigkeit aus Drehzahl und Gang berechnen (realistisch)
    const targetSpeed = calcSpeedFromRpm();
    if(s.gear>0){
      // Fahrzeugträgheit: Geschwindigkeit folgt RPM mit Verzögerung
      s.speed+=(targetSpeed-s.speed)*Math.min(1,dt*5);
    } else {
      s.speed=0;
    }
    
    // Bremse wirkt direkt auf Geschwindigkeit
    if(s.brakeHeld){
      s.speed=Math.max(0,s.speed-24*dt);
    }
    
    s.speed=Math.max(0,Math.min(160,s.speed));
    
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
      // Audioquellen erstellen, falls noch nicht vorhanden
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
    s.running=false;s.gasHeld=false;s.brakeHeld=false;cancelAnimationFrame(s.raf);clearInterval(s.modTimer);
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
  function hold(id,key){const b=$(id);b.addEventListener("pointerdown",e=>{e.preventDefault();s[key]=true;b.classList.add("active");s.useManualRpm=false;if(key==="gasHeld")playRevSweep()});
    ["pointerup","pointercancel","pointerleave"].forEach(ev=>b.addEventListener(ev,e=>{e.preventDefault();s[key]=false;b.classList.remove("active")}))}
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
        // Geschwindigkeit beibehalten: rpm = speed * ratio / 0.114
        s.rpm = Math.min(MAX_RPM, Math.max(IDLE, currentSpeed * ratios[gearNum] / 0.114));
      }
      s.gear = gearNum;
    }
    // Normaler Gangwechsel
    else if(oldGear >= 1 && gearNum >= 0) {
      // Geschwindigkeit beibehalten, RPM basierend auf neuem Gang
      if(currentSpeed > 0) {
        // Motorbremse: leichte Geschwindigkeitsreduktion beim Runterschalten
        const newSpeed = gearNum > oldGear ? currentSpeed : currentSpeed * 0.98;
        s.rpm = Math.min(MAX_RPM, Math.max(IDLE, newSpeed * ratios[gearNum] / 0.114));
        s.speed = newSpeed;
      } else {
        s.rpm = Math.max(IDLE, Math.min(MAX_RPM, IDLE + s.load * 300));
      }
      s.gear = gearNum;
    }
    
    // Im manuellen Modus bleiben, aber mit neuer Drehzahl
    s.useManualRpm = true;
    s.manualRpmTarget = s.rpm;
    
    // Update Load basierend auf neuer Drehzahl
    if(s.gear > 0) {
      s.load = Math.max(0, Math.min(1, (s.rpm - IDLE) / (MAX_RPM - IDLE)));
    }
    
    txt("shiftHint",`Manuell → ${gearNum===0?'N':gearNum+'. GANG'}`);
    setTimeout(()=>txt("shiftHint",`Automatik · ↑${SHIFT_UP} / ↓${SHIFT_DOWN} U/min oder klicke Gang`),650);
    ui();
    if(s.running) audio();
  }
  $("startBtn").addEventListener("click",()=>s.running?stop():start());hold("gasBtn","gasHeld");hold("brakeBtn","brakeHeld");
  // Gang-Buttons klickbar
  ["N","1","2","3","4","5"].forEach((g,i)=>{const btn=$("gear"+g);if(btn)btn.addEventListener("click",()=>selectGearManually(i))});
  $("speedSlider").addEventListener("input",e=>{
    s.speed=+e.target.value;s.useManualRpm=false;
    // Wenn manuell Geschwindigkeit gesetzt wird, Drehzahl anpassen
    if(s.running && s.gear>0){
      // v = rpm * 0.114 / ratio => rpm = v * ratio / 0.114
      s.rpm=Math.min(MAX_RPM,s.speed*ratios[s.gear]/0.114);
      shift();
    }
    if(s.running){audio()}ui();
  });
  $("loadSlider").addEventListener("input",e=>{s.load=+e.target.value/100;s.useManualRpm=false;if(s.running)audio();ui()});
  $("rpmSlider").addEventListener("input",e=>{
    s.useManualRpm=true;
    s.manualRpmTarget=Math.max(IDLE,Math.min(MAX_RPM,+e.target.value));
    s.rpm=s.manualRpmTarget;
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