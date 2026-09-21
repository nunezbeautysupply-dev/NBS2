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

  console.log('\n1️⃣  EL MARGEN Y EL PRECIO SUGERIDO SALEN DE SUS PROPIOS PRODUCTOS');
  const r1 = await p.evaluate(()=>{
    localStorage.setItem('np', JSON.stringify([
      {id:'a',nombre:'A',marca:'M',costo:4.00,precio:10.00,stock:5,min:5},   // margen 60%
      {id:'b',nombre:'B',marca:'M',costo:5.00,precio:10.00,stock:5,min:5},   // margen 50%
      {id:'c',nombre:'C',marca:'M',costo:6.00,precio:10.00,stock:5,min:5}    // margen 40%
    ]));
    loadProds();
    return { margen: margenDeCasa(), sug: precioSugerido(5.00), sinPrecio: productosSinPrecio().length };
  });
  T('el margen de casa es la mediana (50%)', Math.abs(r1.margen-0.5)<0.001, String(r1.margen));
  // OJO: loadProds() mezcla el catalogo de fabrica, asi que el margen sale de TODOS sus
  // productos, no solo de los tres del ejemplo. Lo que importa es que el precio sugerido
  // sea sensato: por encima del costo y en la banda de su margen.
  T('sugiere un precio por encima del costo y sensato (costo $5.00 → $'+r1.sug+')',
     r1.sug > 5.5 && r1.sug < 15, String(r1.sug));
  T('ninguno sin precio todavía', r1.sinPrecio===0, String(r1.sinPrecio));

  console.log('\n2️⃣  🔴 LA COMPRA NO SE GUARDA SI EL PRODUCTO NUEVO VA EN $0.00');
  const r2 = await p.evaluate(async ()=>{
    localStorage.setItem('nsup', JSON.stringify([{id:900,nombre:'Kanar Online'}]));
    localStorage.setItem('nc','[]');
    suplidores=LS('nsup',[]); loadProds();
    var sel=document.getElementById('ccsup'); sel.innerHTML='<option value="900">Kanar</option>'; sel.value='900';
    document.getElementById('cctipo').value='credito';
    window._pagoMetodos={ccini:[{tipo:'efectivo',monto:0}]};
    // Como queda al escanear un PDF: producto nuevo SIN precio de venta
    iCC=[{pid:null, nombre:'Hair Gel 700ml Keratin', marca:'Gummy', cant:120, costo:4.00, esNuevo:true, precioVenta:0}];
    document.getElementById('cc-envio').value=''; document.getElementById('cc-tarjeta').value='';
    for(var i=1;i<=3;i++){ document.getElementById('cc-desc'+i).value=''; document.getElementById('cc-descm'+i).value=''; }
    var oa=window.alert; window.alert=function(){};
    saveCC();
    window.alert=oa;
    await new Promise(r=>setTimeout(r,200));
    var ov=document.getElementById('precios-nuevos-overlay');
    return { compras: LS('nc',[]).length,
             seAbrio: !!ov && ov.style.display!=='none',
             textoOverlay: ov ? (ov.textContent||'').slice(0,180) : '',
             hayCasilla: !!document.getElementById('precionuevo-0'),
             valorSugerido: document.getElementById('precionuevo-0') ? document.getElementById('precionuevo-0').value : null };
  });
  T('🔴 NO guardó la compra', r2.compras===0, String(r2.compras));
  T('abrió la pantalla para ponerle precio', r2.seAbrio);
  T('le dice que se lo estaría regalando', /gratis/i.test(r2.textoOverlay), r2.textoOverlay.slice(0,110));
  T('trae un precio sugerido sensato para un costo de $4.00 ($'+r2.valorSugerido+')',
     parseFloat(r2.valorSugerido) > 4.5 && parseFloat(r2.valorSugerido) < 12, r2.valorSugerido);

  console.log('\n3️⃣  SI DEJA LA CASILLA EN CERO, TAMPOCO PASA');
  const r3 = await p.evaluate(async ()=>{
    document.getElementById('precionuevo-0').value='';
    var dicho=[]; var oa=window.alert; window.alert=function(m){dicho.push(m);};
    guardarPreciosNuevos();
    await new Promise(r=>setTimeout(r,150));
    window.alert=oa;
    return { compras: LS('nc',[]).length, dicho };
  });
  T('sigue sin guardar', r3.compras===0, String(r3.compras));
  T('le dice de cuál falta el precio', /falta el precio/i.test(r3.dicho[0]||''), (r3.dicho[0]||'').slice(0,90));

  console.log('\n4️⃣  ✅ CON EL PRECIO PUESTO, GUARDA Y EL PRODUCTO QUEDA BIEN');
  const r4 = await p.evaluate(async ()=>{
    document.getElementById('precionuevo-0').value='10.00';
    var oa=window.alert; window.alert=function(){};
    guardarPreciosNuevos();
    await new Promise(r=>setTimeout(r,300));
    window.alert=oa;
    var nuevo = LS('np',[]).find(x=>/Hair Gel 700ml Keratin/.test(x.nombre));
    return { compras: LS('nc',[]).length, precio: nuevo?nuevo.precio:null, costo: nuevo?nuevo.costo:null,
             stock: nuevo?nuevo.stock:null, sinPrecio: productosSinPrecio().length };
  });
  T('ahora sí guardó la compra', r4.compras===1, String(r4.compras));
  T('el producto quedó con precio $10.00', Math.abs(r4.precio-10)<0.005, String(r4.precio));
  T('con su costo $4.00 y sus 120 unidades', Math.abs(r4.costo-4)<0.005 && r4.stock===120, r4.costo+' / '+r4.stock);
  T('no queda ningún producto sin precio', r4.sinPrecio===0, String(r4.sinPrecio));

  console.log('\n5️⃣  🔴 LA RED AL VENDER — que no se lo regale');
  const r5 = await p.evaluate(()=>{
    var ps=LS('np',[]);
    ps.push({id:'z9', nombre:'Producto sin precio', marca:'X', costo:5.00, precio:0, stock:10, min:5});
    localStorage.setItem('np', JSON.stringify(ps)); loadProds();
    iV=[];
    var preguntado=null; var op=window.prompt;
    window.prompt=function(m,d){ preguntado={m:m,d:d}; return null; };   // él cancela
    agregarProducto('z9', 2, productos.find(x=>x.id==='z9'));
    window.prompt=op;
    return { preguntado, enElCarrito: iV.length };
  });
  T('le pregunta el precio antes de meterlo', !!r5.preguntado, JSON.stringify(r5.preguntado));
  T('le avisa que lo estaría REGALANDO', /REGALANDO/.test(r5.preguntado.m||''), (r5.preguntado.m||'').slice(0,90));
  T('le sugiere un precio sensato ($'+r5.preguntado.d+' para un costo de $5.00)',
     parseFloat(r5.preguntado.d) > 5.5 && parseFloat(r5.preguntado.d) < 15, r5.preguntado.d);
  T('🔒 si cancela, NO lo mete en la venta', r5.enElCarrito===0, String(r5.enElCarrito));

  const r5b = await p.evaluate(()=>{
    iV=[];
    var op=window.prompt; window.prompt=function(){ return '12.50'; };
    var oa=window.alert; window.alert=function(){};
    agregarProducto('z9', 2, productos.find(x=>x.id==='z9'));
    window.prompt=op; window.alert=oa;
    var pr=LS('np',[]).find(x=>x.id==='z9');
    return { enCarrito: iV.length, precioUsado: iV[0]?iV[0].precio:null, precioGuardado: pr?pr.precio:null };
  });
  T('si escribe el precio, lo mete con ese precio', r5b.enCarrito===1 && Math.abs(r5b.precioUsado-12.50)<0.005, JSON.stringify(r5b));
  T('y se lo guarda al producto para no volver a preguntar', Math.abs(r5b.precioGuardado-12.50)<0.005, String(r5b.precioGuardado));

  console.log('\n6️⃣  EL CATÁLOGO POR SUPLIDOR');
  const r6 = await p.evaluate(async ()=>{
    localStorage.setItem('nsup', JSON.stringify([{id:900,nombre:'Kanar Online'},{id:901,nombre:'Monkeys Group'}]));
    localStorage.setItem('np', JSON.stringify([
      {id:'k1',nombre:'De Kanar 1',marca:'M',costo:4,precio:10,stock:5,min:5},
      {id:'k2',nombre:'De Kanar 2',marca:'M',costo:4,precio:10,stock:5,min:5},
      {id:'m1',nombre:'De Monkeys 1',marca:'M',costo:4,precio:10,stock:5,min:5}
    ]));
    localStorage.setItem('nc', JSON.stringify([
      {id:1,sid:900,total:80,items:[{pid:'k1',cant:10,costo:4},{pid:'k2',cant:10,costo:4}],pagosFactura:[]},
      {id:2,sid:901,total:40,items:[{pid:'m1',cant:10,costo:4}],pagosFactura:[]}
    ]));
    loadProds();
    var deKanar = productosDeSuplidor(900);
    var deMonkeys = productosDeSuplidor(901);
    // Y en pantalla
    var sel=document.getElementById('cat-suplidor');
    renderCatalogo('');
    await new Promise(r=>setTimeout(r,200));
    sel.value='900';
    renderCatalogo('');
    await new Promise(r=>setTimeout(r,200));
    var lista=document.getElementById('catlista').innerText||'';
    return { kanar: Object.keys(deKanar), monkeys: Object.keys(deMonkeys),
             enPantalla: lista, opciones: [...sel.options].map(o=>o.text) };
  });
  T('a Kanar le compra 2 productos', r6.kanar.length===2, JSON.stringify(r6.kanar));
  T('a Monkeys le compra 1', r6.monkeys.length===1, JSON.stringify(r6.monkeys));
  T('el desplegable trae sus suplidores', r6.opciones.some(x=>/Kanar/.test(x)) && r6.opciones.some(x=>/Monkeys/.test(x)), JSON.stringify(r6.opciones));
  T('al escoger Kanar salen solo los suyos', /De Kanar 1/.test(r6.enPantalla) && !/De Monkeys/.test(r6.enPantalla), r6.enPantalla.slice(0,120));

  console.log('\n══════════════════════════════');
  console.log(`  ${ok} bien · ${mal} mal`);
  const reales=errs.filter(e=>!/firebase|onAuthStateChanged/i.test(e));
  if(reales.length){ console.log('⚠️ JS:'); reales.forEach(e=>console.log('   '+e)); }
  await b.close();
  process.exit(mal||reales.length?1:0);
})();
