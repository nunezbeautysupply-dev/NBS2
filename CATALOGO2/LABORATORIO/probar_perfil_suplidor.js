const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({viewport:{width:390,height:1100}});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file:///home/claude/trabajo/index.html');
  await p.waitForTimeout(2500);
  await p.evaluate(()=>{ window.fbDb={ref:()=>({set(){},update(){},on(){},once(){return Promise.resolve({val:()=>null});}})};
    window.protegerConHuella=function(cb){ cb(); }; });
  let ok=0,mal=0;
  const T=(n,c,d)=>{ if(c){ok++;console.log('  ✅ '+n);} else {mal++;console.log('  ❌ '+n+(d?'  →  '+d:''));} };

  const abrir = async (panel) => await p.evaluate(async (pn)=>{
    ['pantalla-login','pantalla-bloqueo'].forEach(id=>{const e=document.getElementById(id); if(e) e.style.display='none';});
    const a=document.getElementById('app-contenido'); if(a) a.style.display='block';
    localStorage.setItem('nsup', JSON.stringify([{id:900,nombre:'Kanar Online',contacto:'Maria Reyes',
      tel:'4015551212',telContacto:'4015559090',email:'ventas@kanar.com',dir:'250 Main St',ciudad:'Providence',zip:'02904',
      notas:'Entrega los martes.'}]));
    localStorage.setItem('np', JSON.stringify([
      {id:'p1',nombre:'Gummy hair gel 700ml',marca:'Gummy',costo:4,precio:10,stock:50,min:5},
      {id:'p2',nombre:'Barber colonia 400ml',marca:'Barber',costo:4.25,precio:9.99,stock:30,min:5}]));
    localStorage.setItem('nc', JSON.stringify([
      {id:7001,sid:900,sn:'Kanar Online',tipo:'credito',fecha:'07/14/2026',
       items:[{pid:'p1',nombre:'Gummy hair gel 700ml',cant:120,costo:4}],total:480,
       pagosFactura:[{pid:'a',monto:480,fecha:'07/20/2026',metodo:'tarjeta'}]},
      {id:7005,sid:900,sn:'Kanar Online',tipo:'credito',fecha:'08/11/2026',
       items:[{pid:'p1',nombre:'Gummy hair gel 700ml',cant:60,costo:4},
              {pid:'p2',nombre:'Barber colonia 400ml',cant:24,costo:4.25}],total:342,
       pagosFactura:[{pid:'b',monto:150,fecha:'08/14/2026',metodo:'zelle'}]},
      {id:7009,sid:900,sn:'Kanar Online',tipo:'credito',fecha:'08/25/2026',
       items:[{pid:'p2',nombre:'Barber colonia 400ml',cant:36,costo:4.25}],total:153,pagosFactura:[]}
    ]));
    suplidores=LS('nsup',[]); compras=LS('nc',[]); loadProds();
    _panelSupAbierto = pn || null;
    ir('p-sup'); verSup(900,'completo');
    await new Promise(r=>setTimeout(r,400));
    return document.getElementById('sup-perfil-contenido').innerText;
  }, panel);

  console.log('\n1️⃣  LOS CUATRO NÚMEROS DE ARRIBA');
  let t = await abrir(null);
  T('COMPRÉ $975.00 (480+342+153)', /COMPR..?\s*\$975\.00/.test(t.replace(/\n/g,' ')), t.slice(0,160).replace(/\n/g,' | '));
  T('DEBO $345.00 (192 + 153)', /DEBO\s*\$345\.00/.test(t.replace(/\n/g,' ')));
  T('PRODUCTOS 2 (le compras 2 distintos)', /PRODUCTOS\s*2/.test(t.replace(/\n/g,' ')));
  T('ÚLTIMA con los días', /LTIMA\s*\d+ d/.test(t.replace(/\n/g,' ')));

  console.log('\n2️⃣  LOS OCHO RENGLONES ESTÁN');
  ['Sus datos','Mis pagos','Lo que más le compro','Historial de costos','Cada cuánto le compro','Cómo le suelo pagar','Notas','Ajustes']
    .forEach(x=>T('está "'+x+'"', t.indexOf(x)>=0));

  console.log('\n3️⃣  📇 SUS DATOS — lo que estaba escondido en Editar');
  t = await abrir('datos');
  T('el contacto', /Maria Reyes/.test(t));
  T('los dos teléfonos', /4015551212/.test(t) && /4015559090/.test(t));
  T('el email', /ventas@kanar\.com/.test(t));
  T('la dirección completa', /250 Main St, Providence, 02904/.test(t));
  const r3 = await p.evaluate(()=>{
    const z=document.getElementById('sup-perfil-contenido');
    return { llamar: !!z.querySelector('a[href^="tel:"]'),
             whats: !!z.querySelector('a[href*="wa.me"]'),
             mapa: !!z.querySelector('a[href*="google.com/maps"]') };
  });
  T('botón de LLAMAR', r3.llamar);
  T('botón de WHATSAPP', r3.whats);
  T('botón de MAPA', r3.mapa);

  console.log('\n4️⃣  💵 MIS PAGOS — con su lápiz para corregir');
  t = await abrir('pagos');
  T('salen los 2 pagos', /\$480\.00/.test(t) && /\$150\.00/.test(t));
  T('con su forma de pago', /Tarjeta/.test(t) && /Zelle/.test(t));
  T('el más nuevo va primero (08/14 antes que 07/20)',
     t.indexOf('08/14/2026') < t.indexOf('07/20/2026'), 'orden');
  const r4 = await p.evaluate(()=>{
    const z=document.getElementById('sup-perfil-contenido');
    const fila=[...z.querySelectorAll('div')].find(x=>(x.getAttribute('onclick')||'').indexOf('abrirEditorPagoCompra')>=0);
    return { hay: !!fila, llama: fila?fila.getAttribute('onclick'):null };
  });
  T('🔑 cada pago abre el corrector', r4.hay, r4.llama);

  console.log('\n5️⃣  📦 LO QUE MÁS LE COMPRO');
  t = await abrir('top');
  T('sale el gel con sus 180 unidades', /Gummy hair gel 700ml/.test(t) && /180 unid/.test(t), t.slice(0,300).replace(/\n/g,' | '));
  T('y la colonia con sus 60', /Barber colonia 400ml/.test(t) && /60 unid/.test(t));

  console.log('\n6️⃣  💳 CÓMO LE SUELO PAGAR');
  t = await abrir('comopago');
  T('sale tarjeta con $480', /Tarjeta/.test(t) && /\$480\.00/.test(t));
  T('y zelle con $150', /Zelle/.test(t) && /\$150\.00/.test(t));

  console.log('\n7️⃣  ⚙️ AJUSTES — los botones que estaban sueltos arriba');
  t = await abrir('ajustes');
  T('editar suplidor', /Editar suplidor/.test(t));
  T('balance inicial', /balance inicial/i.test(t));
  T('eliminar', /Eliminar suplidor/.test(t));

  console.log('\n8️⃣  🔒 UN SUPLIDOR SIN DATOS NO REVIENTA');
  const r8 = await p.evaluate(async ()=>{
    localStorage.setItem('nsup', JSON.stringify([{id:901,nombre:'Nuevo Suplidor'}]));
    localStorage.setItem('nc','[]');
    suplidores=LS('nsup',[]); compras=LS('nc',[]);
    _panelSupAbierto='datos';
    try { verSup(901,'completo'); } catch(e){ return {error:e.message}; }
    await new Promise(r=>setTimeout(r,300));
    const z=document.getElementById('sup-perfil-contenido');
    return { texto: z.innerText.slice(0,400), largo: z.innerHTML.length };
  });
  T('no revienta', !r8.error, r8.error||'');
  T('se pinta igual', r8.largo > 500, String(r8.largo));
  T('los números salen en cero', /\$0\.00/.test(r8.texto||''), (r8.texto||'').slice(0,140).replace(/\n/g,' | '));

  console.log(`\n  ${ok} bien · ${mal} mal`);
  const reales=errs.filter(e=>!/firebase|onAuthStateChanged/i.test(e));
  if(reales.length){ console.log('⚠️ JS:'); reales.forEach(e=>console.log('   '+e)); }
  await b.close();
  process.exit(mal||reales.length?1:0);
})();
