// ═══════════════════════════════════════════════════════════════
//  🔬 AUDITORÍA TOTAL DE NBS 2  (30 ago 2026)
//  Sensei: "revisa todas las funciones que tiene la app y utiliza
//  todos los métodos posibles para que todo funcione lo mejor posible"
// ═══════════════════════════════════════════════════════════════
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({viewport:{width:390,height:1200}});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file:///home/claude/trabajo/index.html');
  await p.waitForTimeout(3000);
  let ok=0, mal=0; const fallos=[];
  const T=(n,c,d)=>{ if(c){ok++;} else {mal++; fallos.push(n+(d?'  →  '+d:'')); console.log('  ❌ '+n+(d?'  →  '+d:''));} };

  await p.evaluate(()=>{
    ['pantalla-login','pantalla-bloqueo'].forEach(id=>{const e=document.getElementById(id); if(e) e.style.display='none';});
    document.getElementById('app-contenido').style.display='block';
  });

  console.log('\n═══ 1. TODA FUNCIÓN LLAMADA DESDE EL HTML EXISTE ═══');
  const r1 = await p.evaluate(()=>{
    const html = document.documentElement.innerHTML;
    const nombres = new Set();
    const re = /on(?:click|change|input|focus|blur|submit)\s*=\s*["']([^"']+)["']/gi;
    let m;
    while((m = re.exec(html))){
      const re2 = /([A-Za-z_$][\w$]*)\s*\(/g; let m2;
      while((m2 = re2.exec(m[1]))){
        const f = m2[1];
        if(['if','for','while','return','function','event','this','typeof','new','catch','try'].includes(f)) continue;
        nombres.add(f);
      }
    }
    // ⚠️ Hay funciones que se crean AL VUELO con window.X = function(){} — existen solo
    // cuando su pantalla está abierta. Y otras viven dentro del catálogo que se le manda
    // al barbero, que corre en OTRO teléfono. Las dos cosas son correctas.
    const alVuelo = /window\.([A-Za-z_$][\w$]*)\s*=\s*function/g;
    const creadas = new Set(); let mv;
    while((mv = alVuelo.exec(html))) creadas.add(mv[1]);
    const delCatalogo = ['verificarCodigo','enviarPorWhatsApp','enviarPorSMS'];
    const metodos = ['getElementById','select','stopPropagation','splice','preventDefault','focus','blur','click'];
    const muertas = [...nombres].filter(f=>
      typeof window[f] !== 'function' && !creadas.has(f) &&
      !delCatalogo.includes(f) && !metodos.includes(f));
    return { total: nombres.size, muertas };
  });
  console.log('     ' + r1.total + ' funciones llamadas desde botones');
  T('🔑 ninguna función llamada desde el HTML falta', r1.muertas.length===0, JSON.stringify(r1.muertas));

  console.log('\n═══ 2. TODO RECUADRO SE CIERRA CON EL BOTÓN ATRÁS ═══');
  const r2 = await p.evaluate(()=>{
    const enLista = RECUADROS_ENCIMA.map(x=>x.id);
    const html = document.documentElement.innerHTML;
    const creados = new Set();
    const re = /\.id\s*=\s*['"]([a-z0-9-]*(?:overlay|-ov|-box)[a-z0-9-]*)['"]/gi;
    let m; while((m = re.exec(html))) creados.add(m[1]);
    document.querySelectorAll('[id*="overlay"],[id$="-ov"]').forEach(e=>creados.add(e.id));
    const aProposito = ['menu-lateral-overlay','salir-ov'];
    const faltan = [...creados].filter(id=>!enLista.includes(id) && !aProposito.includes(id));
    // Y que sus funciones de cerrar existan
    const cierresRotos = RECUADROS_ENCIMA.filter(x=>x.cerrar && typeof window[x.cerrar]!=='function').map(x=>x.cerrar);
    return { enLista: enLista.length, faltan, cierresRotos };
  });
  console.log('     ' + r2.enLista + ' recuadros registrados');
  T('🔑 ningún recuadro sin registrar', r2.faltan.length===0, JSON.stringify(r2.faltan));
  T('🔑 y toda función de cerrar existe', r2.cierresRotos.length===0, JSON.stringify(r2.cierresRotos));

  console.log('\n═══ 3. LAS 29 PANTALLAS ABREN SIN REVENTAR ═══');
  const r3 = await p.evaluate(async ()=>{
    const pantallas = [...document.querySelectorAll('.pg')].map(x=>x.id);
    const rotas = [];
    for(const id of pantallas){
      try {
        ir(id);
        await new Promise(r=>setTimeout(r,60));
        const el = document.getElementById(id);
        if(!el || el.style.display === 'none') rotas.push(id + ' (no se abrió)');
      } catch(e){ rotas.push(id + ': ' + e.message); }
    }
    return { total: pantallas.length, rotas };
  });
  console.log('     ' + r3.total + ' pantallas');
  T('🔑 todas abren', r3.rotas.length===0, JSON.stringify(r3.rotas));

  console.log('\n═══ 4. IDS REPETIDOS ═══');
  const r4 = await p.evaluate(()=>{
    const vistos = {}, reps = [];
    document.querySelectorAll('[id]').forEach(e=>{
      if(vistos[e.id]) { if(!reps.includes(e.id)) reps.push(e.id); }
      vistos[e.id] = 1;
    });
    return reps;
  });
  T('🔑 ningún id repetido en el HTML', r4.length===0, JSON.stringify(r4.slice(0,10)));

  console.log('\n═══ 5. FUNCIONES DEFINIDAS DOS VECES ═══');
  const r5 = await p.evaluate(()=>{
    const html = document.documentElement.innerHTML;
    const cuenta = {};
    const re = /function\s+([A-Za-z_$][\w$]*)\s*\(/g;
    let m; while((m = re.exec(html))) cuenta[m[1]] = (cuenta[m[1]]||0) + 1;
    // ⚠️ Solo importan las funciones GLOBALES. Las declaradas dentro de otra función
    // (terminar, mover, empezar...) son locales de cada una y no se pisan entre sí.
    return Object.keys(cuenta).filter(k=>cuenta[k] > 1 && typeof window[k] === 'function')
      .map(k=>k+' ×'+cuenta[k]);
  });
  T('🔑 ninguna función pisa a otra', r5.length===0, JSON.stringify(r5));


  console.log('\n═══ 6. NINGÚN RECUADRO CUELGA DE OTRO QUE ESTÉ OCULTO ═══');
  // 🔴 El 30 ago un </div> perdido dejó TODOS los avisos grandes dentro del letrero de
  // salir, que está oculto. Medían 0 px y no se veía ninguno. Esto lo caza.
  const r6 = await p.evaluate(()=>{
    const malos = [];
    const ids = RECUADROS_ENCIMA.map(x=>x.id).concat(['aviso-ov','aviso-caja','salir-box','salir-ov']);
    ids.forEach(id=>{
      const el = document.getElementById(id);
      if(!el) return;
      // Se sube por los padres buscando alguno escondido
      let n = el.parentNode, cadena = [];
      while(n && n !== document.body){
        if(n.id) cadena.push(n.id);
        if(n.style && n.style.display === 'none'){
          malos.push(id + ' cuelga de "' + (n.id || n.tagName) + '", que está oculto');
          break;
        }
        n = n.parentNode;
      }
    });
    return malos;
  });
  T('🔑 ningún recuadro cuelga de algo oculto', r6.length===0, JSON.stringify(r6));

  console.log('\n═══ 7. LOS AVISOS GRANDES SE VEN DE VERDAD ═══');
  const r7 = await p.evaluate(async ()=>{
    avisoGrande('PRUEBA');
    await new Promise(r=>setTimeout(r,250));
    const c = document.getElementById('aviso-caja');
    const rc = c.getBoundingClientRect();
    const alto = Math.round(rc.height);
    try { cerrarAviso(); } catch(e){}
    return { alto };
  });
  T('🔑 el aviso grande mide más de 0 px', r7.alto > 40, r7.alto + ' px');

  console.log(`\n  ${ok} bien · ${mal} mal`);
  if(fallos.length){ console.log('\n  LO QUE HAY QUE ARREGLAR:'); fallos.forEach(f=>console.log('   · '+f)); }
  const reales=errs.filter(e=>!/firebase|onAuthStateChanged/i.test(e));
  if(reales.length){ console.log('\n⚠️ ERRORES JS:'); reales.slice(0,8).forEach(e=>console.log('   '+e)); }
  await b.close();
  process.exit(mal||reales.length?1:0);
})();
