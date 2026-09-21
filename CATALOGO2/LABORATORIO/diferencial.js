const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch();

  async function correr(archivo){
    const p = await b.newPage();
    await p.goto('file://'+archivo);
    await p.waitForTimeout(2500);
    const r = await p.evaluate(async () => {
      window.fbDb={ref:()=>({set(){},update(){},on(){},once(){return Promise.resolve({val:()=>null});}})};
      localStorage.setItem('nsup', JSON.stringify([{id:900,nombre:'Kanar Online'},{id:901,nombre:'Monkeys Group'}]));
      localStorage.setItem('nc','[]');
      localStorage.setItem('np', JSON.stringify([
        {id:'p1',nombre:'Hair Gel 700ml',marca:'Gummy',costo:4.00,precio:10,stock:0,min:5},
        {id:'p2',nombre:'Reign Clipper',marca:'StyleCraft',costo:151.21,precio:200,stock:0,min:5}]));
      suplidores=LS('nsup',[]); loadProds();
      var sel=document.getElementById('ccsup');
      sel.innerHTML='<option value="900">Kanar</option><option value="901">Monkeys</option>';
      var oa=window.alert; window.alert=function(){}; var oc=window.confirm; window.confirm=function(){return true;};

      // COMPRA 1: normal, con envio y tarjeta. SIN descuentos.
      sel.value='900'; document.getElementById('cctipo').value='credito';
      window._pagoMetodos={ccini:[{tipo:'efectivo',monto:100}]};
      iCC=[{pid:'p1',nombre:'Hair Gel 700ml',cant:50,costo:4.00,esNuevo:false,precioVenta:10}];
      document.getElementById('cc-envio').value='35.00';
      document.getElementById('cc-tarjeta').value='12.50';
      saveCC();
      // COMPRA 2: solo productos
      sel.value='901'; document.getElementById('cctipo').value='contado';
      window._pagoMetodos={ccini:[{tipo:'efectivo',monto:453.63}]};
      iCC=[{pid:'p2',nombre:'Reign Clipper',cant:3,costo:151.21,esNuevo:false,precioVenta:200}];
      document.getElementById('cc-envio').value='';
      document.getElementById('cc-tarjeta').value='';
      saveCC();
      window.alert=oa; window.confirm=oc;

      compras=LS('nc',[]); loadProds();
      var todos=LS('np',[]);
      var pr=function(id){ var x=todos.find(y=>String(y.id)===String(id)); return x?{stock:x.stock,costo:x.costo}:null; };
      var inv=null; try{ inv=calcularResumenInventario(); }catch(e){ inv='ERR '+e.message; }
      var pp=null;  try{ pp=calcularTotalPorPagar(); }catch(e){ pp='ERR '+e.message; }
      return {
        totales: compras.map(c=>({total:c.total, envio:c.envio, tarjeta:c.cargoTarjeta})),
        p1: pr('p1'), p2: pr('p2'),
        porPagar: pp,
        invInvertido: inv && inv.totalInvertido!==undefined ? inv.totalInvertido : (typeof inv==='object'?JSON.stringify(inv).slice(0,120):inv)
      };
    });
    await p.close();
    return r;
  }

  console.log('⚖️  PRUEBA DIFERENCIAL — mismas operaciones, SIN descuentos');
  const viejo = await correr('/home/claude/BASE_20260819f.html');
  const nuevo = await correr('/home/claude/trabajo/index.html');

  let mal=0;
  const cmp=(nombre,a,c)=>{
    const A=JSON.stringify(a), C=JSON.stringify(c);
    if(A===C) console.log('  ✅ '+nombre+'  '+A);
    else { mal++; console.log('  ❌ '+nombre+'\n       vieja: '+A+'\n       nueva: '+C); }
  };
  cmp('totales de las 2 compras', viejo.totales, nuevo.totales);
  cmp('producto 1 (stock/costo)', viejo.p1, nuevo.p1);
  cmp('producto 2 (stock/costo)', viejo.p2, nuevo.p2);
  cmp('lo que debe a suplidores', viejo.porPagar, nuevo.porPagar);
  cmp('inventario al costo', viejo.invInvertido, nuevo.invInvertido);

  console.log('\n'+(mal? '❌ '+mal+' diferencia(s)' : '✅ SIN CAMBIOS: la app se comporta igual que antes'));
  await b.close();
  process.exit(mal?1:0);
})();
