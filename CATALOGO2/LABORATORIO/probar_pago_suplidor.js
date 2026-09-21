const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file:///home/claude/trabajo/index.html');
  await p.waitForTimeout(2500);
  await p.evaluate(()=>{ window.fbDb={ref:()=>({set(){},update(){},on(){},once(){return Promise.resolve({val:()=>null});}})};
    window.protegerConHuella=function(cb){ cb(); };            // la huella no se puede probar aqui
  });

  let ok=0,mal=0;
  const T=(n,c,d)=>{ if(c){ok++;console.log('  ✅ '+n);} else {mal++;console.log('  ❌ '+n+(d?'  →  '+d:''));} };

  const sembrar = async () => await p.evaluate(() => {
    localStorage.setItem('nsup', JSON.stringify([{id:900,nombre:'Kanar Online'}]));
    localStorage.setItem('np', JSON.stringify([{id:'p1',nombre:'Hair Gel',marca:'Gummy',costo:4,precio:10,stock:100,min:5}]));
    localStorage.setItem('nc', JSON.stringify([
      {id:7001,sid:900,sn:'Kanar Online',tipo:'credito',items:[{pid:'p1',nombre:'Hair Gel',cant:10,costo:4}],
       total:268.85,envio:0,cargoTarjeta:0,fecha:'08/11/2026',hora:'10:00 AM',pagosFactura:[]},
      {id:7005,sid:900,sn:'Kanar Online',tipo:'credito',items:[{pid:'p1',nombre:'Hair Gel',cant:10,costo:4}],
       total:716.01,envio:0,cargoTarjeta:0,fecha:'08/14/2026',hora:'10:00 AM',pagosFactura:[]},
      {id:7009,sid:900,sn:'Kanar Online',tipo:'credito',items:[{pid:'p1',nombre:'Hair Gel',cant:10,costo:4}],
       total:1000.00,envio:0,cargoTarjeta:0,fecha:'08/16/2026',hora:'10:00 AM',pagosFactura:[]}
    ]));
    suplidores=LS('nsup',[]); compras=LS('nc',[]); loadProds();
  });

  console.log('\n1️⃣  LAS CUATRO FORMAS DE PAGO EXISTEN');
  const r1 = await p.evaluate(()=>({ lista: METODOS_PAGO_COMPRA.map(m=>m.tipo),
                                     ventas: Object.keys(obtenerOpcionesMetodoPago('vini')) }));
  T('son 4: tarjeta, cash, zelle, cashapp',
     JSON.stringify(r1.lista)===JSON.stringify(['tarjeta','efectivo','zelle','cashapp']), JSON.stringify(r1.lista));
  T('las formas de pago de las VENTAS no se tocaron',
     JSON.stringify(r1.ventas)===JSON.stringify(['efectivo','cashapp','zelle']), JSON.stringify(r1.ventas));

  console.log('\n2️⃣  EL BOTÓN PAGARLE EN LA PANTALLA DEL SUPLIDOR');
  await sembrar();
  const r2 = await p.evaluate(async () => {
    verSup(900);
    await new Promise(r=>setTimeout(r,300));
    const b=[...document.querySelectorAll('button')].find(x=>/Pagarle/.test(x.textContent));
    return { existe: !!b, texto: b?b.textContent:null };
  });
  T('el botón PAGARLE existe', r2.existe);
  T('enseña lo que le debe ($1,984.86)', /1,984\.86/.test(r2.texto||''), r2.texto);

  console.log('\n3️⃣  TÚ ESCOGES LA FACTURA — nada automático');
  const r3 = await p.evaluate(async () => {
    abrirPagoSuplidor(900);
    await new Promise(r=>setTimeout(r,200));
    const caja=document.getElementById('pagosup-caja');
    const antesDeEscoger = caja.innerHTML.indexOf('Huella y pagar')>=0;
    escogerFacturaSuplidor('7005');
    await new Promise(r=>setTimeout(r,150));
    const c2=document.getElementById('pagosup-caja');
    const monto = document.getElementById('pagosup-monto');
    const botones = [...c2.querySelectorAll('button')].map(x=>x.textContent.trim());
    return { antesDeEscoger, montoPrellenado: monto?monto.value:null,
             tieneLas4: ['Tarjeta','Cash','Zelle','CashApp'].every(t=>botones.some(b=>b.indexOf(t)>=0)),
             cuantasFacturas: (c2.innerHTML.match(/escogerFacturaSuplidor/g)||[]).length };
  });
  T('no deja pagar hasta escoger una factura', r3.antesDeEscoger===false);
  T('enseña las 3 facturas abiertas', r3.cuantasFacturas===3, String(r3.cuantasFacturas));
  T('al escoger la #7005 pone su saldo (716.01)', r3.montoPrellenado==='716.01', r3.montoPrellenado);
  T('salen las 4 formas de pago', r3.tieneLas4);

  console.log('\n4️⃣  EL PAGO VA COMPLETO A LA FACTURA QUE ESCOGIÓ');
  const r4 = await p.evaluate(async () => {
    escogerMetodoSuplidor('zelle');
    document.getElementById('pagosup-monto').value='300.00';
    const oc=window.confirm; window.confirm=function(){return true;};
    const oa=window.alert; const avisos=[]; window.alert=function(m){avisos.push(m);};
    aplicarPagoSuplidor();
    await new Promise(r=>setTimeout(r,400));
    window.confirm=oc; window.alert=oa;
    const cs=LS('nc',[]);
    const f=id=>cs.find(x=>String(x.id)===String(id));
    return { avisos,
             p7001:(f(7001).pagosFactura||[]).length,
             p7005:f(7005).pagosFactura||[],
             p7009:(f(7009).pagosFactura||[]).length };
  });
  T('la factura escogida recibió el pago', r4.p7005.length===1, JSON.stringify(r4.p7005));
  T('el monto es 300.00', r4.p7005[0] && Math.abs(r4.p7005[0].monto-300)<0.005, JSON.stringify(r4.p7005[0]));
  T('guardó la forma de pago (zelle)', r4.p7005[0] && r4.p7005[0].metodo==='zelle', JSON.stringify(r4.p7005[0]));
  T('🔴 NO tocó la factura más vieja (#7001)', r4.p7001===0, String(r4.p7001));
  T('🔴 NO tocó la más nueva (#7009)', r4.p7009===0, String(r4.p7009));

  console.log('\n5️⃣  EL SOBRANTE NO SE PASA A OTRA FACTURA');
  await sembrar();
  const r5 = await p.evaluate(async () => {
    abrirPagoSuplidor(900);
    await new Promise(r=>setTimeout(r,150));
    escogerFacturaSuplidor('7001');           // debe 268.85
    await new Promise(r=>setTimeout(r,120));
    escogerMetodoSuplidor('tarjeta');
    document.getElementById('pagosup-monto').value='500.00';   // 231.15 de sobrante
    const oc=window.confirm; const preguntas=[]; window.confirm=function(m){preguntas.push(m);return true;};
    const oa=window.alert; window.alert=function(){};
    aplicarPagoSuplidor();
    await new Promise(r=>setTimeout(r,400));
    window.confirm=oc; window.alert=oa;
    const cs=LS('nc',[]);
    const f=id=>cs.find(x=>String(x.id)===String(id));
    return { preguntas, p7001:f(7001).pagosFactura, p7005:(f(7005).pagosFactura||[]).length,
             p7009:(f(7009).pagosFactura||[]).length };
  });
  T('avisa que el sobrante NO se pasa', r5.preguntas.some(x=>/sobrante NO se pasa/i.test(x)), JSON.stringify(r5.preguntas).slice(0,160));
  T('los 500 quedaron en la factura escogida', r5.p7001.length===1 && Math.abs(r5.p7001[0].monto-500)<0.005, JSON.stringify(r5.p7001));
  T('🔴 la #7005 sigue sin pagos', r5.p7005===0, String(r5.p7005));
  T('🔴 la #7009 sigue sin pagos', r5.p7009===0, String(r5.p7009));

  console.log('\n6️⃣  LAS 4 FORMAS TAMBIÉN DENTRO DE LA FACTURA');
  await sembrar();
  const r6 = await p.evaluate(async () => {
    const c=LS('nc',[]).find(x=>String(x.id)==='7001');
    verFacturaCompra(c, 900);
    await new Promise(r=>setTimeout(r,300));
    const ids=['tarjeta','efectivo','zelle','cashapp'].map(t=>!!document.getElementById('pagtodo-'+t+'-7001'));
    const sel=document.getElementById('metpagocompra-7001');
    return { botones: ids, haySelector: !!sel,
             opciones: sel?[...sel.options].map(o=>o.value):[] };
  });
  T('los 4 botones de pagar todo existen', r6.botones.every(Boolean), JSON.stringify(r6.botones));
  T('el pago parcial tiene selector de forma de pago', r6.haySelector);
  T('el selector trae las 4', JSON.stringify(r6.opciones)===JSON.stringify(['tarjeta','efectivo','zelle','cashapp']), JSON.stringify(r6.opciones));

  console.log('\n══════════════════════════════');
  console.log(`  ${ok} bien · ${mal} mal`);
  const reales=errs.filter(e=>!/firebase|onAuthStateChanged/i.test(e));
  if(reales.length){ console.log('⚠️ JS:'); reales.forEach(e=>console.log('   '+e)); }
  await b.close();
  process.exit(mal||reales.length?1:0);
})();
