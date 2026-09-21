// 💰 AUDITORÍA DEL DINERO — que las cuentas cuadren por todos los caminos
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({viewport:{width:390,height:1200}});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file:///home/claude/trabajo/index.html');
  await p.waitForTimeout(2800);
  let ok=0,mal=0;
  const T=(n,c,d)=>{ if(c){ok++;console.log('  ✅ '+n);} else {mal++;console.log('  ❌ '+n+(d?'  →  '+d:''));} };

  await p.evaluate(()=>{
    ['pantalla-login','pantalla-bloqueo'].forEach(id=>{const e=document.getElementById(id); if(e) e.style.display='none';});
    document.getElementById('app-contenido').style.display='block';
  });

  // Un negocio de verdad: 3 clientes, ventas, cobros repartidos, devolución, compras
  const sembrar = async () => await p.evaluate(()=>{
    localStorage.setItem('ncl', JSON.stringify([
      {id:1,nombre:'Isidro',negocio:'URBAN',tel:'4015550001'},
      {id:2,nombre:'Nelson',negocio:'RD',tel:'4015550002'},
      {id:3,nombre:'Ana',negocio:'AL DIA',tel:'4015550003'}]));
    localStorage.setItem('np', JSON.stringify([
      {id:'p1',nombre:'Gel',marca:'G',costo:4,precio:10,stock:100,min:5},
      {id:'p2',nombre:'Wax',marca:'W',costo:5,precio:12,stock:100,min:5}]));
    localStorage.setItem('nv', JSON.stringify([
      // Isidro: 3 facturas, un cobro de $80 repartido
      {id:101,cid:1,cn:'Isidro',tipo:'credito',fecha:'07/10/2026',numFactura:'0101',total:35,ganancia:10,
       items:[{pid:'p1',nombre:'Gel',cant:1,precio:35,costo:25}],
       pagosFactura:[{pid:'a1',recibo:'R1',montoCobro:80,monto:35,fecha:'08/15/2026'}]},
      {id:102,cid:1,cn:'Isidro',tipo:'credito',fecha:'07/20/2026',numFactura:'0102',total:15,ganancia:4,
       items:[{pid:'p2',nombre:'Wax',cant:1,precio:15,costo:11}],
       pagosFactura:[{pid:'a2',recibo:'R1',montoCobro:80,monto:15,fecha:'08/15/2026'}]},
      {id:103,cid:1,cn:'Isidro',tipo:'credito',fecha:'08/01/2026',numFactura:'0103',total:55,ganancia:15,
       items:[{pid:'p1',nombre:'Gel',cant:2,precio:27.5,costo:20}],
       pagosFactura:[{pid:'a3',recibo:'R1',montoCobro:80,monto:30,fecha:'08/15/2026'}]},
      // Nelson: contado pagado
      {id:104,cid:2,cn:'Nelson',tipo:'contado',fecha:'08/05/2026',numFactura:'0104',total:40,ganancia:12,
       items:[{pid:'p2',nombre:'Wax',cant:2,precio:20,costo:14}],
       pagosFactura:[{pid:'b1',monto:40,fecha:'08/05/2026'}]},
      // Ana: crédito sin pagar
      {id:105,cid:3,cn:'Ana',tipo:'credito',fecha:'08/10/2026',numFactura:'0105',total:60,ganancia:18,
       items:[{pid:'p1',nombre:'Gel',cant:3,precio:20,costo:14}],pagosFactura:[]},
      // 🔑 Ana con DEVOLUCIÓN: pagó $30 y le devolvieron $20 en mercancía.
      // La devolución NO es un pago — si contara, la deuda saldría mal.
      {id:106,cid:3,cn:'Ana',tipo:'credito',fecha:'08/12/2026',numFactura:'0106',total:90,ganancia:27,
       items:[{pid:'p2',nombre:'Wax',cant:3,precio:30,costo:21}],
       pagosFactura:[{pid:'z1',monto:30,fecha:'08/13/2026'},
                     {pid:'z2',monto:20,fecha:'08/14/2026',esDevolucion:true}]}
    ]));
    localStorage.setItem('nsup', JSON.stringify([{id:900,nombre:'Kanar'}]));
    localStorage.setItem('nc', JSON.stringify([
      {id:7001,sid:900,sn:'Kanar',tipo:'credito',fecha:'08/01/2026',total:400,envio:0,cargoTarjeta:0,
       items:[{pid:'p1',nombre:'Gel',cant:100,costo:4}],
       pagosFactura:[{pid:'c1',monto:150,fecha:'08/10/2026'}]}]));
    clientes=LS('ncl',[]); ventas=LS('nv',[]); compras=LS('nc',[]); suplidores=LS('nsup',[]); loadProds();
  });
  await sembrar();

  console.log('\n═══ 1. LA LEY DEL DINERO: vendido = cobrado + por cobrar ═══');
  const r1 = await p.evaluate(()=>{
    let vendido=0, cobrado=0, porCobrar=0;
    LS('nv',[]).forEach(v=>{
      if(v.cancelada) return;
      vendido += parseFloat(v.total)||0;
      const r = cobradoYDebeDe(v);
      cobrado += r.cobrado; porCobrar += r.debe;
    });
    return { vendido:Math.round(vendido*100)/100, cobrado:Math.round(cobrado*100)/100,
             porCobrar:Math.round(porCobrar*100)/100 };
  });
  console.log('     vendido $' + r1.vendido + ' = cobrado $' + r1.cobrado + ' + por cobrar $' + r1.porCobrar);
  T('🔑 la ley se cumple al centavo', Math.abs(r1.vendido - (r1.cobrado + r1.porCobrar)) < 0.005,
     r1.vendido + ' vs ' + (r1.cobrado + r1.porCobrar));
  T('vendido = $295.00 (35+15+55+40+60+90)', Math.abs(r1.vendido-295)<0.005, String(r1.vendido));
  T('cobrado = $150.00 (80 Isidro + 40 Nelson + 30 Ana)', Math.abs(r1.cobrado-150)<0.005, String(r1.cobrado));

  console.log('\n═══ 2. EL BALANCE DE CADA CLIENTE, POR TRES CAMINOS ═══');
  const r2 = await p.evaluate(()=>{
    const porFn = [1,2,3].map(cid=>balanceDelCliente(cid));
    // Camino 2: sumando factura por factura
    const porFactura = [1,2,3].map(cid=>{
      let d=0; LS('nv',[]).forEach(v=>{ if(String(v.cid)===String(cid) && !v.cancelada) d+=cobradoYDebeDe(v).debe; });
      return Math.round(d*100)/100;
    });
    // Camino 3: total facturado − total pagado
    const porResta = [1,2,3].map(cid=>{
      let t=0,pg=0;
      LS('nv',[]).forEach(v=>{
        if(String(v.cid)!==String(cid) || v.cancelada) return;
        t += parseFloat(v.total)||0;
        // ⚠️ Las devoluciones NO son pagos: no se restan de lo que debe.
        (v.pagosFactura||[]).forEach(x=>{ if(typeof x.monto==='number' && !x.esDevolucion) pg+=x.monto; });
      });
      return Math.round((t-pg)*100)/100;
    });
    return { porFn, porFactura, porResta };
  });
  console.log('     Isidro/Nelson/Ana → ' + JSON.stringify(r2.porFn));
  T('🔑 los tres caminos dan lo mismo',
     JSON.stringify(r2.porFn)===JSON.stringify(r2.porFactura) &&
     JSON.stringify(r2.porFn)===JSON.stringify(r2.porResta),
     JSON.stringify([r2.porFn, r2.porFactura, r2.porResta]));
  T('Isidro debe $25.00 (105 − 80)', Math.abs(r2.porFn[0]-25)<0.005, String(r2.porFn[0]));
  T('Nelson debe $0.00', r2.porFn[1]===0, String(r2.porFn[1]));
  T('Ana debe $120.00 (60 + los 60 que le quedan de la otra)', Math.abs(r2.porFn[2]-120)<0.005, String(r2.porFn[2]));

  console.log('\n═══ 2b. UNA DEVOLUCION NO CUENTA COMO PAGO ═══');
  const r2b = await p.evaluate(()=>{
    const v = LS('nv',[]).find(x=>String(x.id)==='106');
    const c = cobradoYDebeDe(v);
    // Pagó $30 de una factura de $90. La devolución de $20 NO es un pago.
    return { cobrado: c.cobrado, debe: c.debe };
  });
  console.log('     factura de $90 · pagó $30 · devolución de $20');
  T('🔑 solo cuenta el pago: cobrado $30.00', Math.abs(r2b.cobrado-30)<0.005, String(r2b.cobrado));
  T('🔑 y debe $60.00, no $40.00', Math.abs(r2b.debe-60)<0.005, String(r2b.debe));

  console.log('\n═══ 3. EL COBRO REPARTIDO SE VE COMO UNO SOLO ═══');
  const r3 = await p.evaluate(()=>{
    const c = cobrosDelCliente(1);
    return { cuantos:c.length, monto:c[0].montoCobro, partes:c[0].partes.length, suma:c[0].suma };
  });
  T('🔑 un solo cobro de $80.00', r3.cuantos===1 && r3.monto===80, JSON.stringify(r3));
  T('con sus 3 partes, que suman $80', r3.partes===3 && r3.suma===80, JSON.stringify(r3));

  console.log('\n═══ 4. LO QUE LE DEBE A SUS SUPLIDORES ═══');
  const r4 = await p.evaluate(()=>{
    let porFactura=0, total=0, pagado=0;
    LS('nc',[]).forEach(c=>{
      const t=parseFloat(c.total)||0;
      const pg=(c.pagosFactura||[]).reduce((a,x)=>a+(typeof x.monto==='number'?x.monto:0),0);
      total+=t; pagado+=pg;
      if(t-pg>0.005) porFactura+=t-pg;
    });
    return { porFactura:Math.round(porFactura*100)/100, porResta:Math.round((total-pagado)*100)/100 };
  });
  T('🔑 los dos caminos dan lo mismo', Math.abs(r4.porFactura-r4.porResta)<0.005, JSON.stringify(r4));
  T('debe $250.00 al suplidor (400 − 150)', Math.abs(r4.porFactura-250)<0.005, String(r4.porFactura));

  console.log('\n═══ 5. EL VIGILANTE NO INVENTA PROBLEMAS ═══');
  const r5 = await p.evaluate(()=>{
    const r = revisionDiaria();
    return { hallazgos: (r.hallazgos||[]).map(x=>x.titulo), error: r.error };
  });
  console.log('     ' + JSON.stringify(r5.hallazgos));
  T('🔒 no revienta', !r5.error, r5.error||'');
  T('🔒 con datos cuadrados, no avisa de descuadres',
     !r5.hallazgos.some(t=>/no cuadra|pagado de m|no suman/.test(t)), JSON.stringify(r5.hallazgos));

  console.log('\n═══ 6. LA GANANCIA CUADRA CON LO VENDIDO ═══');
  const r6 = await p.evaluate(()=>{
    let ventaTot=0, costoTot=0, gananciaGuardada=0;
    LS('nv',[]).forEach(v=>{
      if(v.cancelada) return;
      gananciaGuardada += parseFloat(v.ganancia)||0;
      (v.items||[]).forEach(it=>{
        const q=Number(it.cant)||0;
        ventaTot += q*(Number(it.precio)||0);
        costoTot += q*(Number(it.costo)||0);
      });
    });
    return { calculada: Math.round((ventaTot-costoTot)*100)/100,
             guardada: Math.round(gananciaGuardada*100)/100 };
  });
  console.log('     ganancia calculada $' + r6.calculada + ' · guardada $' + r6.guardada);
  T('🔑 la ganancia guardada cuadra con la de los productos',
     Math.abs(r6.calculada - r6.guardada) < 0.05, JSON.stringify(r6));

  console.log(`\n  ${ok} bien · ${mal} mal`);
  const reales=errs.filter(e=>!/firebase|onAuthStateChanged/i.test(e));
  if(reales.length){ console.log('⚠️ JS:'); reales.forEach(e=>console.log('   '+e)); }
  await b.close();
  process.exit(mal||reales.length?1:0);
})();
