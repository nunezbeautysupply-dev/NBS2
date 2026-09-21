const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
// 🧪 HOJAS DE LA FACTURA + STOCK A LA VISTA  (20 sep 2026)
//   Prueba las dos mejoras del 20 sep:
//   1) La factura de compra acepta VARIAS hojas (2 + el ➕ para más), se pintan,
//      se pueden quitar, la hoja 1 alimenta el lector de texto, y se guardan en la compra.
//   2) Al buscar y al escoger un producto en la compra, se ve cuánto stock queda.
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({viewport:{width:390,height:844}});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file:///home/claude/trabajo/index.html');
  await p.waitForTimeout(2500);
  let ok=0,mal=0;
  const T=(n,c,d)=>{ if(c){ok++;console.log('  ✅ '+n);} else {mal++;console.log('  ❌ '+n+(d?'  →  '+d:''));} };

  const px='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC';

  await p.evaluate(()=>{
    ['pantalla-login','pantalla-bloqueo'].forEach(id=>{const e=document.getElementById(id); if(e) e.style.display='none';});
    const a=document.getElementById('app-contenido'); if(a) a.style.display='block';
    localStorage.setItem('nsup', JSON.stringify([{id:900,nombre:'Kanar'}]));
    localStorage.setItem('np', JSON.stringify([{id:'p1',nombre:'Guante negro mediano',marca:'Level3',cat:'GUANTES',costo:6,precio:10,stock:42,min:5}]));
    localStorage.setItem('nc','[]');
    suplidores=LS('nsup',[]); compras=LS('nc',[]); loadProds();
    ir('p-comp');
  });
  await p.waitForTimeout(400);

  console.log('\n1️⃣  📄 LAS HOJAS DE LA FACTURA');
  const r1 = await p.evaluate((px)=>{
    const fila=document.getElementById('cc-hojas-fila');
    const existeFila = !!fila;
    // al entrar, solo el botón ➕ (sin hojas todavía)
    const soloMas = existeFila ? fila.querySelectorAll('img').length===0 && fila.textContent.includes('foto') : false;
    // poner 3 hojas
    window._ccHojas=[]; window._ccHojas.push(px+'#1',px+'#2',px+'#3'); pintarHojasFactura();
    const tres = fila.querySelectorAll('img').length;
    const tieneMas = fila.textContent.includes('más');
    const hoja1EnCampo = document.getElementById('cc-foto-data').value===window._ccHojas[0];
    const ocrVisible = document.getElementById('cc-btn-ocr').style.display!=='none';
    // quitar la hoja del medio
    window._ccHojas.splice(1,1); pintarHojasFactura();
    const dos = fila.querySelectorAll('img').length;
    return { existeFila, soloMas, tres, tieneMas, hoja1EnCampo, ocrVisible, dos };
  }, px);
  T('la fila de hojas existe en la compra', r1.existeFila);
  T('al entrar solo está el botón de agregar', r1.soloMas);
  T('acepta 3 hojas (o más)', r1.tres===3, r1.tres+' hojas');
  T('el botón ➕ "más" sigue para agregar otra', r1.tieneMas);
  T('la hoja 1 alimenta el lector de texto', r1.hoja1EnCampo);
  T('el botón de leer texto sigue visible', r1.ocrVisible);
  T('se puede quitar una hoja', r1.dos===2, r1.dos+' tras quitar');

  console.log('\n2️⃣  💾 LAS HOJAS SE GUARDAN EN LA COMPRA');
  const r2 = await p.evaluate((px)=>{
    window._ccHojas=[px+'#a',px+'#b'];
    // armar una compra mínima
    document.getElementById('ccsup').value='900';
    iCC=[{pid:'p1',nombre:'Guante negro mediano',cant:2,costo:6}];
    document.getElementById('cctipo').value='credito';
    const antes=(LS('nc',[])).length;
    saveCC();
    const nc=LS('nc',[]);
    const ult=nc[nc.length-1];
    return {
      seGuardo: nc.length===antes+1,
      tieneFotos: !!(ult && ult.fotos && ult.fotos.length===2),
      fotoCompat: !!(ult && ult.foto),           // hoja 1 también en 'foto' para lo viejo
      hojasLimpias: window._ccHojas.length===0    // se limpian al terminar
    };
  }, px);
  T('la compra se guarda', r2.seGuardo);
  T('guarda las 2 hojas en la compra', r2.tieneFotos);
  T('la hoja 1 queda en "foto" (compras viejas siguen sirviendo)', r2.fotoCompat);
  T('las hojas se limpian al terminar', r2.hojasLimpias);

  console.log('\n3️⃣  📊 EL STOCK A LA VISTA');
  const r3 = await p.evaluate(()=>{
    // estado de stock limpio (la sección anterior guardó una compra que movió el inventario)
    localStorage.setItem('np', JSON.stringify([{id:'p1',nombre:'Guante negro mediano',marca:'Level3',cat:'GUANTES',costo:6,precio:10,stock:42,min:5}]));
    loadProds();
    // búsqueda
    filterCC('guante negro');
    const htmlLista=document.getElementById('cclist').innerHTML;
    // escoger
    selCC('p1');
    const htmlChip=document.getElementById('ccsn').innerHTML;
    return {
      enBusqueda: htmlLista.includes('Quedan: 42'),
      verdeBusqueda: htmlLista.includes('color:#2E7D32'),
      enChip: htmlChip.includes('Quedan 42'),
      verdeChip: htmlChip.includes('color:#2E7D32')
    };
  });
  T('al buscar se ve "Quedan: 42"', r3.enBusqueda);
  T('el stock en la búsqueda sale en verde', r3.verdeBusqueda);
  T('al escoger el producto sigue viéndose "Quedan 42"', r3.enChip);
  T('el stock del escogido sale en verde', r3.verdeChip);

  T('sin errores de JavaScript', errs.length===0, errs.slice(0,3).join(' | '));

  console.log('\n  '+ok+' bien · '+mal+' mal');
  await b.close();
  process.exit(mal>0?1:0);
})();
