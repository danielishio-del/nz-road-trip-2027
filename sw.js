/* Service worker: guarda o app no celular para abrir sem internet. */
const CACHE="nz27-202611211150";
const SHELL=["./","index.html","app.js","backend.js","manifest.webmanifest","vendor/supabase.js","vendor/pdf.min.js","vendor/pdf.worker.min.js","fonts/fonts.css","fonts/plus-jakarta-sans-latin-600-normal.woff2","fonts/plus-jakarta-sans-latin-700-normal.woff2","fonts/plus-jakarta-sans-latin-800-normal.woff2",
 "fonts/inter-latin-400-normal.woff2","fonts/inter-latin-500-normal.woff2","fonts/inter-latin-600-normal.woff2",
 "icons/icon-192.png","icons/icon-512.png","icons/apple-touch-icon.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=="GET"||u.origin!==location.origin) return; // Supabase e Google Maps vão direto para a rede
  if(e.request.mode==="navigate"){
    e.respondWith(fetch(e.request).then(r=>{const c=r.clone();caches.open(CACHE).then(x=>x.put("index.html",c));return r}).catch(()=>caches.match("index.html")));
    return;
  }
  e.respondWith(caches.match(e.request).then(hit=>{
    const net=fetch(e.request).then(r=>{if(r.ok){const c=r.clone();caches.open(CACHE).then(x=>x.put(e.request,c))}return r}).catch(()=>hit);
    return hit||net;
  }));
});
