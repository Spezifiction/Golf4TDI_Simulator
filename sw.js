const CACHE="golf4-tdi-sim-v4";
const FILES=[
  "./","./index.html","./style.css","./script.js","./manifest.webmanifest",
  "./audio/leerlauf-loop.mp3","./audio/fahr-loop.mp3","./audio/drehzahl-anhebung.mp3",
  "./audio/leerlauf-t5-loop.mp3","./audio/fahrt-t5-cruise-loop.mp3","./audio/fahrt-t5-last-loop.mp3"
];
self.addEventListener("install",event=>event.waitUntil(
  caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting())
));
self.addEventListener("activate",event=>event.waitUntil(
  caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))
    .then(()=>self.clients.claim())
));
self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request)));
});
