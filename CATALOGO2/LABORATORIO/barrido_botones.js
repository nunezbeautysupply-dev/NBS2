const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
const fs=require('fs');
(async () => {
  const html = fs.readFileSync('/home/claude/trabajo/index.html','utf8');
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs=[]; p.on('pageerror', e=>errs.push(e.message));
  await p.goto('file:///home/claude/trabajo/index.html');
  await p.waitForTimeout(2500);

  // Todas las funciones que se llaman desde un onclick / oninput del HTML
  const nombres = new Set();
  const re = /on(?:click|input|change|focus|blur)\s*=\s*"([^"]*)"/g;
  let m;
  while((m=re.exec(html))){
    const re2=/([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g; let m2;
    while((m2=re2.exec(m[1]))) nombres.add(m2[1]);
  }
  const lista=[...nombres].filter(n=>!['if','for','while','return','function','typeof','catch','switch','parseFloat','parseInt','String','Number','Math','Array','Object','JSON','alert','confirm','prompt','setTimeout'].includes(n));
  const muertas = await p.evaluate((ns)=> ns.filter(n=>typeof window[n]!=='function'), lista);
  console.log(`🔘 BARRIDO DE BOTONES: ${lista.length} funciones llamadas desde el HTML`);
  if(muertas.length){ console.log('   ❌ NO EXISTEN: '+muertas.join(', ')); }
  else console.log('   ✅ todas existen');

  // Que las pantallas principales abran sin reventar
  console.log('\n📱 QUE LAS PANTALLAS ABRAN');
  const pant = await p.evaluate(async ()=>{
    window.fbDb={ref:()=>({set(){},update(){},on(){},once(){return Promise.resolve({val:()=>null});}})};
    const rotas=[];
    const fns=['renderICC','renderSup','renderCXP','renderCl','renderCxC','renderDashboard',
               'renderFacturas','renderPanorama','calcularResumenInventario','calcularTotalPorPagar',
               'masVendidos','productosHabituales','calcVIP','genRpt','renderListaPrecios'];
    for(const f of fns){
      try { if(typeof window[f]==='function') window[f](); }
      catch(e){ rotas.push(f+': '+e.message); }
    }
    return rotas;
  });
  if(pant.length){ pant.forEach(x=>console.log('   ❌ '+x)); } else console.log('   ✅ ninguna reventó');

  const reales = errs.filter(e=>!/firebase|onAuthStateChanged/i.test(e));
  console.log('\n⚠️ errores JS reales: ' + (reales.length||'ninguno'));
  reales.slice(0,8).forEach(e=>console.log('   '+e));
  await b.close();
  process.exit((muertas.length||pant.length||reales.length)?1:0);
})();
