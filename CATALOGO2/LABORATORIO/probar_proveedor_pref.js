const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file:///home/claude/trabajo/index.html');
  await p.waitForTimeout(2500);
  await p.evaluate(()=>{ window.fbDb={ref:()=>({set(){},update(){},on(){},once(){return Promise.resolve({val:()=>null});}})}; });
  let ok=0,mal=0;
  const T=(n,c,d)=>{ if(c){ok++;console.log('  ✅ '+n);} else {mal++;console.log('  ❌ '+n+(d?'  →  '+d:''));} };

  const compra = async (sid, nombreSup, items) => await p.evaluate(({sid,items})=>{
    var sel=document.getElementById('ccsup');
    sel.innerHTML='<option value="900">Kanar Online</option><option value="901">Monkeys Group</option>';
    sel.value=String(sid);
    document.getElementById('cctipo').value='credito';
    window._pagoMetodos={ccini:[{tipo:'efectivo',monto:0}]};
    iCC = items;
    document.getElementById('cc-envio').value=''; document.getElementById('cc-tarjeta').value='';
    for(var i=1;i<=3;i++){ document.getElementById('cc-desc'+i).value=''; document.getElementById('cc-descm'+i).value=''; }
    var oa=window.alert; window.alert=function(){};
    saveCC();
    window.alert=oa;
    return LS('np',[]);
  }, {sid, items});

  console.log('\n1️⃣  UN PRODUCTO NUEVO SE QUEDA CON EL SUPLIDOR DE LA FACTURA');
  await p.evaluate(()=>{
    localStorage.setItem('nsup', JSON.stringify([{id:900,nombre:'Kanar Online'},{id:901,nombre:'Monkeys Group'}]));
    localStorage.setItem('nc','[]'); localStorage.setItem('np','[]');
    suplidores=LS('nsup',[]); loadProds();
  });
  let ps = await compra(900,'Kanar Online',[{pid:null,nombre:'Hair Gel 700ml',marca:'Gummy',cant:12,costo:4,esNuevo:true,precioVenta:10}]);
  let nuevo = ps.find(x=>/Hair Gel 700ml/.test(x.nombre));
  T('el producto se creó', !!nuevo, JSON.stringify(nuevo&&nuevo.nombre));
  T('🔑 su proveedor preferido quedó en "Kanar Online"', nuevo && nuevo.proveedorPref==='Kanar Online', nuevo && nuevo.proveedorPref);

  console.log('\n2️⃣  UN PRODUCTO QUE YA EXISTÍA Y NO TENÍA PROVEEDOR');
  ps = await p.evaluate(()=>{
    var ps=LS('np',[]);
    ps.push({id:'viejo1',nombre:'Producto viejo sin proveedor',marca:'M',costo:5,precio:10,stock:0,min:5});
    localStorage.setItem('np', JSON.stringify(ps)); loadProds();
    return LS('np',[]);
  });
  ps = await compra(901,'Monkeys Group',[{pid:'viejo1',nombre:'Producto viejo sin proveedor',cant:6,costo:5,esNuevo:false}]);
  let viejo = ps.find(x=>x.id==='viejo1');
  T('se le puso "Monkeys Group"', viejo && viejo.proveedorPref==='Monkeys Group', viejo && viejo.proveedorPref);
  T('y su existencia subió a 6', viejo && viejo.stock===6, String(viejo&&viejo.stock));

  console.log('\n3️⃣  🔒 SI YA TENÍA PROVEEDOR, NO SE LE PISA');
  ps = await p.evaluate(()=>{
    var ps=LS('np',[]);
    ps.push({id:'viejo2',nombre:'Producto con proveedor escogido',marca:'M',costo:5,precio:10,stock:0,min:5,proveedorPref:'Dorco USA'});
    localStorage.setItem('np', JSON.stringify(ps)); loadProds();
    return LS('np',[]);
  });
  ps = await compra(900,'Kanar Online',[{pid:'viejo2',nombre:'Producto con proveedor escogido',cant:3,costo:5,esNuevo:false}]);
  let v2 = ps.find(x=>x.id==='viejo2');
  T('🔒 conserva "Dorco USA", no lo pisa', v2 && v2.proveedorPref==='Dorco USA', v2 && v2.proveedorPref);

  console.log('\n4️⃣  Y SIRVE PARA BUSCAR');
  const r4 = await p.evaluate(()=>{
    loadProds();
    var el=document.getElementById('catlista');
    document.getElementById('cat-suplidor').value='';
    renderCatalogo('Kanar');
    return { salen: (el.innerText||'').indexOf('Hair Gel 700ml')>=0 };
  });
  T('buscando "Kanar" en el catálogo sale su producto', r4.salen);

  console.log(`\n  ${ok} bien · ${mal} mal`);
  const reales=errs.filter(e=>!/firebase|onAuthStateChanged/i.test(e));
  if(reales.length){ console.log('⚠️ JS:'); reales.forEach(e=>console.log('   '+e)); }
  await b.close();
  process.exit(mal||reales.length?1:0);
})();
