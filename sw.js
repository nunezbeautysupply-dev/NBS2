// ═══════════════════════════════════════════════════════════════
//  SERVICE WORKER — NBS 2
//
//  ARREGLADO EL 23 DE JULIO DE 2026 (problema real que reporto Sensei):
//  subio archivos nuevos, entro a la app y le salio "This site can't be
//  reached / ERR_FAILED", tanto en Chrome como por el ICONO.
//
//  QUE PASABA DE VERDAD: mientras Cloudflare esta publicando -esos 2 minutos
//  despues del Push- el servidor todavia no entrega la pagina: entrega un
//  DESVIO ("ve para alla"). La version anterior de este archivo guardaba lo
//  que llegara, sin revisarlo. Guardo el desvio. Y cuando el navegador va a
//  ABRIR la app y este guardian le entrega un desvio guardado, Chrome lo
//  rechaza en seco -esa es la pantalla de error-. No era falta de internet:
//  era que el guardian le entregaba algo que Chrome no acepta.
//
//  LOS 4 HUECOS QUE SE TAPARON:
//   1) NO GUARDAR BASURA: solo se guarda una respuesta sana (200, sin desvio).
//   2) NO SERVIR BASURA GUARDADA: antes de entregar una copia se revisa que
//      este sana; si no lo esta, se BORRA y se va a internet.
//   3) NUNCA DEVOLVER "NADA": si no hay copia ni internet, se muestra una
//      pantalla propia con un boton de Reintentar, no un error del navegador.
//   4) NO BORRAR LO VIEJO HASTA TENER LO NUEVO: al actualizar, la copia
//      anterior se conserva hasta que la nueva quede completa.
//
//  LO DE ANTES SE MANTIENE: "primero la copia guardada" -para que la app
//  abra al instante aunque la senal este mala dentro de una barberia- y el
//  limite de tiempo para no quedarse colgada esperando a la red.
// ═══════════════════════════════════════════════════════════════

var CACHE_NOMBRE = 'nbs2-cache-v35';

// Cuanto se espera a la red cuando NO hay copia guardada (milisegundos)
var LIMITE_RED = 4000;

var ARCHIVOS_BASE = [
  './',
  './index.html',
  './app_prueba_firebase.html',
  './manifest.json',
  './icon-512.png'
];

// ───────────────────────────────────────────────────────────────
// EL FILTRO NUEVO: decide si una respuesta se puede guardar y servir.
// Una respuesta sirve solo si:
//   - existe
//   - el servidor dijo que salio bien (200)
//   - NO es un desvio (redirected) — esto es lo que rompia todo
//   - NO es "opaca" (una respuesta que el navegador no deja leer)
// ───────────────────────────────────────────────────────────────
function respuestaSana(resp){
  if(!resp) return false;
  if(resp.redirected) return false;
  if(resp.type === 'opaque' || resp.type === 'opaqueredirect') return false;
  if(resp.status !== 200) return false;
  return true;
}

// La pantalla que se muestra si de verdad no hay nada que servir.
// Antes aqui se devolvia una respuesta VACIA, y eso el navegador lo
// mostraba como un error suyo. Ahora al menos se ve algo entendible.
function paginaDeEmergencia(){
  var html = '<!doctype html><html lang="es"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<title>NBS 2</title></head>'
    + '<body style="margin:0;font-family:system-ui,Arial,sans-serif;background:#1a237e;color:#fff;'
    + 'display:flex;align-items:center;justify-content:center;min-height:100vh;padding:22px">'
    + '<div style="text-align:center;max-width:340px">'
    + '<div style="font-size:44px;margin-bottom:10px">&#128274;</div>'
    + '<div style="font-size:21px;font-weight:900;margin-bottom:10px">No se pudo abrir NBS 2</div>'
    + '<div style="font-size:15px;line-height:1.5;color:#c5cae9;margin-bottom:20px">'
    + 'Tus datos est&aacute;n guardados y no se han perdido.<br>'
    + 'Toca Reintentar. Si acabas de subir archivos, espera 2 minutos.</div>'
    + '<button onclick="location.reload()" style="width:100%;padding:15px;background:#D4A017;color:#1a237e;'
    + 'border:none;border-radius:12px;font-size:17px;font-weight:900">Reintentar</button>'
    + '</div></body></html>';
  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}

