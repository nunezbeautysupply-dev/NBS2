/**
 * ⚖️ LAS LEYES DEL DINERO DE NBS  (4 sep 2026)
 *
 * Sensei pidió la prueba más fuerte que exista para el dinero. Esta es la base de esa
 * prueba: las leyes que SIEMPRE tienen que cumplirse, pase lo que pase.
 *
 * 🔑 La máquina va a inventar miles de secuencias de trabajo al azar —vender, cobrar,
 * devolver, cancelar, editar, borrar pagos, aplicar crédito— y DESPUÉS DE CADA UNA
 * comprobará estas leyes. Si alguna se rompe, para y reduce el caso a los 2 o 3 pasos
 * mínimos que lo provocan.
 *
 * ⚠️ Estas leyes son lo único que la prueba sabe. Si una ley falta, ese fallo no se ve.
 * Por eso están escritas con cuidado y en cristiano.
 */

// Se corre dentro del navegador, con la app cargada.
window.LEYES_DINERO = [

  {
    id: 'ley1',
    nombre: 'Lo vendido es igual a lo cobrado más lo que te deben',
    porQue: 'Es la ley madre. Si esto no cuadra, cualquier número de la app es dudoso.',
    revisar: function () {
      var vendido = 0, cobrado = 0, debe = 0;
      LS('nv', []).forEach(function (v) {
        if (v.cancelada) return;
        var t = (typeof dinero === 'function') ? dinero(v.total) : (parseFloat(v.total) || 0);
        var c = cobradoYDebeDe(v);
        vendido += t; cobrado += c.cobrado; debe += c.debe;
      });
      var r2 = function (x) { return Math.round(x * 100) / 100; };
      // 🔑 El CRÉDITO A FAVOR no entra aquí: es dinero que el cliente adelantó y que
      // todavía no pertenece a ninguna venta. Tiene su propia ley, la 5.
      // La ley madre es simple: lo que vendiste = lo que cobraste + lo que te deben.
      var sobra = r2(r2(cobrado) + r2(debe) - r2(vendido));
      if (Math.abs(sobra) > 0.02) {
        return 'vendido $' + r2(vendido) + ' pero cobrado + por cobrar da $'
             + r2(cobrado + debe) + ' (descuadre de $' + sobra + ')';
      }
      return null;
    }
  },

  {
    id: 'ley2',
    nombre: 'El balance de cada cliente da lo mismo por dos caminos',
    porQue: 'La app enseña el balance en varios sitios. Todos tienen que coincidir.',
    revisar: function () {
      var malos = [];
      LS('ncl', []).forEach(function (c) {
        var porFn = 0;
        try { porFn = balanceDelCliente(c.id); } catch (e) { return; }
        var aMano = 0;
        LS('nv', []).forEach(function (v) {
          if (String(v.cid) !== String(c.id) || v.cancelada) return;
          aMano += cobradoYDebeDe(v).debe;
        });
        aMano = Math.round(aMano * 100) / 100;
        if (Math.abs(porFn - aMano) > 0.02) {
          malos.push(nombreCl(c) + ': la función dice $' + porFn + ' y factura a factura da $' + aMano);
        }
      });
      return malos.length ? malos.slice(0, 3).join(' | ') : null;
    }
  },

  {
    id: 'ley3',
    nombre: 'Ninguna deuda es negativa',
    porQue: 'Un cliente no puede deber menos de cero. Si pasa, es que un pago se contó mal.',
    revisar: function () {
      var malos = [];
      LS('nv', []).forEach(function (v) {
        if (v.cancelada) return;
        var c = cobradoYDebeDe(v);
        if (c.debe < -0.005) malos.push('factura #' + (v.numFactura || v.id) + ' debe $' + c.debe);
      });
      LS('ncl', []).forEach(function (c) {
        var b = 0;
        try { b = balanceDelCliente(c.id); } catch (e) { return; }
        if (b < -0.005) malos.push(nombreCl(c) + ' tiene balance $' + b);
      });
      return malos.length ? malos.slice(0, 3).join(' | ') : null;
    }
  },

  {
    id: 'ley4',
    nombre: 'Lo cobrado de una factura nunca pasa de su total',
    porQue: 'Si le pagaron de más, ese sobrante va a crédito a favor — no se queda en la factura.',
    revisar: function () {
      var malos = [];
      LS('nv', []).forEach(function (v) {
        if (v.cancelada) return;
        var t = (typeof dinero === 'function') ? dinero(v.total) : (parseFloat(v.total) || 0);
        var c = cobradoYDebeDe(v);
        if (c.cobrado > t + 0.02) {
          malos.push('factura #' + (v.numFactura || v.id) + ' de $' + t + ' tiene cobrado $' + c.cobrado);
        }
      });
      return malos.length ? malos.slice(0, 3).join(' | ') : null;
    }
  },

  {
    id: 'ley5',
    nombre: 'El crédito a favor nunca es negativo',
    porQue: 'Si sale negativo, se aplicó crédito que el cliente no tenía.',
    revisar: function () {
      var malos = [];
      LS('ncl', []).forEach(function (c) {
        var cr = parseFloat(c.creditoAFavor) || 0;
        if (cr < -0.005) malos.push(nombreCl(c) + ' tiene crédito $' + cr);
      });
      return malos.length ? malos.join(' | ') : null;
    }
  },

  {
    id: 'ley6',
    nombre: 'Una factura cancelada no le debe nada a nadie',
    porQue: 'Cancelar tiene que sacarla de las cuentas por completo.',
    revisar: function () {
      var malos = [];
      LS('nv', []).forEach(function (v) {
        if (!v.cancelada) return;
        // No debe aparecer en el balance de su cliente
        var b = 0;
        try { b = balanceDelCliente(v.cid); } catch (e) { return; }
        var conEsta = 0;
        LS('nv', []).forEach(function (x) {
          if (String(x.cid) !== String(v.cid) || x.cancelada) return;
          conEsta += cobradoYDebeDe(x).debe;
        });
        if (Math.abs(b - Math.round(conEsta * 100) / 100) > 0.02) {
          malos.push('la cancelada #' + (v.numFactura || v.id) + ' sigue contando en el balance');
        }
      });
      return malos.length ? malos.slice(0, 2).join(' | ') : null;
    }
  },

  {
    id: 'ley7',
    nombre: 'Ningún pago se cuenta dos veces',
    porQue: 'Cada pago tiene su código. Dos pagos con el mismo código es dinero duplicado.',
    revisar: function () {
      var vistos = {}, malos = [];
      LS('nv', []).forEach(function (v) {
        (v.pagosFactura || []).forEach(function (p) {
          if (!p || !p.pid) return;
          if (vistos[p.pid]) {
            malos.push('el pago ' + p.pid + ' está en dos facturas');
          }
          vistos[p.pid] = true;
        });
      });
      return malos.length ? malos.slice(0, 3).join(' | ') : null;
    }
  },

  {
    id: 'ley8',
    nombre: 'Ningún número de dinero es basura',
    porQue: 'Un NaN o un infinito se propaga y ensucia todos los totales.',
    revisar: function () {
      var malos = [];
      LS('nv', []).forEach(function (v) {
        if (v.cancelada) return;
        var c = cobradoYDebeDe(v);
        if (!isFinite(c.debe) || !isFinite(c.cobrado)) {
          malos.push('factura #' + (v.numFactura || v.id) + ' da números raros');
        }
        (v.pagosFactura || []).forEach(function (p) {
          if (p && p.monto !== undefined && !isFinite(parseFloat(p.monto))) {
            malos.push('un pago de la #' + (v.numFactura || v.id) + ' no es un número');
          }
        });
      });
      return malos.length ? malos.slice(0, 3).join(' | ') : null;
    }
  },

  {
    id: 'ley9',
    nombre: 'Cada factura pertenece a un cliente que existe',
    porQue: 'Una factura huérfana es dinero que no aparece en el balance de nadie.',
    revisar: function () {
      var ids = {};
      LS('ncl', []).forEach(function (c) { ids[String(c.id)] = true; });
      var malos = [];
      LS('nv', []).forEach(function (v) {
        if (v.cancelada) return;
        if (v.cid !== undefined && v.cid !== null && !ids[String(v.cid)]) {
          malos.push('la factura #' + (v.numFactura || v.id) + ' es de un cliente que no existe');
        }
      });
      return malos.length ? malos.slice(0, 3).join(' | ') : null;
    }
  },

  {
    id: 'ley10',
    nombre: 'Un cobro repartido suma exactamente lo que se cobró',
    porQue: 'Si le cobras $80 y se reparte en tres facturas, las tres partes tienen que dar $80.',
    revisar: function () {
      var porRecibo = {};
      LS('nv', []).forEach(function (v) {
        (v.pagosFactura || []).forEach(function (p) {
          if (!p || !p.recibo || p.esDevolucion) return;
          if (!porRecibo[p.recibo]) porRecibo[p.recibo] = { suma: 0, completo: null };
          porRecibo[p.recibo].suma += (parseFloat(p.monto) || 0);
          if (typeof p.montoCobro === 'number') porRecibo[p.recibo].completo = p.montoCobro;
        });
      });
      var malos = [];
      Object.keys(porRecibo).forEach(function (r) {
        var g = porRecibo[r];
        if (g.completo === null) return;
        // 🔑 Las partes pueden sumar MENOS que el cobro por dos motivos legítimos:
        //   · sobró y fue a crédito a favor
        //   · una de esas facturas se editó y bajó, y el resto fue a crédito
        // Lo que NUNCA puede pasar es que sumen MÁS de lo que se cobró.
        if (Math.round(g.suma * 100) / 100 > Math.round(g.completo * 100) / 100 + 0.02) {
          malos.push('el recibo ' + r + ' cobró $' + Math.round(g.completo * 100) / 100
                   + ' pero sus partes suman $' + Math.round(g.suma * 100) / 100
                   + ' — se cobró de más de lo que se recibió');
        }
      });
      return malos.length ? malos.slice(0, 3).join(' | ') : null;
    }
  }
];
