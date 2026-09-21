const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({viewport:{width:390,height:1000}});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file:///home/claude/trabajo/index.html');
  await p.waitForTimeout(2500);
  await p.evaluate(()=>{ window.fbDb={ref:()=>({set(){},update(){},on(){},once(){return Promise.resolve({val:()=>null});}})};
    window.protegerConHuella=function(cb){ cb(); }; });
  let ok=0,mal=0;
  const T=(n,c,d)=>{ if(c){ok++;console.log('  ✅ '+n);} else {mal++;console.log('  ❌ '+n+(d?'  →  '+d:''));} };

  console.log('\n1️⃣  LA FUNCIÓN QUE LEE DINERO');
  const r1 = await p.evaluate(()=>({
    conComa: dinero('2,554.87'), conDolar: dinero('$2,554.87'), sinComa: dinero('2554.87'),
    millon: dinero('1,234,567.89'), vacio: dinero(''), basura: dinero('abc'),
    nulo: dinero(null), numero: dinero(1234.5), negativo: dinero('-45.50'),
    cuatroDec: dinero('4,4589'.replace('4,4','4.4'))
  }));
  T('🔑 "2,554.87" → 2554.87 (NO 2)', r1.conComa===2554.87, String(r1.conComa));
  T('"$2,554.87" → 2554.87', r1.conDolar===2554.87, String(r1.conDolar));
  T('"2554.87" sigue bien', r1.sinComa===2554.87, String(r1.sinComa));
  T('"1,234,567.89" → 1234567.89', r1.millon===1234567.89, String(r1.millon));
  T('vacío → 0', r1.vacio===0);
  T('basura → 0', r1.basura===0);
  T('nulo → 0', r1.nulo===0);
  T('un número se deja igual', r1.numero===1234.5);
  T('negativos', r1.negativo===-45.50, String(r1.negativo));

  console.log('\n2️⃣  LAS CASILLAS PONEN LA COMA AL ESCRIBIR');
  const r2 = await p.evaluate(()=>{
    const e=document.createElement('input'); document.body.appendChild(e);
    const pruebas={};
    [['255487','2,554.87'],['100000','1,000.00'],['123456789','1,234,567.89'],
     ['400','4.00'],['99','0.99'],['0','0.00']].forEach(([entra,sale])=>{
      e.value=entra; formatoMoneda(e); pruebas[entra]={dio:e.value, esperado:sale};
    });
    return pruebas;
  });
  Object.keys(r2).forEach(k=>{
    T(`escribes "${k}" → ${r2[k].esperado}`, r2[k].dio===r2[k].esperado, r2[k].dio);
  });

  console.log('\n3️⃣  🔴 EL CAMINO COMPLETO — que NO se guarden $2 en vez de $2,554.87');
  const r3 = await p.evaluate(async ()=>{
    localStorage.setItem('nsup', JSON.stringify([{id:900,nombre:'Vecina Beauty Supply'}]));
    localStorage.setItem('np', JSON.stringify([{id:'p1',nombre:'Gel',marca:'G',costo:4,precio:10,stock:9,min:5}]));
    localStorage.setItem('nc', JSON.stringify([{id:7001,sid:900,sn:'Vecina Beauty Supply',tipo:'credito',
      items:[{pid:'p1',nombre:'Gel',cant:1000,costo:4}],total:4000,envio:0,cargoTarjeta:0,
      fecha:'08/17/2026',hora:'10:00 AM',pagosFactura:[]}]));
    suplidores=LS('nsup',[]); compras=LS('nc',[]); loadProds();
    abrirPagoSuplidor(900);
    await new Promise(r=>setTimeout(r,200));
    escogerFacturaSuplidor('7001');
    await new Promise(r=>setTimeout(r,150));
    escogerMetodoSuplidor('tarjeta');
    await new Promise(r=>setTimeout(r,150));
    // Escribe como escribiría él: la casilla le pone la coma sola
    const m=document.getElementById('pagosup-monto');
    m.value='255487'; formatoMoneda(m);
    const loQueVe = m.value;
    const oc=window.confirm; window.confirm=()=>true; const oa=window.alert; window.alert=()=>{};
    aplicarPagoSuplidor();
    await new Promise(r=>setTimeout(r,300));
    window.confirm=oc; window.alert=oa;
    const c=LS('nc',[]).find(x=>String(x.id)==='7001');
    return { loQueVe, guardado: c.pagosFactura[0] ? c.pagosFactura[0].monto : null, saldo: saldoDeCompra(c) };
  });
  console.log('     en pantalla: ' + r3.loQueVe + '   guardado: ' + r3.guardado);
  T('la casilla le enseña 2,554.87', r3.loQueVe==='2,554.87', r3.loQueVe);
  T('🔑 y se guardan $2,554.87 — NO $2.00', r3.guardado===2554.87, String(r3.guardado));
  T('la deuda queda en 1,445.13 (4000 − 2554.87)', Math.abs(r3.saldo-1445.13)<0.005, String(r3.saldo));

  console.log('\n4️⃣  EL CORRECTOR DE PAGOS TAMBIÉN');
  const r4 = await p.evaluate(async ()=>{
    abrirEditorPagoCompra(7001, 0, 900);
    await new Promise(r=>setTimeout(r,200));
    const m=document.getElementById('edpc-monto');
    const vieneCon = m.value;
    m.value='300055'; formatoMoneda(m);
    const loQueVe = m.value;
    const oa=window.alert; window.alert=()=>{}; const oc=window.confirm; window.confirm=()=>true;
    guardarEditorPagoCompra();
    await new Promise(r=>setTimeout(r,300));
    window.alert=oa; window.confirm=oc;
    const c=LS('nc',[]).find(x=>String(x.id)==='7001');
    return { vieneCon, loQueVe, guardado:c.pagosFactura[0].monto };
  });
  T('al corregir se ve 3,000.55', r4.loQueVe==='3,000.55', r4.loQueVe);
  T('🔑 y se guardan $3,000.55', r4.guardado===3000.55, String(r4.guardado));

  console.log('\n5️⃣  🔒 EL COSTO CON 4 DECIMALES NO SE ROMPE');
  const r5 = await p.evaluate(()=>{
    const e=document.createElement('input'); document.body.appendChild(e);
    e.value=''; e.dataset.modoPreciso='';
    for(const ch of '4.4589'){
      e.value+=ch;
      formatoCostoPreciso(e, new InputEvent('input',{data:ch,inputType:'insertText'}));
    }
    finalizarCostoPreciso(e);
    const chico = e.value;
    e.value=''; e.dataset.modoPreciso='';
    for(const ch of '12345.6789'){
      e.value+=ch;
      formatoCostoPreciso(e, new InputEvent('input',{data:ch,inputType:'insertText'}));
    }
    finalizarCostoPreciso(e);
    return { chico, grande:e.value, leido: dinero(e.value) };
  });
  T('4.4589 se queda 4.4589', r5.chico==='4.4589', r5.chico);
  T('12345.6789 se ve 12,345.6789', r5.grande==='12,345.6789', r5.grande);
  T('🔑 y se lee como 12345.6789', Math.abs(r5.leido-12345.6789)<0.00001, String(r5.leido));

  console.log('\n6️⃣  🔒 UNA VENTA GRANDE, DE PUNTA A PUNTA');
  const r6 = await p.evaluate(async ()=>{
    localStorage.setItem('ncl', JSON.stringify([{id:1,nombre:'Isidro',negocio:'URBAN'}]));
    localStorage.setItem('nv','[]');
    localStorage.setItem('np', JSON.stringify([{id:'p9',nombre:'Clipper',marca:'S',costo:900,precio:1500,stock:10,min:2}]));
    clientes=LS('ncl',[]); ventas=LS('nv',[]); loadProds();
    ir('p-v');
    const sel=document.getElementById('vcl');
    sel.innerHTML='<option value="1">Isidro</option>'; sel.value='1';
    iV=[{pid:'p9',nombre:'Clipper',cant:2,precio:1500,costo:900}];
    document.getElementById('vtipo').value='contado';
    const d=document.getElementById('vdesc-val');
    document.getElementById('vdesc-tipo').value='monto';
    d.value='50000'; formatoMoneda(d);          // $500.00 de descuento
    const descEnPantalla = d.value;
    renderIV();
    await new Promise(r=>setTimeout(r,200));
    return { descEnPantalla,
             total: document.getElementById('vtot').textContent,
             subtotal: document.getElementById('vsubtot').textContent };
  });
  console.log('     descuento en pantalla: ' + r6.descEnPantalla);
  T('el descuento se ve 500.00', r6.descEnPantalla==='500.00', r6.descEnPantalla);
  T('subtotal $3,000.00', /3,000\.00/.test(r6.subtotal), r6.subtotal);
  T('🔑 total $2,500.00 (el descuento se restó bien)', /2,500\.00/.test(r6.total), r6.total);

  console.log(`\n  ${ok} bien · ${mal} mal`);
  const reales=errs.filter(e=>!/firebase|onAuthStateChanged/i.test(e));
  if(reales.length){ console.log('⚠️ JS:'); reales.forEach(e=>console.log('   '+e)); }
  await b.close();
  process.exit(mal||reales.length?1:0);
})();
