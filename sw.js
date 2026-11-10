const CACHE="golf4-tdi-sim-v8";
const FILES=[
  "./","./index.html","./style.css","./script.js","./manifest.webmanifest",
  "./icons/favicon.ico","./icons/favicon.svg","./icons/apple-touch-icon.png",
  "./icons/web-app-manifest-192x192.png","./icons/web-app-manifest-512x512.png",
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
  const url=new URL(event.request.url);
  const isAppShell=/\.(html|css|js|webmanifest)$/.test(url.pathname) || url.pathname.endsWith("/");
  if(isAppShell){
    event.respondWith(fetch(event.request).then(response=>{
      if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));}
      return response;
    }).catch(()=>caches.match(event.request).then(cached=>cached||caches.match("./index.html"))));
  }else{
    event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request)));
  }
});
