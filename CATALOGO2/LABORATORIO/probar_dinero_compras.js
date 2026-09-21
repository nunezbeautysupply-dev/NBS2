const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto('file:///home/claude/trabajo/index.html');
  await p.waitForTimeout(2500);
  await p.evaluate(() => { window.fbDb = { ref: () => ({ set(){}, update(){}, on(){}, once(){ return Promise.resolve({val:()=>null}); } }) }; });

  let ok=0, mal=0;
  const T=(n,c,d)=>{ if(c){ok++;console.log('  ✅ '+n);} else {mal++;console.log('  ❌ '+n+(d?'  →  '+d:''));} };

  console.log('\n1️⃣  GUARDAR UNA COMPRA CON DESCUENTOS (su factura real)');
  const r1 = await p.evaluate(() => {
    localStorage.setItem('nsup', JSON.stringify([{id:900,nombre:'Kanar Online'}]));
    localStorage.setItem('nc','[]');
    localStorage.setItem('np', JSON.stringify([
      {id:'p1',nombre:'Hair Gel 700ml Keratin',marca:'Gummy',costo:4.00,precio:10,stock:0,min:5},
      {id:'p2',nombre:'StyleCraft Reign Clipper',marca:'StyleCraft',costo:151.21,precio:200,stock:0,min:5}
    ]));
    suplidores = LS('nsup',[]); loadProds();
    var sel=document.getElementById('ccsup');
    sel.innerHTML='<option value="900">Kanar Online</option>'; sel.value='900';
    document.getElementById('cctipo').value='credito';
    window._pagoMetodos={ccini:[{tipo:'efectivo',monto:0}]};
    iCC=[{pid:'p1',nombre:'Hair Gel 700ml Keratin',cant:120,costo:4.00,esNuevo:false,precioVenta:10},
         {pid:'p2',nombre:'StyleCraft Reign Clipper',cant:3,costo:151.21,esNuevo:false,precioVenta:200}];
    document.getElementById('cc-envio').value='';
    document.getElementById('cc-tarjeta').value='';
    document.getElementById('cc-desc1').value='All reign pairs clipper y trimmer';
    document.getElementById('cc-descm1').value='612.78';
    document.getElementById('cc-desc2').value='BC-400 free samples';
    document.getElementById('cc-descm2').value='102.00';
    var alertas=[]; var oldAlert=window.alert; window.alert=function(m){alertas.push(m);};
    saveCC();
    window.alert=oldAlert;
    var c=LS('nc',[])[0];
    var todos=LS('np',[]);
    var buscar=function(id){ return todos.find(function(x){return String(x.id)===String(id);}) || {stock:'NO ESTA',costo:'NO ESTA'}; };
    return { compra:c, alertas:alertas, prods:[buscar('p1'),buscar('p2')], cuantos:todos.length,
             sumaItems: (c.items||[]).reduce((a,i)=>a+i.cant*i.costo,0) };
  });
  const c1=r1.compra;
  console.log('     total guardado: $'+c1.total+'   descuentos: '+JSON.stringify(c1.descuentos));
  T('los productos suman 933.63', Math.abs(r1.sumaItems-933.63)<0.005, String(r1.sumaItems));
  T('el total guardado resta los descuentos (933.63−714.78=218.85)', Math.abs(c1.total-218.85)<0.005, String(c1.total));
  T('guardó los 2 descuentos', (c1.descuentos||[]).length===2, JSON.stringify(c1.descuentos));
  T('el inventario subió igual (120 y 3)', r1.prods[0].stock===120 && r1.prods[1].stock===3,
     r1.prods[0].stock+' / '+r1.prods[1].stock);
  T('el costo por unidad NO cambió (4.00 y 151.21)',
     Math.abs(r1.prods[0].costo-4.00)<0.0001 && Math.abs(r1.prods[1].costo-151.21)<0.0001,
     r1.prods[0].costo+' / '+r1.prods[1].costo);

  console.log('\n2️⃣  LO QUE LE DEBE AL SUPLIDOR BAJA SOLO');
  const r2 = await p.evaluate(() => {
    compras = LS('nc',[]);
    return { porPagar: calcularTotalPorPagar() };
  });
  const pp = typeof r2.porPagar==='object' ? JSON.stringify(r2.porPagar) : r2.porPagar;
  console.log('     por pagar: '+pp);
  T('la deuda con el suplidor es 218.85 (no 933.63)',
     JSON.stringify(r2.porPagar).indexOf('218.85')>=0 || Math.abs(Number(r2.porPagar)-218.85)<0.005, pp);

  console.log('\n3️⃣  LA REVISIÓN DE INTEGRIDAD NO DA FALSA ALARMA');
  const r3 = await p.evaluate(() => {
    var textos=[]; var oldAlert=window.alert; window.alert=function(m){textos.push(m);};
    var el=document.createElement('div'); el.id='integridad-resultado'; document.body.appendChild(el);
    try { revisarIntegridad(); } catch(e){ textos.push('EXCEPCION: '+e.message); }
    window.alert=oldAlert;
    return { texto: (el.textContent||'') + ' ' + textos.join(' ') };
  });
  T('NO dice "los productos no suman el total"', r3.texto.indexOf('no suman el total')<0,
     r3.texto.slice(0,200));

  console.log('\n══════════════════════════════');
  console.log(`  ${ok} bien · ${mal} mal`);
  await b.close();
  process.exit(mal?1:0);
})();
