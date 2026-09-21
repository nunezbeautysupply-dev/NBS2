const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({viewport:{width:390,height:844}});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file:///home/claude/trabajo/index.html');
  await p.waitForTimeout(2500);
  await p.evaluate(()=>{ window.fbDb={ref:()=>({set(){},update(){},on(){},once(){return Promise.resolve({val:()=>null});}})}; });
  let ok=0,mal=0;
  const T=(n,c,d)=>{ if(c){ok++;console.log('  ✅ '+n);} else {mal++;console.log('  ❌ '+n+(d?'  →  '+d:''));} };

  const abrir = async () => await p.evaluate(async ()=>{
    ['pantalla-login','pantalla-bloqueo'].forEach(id=>{const e=document.getElementById(id); if(e) e.style.display='none';});
    const a=document.getElementById('app-contenido'); if(a) a.style.display='block';
    localStorage.setItem('nsup', JSON.stringify([{id:900,nombre:'Kanar Online'}]));
    localStorage.setItem('np', JSON.stringify([{id:'p1',nombre:'Gel 700ml',marca:'G',costo:4,precio:10,stock:20,min:5}]));
    localStorage.setItem('nc','[]');
    suplidores=LS('nsup',[]); compras=LS('nc',[]); loadProds();
    ir('p-comp');
    await new Promise(r=>setTimeout(r,300));
    return Math.round(document.getElementById('p-comp').getBoundingClientRect().height);
  });

  console.log('\n1️⃣  LA PANTALLA ES MÁS CORTA');
  const alto = await abrir();
  console.log('     ahora: ' + alto + ' px   ·   antes: 1504 px');
  // ⚠️ El listón era 1200 y subió a 1300 el 4 sep: la pantalla creció 7 px cuando se le
  // añadió el campo 📅 "Fecha de la factura" que pidió Sensei. Es una función nueva,
  // no un descuido. Sigue siendo casi 300 px más corta que antes.
  T('bajó de 1504 px', alto < 1300, alto+' px');
  T('🔑 se ahorraron casi 300 px', (1504-alto) > 250, (1504-alto)+' px menos');

  console.log('\n2️⃣  LOS DOS BLOQUES NACEN CERRADOS');
  const r2 = await p.evaluate(()=>({
    factura: document.getElementById('cc-bloque-factura').style.display,
    extras: document.getElementById('cc-bloque-extras').style.display,
    botonFactura: !!document.getElementById('cc-btn-factura'),
    botonExtras: !!document.getElementById('cc-btn-extras')
  }));
  T('el de la factura, cerrado', r2.factura==='none', r2.factura);
  T('el de envío y descuentos, cerrado', r2.extras==='none', r2.extras);
  T('los dos botones están', r2.botonFactura && r2.botonExtras);

  console.log('\n3️⃣  🔒 NADA SE PERDIÓ — todo sigue dentro');
  const r3 = await p.evaluate(()=>{
    const f=document.getElementById('cc-bloque-factura');
    const e=document.getElementById('cc-bloque-extras');
    return {
      foto: !!f.querySelector('#cc-hojas-fila'),
      ocr: !!f.querySelector('#cc-btn-ocr'),
      pdf: !!f.querySelector('button[onclick*="abrirLectorFactura"]'),
      envio: !!e.querySelector('#cc-envio'),
      tarjeta: !!e.querySelector('#cc-tarjeta'),
      desc1: !!e.querySelector('#cc-desc1'),
      desc3: !!e.querySelector('#cc-descm3'),
      // y lo del dia a dia sigue FUERA, a la vista
      suplidorFuera: !document.getElementById('cc-bloque-factura').contains(document.getElementById('ccsup')),
      totalFuera: !document.getElementById('cc-bloque-extras').contains(document.getElementById('cctot'))
    };
  });
  T('las hojas de la factura siguen ahí', r3.foto);
  T('el lector de texto también', r3.ocr);
  T('y el lector de PDF', r3.pdf);
  T('el envío y el cargo por tarjeta', r3.envio && r3.tarjeta);
  T('los 3 descuentos', r3.desc1 && r3.desc3);
  T('🔒 el suplidor sigue a la vista', r3.suplidorFuera);
  T('🔒 y el total también', r3.totalFuera);

  console.log('\n4️⃣  ABREN Y CIERRAN');
  const r4 = await p.evaluate(()=>{
    toggleBloqueCompra('cc-bloque-factura','cc-btn-factura');
    const abierto = document.getElementById('cc-bloque-factura').style.display;
    const fl = document.querySelector('#cc-btn-factura .cc-flecha').textContent;
    toggleBloqueCompra('cc-bloque-factura','cc-btn-factura');
    return { abierto, cerrado: document.getElementById('cc-bloque-factura').style.display, fl,
             fl2: document.querySelector('#cc-btn-factura .cc-flecha').textContent };
  });
  T('abre al tocarlo', r4.abierto==='block', r4.abierto);
  T('cierra al tocarlo otra vez', r4.cerrado==='none', r4.cerrado);
  T('la flechita cambia', r4.fl==='⌃' && r4.fl2==='›', r4.fl+' / '+r4.fl2);

  console.log('\n5️⃣  🔑 SI EL PDF TRAE DESCUENTOS, EL BLOQUE SE ABRE SOLO');
  const r5 = await p.evaluate(async ()=>{
    const linea=(t)=>({texto:t, palabras:t.split(/\s+/).map((x,i)=>({t:x,x:i*10}))});
    analizarFacturaYMostrar([
      linea('GU-GU103A Gel 700ml 120 0 4.00 480.00'),
      linea('Subtotal 480.00'),
      linea('PROMO DE VERANO -50.00')
    ]);
    await new Promise(r=>setTimeout(r,300));
    // ⚠️ agregarFacturaALaCompra exige que el renglon este MARCADO y emparejado con un
    // producto. Sin eso se sale con un aviso y no llega a poner los descuentos.
    (window._facturaItems||[]).forEach(it=>{ it.marcado = true; it.pid = 'p1'; });
    const oa=window.alert; window.alert=()=>{};
    agregarFacturaALaCompra();
    await new Promise(r=>setTimeout(r,300));
    window.alert=oa;
    return { extras: document.getElementById('cc-bloque-extras').style.display,
             desc1: document.getElementById('cc-desc1').value,
             monto1: document.getElementById('cc-descm1').value };
  });
  T('🔑 el bloque se abrió solo', r5.extras==='block', r5.extras);
  T('y el descuento está puesto', /PROMO/i.test(r5.desc1||''), r5.desc1);
  T('con su monto', r5.monto1==='50.00', r5.monto1);

  console.log('\n6️⃣  🔒 SE PUEDE GUARDAR UNA COMPRA CON TODO CERRADO');
  const r6 = await p.evaluate(async ()=>{
    ir('p-comp');
    await new Promise(r=>setTimeout(r,200));
    const sel=document.getElementById('ccsup');
    sel.innerHTML='<option value="900">Kanar</option>'; sel.value='900';
    document.getElementById('cctipo').value='credito';
    window._pagoMetodos={ccini:[{tipo:'efectivo',monto:0}]};
    iCC=[{pid:'p1',nombre:'Gel 700ml',cant:10,costo:4,esNuevo:false,precioVenta:10}];
    document.getElementById('cc-envio').value='';
    document.getElementById('cc-tarjeta').value='';
    for(let i=1;i<=3;i++){ document.getElementById('cc-desc'+i).value=''; document.getElementById('cc-descm'+i).value=''; }
    const oa=window.alert; window.alert=()=>{};
    saveCC();
    window.alert=oa;
    const c=LS('nc',[])[0];
    return { total: c?c.total:null, cuantas: LS('nc',[]).length };
  });
  T('🔒 la compra se guarda igual', r6.cuantas===1, String(r6.cuantas));
  T('con su total correcto ($40.00)', Math.abs(r6.total-40)<0.005, String(r6.total));

  console.log(`\n  ${ok} bien · ${mal} mal`);
  const reales=errs.filter(e=>!/firebase|onAuthStateChanged/i.test(e));
  if(reales.length){ console.log('⚠️ JS:'); reales.forEach(e=>console.log('   '+e)); }
  await b.close();
  process.exit(mal||reales.length?1:0);
})();
