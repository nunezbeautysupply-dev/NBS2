const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file:///home/claude/trabajo/index.html');
  await p.waitForTimeout(2500);
  await p.evaluate(()=>{ window.fbDb={ref:()=>({set(){},update(){},on(){},once(){return Promise.resolve({val:()=>null});}})};
    document.getElementById('pantalla-login')&&(document.getElementById('pantalla-login').style.display='none');
    document.getElementById('pantalla-bloqueo')&&(document.getElementById('pantalla-bloqueo').style.display='none');
    var a=document.getElementById('app-contenido'); if(a) a.style.display='block'; });

  let ok=0,mal=0;
  const T=(n,c,d)=>{ if(c){ok++;console.log('  ✅ '+n);} else {mal++;console.log('  ❌ '+n+(d?'  →  '+d:''));} };

  // Escribir de verdad, tecla por tecla, en un campo
  // Los campos viven en pantallas escondidas, asi que se teclea disparando el MISMO evento
  // que dispara el teclado del telefono: un InputEvent con la letra en .data, que es
  // exactamente lo que lee formatoCostoPreciso. Luego el onblur, como al salir del campo.
  async function teclear(id, texto){
    return await p.evaluate(({id, texto})=>{
      const e = document.getElementById(id);
      if(!e) return 'NO EXISTE EL CAMPO';
      e.value=''; e.dataset.modoPreciso='';
      const alEscribir = e.getAttribute('oninput');
      const alSalir    = e.getAttribute('onblur');
      for(const ch of texto){
        e.value += ch;
        const ev = new InputEvent('input', { data: ch, inputType:'insertText', bubbles:true });
        new Function('event', alEscribir).call(e, ev);
      }
      new Function('event', alSalir).call(e, new Event('blur'));
      return e.value;
    }, {id, texto});
  }

  console.log('\n1️⃣  MODO CALCULADORA en el costo de la compra (cccosto)');
  for (const [entra, sale] of [['400','4.00'],['450','4.50'],['1250','12.50'],['4','0.04'],['15121','151.21']]) {
    const r = await teclear('cccosto', entra);
    T(`escribes "${entra}" → queda ${sale}`, r===sale, r);
  }

  console.log('\n2️⃣  DECIMALES DE VERDAD (escribiendo el punto tú mismo)');
  for (const [entra, sale] of [['4.4589','4.4589'],['3.9589','3.9589'],['4.4','4.4'],['0.0125','0.0125'],['151.21','151.21']]) {
    const r = await teclear('cccosto', entra);
    T(`escribes "${entra}" → queda ${sale}`, r===sale, r);
  }

  console.log('\n3️⃣  LOS OTROS TRES CAMPOS DE COSTO');
  for (const id of ['ep-costo','vnp-costo','pednp-costo']) {
    const a = await teclear(id,'400');
    const c = await teclear(id,'4.4589');
    T(`${id}: calculadora (400 → 4.00)`, a==='4.00', a);
    T(`${id}: decimales (4.4589)`, c==='4.4589', c);
  }

  console.log('\n4️⃣  EL COSTO EN LA REVISIÓN DEL PDF ESCANEADO');
  const r4 = await p.evaluate(async () => {
    const linea = (t)=>({texto:t, palabras:t.split(/\s+/).map((x,i)=>({t:x,x:i*10}))});
    localStorage.setItem('np', JSON.stringify([{id:'p1',nombre:'Hair Gel 700ml',marca:'Gummy',costo:4,precio:10,stock:0,min:5}]));
    loadProds();
    analizarFacturaYMostrar([
      linea('GU-GU103A Hair Gel 700ml Keratin 120 0 4.4589 535.07'),
      linea('Subtotal 535.07')
    ]);
    await new Promise(r=>setTimeout(r,250));
    const inps=[...document.querySelectorAll('input')].filter(x=>x.getAttribute('onblur')&&x.getAttribute('onblur').indexOf("'costo'")>=0);
    return { cuantos: inps.length,
             tipo: inps[0]?inps[0].type:null,
             valor: inps[0]?inps[0].value:null,
             tieneCalculadora: inps[0]?(inps[0].getAttribute('oninput')||'').indexOf('formatoCostoPreciso')>=0:false,
             leido: (window._facturaItems||[]).map(i=>i.costo) };
  });
  console.log('     el PDF traía 4.4589 →  la casilla muestra: '+r4.valor);
  T('la casilla del costo es de texto (no number)', r4.tipo==='text', r4.tipo);
  T('tiene modo calculadora enganchado', r4.tieneCalculadora);
  T('muestra 4.4589 completo, sin redondear a 4.46', r4.valor==='4.4589', r4.valor);
  T('el costo leído del PDF conserva los 4 decimales', Math.abs(r4.leido[0]-4.4589)<0.00001, JSON.stringify(r4.leido));

  console.log('\n5️⃣  QUE EL COSTO CON 4 DECIMALES LLEGUE BIEN AL PRODUCTO');
  const r5 = await p.evaluate(() => {
    localStorage.setItem('nsup', JSON.stringify([{id:900,nombre:'Kanar Online'}]));
    localStorage.setItem('nc','[]');
    localStorage.setItem('np', JSON.stringify([{id:'p1',nombre:'Hair Gel 700ml',marca:'Gummy',costo:4,precio:10,stock:0,min:5}]));
    suplidores=LS('nsup',[]); loadProds();
    var sel=document.getElementById('ccsup'); sel.innerHTML='<option value="900">K</option>'; sel.value='900';
    document.getElementById('cctipo').value='credito';
    window._pagoMetodos={ccini:[{tipo:'efectivo',monto:0}]};
    iCC=[{pid:'p1',nombre:'Hair Gel 700ml',cant:120,costo:4.4589,esNuevo:false,precioVenta:10}];
    document.getElementById('cc-envio').value=''; document.getElementById('cc-tarjeta').value='';
    for(var i=1;i<=3;i++){ document.getElementById('cc-desc'+i).value=''; document.getElementById('cc-descm'+i).value=''; }
    var oa=window.alert; window.alert=function(){}; saveCC(); window.alert=oa;
    var c=LS('nc',[])[0];
    var pr=LS('np',[]).find(x=>String(x.id)==='p1');
    return { total:c.total, costoGuardado:c.items[0].costo, costoProducto:pr.costo };
  });
  console.log('     120 × 4.4589 = '+r5.total);
  T('el total sale 535.068 (no 535.20 de redondear)', Math.abs(r5.total-535.068)<0.001, String(r5.total));
  T('la factura guarda 4.4589', Math.abs(r5.costoGuardado-4.4589)<0.00001, String(r5.costoGuardado));
  T('el producto queda con costo 4.4589', Math.abs(r5.costoProducto-4.4589)<0.00001, String(r5.costoProducto));

  console.log('\n══════════════════════════════');
  console.log(`  ${ok} bien · ${mal} mal`);
  const reales=errs.filter(e=>!/firebase|onAuthStateChanged/i.test(e));
  if(reales.length){ console.log('⚠️ JS:'); reales.forEach(e=>console.log('   '+e)); }
  await b.close();
  process.exit(mal?1:0);
})();
