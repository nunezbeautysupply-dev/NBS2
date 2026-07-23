// ═══════════════════════════════════════════════════════════════
//  SERVICE WORKER — NBS 2
//  Hace que la app ABRA sin internet, incluso si la refrescas.
//
//  ESTRATEGIA: "network-first" (primero la red)
//   • CON internet:  siempre busca la versión MÁS NUEVA de la app
//                    (así la app SIEMPRE se actualiza, nunca se queda vieja)
//   • SIN internet:  usa la copia guardada en el teléfono
//                    (así abre aunque refresques sin conexión)
//
//  Esto evita el problema viejo de "la app no se actualiza": con internet
//  siempre trae lo nuevo; la copia local es solo el respaldo para offline.
// ═══════════════════════════════════════════════════════════════

// VERSIÓN del caché. Al subir una app nueva, sube este número (v2, v3...).
// El evento 'activate' borra los cachés viejos, así no quedan restos.
var CACHE_NOMBRE = 'nbs2-cache-v32';

// Archivos base que la app necesita para abrir sin internet.
// La página principal se guarda sola al visitarla (dynamic caching).
var ARCHIVOS_BASE = [
  './',
  './index.html',
  './app_prueba_firebase.html',
  './manifest.json',
  './icon-512.png'
];

// INSTALL: guardar los archivos base la primera vez.
self.addEventListener('install', function(event){
  self.skipWaiting(); // activar de una vez la versión nueva
  event.waitUntil(
    caches.open(CACHE_NOMBRE).then(function(cache){
      // addAll falla si UN archivo no existe; por eso se agregan uno por uno
      // y se ignora el que falte, para no romper la instalación.
      return Promise.all(ARCHIVOS_BASE.map(function(url){
        return cache.add(url).catch(function(){ /* si falta uno, seguir */ });
      }));
    })
  );
});

// ACTIVATE: borrar cachés viejos (de versiones anteriores).
self.addEventListener('activate', function(event){
  event.waitUntil(
    caches.keys().then(function(nombres){
      return Promise.all(nombres.map(function(nombre){
        if(nombre !== CACHE_NOMBRE){ return caches.delete(nombre); }
      }));
    }).then(function(){ return self.clients.claim(); })
  );
});

// FETCH: network-first para las páginas; deja pasar todo lo demás normal.
self.addEventListener('fetch', function(event){
  var req = event.request;

  // Solo manejar peticiones GET del mismo sitio (la app). Todo lo demás
  // (Firebase, Google, etc.) pasa directo a la red, sin tocar — así la
  // nube y el login siguen funcionando exactamente igual que antes.
  if(req.method !== 'GET'){ return; }
  var url = new URL(req.url);
  if(url.origin !== self.location.origin){ return; }

  event.respondWith(
    // 1) Intentar la RED primero (para tener siempre lo más nuevo)
    fetch(req).then(function(respuesta){
      // Guardar una copia fresca en el caché, para el próximo offline
      var copia = respuesta.clone();
      caches.open(CACHE_NOMBRE).then(function(cache){
        cache.put(req, copia).catch(function(){});
      });
      return respuesta;
    }).catch(function(){
      // 2) Si NO hay internet, usar la copia guardada
      return caches.match(req).then(function(cacheado){
        if(cacheado){ return cacheado; }
        // Si es una navegación (abrir la app) y no hay copia exacta,
        // devolver la página principal guardada.
        if(req.mode === 'navigate'){
          return caches.match('./index.html') ||
                 caches.match('./app_prueba_firebase.html');
        }
        // Nada que devolver
        return new Response('', { status: 503, statusText: 'Sin conexión' });
      });
    })
  );
});
