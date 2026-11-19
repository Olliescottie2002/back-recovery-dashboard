const prefix = 'recovery-journal-shell-';
const cacheName = prefix+'1';
const assets = ['./','./index.html','./app.mjs','./db.mjs','./model.mjs','./view.mjs','./trends.mjs','./style.css','./app.webmanifest','./icon-192.png','./icon-512.png'];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(cacheName).then(cache=>cache.addAll(assets.map(url=>new Request(url,{cache:'reload'})))));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith(prefix)&&key!==cacheName).map(key=>caches.delete(key)))));
});
self.addEventListener('fetch',event=>{
  const url = new URL(event.request.url);
  if (event.request.method!=='GET' || !url.href.startsWith(self.registration.scope)) return;
  if (event.request.mode==='navigate') {
    event.respondWith(caches.open(cacheName).then(cache=>cache.match('./index.html')).then(response=>response||fetch(event.request)));
    return;
  }
  if (assets.some(asset=>new URL(asset,self.registration.scope).href===url.href)) {
    event.respondWith(caches.open(cacheName).then(cache=>cache.match(event.request)).then(response=>response||fetch(event.request)));
  }
});