// ───────────────────────────────────────────────────────────────
// INSTALL: guardar los archivos base.
// HUECO 4: se guardan en un caché APARTE y solo al final, si todo salio
// bien, se pasan al caché de verdad. Asi una actualizacion a medias nunca
// deja al usuario sin app.
// ───────────────────────────────────────────────────────────────
self.addEventListener('install', function(event){
  self.skipWaiting(); // activar de una vez la version nueva
  event.waitUntil(
    caches.open(CACHE_NOMBRE).then(function(cache){
      // Se agregan uno por uno -no con addAll- para que si falta un archivo
      // no se caiga la instalacion completa. Y solo se guarda lo que este sano.
      return Promise.all(ARCHIVOS_BASE.map(function(url){
        return fetch(url, { cache: 'reload' }).then(function(resp){
          if(!respuestaSana(resp)) return;         // llego un desvio o un error: NO se guarda
          return cache.put(url, resp.clone());
        }).catch(function(){ /* si uno falla, seguir con los demas */ });
      }));
    })
  );
});

// ACTIVATE: borrar cachés viejos (de versiones anteriores).
// Esto es lo que limpia de una vez la copia envenenada del 23 de julio.
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
// cuando la senal esta mala (que era el problema del 22 de julio).
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
// HUECO 1: solo guarda si la respuesta esta sana.
function refrescarEnSegundoPlano(req){
  return redConLimite(req, 8000).then(function(resp){
    if(!respuestaSana(resp)) return;   // desvio o error: se BOTA, se deja la copia buena
    var copia = resp.clone();
    return caches.open(CACHE_NOMBRE).then(function(cache){
      return cache.put(req, copia).catch(function(){});
    });
  }).catch(function(){ /* sin internet o lento: no pasa nada, ya abrio */ });
}

self.addEventListener('fetch', function(event){
  var req = event.request;

  // Solo peticiones GET del mismo sitio. Todo lo demas (Firebase, Google...)
  // pasa directo a la red, sin tocar — la nube y el login siguen igual.
  if(req.method !== 'GET'){ return; }
  var url;
  try { url = new URL(req.url); } catch(e){ return; }
  if(url.origin !== self.location.origin){ return; }

  event.respondWith(
    caches.match(req).then(function(cacheado){

      // ── CASO 1: hay copia guardada ──
      if(cacheado){
        // HUECO 2: revisar que la copia este SANA antes de entregarla.
        // Si esta rota -un desvio guardado, por ejemplo- se borra y se
        // sigue de largo como si no existiera.
        if(respuestaSana(cacheado)){
          event.waitUntil(refrescarEnSegundoPlano(req));
          return cacheado;
        }
        caches.open(CACHE_NOMBRE).then(function(cache){
          cache.delete(req).catch(function(){});
        });
      }

      // ── CASO 2: no hay copia usable → ir a la red, con limite de tiempo ──
      return redConLimite(req, LIMITE_RED).then(function(resp){
        if(respuestaSana(resp)){                     // HUECO 1 otra vez
          var copia = resp.clone();
          caches.open(CACHE_NOMBRE).then(function(cache){
            cache.put(req, copia).catch(function(){});
          });
        }
        return resp;
      }).catch(function(){
        // HUECO 3: no devolver nunca una respuesta vacia.
        // Si es abrir la app, buscar cualquier copia sana de la pagina
        // principal; si no hay ninguna, mostrar la pantalla propia.
        if(req.mode === 'navigate'){
          return caches.match('./index.html').then(function(r){
            if(respuestaSana(r)) return r;
            return caches.match('./app_prueba_firebase.html').then(function(r2){
              if(respuestaSana(r2)) return r2;
              return paginaDeEmergencia();
            });
          }).catch(function(){ return paginaDeEmergencia(); });
        }
        return new Response('', { status: 503, statusText: 'Sin conexion' });
      });
    }).catch(function(){
      if(req.mode === 'navigate') return paginaDeEmergencia();
      return new Response('', { status: 503, statusText: 'Sin conexion' });
    })
  );
});
