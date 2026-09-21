const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
// 🧪 STOCK QUE SE AJUSTA SOLO  (20 sep 2026)
//   Sensei: "vendo articulos que la app dice que no hay, y al meter la factura
//   quiero que se rebaje lo que vendí de más". Solución:
//   1) al vender sin stock, el stock baja a NEGATIVO (ya no se pega en 0)
//   2) al meter la factura de compra, la compra suma sobre el negativo y
//      aterriza sola en el número correcto
//   3) el negativo se ve en NARANJA con ⚠️ al buscar/escoger en la compra
//   NO se tocan: eliminar/editar compra, devoluciones, premio VIP.
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({viewport:{width:390,height:844}});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file:///home/claude/trabajo/index.html'); await p.waitForTimeout(2000);
  let ok=0,mal=0; const T=(n,c,d)=>{ if(c){ok++;console.log('  ✅ '+n);} else {mal++;console.log('  ❌ '+n+(d?' → '+d:''));} };

  const base = async ()=> await p.evaluate(()=>{
    ['pantalla-login','pantalla-bloqueo'].forEach(id=>{const e=document.getElementById(id); if(e) e.style.display='none';});
    const a=document.getElementById('app-contenido'); if(a) a.style.display='block';
    window.alert=(m)=>{ window.__alert=m; }; window.confirm=()=>true;
  });

  console.log('\n1️⃣  LA VENTA SIN STOCK BAJA A NEGATIVO');
  await base();
  const r1 = await p.evaluate(()=>{
    localStorage.setItem('np', JSON.stringify([{id:'p1',nombre:'Guante negro',cat:'GUANTES',costo:6,precio:10,stock:3,min:0}]));
    loadProds();
    iV=[{pid:'p1',nombre:'Guante negro',cant:5,precio:10,costo:6}];
    window._pagoInicialVenta=50;
    saveV();
    return productos.find(x=>x.id==='p1').stock;
  });
  T('vender 5 teniendo 3 → queda -2 (no pegado en 0)', r1===-2, 'quedó '+r1);

  console.log('\n2️⃣  LA FACTURA DE COMPRA CORRIGE EL NEGATIVO SOLA');
  await base();
  const r2 = await p.evaluate(async ()=>{
    localStorage.setItem('np', JSON.stringify([{id:'p1',nombre:'Guante negro',cat:'GUANTES',costo:6,precio:10,stock:-2,min:0}]));
    localStorage.setItem('nc','[]'); localStorage.setItem('nsup', JSON.stringify([{id:900,nombre:'Kanar'}]));
    suplidores=LS('nsup',[]); compras=LS('nc',[]); loadProds();
    ir('p-comp'); await new Promise(r=>setTimeout(r,300));
    document.getElementById('ccsup').value='900';
    document.getElementById('cctipo').value='credito';
    iCC=[{pid:'p1',nombre:'Guante negro',cant:20,costo:6}];
    window._preciosYaPuestos=true;
    saveCC();
    return productos.find(x=>x.id==='p1').stock;
  });
  T('comprar 20 sobre -2 → queda 18 (correcto, solo)', r2===18, 'quedó '+r2);

  console.log('\n3️⃣  EL NEGATIVO SE VE EN NARANJA CON AVISO AL METER LA FACTURA');
  await base();
  const r3 = await p.evaluate(()=>{
    localStorage.setItem('np', JSON.stringify([
      {id:'pn',nombre:'Navaja Negativa',cat:'NAVAJAS',costo:2,precio:5,stock:-3,min:0},
      {id:'pp',nombre:'Navaja Positiva',cat:'NAVAJAS',costo:2,precio:5,stock:40,min:0}
    ]));
    loadProds();
    filterCC('navaja negativa'); const busNeg=document.getElementById('cclist').innerHTML;
    selCC('pn'); const chipNeg=document.getElementById('ccsn').innerHTML;
    filterCC('navaja positiva'); const busPos=document.getElementById('cclist').innerHTML;
    selCC('pp'); const chipPos=document.getElementById('ccsn').innerHTML;
    return {
      negNaranja: busNeg.includes('#E67E22') && busNeg.includes('-3'),
      negAviso: busNeg.includes('\u26a0'),
      negChip: chipNeg.includes('#E67E22'),
      posVerde: busPos.includes('#2E7D32') && !busPos.includes('#E67E22'),
      posSinAviso: !busPos.includes('\u26a0')
    };
  });
  T('negativo: -3 en naranja', r3.negNaranja);
  T('negativo: con ⚠️', r3.negAviso);
  T('negativo: el chip también en naranja', r3.negChip);
  T('positivo: sigue en verde, sin aviso', r3.posVerde && r3.posSinAviso);

  console.log('\n4️⃣  LO QUE NO SE TOCA SIGUE IGUAL');
  const r4 = await p.evaluate(()=>{
    const src = document.documentElement.outerHTML;
    // eliminarCompra, guardarEdicionCompra y deshacerDevolucion CONSERVAN el tope de 0
    const conTope = (src.match(/p\.stock = Math\.max\(0, \(p\.stock\|\|0\) - it\.cant\)/g)||[]).length;
    return { conTope };
  });
  T('compras y devolución conservan su tope de 0 (3 lugares)', r4.conTope===3, 'encontrados '+r4.conTope);

  T('sin errores de JavaScript', errs.length===0, errs.slice(0,3).join(' | '));
  console.log('\n  '+ok+' bien · '+mal+' mal');
  await b.close();
  process.exit(mal>0?1:0);
})();
