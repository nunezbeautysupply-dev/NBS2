// ═══════════════════════════════════════════════════════════════
//  SERVICE WORKER — NBS 2
//
//  ARREGLADO EL 22 DE JULIO DE 2026 (problema real que reporto Sensei):
//  entro a una barberia con POCA senal y la app NO ABRIA.
//
//  QUE PASABA: la version anterior buscaba internet PRIMERO y solo usaba
//  la copia guardada si la red FALLABA. Con cero senal falla rapido y todo
//  bien; pero con senal DEBIL la peticion no falla — solo tarda muchisimo.
//  Como nunca fallaba, la app se quedaba esperando y no abria nunca.
//
//  COMO FUNCIONA AHORA: "primero la copia guardada".
//   1) Abre AL INSTANTE con la copia que tiene en el telefono.
//   2) Por detras, sin hacer esperar a nadie, busca si hay version nueva
//      y la guarda para la proxima vez que abra.
//   3) Si no hay copia guardada todavia, va a la red pero con un limite
//      de 4 segundos, para no quedarse colgada.
//
//  Consecuencia: la app abre SIEMPRE al instante — con senal, sin senal,
//  o con senal mala. La version nueva entra en la siguiente apertura.
// ═══════════════════════════════════════════════════════════════

var CACHE_NOMBRE = 'nbs2-cache-v34';

// Cuanto se espera a la red cuando NO hay copia guardada (milisegundos)
var LIMITE_RED = 4000;

var ARCHIVOS_BASE = [
  './',
  './index.html',
  './app_prueba_firebase.html',
  './manifest.json',
  './icon-512.png'
];

// INSTALL: guardar los archivos base la primera vez.
self.addEventListener('install', function(event){
  self.skipWaiting(); // activar de una vez la version nueva
  event.waitUntil(
    caches.open(CACHE_NOMBRE).then(function(cache){
      // addAll falla si UN archivo no existe; por eso se agregan uno por uno
      // y se ignora el que falte, para no romper la instalacion.
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

// Busca en la red con un limite de tiempo, para no quedarse colgada
// cuando la senal esta mala (que era justo el problema).
function redConLimite(req, ms){
  return new Promise(function(resolver, rechazar){
    var listo = false;
    var reloj = setTimeout(function(){
      if(!listo){ listo = true; rechazar(new Error('La red tardo demasiado')); }
    }, ms);
    fetch(req).then(function(resp){
      if(listo) return;
      listo = true; clearTimeout(reloj); resolver(resp);
    }).catch(function(e){
      if(listo) return;
      listo = true; clearTimeout(reloj); rechazar(e);
    });
  });
}

// Guarda una copia fresca en segundo plano, sin hacer esperar a nadie.
function refrescarEnSegundoPlano(req){
  redConLimite(req, 8000).then(function(resp){
    if(!resp || !resp.ok) return;
    var copia = resp.clone();
    caches.open(CACHE_NOMBRE).then(function(cache){
      cache.put(req, copia).catch(function(){});
    });
  }).catch(function(){ /* sin internet o lento: no pasa nada, ya abrio */ });
}

self.addEventListener('fetch', function(event){
  var req = event.request;

  // Solo peticiones GET del mismo sitio. Todo lo demas (Firebase, Google...)
  // pasa directo a la red, sin tocar — la nube y el login siguen igual.
  if(req.method !== 'GET'){ return; }
  var url = new URL(req.url);
  if(url.origin !== self.location.origin){ return; }

  event.respondWith(
    caches.match(req).then(function(cacheado){

      // ── CASO 1: SÍ hay copia guardada → responder YA ──
      if(cacheado){
        // Y por detras, buscar si hay version nueva para la proxima vez.
        event.waitUntil(refrescarEnSegundoPlano(req));
        return cacheado;
      }

      // ── CASO 2: NO hay copia → ir a la red, pero con limite de tiempo ──
      return redConLimite(req, LIMITE_RED).then(function(resp){
        var copia = resp.clone();
        caches.open(CACHE_NOMBRE).then(function(cache){
          cache.put(req, copia).catch(function(){});
        });
        return resp;
      }).catch(function(){
        // Si es abrir la app y no hay nada guardado, servir la pagina principal
        if(req.mode === 'navigate'){
          return caches.match('./index.html').then(function(r){
            return r || caches.match('./app_prueba_firebase.html');
          });
        }
        return new Response('', { status: 503, statusText: 'Sin conexion' });
      });
    })
  );
});
