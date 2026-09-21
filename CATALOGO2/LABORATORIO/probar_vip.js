/**
 * 🎁 PROBAR EL PROGRAMA VIP con las reglas de Sensei (3 sep 2026)
 *
 *   $10 → 1 punto · $5 SOLO navajas → 2 = 1 punto
 *   MISMA MARCA + MISMA CATEGORÍA = suman juntos
 *   Retroactivo desde JUNIO 2026
 *   Y se pueden ajustar los puntos a mano, por grupo
 */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 1100 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file:///home/claude/trabajo/index.html');
  await p.waitForTimeout(2600);
  let ok = 0, mal = 0;
  const T = (n, c, d) => { if (c) { ok++; console.log('  ✅ ' + n); } else { mal++; console.log('  ❌ ' + n + (d ? '  →  ' + d : '')); } };

  await p.evaluate(() => {
    ['pantalla-login', 'pantalla-bloqueo'].forEach(id => {
      const e = document.getElementById(id); if (e) e.style.display = 'none';
    });
    document.getElementById('app-contenido').style.display = 'block';
  });

  console.log('\n1️⃣  🔑 QUÉ CUENTA Y QUÉ NO');
  const r1 = await p.evaluate(() => {
    const casos = [
      // [nombre, precio, categoría esperada]
      ['Immortal hair gel 700ml',            10, 'HAIR GEL'],
      ['Totex Gel para el pelo Freeze',      10, 'HAIR GEL'],
      ['ECO KRYSTAL 32 oz',                  10, 'HAIR GEL'],
      ['Immortal Chaos sea salt wax',        10, 'WAX/CREAM'],
      ['Nishman Hair styling wax crema',     10, 'WAX/CREAM'],
      ['Inmortal hair matte clay',           10, 'WAX/CREAM'],
      ['KABUTO SOFT MATTE PASTE',            10, 'WAX/CREAM'],
      ['KABUTO CLASSIC POMADE',              10, 'WAX/CREAM'],
      ['Level3 pomada gold',                 10, 'WAX/CREAM'],
      ['Immortal Colonia original #06',      10, 'COLONIA'],
      ['Inmortal cologne original #03',      10, 'COLONIA'],
      ['BARBER AFTER SHAVE COLOGNE 400',     10, 'COLONIA'],
      ['INMORTAL AFTER SHAVE CREAM BALSAM',  10, 'AFTER SHAVE'],
      ['KABUTO FRESHNESS BALM SAYA',         10, 'AFTER SHAVE'],
      ['Agiva leave in conditioner',         10, 'LEAVE IN'],
      ['Two phase conditioner spray',        10, 'TWO PHASE'],
      ['Dorco Navajas rojas regular',        10, 'NAVAJA'],
      ['Nishman Papel cuello negro',         10, 'PAPEL CUELLO'],
      ['Neck strips',                        10, 'PAPEL CUELLO'],
      // 🔴 LO QUE NO CUENTA
      ['Inmortal shaving gel',               10, null],
      ['proshave shaving cream',             10, null],
      ['Level 3 hair spray',                 10, null],
      ['LEVEL3 STYLING POWDER',              10, null],
      ['Gummy mousse',                       10, null],
      ['Level 3 shampoo and conditioner',    10, null],
      ['Oil sheen cantu',                    10, null],
      ['Neck duster',                        10, null],
      ['Hand mirror blue',                   10, null],
      ['Andis Cool Care',                    10, null],
      ['Clippercide blade care',             10, null],
      ['Kiss express Tintation negro',       10, null],
      ['Inmortal talco polvo deluxe',        10, null],
      ['BLUE COMB PEINE AZUL',                5, null],
      ['Speed O Guide #00 red',               5, null],
      ['Persona blade navaja cortada',        5, 'NAVAJA'],
      ['Colonia grande',                     12, null],   // no es de $10
    ];
    return casos.map(([n, pr, esp]) => ({ n, esp, dio: categoriaVIP(n, pr, null) }));
  });
  const fallan1 = r1.filter(x => x.dio !== x.esp);
  console.log('     ' + r1.length + ' productos comprobados');
  T('🔑 los ' + r1.length + ' se clasifican bien', fallan1.length === 0,
     fallan1.map(x => x.n + ': dio ' + x.dio + ' y esperaba ' + x.esp).join(' | ').slice(0, 200));

  console.log('\n2️⃣  🔑 MISMA MARCA + MISMA CATEGORÍA SUMAN JUNTOS');
  const r2 = await p.evaluate(() => {
    localStorage.setItem('ncl', JSON.stringify([{ id: 1, nombre: 'Test', vipActivo: true }]));
    localStorage.setItem('np', JSON.stringify([
      { id: 'w1', nombre: 'Immortal Chaos sea salt wax', marca: 'Immortal', precio: 10, costo: 6 },
      { id: 'w2', nombre: 'Immortal hair wax strawberry', marca: 'Immortal', precio: 10, costo: 6 },
      { id: 'w3', nombre: 'Immortal hair matte clay', marca: 'Immortal', precio: 10, costo: 6 },
      { id: 'w4', nombre: 'Nishman wax crema', marca: 'Nishman', precio: 10, costo: 6 }]));
    localStorage.setItem('nv', JSON.stringify([
      { id: 1, cid: 1, cn: 'Test', tipo: 'contado', fecha: '07/01/2026', total: 100, ganancia: 30,
        items: [{ pid: 'w1', nombre: 'Immortal Chaos sea salt wax', cant: 4, precio: 10, costo: 6 },
                { pid: 'w2', nombre: 'Immortal hair wax strawberry', cant: 3, precio: 10, costo: 6 },
                { pid: 'w3', nombre: 'Immortal hair matte clay', cant: 3, precio: 10, costo: 6 },
                { pid: 'w4', nombre: 'Nishman wax crema', cant: 5, precio: 10, costo: 6 }],
        pagosFactura: [{ pid: 'a', monto: 150, fecha: '07/01/2026' }] }]));
    clientes = LS('ncl', []); ventas = LS('nv', []); loadProds();
    const g = calcVIP(1);
    return Object.keys(g).map(k => ({ k, nombre: g[k].nombre, pts: g[k].puntos, gratis: g[k].gratis }));
  });
  console.log('     ' + JSON.stringify(r2.map(x => x.nombre + '=' + x.pts)));
  const immortal = r2.find(x => /IMMORTAL/.test(x.nombre));
  const nishman = r2.find(x => /NISHMAN/.test(x.nombre));
  T('🔑 los 3 wax Immortal suman JUNTOS: 10 puntos', immortal && immortal.pts === 10, immortal && String(immortal.pts));
  T('🎁 y eso ya es un premio', immortal && immortal.gratis === 1, immortal && String(immortal.gratis));
  T('🔑 Nishman va APARTE: 5 puntos', nishman && nishman.pts === 5, nishman && String(nishman.pts));
  T('🔒 son dos grupos, no uno', r2.length === 2, String(r2.length));

  console.log('\n3️⃣  📅 RETROACTIVO DESDE JUNIO');
  const r3 = await p.evaluate(() => {
    localStorage.setItem('nv', JSON.stringify([
      { id: 1, cid: 1, cn: 'T', tipo: 'contado', fecha: '05/20/2026', total: 50, ganancia: 15,
        items: [{ pid: 'w1', nombre: 'Immortal Chaos sea salt wax', cant: 5, precio: 10, costo: 6 }],
        pagosFactura: [] },
      { id: 2, cid: 1, cn: 'T', tipo: 'contado', fecha: '06/05/2026', total: 40, ganancia: 12,
        items: [{ pid: 'w1', nombre: 'Immortal Chaos sea salt wax', cant: 4, precio: 10, costo: 6 }],
        pagosFactura: [] }]));
    ventas = LS('nv', []);
    const g = calcVIP(1);
    const k = Object.keys(g)[0];
    return { grupos: Object.keys(g).length, pts: k ? g[k].puntos : 0 };
  });
  T('📅 lo de MAYO no cuenta', r3.pts === 4, String(r3.pts) + ' (debería ser 4, no 9)');

  console.log('\n4️⃣  🔢 LAS NAVAJAS DE $5: DOS POR UN PUNTO');
  const r4 = await p.evaluate(() => {
    localStorage.setItem('np', JSON.stringify([
      { id: 'n5', nombre: 'Persona blade navaja cortada', marca: 'Persona', precio: 5, costo: 3 }]));
    localStorage.setItem('nv', JSON.stringify([
      { id: 1, cid: 1, cn: 'T', tipo: 'contado', fecha: '07/01/2026', total: 35, ganancia: 10,
        items: [{ pid: 'n5', nombre: 'Persona blade navaja cortada', cant: 7, precio: 5, costo: 3 }],
        pagosFactura: [] }]));
    ventas = LS('nv', []); loadProds();
    const g = calcVIP(1);
    const k = Object.keys(g)[0];
    return { pts: k ? g[k].puntos : 0, nombre: k ? g[k].nombre : '' };
  });
  T('🔢 7 navajas de $5 = 3 puntos (se trunca)', r4.pts === 3, String(r4.pts));

  console.log('\n5️⃣  ✏️ AJUSTAR LOS PUNTOS A MANO');
  const r5 = await p.evaluate(async () => {
    localStorage.setItem('np', JSON.stringify([
      { id: 'w1', nombre: 'Immortal Chaos sea salt wax', marca: 'Immortal', precio: 10, costo: 6 }]));
    localStorage.setItem('nv', JSON.stringify([
      { id: 1, cid: 1, cn: 'T', tipo: 'contado', fecha: '07/01/2026', total: 80, ganancia: 24,
        items: [{ pid: 'w1', nombre: 'Immortal Chaos sea salt wax', cant: 8, precio: 10, costo: 6 }],
        pagosFactura: [] }]));
    ventas = LS('nv', []); loadProds();
    const antes = calcVIP(1);
    const k = Object.keys(antes)[0];
    const ptsAntes = antes[k].puntos;

    // Su caso: tiene 8, le da el premio y le deja 1
    abrirAjustePuntosVIP(1, k);
    await new Promise(r => setTimeout(r, 250));
    document.getElementById('aj-vip-puntos').value = '1';
    document.getElementById('aj-vip-motivo').value = 'Le regalé uno, buen cliente';
    const oa = window.alert, oav = window.avisoGrande;
    window.alert = () => {}; window.avisoGrande = () => {};
    guardarAjustePuntosVIP();
    await new Promise(r => setTimeout(r, 250));
    window.alert = oa; window.avisoGrande = oav;

    const despues = calcVIP(1);
    const c = LS('ncl', []).find(x => String(x.id) === '1');
    return { ptsAntes, ptsDespues: despues[k] ? despues[k].puntos : 0,
             ajustes: (c.vipAjustes || []).length,
             motivo: (c.vipAjustes || [])[0] ? c.vipAjustes[0].motivo : null,
             clave: k };
  });
  T('tenía 8 puntos', r5.ptsAntes === 8, String(r5.ptsAntes));
  T('✏️ ahora tiene 1, como él dijo', r5.ptsDespues === 1, String(r5.ptsDespues));
  T('queda apuntado el ajuste', r5.ajustes === 1, String(r5.ajustes));
  T('con su motivo', /buen cliente/.test(r5.motivo || ''), String(r5.motivo));

  console.log('\n6️⃣  🔑 Y LO QUE COMPRE DESPUÉS SIGUE SUMANDO');
  const r6 = await p.evaluate(() => {
    const V = LS('nv', []);
    V.push({ id: 2, cid: 1, cn: 'T', tipo: 'contado', fecha: '08/20/2026', total: 30, ganancia: 9,
             items: [{ pid: 'w1', nombre: 'Immortal Chaos sea salt wax', cant: 3, precio: 10, costo: 6 }],
             pagosFactura: [] });
    localStorage.setItem('nv', JSON.stringify(V)); ventas = LS('nv', []);
    const g = calcVIP(1);
    const k = Object.keys(g)[0];
    return { pts: k ? g[k].puntos : 0 };
  });
  T('🔑 compró 3 más: 1 + 3 = 4 puntos', r6.pts === 4, String(r6.pts) + ' (debería ser 4)');

  console.log('\n7️⃣  ↩️ SE PUEDE DESHACER');
  const r7 = await p.evaluate(async () => {
    const c = LS('ncl', []).find(x => String(x.id) === '1');
    const idAj = (c.vipAjustes || [])[0].id;
    const oc = window.confirm, oav = window.avisoGrande;
    window.confirm = () => true; window.avisoGrande = () => {};
    deshacerAjustePuntosVIP(1, idAj);
    await new Promise(r => setTimeout(r, 200));
    window.confirm = oc; window.avisoGrande = oav;
    const g = calcVIP(1);
    const k = Object.keys(g)[0];
    const c2 = LS('ncl', []).find(x => String(x.id) === '1');
    return { pts: k ? g[k].puntos : 0, ajustes: (c2.vipAjustes || []).length };
  });
  T('↩️ al deshacer vuelven los 11 puntos', r7.pts === 11, String(r7.pts));
  T('y el ajuste desaparece', r7.ajustes === 0, String(r7.ajustes));

  console.log('\n8️⃣  🔙 EL BOTÓN ATRÁS LO CIERRA');
  const r8 = await p.evaluate(() => ({
    enLista: RECUADROS_ENCIMA.some(x => x.id === 'ajuste-vip-overlay'),
    cierra: typeof cerrarAjustePuntosVIP === 'function'
  }));
  T('🔙 el recuadro está registrado', r8.enLista);
  T('y su función de cerrar existe', r8.cierra);

  console.log('\n9️⃣  🎺 LA FANFARRIA DEL PREMIO');
  const r9 = await p.evaluate(async () => {
    localStorage.removeItem('nbs_premios_sonados');
    localStorage.setItem('ncl', JSON.stringify([{ id: 1, nombre: 'Test', vipActivo: true }]));
    localStorage.setItem('np', JSON.stringify([
      { id: 'w1', nombre: 'Immortal Chaos sea salt wax', marca: 'Immortal', precio: 10, costo: 6 }]));
    // 9 unidades: todavía NO llega
    localStorage.setItem('nv', JSON.stringify([
      { id: 1, cid: 1, cn: 'T', tipo: 'contado', fecha: '07/01/2026', total: 90, ganancia: 27,
        items: [{ pid: 'w1', nombre: 'Immortal Chaos sea salt wax', cant: 9, precio: 10, costo: 6 }],
        pagosFactura: [] }]));
    clientes = LS('ncl', []); ventas = LS('nv', []); loadProds();

    // Se espía el sonido
    let sono = 0;
    const orig = window.sonidoPremioVIP;
    window.sonidoPremioVIP = function () { sono++; };

    const con9 = revisarPremioNuevo(1);
    const sonoCon9 = sono;

    // Le vende UNA más: ahora llega a 10
    const V = LS('nv', []);
    V.push({ id: 2, cid: 1, cn: 'T', tipo: 'contado', fecha: '07/05/2026', total: 10, ganancia: 3,
             items: [{ pid: 'w1', nombre: 'Immortal Chaos sea salt wax', cant: 1, precio: 10, costo: 6 }],
             pagosFactura: [] });
    localStorage.setItem('nv', JSON.stringify(V)); ventas = LS('nv', []);
    const con10 = revisarPremioNuevo(1);
    const sonoCon10 = sono;

    // Y si abre otra vez, NO debe volver a sonar
    const otraVez = revisarPremioNuevo(1);
    const sonoOtraVez = sono;

    window.sonidoPremioVIP = orig;
    return { con9: con9.length, sonoCon9, con10: con10.length, sonoCon10,
             otraVez: otraVez.length, sonoOtraVez,
             nombre: con10[0] ? con10[0].nombre : null };
  });
  T('🔒 con 9 puntos NO suena', r9.sonoCon9 === 0 && r9.con9 === 0, String(r9.sonoCon9));
  T('🎺 al llegar a 10, SUENA', r9.sonoCon10 === 1, String(r9.sonoCon10));
  T('y dice qué grupo ganó', /IMMORTAL/.test(r9.nombre || ''), String(r9.nombre));
  T('🔑 y NO vuelve a sonar después', r9.sonoOtraVez === 1 && r9.otraVez === 0, String(r9.sonoOtraVez));

  console.log('\n🔟  🎁 EL AVISO DEL ASISTENTE');
  const r10 = await p.evaluate(() => {
    const lista = premiosListos();
    const avisos = analizarNegocio();
    const premio = avisos.find(a => a.clave === 'premiosVIP');
    return {
      cuantos: lista.length,
      hayAviso: !!premio,
      esPrimero: avisos[0] && avisos[0].clave === 'premiosVIP',
      noSeArchiva: premio ? !!premio.noSeArchiva : false,
      titulo: premio ? premio.titulo : null,
      sigueSaliendo: true
    };
  });

  // 🔑 Se ARCHIVA de verdad y se comprueba que SIGA saliendo
  const r10b = await p.evaluate(() => {
    const avisos = analizarNegocio();
    const premio = avisos.find(a => a.clave === 'premiosVIP');
    if(!premio) return { ok:false };
    const oa = window.alert, oav = window.avisoGrande;
    window.alert = () => {}; window.avisoGrande = () => {};
    // Se mete a mano en la libreta de leídos, como si hubiera tocado "Ya lo vi"
    try {
      const leidos = avisosLeidos();
      leidos.push({ huella: huellaDeAviso(premio), fecha: fechaHoy() });
      SS('nbs_avisos_leidos', leidos);
    } catch(e){}
    window.alert = oa; window.avisoGrande = oav;
    const pendientes = avisosPendientes();
    return { ok:true, sigue: pendientes.some(a => a.clave === 'premiosVIP') };
  });
  T('🎁 hay premio listo', r10.cuantos === 1, String(r10.cuantos));
  T('🎁 sale el aviso en el asistente', r10.hayAviso);
  T('🔑 y va PRIMERO, antes que los demás', r10.esPrimero, String(r10.esPrimero));
  T('está marcado como que no se archiva', r10.noSeArchiva, String(r10.noSeArchiva));
  T('🔑 aunque se ARCHIVE, SIGUE saliendo', r10b.ok && r10b.sigue, JSON.stringify(r10b));
  T('dice quién ganó', /gan\u00f3 su premio|ganó su premio/.test(r10.titulo || ''), String(r10.titulo));

  console.log('\n1️⃣1️⃣  🔑 EL AVISO SE VA AL DAR EL PREMIO');
  const r11 = await p.evaluate(() => {
    // Se simula que le dio el premio: se apunta el canje
    const C = LS('ncl', []);
    const g = calcVIP(1);
    const k = Object.keys(g)[0];
    C[0].vipCanjes = [{ grupo: k, nombreGrupo: g[k].nombre, fecha: fechaHoy() }];
    localStorage.setItem('ncl', JSON.stringify(C)); clientes = LS('ncl', []);
    const lista = premiosListos();
    const avisos = analizarNegocio();
    return { quedan: lista.length, hayAviso: avisos.some(a => a.clave === 'premiosVIP') };
  });
  T('🔑 al darle el premio, ya no hay premio pendiente', r11.quedan === 0, String(r11.quedan));
  T('🔑 y el aviso DESAPARECE del asistente', !r11.hayAviso, String(r11.hayAviso));

  console.log('\n1️⃣2️⃣  ✏️ EL LÁPIZ ESTÁ EN LAS DOS PANTALLAS');
  const r12 = await p.evaluate(async () => {
    localStorage.setItem('ncl', JSON.stringify([{ id: 1, nombre: 'Jose', apellido: 'Vasquez',
      negocio: 'LA SELECCION', vipActivo: true }]));
    localStorage.setItem('np', JSON.stringify([
      { id: 'w1', nombre: 'Nishman Wax Cream #6', marca: 'Nishman', precio: 10, costo: 6 }]));
    localStorage.setItem('nv', JSON.stringify([
      { id: 1, cid: 1, cn: 'Jose', tipo: 'contado', fecha: '07/10/2026', total: 40, ganancia: 12,
        items: [{ pid: 'w1', nombre: 'Nishman Wax Cream #6', cant: 4, precio: 10, costo: 6 }],
        pagosFactura: [] }]));
    clientes = LS('ncl', []); ventas = LS('nv', []); loadProds();

    // ① La lista del Programa VIP (Menú → Programa VIP)
    ir('p-vip'); await new Promise(r => setTimeout(r, 200));
    renderVIP('');
    await new Promise(r => setTimeout(r, 400));
    const enLista = document.querySelectorAll('#p-vip [onclick*="abrirAjustePuntosVIP"]').length;

    // ② La ficha del cliente
    verCl(1); await new Promise(r => setTimeout(r, 400));
    const pg = document.getElementById('p-cl-perfil');
    const fila = [...pg.querySelectorAll('[onclick*="togglePanelCl"]')]
      .find(x => /Programa VIP/.test(x.textContent || ''));
    if (fila) fila.click();
    await new Promise(r => setTimeout(r, 300));
    const enFicha = pg.querySelectorAll('[onclick*="abrirAjustePuntosVIP"]').length;
    return { enLista, enFicha };
  });
  T('✏️ el lápiz está en el Programa VIP', r12.enLista > 0, String(r12.enLista));
  T('✏️ y también en la ficha del cliente', r12.enFicha > 0, String(r12.enFicha));

  console.log('\n1️⃣3️⃣  📋 LOS TEXTOS DICEN LA REGLA DE VERDAD');
  const r13 = await p.evaluate(() => {
    const t = document.getElementById('p-vip').innerText;
    const html = document.documentElement.innerHTML;
    return {
      diceMarcaTipo: /misma MARCA y el mismo TIPO/i.test(t),
      diceNavajas: /navajas de \$5\.00 cuentan 2 por 1/i.test(t),
      diceJunio: /junio 2026/i.test(t),
      // 🔴 Ya no debe decir "mismo producto" en ningún texto visible
      quedaTextoViejo: /Compra 10 del mismo producto|10 compras del mismo producto/i.test(html)
    };
  });
  T('📋 dice "misma MARCA y el mismo TIPO"', r13.diceMarcaTipo);
  T('📋 dice lo de las navajas de $5', r13.diceNavajas);
  T('📋 dice que cuenta desde junio', r13.diceJunio);
  T('🔑 y ya NO dice "del mismo producto"', !r13.quedaTextoViejo, String(r13.quedaTextoViejo));

  console.log(`\n  ${ok} bien · ${mal} mal`);
  const reales = errs.filter(e => !/firebase|onAuthStateChanged/i.test(e));
  if (reales.length) { console.log('⚠️ JS:'); reales.slice(0, 4).forEach(e => console.log('   ' + e)); }
  await b.close();
  process.exit(mal || reales.length ? 1 : 0);
})();
