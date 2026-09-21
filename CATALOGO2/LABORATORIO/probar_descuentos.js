const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errores = [];
  p.on('pageerror', e => errores.push('JS: ' + e.message));
  await p.goto('file:///home/claude/trabajo/index.html');
  await p.waitForTimeout(2500);

  let ok = 0, mal = 0;
  const T = (nombre, cond, detalle) => {
    if (cond) { ok++; console.log('  ✅ ' + nombre); }
    else { mal++; console.log('  ❌ ' + nombre + (detalle ? '  →  ' + detalle : '')); }
  };

  // ══ 1. EL LECTOR: LA FACTURA REAL DE KANAR ONLINE ══
  console.log('\n1️⃣  EL LECTOR DE PDF CON SU FACTURA REAL');
  const r1 = await p.evaluate(() => {
    const linea = (txt) => ({ texto: txt, palabras: txt.split(/\s+/).map((t,i)=>({t:t, x:i*10})) });
    const lineas = [
      linea('GU-GU103A Hair Gel 700ml Keratin - 700ml 120 0 4.00 480.00'),
      linea('BC-400-66 BARBER AFTER SHAVE COLOGNE 400 ML NO.66 12 0 4.25 51.00'),
      linea('BC-400-65 BARBER AFTER SHAVE COLOGNE 400 ML NO.65 12 0 4.25 51.00'),
      linea('ZY-GP540B GAMMA+ T1000 Echo Fixed Fade Blade Set 10 2 32.91 329.10'),
      linea('ZZ-SC422P StyleCraft: Reign Trimmer- Purple 3 0 115.59 346.77'),
      linea('ZZ-SC620P StyleCracft: Reign Professional Hair Clipper 3 0 137.46 412.38'),
      linea('ZZ-SCHSWBB StyleCraft Heat Stroke Wireless Hot Brush 2 0 48.00 96.00'),
      linea('ZZ-SC542B StyleCraft Instinct Shaver Replacement 6 0 24.96 149.76'),
      linea('ZZ-SC620W StyleCraft: Reign Clipper 3 0 151.21 453.63'),
      linea('ZZ-SC422W StyleCraft: REIGN TRIMMER 3 0 110.00 330.00'),
      linea('Subtotal 2,699.64'),
      linea('All reign pairs clipper and trimmer $155.00 -612.78'),
      linea('BC-400 FREE SAMPLES -102.00')
    ];
    return { d: descuentosDeLaFactura(lineas), sub: subtotalImpreso(lineas) };
  });
  console.log('     encontró: ' + JSON.stringify(r1.d));
  T('encuentra exactamente 2 descuentos', r1.d.length === 2, 'dio ' + r1.d.length);
  T('el primero es 612.78 (no el $155.00 del medio)', Math.abs(r1.d[0].monto - 612.78) < 0.005, JSON.stringify(r1.d[0]));
  T('el segundo es 102.00', Math.abs(r1.d[1].monto - 102.00) < 0.005, JSON.stringify(r1.d[1]));
  T('la descripción del 1ro menciona reign', /reign/i.test(r1.d[0].desc), r1.d[0].desc);
  T('la descripción del 2do menciona BC-400', /BC-400/i.test(r1.d[1].desc), r1.d[1].desc);
  T('el subtotal impreso es 2699.64', Math.abs(r1.sub - 2699.64) < 0.005, String(r1.sub));
  const total = r1.sub - r1.d.reduce((a,x)=>a+x.monto,0);
  T('subtotal − descuentos = 1984.86', Math.abs(total - 1984.86) < 0.005, String(total));

  // ══ 2. QUE NO SE CUELEN COMO PRODUCTOS ══
  console.log('\n2️⃣  LAS LÍNEAS DE DESCUENTO NO SE VUELVEN PRODUCTOS');
  const r2 = await p.evaluate(() => {
    const linea = (txt) => ({ texto: txt, palabras: txt.split(/\s+/).map((t,i)=>({t:t, x:i*10})) });
    return {
      a: leerLineaDeFactura(linea('All reign pairs clipper and trimmer $155.00 -612.78')),
      b: leerLineaDeFactura(linea('BC-400 FREE SAMPLES -102.00')),
      c: leerLineaDeFactura(linea('GU-GU103A Hair Gel 700ml Keratin - 700ml 120 0 4.00 480.00'))
    };
  });
  T('el descuento de reign NO se lee como producto', r2.a === null);
  T('el de free samples NO se lee como producto', r2.b === null);
  T('un producto de verdad SÍ se sigue leyendo', r2.c && r2.c.cant === 120 && Math.abs(r2.c.costo-4.00)<0.005, JSON.stringify(r2.c));

  // ══ 3. CASOS RAROS ══
  console.log('\n3️⃣  CASOS RAROS');
  const r3 = await p.evaluate(() => {
    const linea = (txt) => ({ texto: txt, palabras: txt.split(/\s+/).map((t,i)=>({t:t, x:i*10})) });
    return {
      parentesis: descuentosDeLaFactura([linea('PROMO DE VERANO (250.00)')]),
      signoSuelto: descuentosDeLaFactura([linea('CUPON DE FIDELIDAD - 75.50')]),
      totalNoCuenta: descuentosDeLaFactura([linea('TOTAL DUE -1,984.86')]),
      soloPositivos: descuentosDeLaFactura([linea('SHIPPING 45.00')]),
      masDeTres: descuentosDeLaFactura([
        linea('DESCUENTO A -10.00'), linea('DESCUENTO B -20.00'),
        linea('DESCUENTO C -30.00'), linea('DESCUENTO D -40.00'), linea('DESCUENTO E -5.00')])
    };
  });
  T('lo lee entre paréntesis: (250.00)', r3.parentesis.length===1 && Math.abs(r3.parentesis[0].monto-250)<0.005, JSON.stringify(r3.parentesis));
  T('lo lee con el signo suelto: - 75.50', r3.signoSuelto.length===1 && Math.abs(r3.signoSuelto[0].monto-75.50)<0.005, JSON.stringify(r3.signoSuelto));
  T('el TOTAL negativo NO cuenta como descuento', r3.totalNoCuenta.length===0, JSON.stringify(r3.totalNoCuenta));
  T('una línea positiva NO cuenta como descuento', r3.soloPositivos.length===0, JSON.stringify(r3.soloPositivos));
  T('OPCIÓN B: 5 descuentos → 3 renglones', r3.masDeTres.length===3, JSON.stringify(r3.masDeTres));
  T('OPCIÓN B: el 3ro junta los demás (30+40+5=75)', r3.masDeTres.length===3 && Math.abs(r3.masDeTres[2].monto-75)<0.005, JSON.stringify(r3.masDeTres[2]));
  T('OPCIÓN B: no se pierde ni un centavo (105 total)',
    Math.abs(r3.masDeTres.reduce((a,x)=>a+x.monto,0) - 105) < 0.005);

  console.log('\n══════════════════════════════');
  console.log(`  ${ok} bien · ${mal} mal`);
  if (errores.length) { console.log('\n⚠️ ERRORES DE JS:'); errores.forEach(e=>console.log('   '+e)); }
  await b.close();
  process.exit(mal ? 1 : 0);
})();
