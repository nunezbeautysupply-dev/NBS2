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

  const sembrar = async () => await p.evaluate(async ()=>{
    ['pantalla-login','pantalla-bloqueo'].forEach(id=>{const e=document.getElementById(id); if(e) e.style.display='none';});
    const a=document.getElementById('app-contenido'); if(a) a.style.display='block';
    localStorage.setItem('nsup', JSON.stringify([{id:900,nombre:'Kanar Online'}]));
    localStorage.setItem('np', JSON.stringify([{id:'p1',nombre:'Hair Gel',marca:'G',costo:4,precio:10,stock:50,min:5}]));
    localStorage.setItem('nc', JSON.stringify([{
      id:7001, sid:900, sn:'Kanar Online', tipo:'credito',
      items:[{pid:'p1',nombre:'Hair Gel',cant:100,costo:4}],
      total:400, envio:0, cargoTarjeta:0, fecha:'08/11/2026', hora:'10:00 AM', pagosFactura:[] }]));
    suplidores=LS('nsup',[]); compras=LS('nc',[]); loadProds();
  });

  console.log('\n1️⃣  AL PAGAR SE PUEDE ESCOGER EL DÍA');
  await sembrar();
  const r1 = await p.evaluate(async ()=>{
    abrirPagoSuplidor(900);
    await new Promise(r=>setTimeout(r,200));
    escogerFacturaSuplidor('7001');
    await new Promise(r=>setTimeout(r,150));
    const f=document.getElementById('pagosup-fecha');
    return { existe: !!f, valorHoy: f?f.value:null, esHoy: f? f.value===fechaUSAaISO(fechaHoy()) : false };
  });
  T('la casilla de fecha existe', r1.existe);
  T('viene con la fecha de hoy', r1.esHoy, r1.valorHoy);

  const r2 = await p.evaluate(async ()=>{
    document.getElementById('pagosup-fecha').value='2026-08-14';   // le pagó otro día
    escogerMetodoSuplidor('zelle');
    document.getElementById('pagosup-monto').value='150.00';
    const oc=window.confirm; window.confirm=()=>true; const oa=window.alert; window.alert=()=>{};
    aplicarPagoSuplidor();
    await new Promise(r=>setTimeout(r,300));
    window.confirm=oc; window.alert=oa;
    const c=LS('nc',[]).find(x=>String(x.id)==='7001');
    return { pagos:c.pagosFactura };
  });
  T('🔑 guardó la fecha que escogiste (08/14/2026)', r2.pagos[0] && r2.pagos[0].fecha==='08/14/2026', JSON.stringify(r2.pagos[0]));
  T('con su monto y su forma de pago', r2.pagos[0] && Math.abs(r2.pagos[0].monto-150)<0.005 && r2.pagos[0].metodo==='zelle', JSON.stringify(r2.pagos[0]));

  console.log('\n2️⃣  EL PAGO SE PUEDE CORREGIR');
  const r3 = await p.evaluate(async ()=>{
    const c=LS('nc',[]).find(x=>String(x.id)==='7001');
    verFacturaCompra(c, 900);
    await new Promise(r=>setTimeout(r,300));
    const filas=[...document.querySelectorAll('div')].filter(x=>/PAGOS APLICADOS/.test(x.textContent||''));
    abrirEditorPagoCompra(7001, 0, 900);
    await new Promise(r=>setTimeout(r,250));
    const ov=document.getElementById('editor-pago-compra');
    return { seAbrio: !!ov && ov.style.display!=='none',
             fecha: (document.getElementById('edpc-fecha')||{}).value,
             monto: (document.getElementById('edpc-monto')||{}).value,
             metodos: [...document.querySelectorAll('.edpc-met')].map(x=>x.getAttribute('data-met')) };
  });
  T('el editor abre', r3.seAbrio);
  T('trae la fecha del pago', r3.fecha==='2026-08-14', r3.fecha);
  T('trae el monto del pago', r3.monto==='150.00', r3.monto);
  T('trae las 4 formas de pago', JSON.stringify(r3.metodos)===JSON.stringify(['tarjeta','efectivo','zelle','cashapp']), JSON.stringify(r3.metodos));

  console.log('\n3️⃣  🔑 SE CAMBIA LA FECHA, EL MONTO Y LA FORMA');
  const r4 = await p.evaluate(async ()=>{
    document.getElementById('edpc-fecha').value='2026-08-20';
    document.getElementById('edpc-monto').value='175.50';
    escogerMetodoEditPagoCompra('tarjeta');
    const oa=window.alert; window.alert=()=>{}; const oc=window.confirm; window.confirm=()=>true;
    guardarEditorPagoCompra();
    await new Promise(r=>setTimeout(r,350));
    window.alert=oa; window.confirm=oc;
    const c=LS('nc',[]).find(x=>String(x.id)==='7001');
    return { pago:c.pagosFactura[0], cuantos:c.pagosFactura.length, saldo: saldoDeCompra(c) };
  });
  T('la fecha quedó en 08/20/2026', r4.pago.fecha==='08/20/2026', r4.pago.fecha);
  T('el monto quedó en 175.50', Math.abs(r4.pago.monto-175.50)<0.005, String(r4.pago.monto));
  T('la forma quedó en tarjeta', r4.pago.metodo==='tarjeta', r4.pago.metodo);
  T('sigue siendo UN solo pago (no se duplicó)', r4.cuantos===1, String(r4.cuantos));
  T('🔑 la deuda se recalculó (400 − 175.50 = 224.50)', Math.abs(r4.saldo-224.50)<0.005, String(r4.saldo));

  console.log('\n4️⃣  🔒 NO DEJA GUARDAR UN PAGO EN CERO');
  const r5 = await p.evaluate(async ()=>{
    abrirEditorPagoCompra(7001, 0, 900);
    await new Promise(r=>setTimeout(r,200));
    document.getElementById('edpc-monto').value='0';
    let dicho=null; const oa=window.alert; window.alert=(m)=>{dicho=m;};
    guardarEditorPagoCompra();
    await new Promise(r=>setTimeout(r,200));
    window.alert=oa;
    const c=LS('nc',[]).find(x=>String(x.id)==='7001');
    return { dicho, monto:c.pagosFactura[0].monto };
  });
  T('avisa que no puede ser cero', /mayor que cero/i.test(r5.dicho||''), (r5.dicho||'').slice(0,70));
  T('y no tocó el pago', Math.abs(r5.monto-175.50)<0.005, String(r5.monto));

  console.log('\n5️⃣  ⚠️ AVISA SI QUEDARÍA PAGADO DE MÁS');
  const r6 = await p.evaluate(async ()=>{
    document.getElementById('edpc-monto').value='900.00';
    let preg=null; const oc=window.confirm; window.confirm=(m)=>{preg=m; return false;};
    const oa=window.alert; window.alert=()=>{};
    guardarEditorPagoCompra();
    await new Promise(r=>setTimeout(r,200));
    window.confirm=oc; window.alert=oa;
    const c=LS('nc',[]).find(x=>String(x.id)==='7001');
    return { preg, monto:c.pagosFactura[0].monto };
  });
  T('avisa del pago de más', /pagando \$900/.test(r6.preg||''), (r6.preg||'').slice(0,90));
  T('🔒 si dices que no, no cambia nada', Math.abs(r6.monto-175.50)<0.005, String(r6.monto));

  console.log('\n6️⃣  🗑️ BORRAR EL PAGO DEVUELVE LA DEUDA');
  const r7 = await p.evaluate(async ()=>{
    abrirEditorPagoCompra(7001, 0, 900);
    await new Promise(r=>setTimeout(r,200));
    const oc=window.confirm; window.confirm=()=>true; const oa=window.alert; window.alert=()=>{};
    borrarPagoCompra();
    await new Promise(r=>setTimeout(r,300));
    window.confirm=oc; window.alert=oa;
    const c=LS('nc',[]).find(x=>String(x.id)==='7001');
    return { pagos:c.pagosFactura.length, saldo:saldoDeCompra(c), total:c.total };
  });
  T('el pago se borró', r7.pagos===0, String(r7.pagos));
  T('🔑 la deuda volvió a $400.00', Math.abs(r7.saldo-400)<0.005, String(r7.saldo));
  T('🔒 el total de la factura no se tocó', Math.abs(r7.total-400)<0.005, String(r7.total));

  console.log(`\n  ${ok} bien · ${mal} mal`);
  const reales=errs.filter(e=>!/firebase|onAuthStateChanged/i.test(e));
  if(reales.length){ console.log('⚠️ JS:'); reales.forEach(e=>console.log('   '+e)); }
  await b.close();
  process.exit(mal||reales.length?1:0);
})();
