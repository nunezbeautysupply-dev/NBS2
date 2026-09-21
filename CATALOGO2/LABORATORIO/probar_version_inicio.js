const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({viewport:{width:390,height:900}});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file:///home/claude/trabajo/index.html');
  await p.waitForTimeout(3000);
  let ok=0,mal=0;
  const T=(n,c,d)=>{ if(c){ok++;console.log('  ✅ '+n);} else {mal++;console.log('  ❌ '+n+(d?'  →  '+d:''));} };

  await p.evaluate(()=>{
    ['pantalla-login','pantalla-bloqueo'].forEach(id=>{const e=document.getElementById(id); if(e) e.style.display='none';});
    const a=document.getElementById('app-contenido'); if(a) a.style.display='block';
  });

  const mirar = async (pantalla) => await p.evaluate((pant)=>{
    ir(pant);
    const bv=document.getElementById('badge-version');
    const top=document.querySelector('.top');
    const logo=document.getElementById('logo-barra');
    const img=logo?logo.querySelector('img'):null;
    const r=bv.getBoundingClientRect(), t=top.getBoundingClientRect();
    const meta=document.querySelector('meta[name=app-version]');
    return { texto:bv.textContent, meta:meta?meta.content:null,
             centroBadge:Math.round(r.left+r.width/2), centroBarra:Math.round(t.left+t.width/2),
             visible: getComputedStyle(bv).visibility!=='hidden' && r.width>0,
             escudoVisible: img ? getComputedStyle(img).display!=='none' : null,
             fondoLogo: logo?logo.style.background:null,
             enInicio: !!document.getElementById('inicio-version') };
  }, pantalla);

  console.log('\n1️⃣  EN LA PANTALLA DE INICIO');
  const a = await mirar('p-inicio');
  console.log('     "'+a.texto+'"   centro badge '+a.centroBadge+'  ·  centro barra '+a.centroBarra);
  T('el letrero se VE en el inicio', a.visible, JSON.stringify(a));
  T('🔑 está CENTRADO en la franja de arriba', Math.abs(a.centroBadge-a.centroBarra)<=2, a.centroBadge+' vs '+a.centroBarra);
  T('el escudo de la barra sigue escondido (no sale dos veces)', a.escudoVisible===false, String(a.escudoVisible));
  T('sin caja blanca en el inicio', a.fondoLogo==='transparent', a.fondoLogo);
  T('ya NO está el letrero suelto de la pantalla de inicio', a.enInicio===false, String(a.enInicio));

  console.log('\n2️⃣  DENTRO DE UN MÓDULO (Catálogo)');
  const c = await mirar('p-cat');
  T('sigue centrado', Math.abs(c.centroBadge-c.centroBarra)<=2, c.centroBadge+' vs '+c.centroBarra);
  T('aquí el escudo SÍ se ve', c.escudoVisible===true, String(c.escudoVisible));
  T('y vuelve la caja blanca', c.fondoLogo==='white', c.fondoLogo);

  console.log('\n3️⃣  LA VERSIÓN SALE DEL ARCHIVO');
  const f = String(c.meta||'').match(/^(\d{4})(\d{2})(\d{2})([a-z]?)/);
  const esperada = f ? ('v'+f[3]+'/'+f[2]+(f[4]?f[4].toUpperCase():'')) : null;
  T('dice la versión que trae el archivo ('+esperada+')', !!esperada && c.texto===esperada, c.texto);
  T('el meta tiene el formato de siempre', /^\d{8}[a-z]?-/.test(c.meta||''), c.meta);

  const r2 = await p.evaluate(()=>{
    let dicho=null; const o=window.avisoGrande; window.avisoGrande=function(m){ dicho=m; };
    verQueVersionTengo(); window.avisoGrande=o; return dicho;
  });
  // ⚠️ Antes buscaba "de agosto de 2026" y se rompio al llegar septiembre. Ahora
  // comprueba que diga CUALQUIER mes con su año, que es lo que de verdad importa. -2 sep-
  T('al tocarlo lo explica en cristiano',
     /de (enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre) de \d{4}/.test(r2||''),
     (r2||'').slice(0,80));
  T('y le dice qué hacer si le sale la vieja', /copia guardada/.test(r2||''), (r2||'').slice(0,120));

  console.log(`\n  ${ok} bien · ${mal} mal`);
  const reales=errs.filter(e=>!/firebase|onAuthStateChanged/i.test(e));
  if(reales.length){ console.log('⚠️ JS:'); reales.forEach(e=>console.log('   '+e)); }
  await b.close();
  process.exit(mal||reales.length?1:0);
})();
