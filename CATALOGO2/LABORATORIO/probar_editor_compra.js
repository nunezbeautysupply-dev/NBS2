const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs=[]; p.on('pageerror', e=>errs.push(e.message));
  await p.goto('file:///home/claude/trabajo/index.html');
  await p.waitForTimeout(2500);
  await p.evaluate(() => { window.fbDb={ref:()=>({set(){},update(){},on(){},once(){return Promise.resolve({val:()=>null});}})}; });

  let ok=0,mal=0;
  const T=(n,c,d)=>{ if(c){ok++;console.log('  ✅ '+n);} else {mal++;console.log('  ❌ '+n+(d?'  →  '+d:''));} };

  console.log('\n1️⃣  ARREGLAR LA COMPRA DE KANAR QUE YA ESTABA ENTRADA');
  const r = await p.evaluate(async () => {
    localStorage.setItem('nsup', JSON.stringify([{id:900,nombre:'Kanar Online'}]));
    localStorage.setItem('np', JSON.stringify([
      {id:'p1',nombre:'Hair Gel 700ml Keratin',marca:'Gummy',costo:4.00,precio:10,stock:120,min:5},
      {id:'p2',nombre:'StyleCraft Reign Clipper',marca:'StyleCraft',costo:151.21,precio:200,stock:3,min:5}]));
    // La compra COMO LA ENTRO EL: sin descuentos, y CON cargo por tarjeta
    localStorage.setItem('nc', JSON.stringify([{
      id: 7001, sid:900, sn:'Kanar Online', tipo:'credito',
      items:[{pid:'p1',nombre:'Hair Gel 700ml Keratin',cant:120,costo:4.00,esNuevo:false},
             {pid:'p2',nombre:'StyleCraft Reign Clipper',cant:3,costo:151.21,esNuevo:false}],
      total: 983.63, envio: 0, cargoTarjeta: 50.00,
      fecha:'08/11/2026', hora:'10:00 AM', pagosFactura:[], foto:null }]));
    suplidores=LS('nsup',[]); compras=LS('nc',[]); loadProds();
    var antes = JSON.parse(JSON.stringify(compras[0]));
    var alertas=[]; var oa=window.alert; window.alert=function(m){alertas.push(m);};
    var oc=window.confirm; window.confirm=function(){return true;};
    editarCompra(7001, 900);
    await new Promise(r=>setTimeout(r,300));
    var hayTarj = !!document.getElementById('compra-edit-tarjeta');
    var tarjValor = hayTarj ? document.getElementById('compra-edit-tarjeta').value : null;
    var hayD1 = !!document.getElementById('compra-edit-desc1');
    // Sensei escribe los dos descuentos de su factura
    document.getElementById('compra-edit-desc1').value='All reign pairs clipper y trimmer';
    document.getElementById('compra-edit-descm1').value='612.78';
    document.getElementById('compra-edit-desc2').value='BC-400 free samples';
    document.getElementById('compra-edit-descm2').value='102.00';
    document.getElementById('compra-edit-descm1').dispatchEvent(new Event('input'));
    await new Promise(r=>setTimeout(r,150));
    var totalEnPantalla = document.getElementById('compra-edit-total').textContent;
    guardarEdicionCompra();
    await new Promise(r=>setTimeout(r,300));
    window.alert=oa; window.confirm=oc;
    var d = LS('nc',[]).find(x=>String(x.id)==='7001');
    var todos=LS('np',[]);
    var pr=function(id){ return todos.find(x=>String(x.id)===String(id))||{stock:'NO'}; };
    return { antes:antes, despues:d, hayTarj:hayTarj, tarjValor:tarjValor, hayD1:hayD1,
             totalEnPantalla:totalEnPantalla, alertas:alertas,
             stock1:pr('p1').stock, stock2:pr('p2').stock };
  });

  console.log('     total en pantalla antes de guardar: '+r.totalEnPantalla);
  console.log('     total guardado: $'+r.despues.total+'  tarjeta: $'+r.despues.cargoTarjeta);
  T('el editor tiene casilla de cargo por tarjeta', r.hayTarj);
  T('viene con el valor que tenía guardado (50.00)', r.tarjValor==='50.00', String(r.tarjValor));
  T('el editor tiene las 3 casillas de descuento', r.hayD1);
  T('la pantalla ya mostraba 268.85 antes de guardar',
     (r.totalEnPantalla||'').indexOf('268.85')>=0, r.totalEnPantalla);
  T('guardó los 2 descuentos', (r.despues.descuentos||[]).length===2, JSON.stringify(r.despues.descuentos));
  T('🔴 EL CARGO POR TARJETA NO SE PERDIÓ (sigue en 50)',
     Math.abs((r.despues.cargoTarjeta||0)-50)<0.005, String(r.despues.cargoTarjeta));
  T('el total quedó en 268.85 (933.63+50−714.78)', Math.abs(r.despues.total-268.85)<0.005, String(r.despues.total));
  T('el inventario NO se movió (120 y 3)', r.stock1===120 && r.stock2===3, r.stock1+' / '+r.stock2);
  T('el costo por unidad de los productos sigue igual',
     Math.abs(r.despues.items[0].costo-4.00)<0.0001 && Math.abs(r.despues.items[1].costo-151.21)<0.0001,
     JSON.stringify(r.despues.items.map(i=>i.costo)));

  console.log('\n2️⃣  PRUEBA DEL FALLO VIEJO: editar SIN tocar nada no debe comerse la tarjeta');
  const r2 = await p.evaluate(async () => {
    localStorage.setItem('nc', JSON.stringify([{
      id: 7002, sid:900, sn:'Kanar Online', tipo:'credito',
      items:[{pid:'p1',nombre:'Hair Gel',cant:10,costo:4.00,esNuevo:false}],
      total: 90.00, envio: 0, cargoTarjeta: 50.00,
      fecha:'08/11/2026', hora:'10:00 AM', pagosFactura:[], foto:null }]));
    compras=LS('nc',[]); loadProds();
    var oa=window.alert; window.alert=function(){}; var oc=window.confirm; window.confirm=function(){return true;};
    editarCompra(7002, 900);
    await new Promise(r=>setTimeout(r,300));
    guardarEdicionCompra();
    await new Promise(r=>setTimeout(r,300));
    window.alert=oa; window.confirm=oc;
    var d=LS('nc',[]).find(x=>String(x.id)==='7002');
    return { total:d.total, tarj:d.cargoTarjeta };
  });
  console.log('     total tras editar sin tocar nada: $'+r2.total);
  T('el total sigue en 90.00 (40 productos + 50 tarjeta)', Math.abs(r2.total-90)<0.005, String(r2.total));
  T('el cargo por tarjeta sigue en 50', Math.abs(r2.tarj-50)<0.005, String(r2.tarj));

  console.log('\n══════════════════════════════');
  console.log(`  ${ok} bien · ${mal} mal`);
  const reales = errs.filter(e=>!/firebase|onAuthStateChanged/i.test(e));
  if(reales.length){ console.log('\n⚠️ ERRORES JS:'); reales.forEach(e=>console.log('   '+e)); }
  await b.close();
  process.exit(mal||reales.length?1:0);
})();
