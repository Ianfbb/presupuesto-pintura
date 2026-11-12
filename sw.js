// Guarda la app en el teléfono para que abra sin internet.
// El nombre del caché ya no cambia en cada versión: la app misma baja la versión nueva y la guarda acá.
const CACHE='presupuestos-app';
const FILES=['./','./index.html','./manifest.webmanifest','./icon-180.png','./icon-192.png','./icon-512.png'];
const ver=t=>{const m=String(t).match(/const VERSION='([\d.]+)'/); return m?m[1].split('.').map(n=>parseInt(n,10)||0):null;};
const menor=(a,b)=>{for(let i=0;i<Math.max(a.length,b.length);i++){const d=(a[i]||0)-(b[i]||0); if(d)return d<0;} return false;};
// Guarda el index solo si no es más viejo que el que ya está (el servidor a veces entrega una copia atrasada unos minutos).
async function guardarIndex(c,resp){
  try{
    const nuevo=ver(await resp.clone().text()); if(!nuevo)return;
    const viejo=await c.match('./index.html'); const v=viejo?ver(await viejo.text()):null;
    if(v&&menor(nuevo,v))return;
    await c.put('./index.html',resp);
  }catch(e){}
}
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(async c=>{
  await Promise.all(FILES.filter(f=>f!=='./index.html'&&f!=='./').map(f=>fetch(new Request(f,{cache:'reload'})).then(r=>{if(r.ok)return c.put(f,r);}).catch(()=>{})));
  const r=await fetch('./index.html?sw='+Date.now(),{cache:'no-store'}); if(!r.ok)throw new Error('sin index');
  await guardarIndex(c,r);
  if(!(await c.match('./index.html')))throw new Error('sin index');
}).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil((async()=>{
  const viejos=(await caches.keys()).filter(k=>k.startsWith('presupuestos-')&&k!==CACHE);
  await Promise.all(viejos.map(k=>caches.delete(k))); await self.clients.claim();
  // Pasaje desde el sistema anterior: la pantalla abierta todavía es la versión vieja, que no sabe actualizarse sola. Se recarga una vez.
  // (No se espera a que termine: la recarga necesita que este service worker ya esté activo.)
  if(viejos.length){const cs=await self.clients.matchAll({type:'window'}); cs.forEach(c=>{c.navigate(c.url).catch(()=>{});});}
})());});
self.addEventListener('fetch',e=>{
  const req=e.request, url=new URL(req.url);
  if(req.method!=='GET'||url.origin!==location.origin||!url.pathname.startsWith(new URL('./',location).pathname))return;
  // Los pedidos "sin caché" (la app buscando si hay versión nueva) van directo a internet.
  if(req.cache==='no-store'||req.cache==='reload')return;
  const nav=req.mode==='navigate';
  e.respondWith(caches.open(CACHE).then(async c=>{
    const hit=await c.match(nav?'./index.html':req,{ignoreSearch:true});
    const net=nav
      ?fetch('./index.html?sw='+Date.now(),{cache:'no-store'}).then(async r=>{if(r&&r.ok)await guardarIndex(c,r.clone()); return r;}).catch(()=>null)
      :fetch(req).then(r=>{if(r&&r.ok)c.put(req,r.clone()); return r;}).catch(()=>null);
    if(hit){e.waitUntil(net);return hit;}
    const r=await net; return r||new Response('Sin conexión',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});
  }));
});
