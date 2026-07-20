// ═══════════════════════════════════════════════════════════════════════════
//  Service Worker de NBS — versión SEGURA (18 jul 2026)
//
//  IMPORTANTE: Este service worker NO guarda la app en caché a propósito.
//  ¿Por qué? Porque guardar en caché fue lo que causó que el teléfono mostrara
//  versiones VIEJAS de la app (el problema que costó un día de ventas).
//
//  Lo único que hace este archivo es permitir que la app se pueda INSTALAR
//  como ícono en el teléfono (requisito de las PWA). Todo lo demás (guardar
//  datos, funcionar sin internet) ya lo maneja la app por su cuenta con
//  localStorage y Firebase, que es más confiable.
//
//  Resultado: la app se puede instalar, pero SIEMPRE carga la versión más
//  reciente desde GitHub. Nunca te va a mostrar una versión vieja.
// ═══════════════════════════════════════════════════════════════════════════

// Al instalarse, tomar control de inmediato
self.addEventListener('install', function(e){
  self.skipWaiting();
});

// Al activarse, borrar cualquier caché vieja que haya quedado de versiones anteriores
self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(nombres){
      return Promise.all(nombres.map(function(n){ return caches.delete(n); }));
    }).then(function(){
      return self.clients.claim();
    })
  );
});

// En cada petición, ir SIEMPRE a la red (GitHub), nunca a caché.
// Así siempre se carga la versión más nueva de la app.
self.addEventListener('fetch', function(e){
  e.respondWith(
    fetch(e.request).catch(function(){
      // Si de plano no hay internet, devolver lo que el navegador tenga (raro que pase)
      return caches.match(e.request);
    })
  );
});
