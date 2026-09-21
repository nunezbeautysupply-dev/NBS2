const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({viewport:{width:390,height:1200}});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file:///home/claude/trabajo/index.html');
  await p.waitForTimeout(2500);
  let ok=0,mal=0;
  const T=(n,c,d)=>{ if(c){ok++;console.log('  ✅ '+n);} else {mal++;console.log('  ❌ '+n+(d?'  →  '+d:''));} };

  const abrir = async () => await p.evaluate(async ()=>{
    ['pantalla-login','pantalla-bloqueo'].forEach(id=>{const e=document.getElementById(id); if(e) e.style.display='none';});
    const a=document.getElementById('app-contenido'); if(a) a.style.display='block';
    localStorage.setItem('ncl', JSON.stringify([
      {id:1,nombre:'Nelson',apellido:'Castro De La Cruz',apodo:'TITO',negocio:'RD BARBERSHOP'},
      {id:3,nombre:'Diego',apellido:'Rodriguez',apodo:'',negocio:'RD BARBERSHOP'},
      {id:4,nombre:'Luis',apellido:'Perez',apodo:'EL FLACO',negocio:'RD BARBERSHOP'}
    ]));
    localStorage.setItem('nv','[]');
    clientes=LS('ncl',[]); ventas=LS('nv',[]); loadProds();
    ir('p-ped');
    barberosSel={'1':{cliente:clientes[0],barberia:'RD BARBERSHOP'},
                 '3':{cliente:clientes[1],barberia:'RD BARBERSHOP'},
                 '4':{cliente:clientes[2],barberia:'RD BARBERSHOP'}};
    iniciarPedidoMultiple();
    await new Promise(r=>setTimeout(r,600));
  });

  const leer = async () => await p.evaluate(()=>{
    const zona=document.getElementById('ped-multi-wrap');
    const nombres=[...zona.querySelectorAll('div')].filter(x=>x.children.length===0 &&
      /Nelson Castro|Diego Rodriguez|Luis Perez/.test((x.textContent||'').trim()) &&
      getComputedStyle(x).fontSize==='18px');
    const tarjetas=[0,1,2].map(i=>{
      const c=document.getElementById('multi-card-'+i);
      const cab=document.getElementById('multi-cab-'+i);
      const cs=c?getComputedStyle(c):null;
      return c ? { borde: cs.borderTopWidth, colorBorde: cs.borderTopColor,
                   cabecera: cab?getComputedStyle(cab).backgroundColor:null,
                   filtro: cs.filter, fondo: cs.backgroundColor,
                   rayita: cs.borderLeftColor, rayitaAncho: cs.borderLeftWidth } : null;
    });
    return { nombres: nombres.map(x=>({ txt:x.textContent.trim().slice(0,22),
                                        color:getComputedStyle(x).color,
                                        tam:getComputedStyle(x).fontSize })),
             tarjetas, activo: window._barberoActivo };
  });

  await abrir();
  let r = await leer();

  console.log('\n1️⃣  TODOS LOS NOMBRES IGUALES');
  console.log('     ' + r.nombres.map(x=>x.txt+' → '+x.color).join('\n     '));
  T('salen los 3 nombres', r.nombres.length===3, String(r.nombres.length));
  T('🔑 los 3 son del MISMO color', new Set(r.nombres.map(x=>x.color)).size===1, JSON.stringify(r.nombres.map(x=>x.color)));
  T('y ese color es negro', r.nombres[0].color==='rgb(26, 26, 26)', r.nombres[0].color);
  T('los 3 del mismo tamaño (18px)', new Set(r.nombres.map(x=>x.tam)).size===1 && r.nombres[0].tam==='18px', JSON.stringify(r.nombres.map(x=>x.tam)));

  console.log('\n2️⃣  LA CABECERA GRIS, IGUAL EN TODOS');
  T('los tres tienen la MISMA cabecera gris',
     new Set(r.tarjetas.map(t=>t.cabecera)).size===1 && r.tarjetas[0].cabecera==='rgb(239, 239, 243)',
     JSON.stringify(r.tarjetas.map(t=>t.cabecera)));

  console.log('\n3️⃣  AL ABRIR, NINGUNO ESTÁ ENCENDIDO (desde el acordeón del 28 ago)');
  // Sensei pidio que cada barbero naciera CERRADO. Asi que al abrir la pantalla no hay
  // ninguno encendido: se enciende el que el toque.
  T('ninguno viene encendido', r.activo===undefined || r.activo===null, String(r.activo));
  T('los tres con el borde fino', r.tarjetas.every(t=>parseFloat(t.borde)<2),
     JSON.stringify(r.tarjetas.map(t=>t.borde)));
  T('y ninguno atenuado: se ven todos igual', r.tarjetas.every(t=>t.filtro==='none'),
     JSON.stringify(r.tarjetas.map(t=>t.filtro)));

  console.log('\n4️⃣  AL TOCAR OTRO, SE CAMBIA EL ENCENDIDO');
  // ⚠️ El borde tiene una animacion de 120 ms. Si se mide en el acto, getComputedStyle
  // devuelve el color A MITAD del cambio y la prueba acusa un fallo que no existe. Paso hoy.
  await p.evaluate(()=>marcarBarberoActivo(2));
  await p.waitForTimeout(300);
  r = await leer();
  T('ahora el activo es el 2', r.activo===2, String(r.activo));
  T('el 2 quedó con borde grueso', parseFloat(r.tarjetas[2].borde)>=2, r.tarjetas[2].borde);
  T('🔑 el 0 se APAGÓ', parseFloat(r.tarjetas[0].borde)<2 && r.tarjetas[0].filtro!=='none',
     r.tarjetas[0].borde+' / '+r.tarjetas[0].filtro);
  T('y el 2 quedó a todo color', r.tarjetas[2].filtro==='none', r.tarjetas[2].filtro);
  T('solo UNO está encendido', r.tarjetas.filter(t=>parseFloat(t.borde)>=2).length===1,
     JSON.stringify(r.tarjetas.map(t=>t.borde)));

  console.log('\n5️⃣  LA RAYITA DE COLOR SE QUEDA (para saber dónde empieza cada bloque)');
  // Aqui el ENCENDIDO es el barbero 2: su rayita va ROJA y de 10px; las otras dos se quedan
  // con su color de siempre y 6px.
  T('la rayita del ELEGIDO es más gruesa (10px)', r.tarjetas[2].rayitaAncho==='10px',
     JSON.stringify(r.tarjetas.map(t=>t.rayitaAncho)));
  T('🔑 y va ROJA mientras esté elegido', r.tarjetas[2].rayita==='rgb(198, 40, 40)', r.tarjetas[2].rayita);
  T('las de los apagados se quedan en 6px',
     r.tarjetas[0].rayitaAncho==='6px' && r.tarjetas[1].rayitaAncho==='6px',
     JSON.stringify(r.tarjetas.map(t=>t.rayitaAncho)));
  T('y cada apagado conserva SU propio color',
     r.tarjetas[0].rayita!==r.tarjetas[1].rayita, JSON.stringify(r.tarjetas.map(t=>t.rayita)));

  console.log('\n5️⃣b  AL APAGARSE, LA RAYITA VUELVE A SU COLOR');
  await p.evaluate(()=>marcarBarberoActivo(0));
  await p.waitForTimeout(300);
  const r5b = await leer();
  // OJO: el color propio del tercer barbero YA ES ese mismo rojo, asi que por color no se
  // puede distinguir. Se comprueba por el GROSOR, que si vuelve de 10 a 6.
  T('el 2 se apagó: su rayita volvió a 6px', r5b.tarjetas[2].rayitaAncho==='6px', r5b.tarjetas[2].rayitaAncho);
  T('ahora el rojo lo tiene el 0', r5b.tarjetas[0].rayita==='rgb(198, 40, 40)', r5b.tarjetas[0].rayita);
  T('con sus 10px', r5b.tarjetas[0].rayitaAncho==='10px', r5b.tarjetas[0].rayitaAncho);

  console.log('\n6️⃣  AL ESCRIBIR EN SU BUSCADOR, TAMBIÉN SE MARCA');
  const r6 = await p.evaluate(()=>{
    const i=document.getElementById('multi-buscar-1');
    if(!i) return {error:'no existe el buscador'};
    i.dispatchEvent(new Event('focus'));
    new Function('event', i.getAttribute('onfocus')).call(i, new Event('focus'));
    return { activo: window._barberoActivo };
  });
  T('al enfocar el buscador del barbero 1, se enciende él', r6.activo===1, JSON.stringify(r6));

  console.log(`\n  ${ok} bien · ${mal} mal`);
  const reales=errs.filter(e=>!/firebase|onAuthStateChanged/i.test(e));
  if(reales.length){ console.log('⚠️ JS:'); reales.forEach(e=>console.log('   '+e)); }
  await b.close();
  process.exit(mal||reales.length?1:0);
})();
