const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({viewport:{width:390,height:900}});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file:///home/claude/trabajo/index.html');
  await p.waitForTimeout(2500);
  await p.evaluate(()=>{ window.fbDb={ref:()=>({set(){},update(){},on(){},once(){return Promise.resolve({val:()=>null});}})}; });
  let ok=0,mal=0;
  const T=(n,c,d)=>{ if(c){ok++;console.log('  ✅ '+n);} else {mal++;console.log('  ❌ '+n+(d?'  →  '+d:''));} };

  // Un mundo LIMPIO: todo cuadra
  const limpio = () => ({
    nsup: [{id:900,nombre:'Kanar Online'}],
    np: [{id:'p1',nombre:'Gel',marca:'G',costo:4,precio:10,stock:20,min:5}],
    nc: [{id:7001,sid:900,sn:'Kanar Online',tipo:'credito',fecha:'08/11/2026',
          items:[{pid:'p1',nombre:'Gel',cant:100,costo:4}],total:400,envio:0,cargoTarjeta:0,
          pagosFactura:[{pid:'a',monto:150,fecha:'08/14/2026',metodo:'zelle'}]}],
    ncl: [{id:1,nombre:'Isidro',negocio:'URBAN'}],
    nv: []
  });
  const sembrar = async (mundo) => await p.evaluate((m)=>{
    Object.keys(m).forEach(k=>localStorage.setItem(k, JSON.stringify(m[k])));
    localStorage.removeItem('nbs_revision_dia');
    localStorage.removeItem('nbs_revision_huella');
    suplidores=LS('nsup',[]); compras=LS('nc',[]); clientes=LS('ncl',[]); ventas=LS('nv',[]); loadProds();
    return revisionDiaria();
  }, mundo);

  console.log('\n1️⃣  CON TODO CUADRADO, NO INVENTA PROBLEMAS');
  let r = await sembrar(limpio());
  const compras = (r.hallazgos||[]).filter(h=>/suplidor|compra|precio de venta/i.test(h.titulo));
  T('no avisa nada del lado de compras', compras.length===0, JSON.stringify(compras.map(h=>h.titulo)));

  console.log('\n2️⃣  🔴 UN PAGO MAYOR QUE SU FACTURA');
  let m = limpio();
  m.nc[0].pagosFactura.push({pid:'b',monto:500,fecha:'08/20/2026',metodo:'tarjeta'});  // 650 > 400
  r = await sembrar(m);
  let h = (r.hallazgos||[]).find(x=>/pagado de m/i.test(x.titulo));
  T('lo caza', !!h, JSON.stringify((r.hallazgos||[]).map(x=>x.titulo)));
  T('dice cuánto de más ($250.00)', /250\.00/.test(h?h.titulo:''), h&&h.titulo);
  T('lo marca como GRAVE', h && h.grave===true);
  T('dice de qué suplidor', /Kanar Online/.test(h?h.detalle:''), h&&h.detalle);

  console.log('\n3️⃣  🔴 UN PRODUCTO EN $0.00');
  m = limpio();
  m.np.push({id:'p9',nombre:'Clipper sin precio',marca:'S',costo:900,precio:0,stock:3,min:2});
  r = await sembrar(m);
  h = (r.hallazgos||[]).find(x=>/sin precio de venta/i.test(x.titulo));
  T('lo caza', !!h, JSON.stringify((r.hallazgos||[]).map(x=>x.titulo)));
  T('avisa que saldrían GRATIS', /GRATIS/.test(h?h.detalle:''), h&&h.detalle);
  T('lo marca como GRAVE', h && h.grave===true);

  console.log('\n4️⃣  ⚠️ UNA COMPRA DONDE LOS PRODUCTOS NO SUMAN EL TOTAL');
  m = limpio();
  m.nc[0].total = 999;      // los productos suman 400
  m.nc[0].pagosFactura = [];
  r = await sembrar(m);
  h = (r.hallazgos||[]).find(x=>/no suman el total/i.test(x.titulo));
  T('lo caza', !!h, JSON.stringify((r.hallazgos||[]).map(x=>x.titulo)));
  T('no lo marca como grave (puede ser un costo mal escrito)', h && h.grave===false);

  console.log('\n5️⃣  🔒 UNA COMPRA CON ENVÍO, TARJETA Y DESCUENTOS *SÍ* CUADRA');
  m = limpio();
  m.nc[0].envio = 35; m.nc[0].cargoTarjeta = 12.50;
  m.nc[0].descuentos = [{desc:'promo',monto:50}];
  m.nc[0].total = 400 + 35 + 12.50 - 50;   // 397.50
  m.nc[0].pagosFactura = [];
  r = await sembrar(m);
  h = (r.hallazgos||[]).find(x=>/no suman el total/i.test(x.titulo));
  T('🔒 NO da falsa alarma con envío, tarjeta y descuento', !h, h&&h.titulo);

  console.log('\n6️⃣  🔴 EL CASO QUE MÁS IMPORTA: UN NÚMERO CORTADO POR LA COMA');
  m = limpio();
  // Los productos TIENEN que sumar el total, o el aviso de cuadre salta con razón
  // y estaríamos midiendo otra cosa. 1000 x $4.00 = $4,000.
  m.nc[0].items = [{pid:'p1',nombre:'Gel',cant:1000,costo:4}];
  m.nc[0].total = 4000;
  m.nc[0].pagosFactura = [{pid:'a',monto:2,fecha:'08/27/2026',metodo:'tarjeta'}];  // se guardó 2 en vez de 2554.87
  r = await sembrar(m);
  const cuadre = (r.hallazgos||[]).find(x=>/no suman el total/i.test(x.titulo));
  T('un pago de $2 en una factura de $4,000 no dispara falsa alarma de cuadre', !cuadre, cuadre&&cuadre.titulo);
  // Lo que sí lo cazaría es el propio Sensei; pero el vigilante SÍ caza el inverso:
  m.nc[0].items = [{pid:'p1',nombre:'Gel',cant:1000,costo:4}];
  m.nc[0].total = 4000;
  m.nc[0].pagosFactura = [{pid:'a',monto:2554870,fecha:'08/27/2026',metodo:'tarjeta'}]; // inflado
  r = await sembrar(m);
  h = (r.hallazgos||[]).find(x=>/pagado de m/i.test(x.titulo));
  T('🔑 y un pago INFLADO por leer mal la coma, SÍ lo caza', !!h, JSON.stringify((r.hallazgos||[]).map(x=>x.titulo)));

  console.log('\n7️⃣  EL BOTÓN DEL AVISO LLEVA A ALGÚN SITIO');
  const r7 = await p.evaluate(()=>({
    suplidores: typeof irASuplidores==='function',
    catalogo: typeof irACatalogo==='function',
    cxc: typeof irACuentasPorCobrar==='function'
  }));
  T('irASuplidores existe', r7.suplidores);
  T('irACatalogo existe', r7.catalogo);
  T('irACuentasPorCobrar existe', r7.cxc);

  console.log('\n8️⃣  AVISA EL MISMO DÍA SI SALE ALGO NUEVO');
  const r8 = await p.evaluate(async ()=>{
    localStorage.removeItem('nbs_revision_dia');
    localStorage.removeItem('nbs_revision_huella');
    // Mundo limpio: corre y no avisa
    localStorage.setItem('nc', JSON.stringify([{id:7001,sid:900,sn:'K',tipo:'credito',fecha:'08/11/2026',
      items:[{pid:'p1',nombre:'Gel',cant:100,costo:4}],total:400,envio:0,cargoTarjeta:0,pagosFactura:[]}]));
    localStorage.setItem('np', JSON.stringify([{id:'p1',nombre:'Gel',marca:'G',costo:4,precio:10,stock:20,min:5}]));
    compras=LS('nc',[]); loadProds();
    let avisos=0; const om=window.mostrarRevisionDiaria; window.mostrarRevisionDiaria=()=>{avisos++;};
    correrRevisionDiaria();
    await new Promise(r=>setTimeout(r,2800));
    const tras1 = avisos;
    // Ahora aparece un descuadre GRAVE, el mismo día
    const cs=LS('nc',[]); cs[0].pagosFactura=[{pid:'x',monto:9999,fecha:'08/27/2026'}];
    localStorage.setItem('nc', JSON.stringify(cs)); compras=LS('nc',[]);
    correrRevisionDiaria();
    await new Promise(r=>setTimeout(r,2800));
    const tras2 = avisos;
    // Y si nada cambia, no repite
    correrRevisionDiaria();
    await new Promise(r=>setTimeout(r,2800));
    const tras3 = avisos;
    window.mostrarRevisionDiaria=om;
    return { tras1, tras2, tras3 };
  });
  T('con todo limpio no interrumpe', r8.tras1===0, String(r8.tras1));
  T('🔑 al salir un descuadre grave, avisa EL MISMO DÍA', r8.tras2===1, String(r8.tras2));
  T('🔒 y no lo repite si nada cambió', r8.tras3===1, String(r8.tras3));

  console.log(`\n  ${ok} bien · ${mal} mal`);
  const reales=errs.filter(e=>!/firebase|onAuthStateChanged/i.test(e));
  if(reales.length){ console.log('⚠️ JS:'); reales.forEach(e=>console.log('   '+e)); }
  await b.close();
  process.exit(mal||reales.length?1:0);
})();
