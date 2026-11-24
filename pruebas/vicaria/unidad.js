/* Pruebas de unidad de los módulos de vicaria/ (sin navegador). Se corren con: npm run prueba:vicaria
   Para agregar un grupo: grupo('nombre', () => { prueba('qué comprueba', () => { ... }); });
   Los grupos van antes del bloque «Resultado». */
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { cargar } = require('./cargar');

let fallos = 0;
let total = 0;
let cola = Promise.resolve(); // pruebas asíncronas: se esperan una tras otra, en orden

function grupo(nombre, definir) {
  console.log('\n' + nombre);
  definir();
}

function _aprobada(descripcion) {
  console.log('  ✓ ' + descripcion);
}

function _fallida(descripcion, e) {
  fallos++;
  console.log('  ✗ ' + descripcion + '\n      ' + String(e && e.message).split('\n').join('\n      '));
}

/* fn puede ser asíncrona (devolver una promesa): el resultado final espera a que termine. */
function prueba(descripcion, fn) {
  total++;
  let r;
  try {
    r = fn();
  } catch (e) {
    _fallida(descripcion, e);
    return;
  }
  if (r && typeof r.then === 'function') {
    cola = cola.then(() => r).then(() => _aprobada(descripcion), (e) => _fallida(descripcion, e));
  } else {
    _aprobada(descripcion);
  }
}


/* ---------- Configuraciones de prueba y carga con parroquia ---------- */

/* Las configuraciones viven aquí (San José todavía no tiene archivo de ejemplo: lo crea la Tarea 7). */
const CONFIG_CIUDAD_ARCE = {
  esquema: 1, version: 1, publicado: '2026-11-07T12:00:00Z', slug: 'ciudad-arce',
  nombre: 'Parroquia Inmaculada Concepción de María', nombreCorto: 'Inmaculada Concepción',
  lugar: 'Ciudad Arce, La Libertad',
  colores: { principal: '#1155a4', oscuro: '#0c3562' },
  logos: { blanco: { src: 'medios/logo-blanco.png', alt: 'Logo blanco de la Parroquia Inmaculada Concepción de María' } },
  fachada: { src: 'medios/fachada.jpg', alt: 'Fachada del templo parroquial de Ciudad Arce' },
  patrono: {
    nombre: 'Inmaculada Concepción de María', corto: 'Inmaculada',
    imagen: { src: 'medios/patrono.png', alt: 'Imagen de la Inmaculada Concepción' }
  },
  fiesta: { dia: 8, mes: 12, lema: 'TODA HERMOSA ERES, MARÍA' }
};
const CONFIG_SAN_JOSE = {
  esquema: 1, version: 1, publicado: '2026-11-07T12:00:00Z', slug: 'san-jose',
  nombre: 'Parroquia San José', lugar: 'Santa Tecla, La Libertad',
  colores: { principal: '#7a3b12', oscuro: '#4a2008' },
  logos: { blanco: { src: 'medios/logo-blanco.png', alt: 'Logo blanco de la Parroquia San José' } },
  fachada: { src: 'medios/fachada.jpg', alt: 'Fachada del templo de San José' },
  patrono: { nombre: 'San José', corto: 'San José' },
  fiesta: { dia: 19, mes: 3 }
};
const conFiesta = (base, dia, mes) => Object.assign({}, base, { fiesta: { dia, mes } });

/* cargarCon(archivos, almacen, config): carga parroquia.js primero y luego `archivos`, con la página en
   /<slug>/panel.html y `config` guardada como copia válida. Sin config (null): parroquia sin configuración (neutra). */
function cargarCon(archivos, almacen = {}, config = CONFIG_CIUDAD_ARCE, extras = {}) {
  const slug = config ? config.slug : 'ciudad-arce';
  const datos = Object.assign({}, almacen);
  if (config) datos['pev_' + slug + '_config_v1'] = JSON.stringify(config);
  return cargar(['parroquia.js'].concat(archivos), datos, Object.assign({ location: { pathname: '/' + slug + '/panel.html' } }, extras));
}

/* ---------- Grupos ---------- */

grupo('tipos', () => {
  let c;
  try {
    c = cargarCon(['tipos.js', 'comun.js']);
  } catch (e) {
    prueba('se pueden cargar tipos.js y comun.js', () => { throw e; });
    return;
  }
  const { TIPOS, ORDEN_TIPOS, ROTULOS, tipoDe, rellenar } = c;

  prueba('ORDEN_TIPOS tiene 11 claves y todas existen en TIPOS', () => {
    assert.equal(ORDEN_TIPOS.length, 11);
    for (const k of ORDEN_TIPOS) assert.ok(TIPOS[k], 'falta ' + k);
  });
  prueba('Hora Santa ofrece 5 rótulos y ninguno es lectura2', () => {
    assert.deepEqual(Array.from(TIPOS.horasanta.rotulos, (r) => r.id),
      ['guia', 'santisimo', 'lectura1', 'oracion', 'bendicion']);
    assert.ok(TIPOS.horasanta.rotulos.every((r) => r.base !== 'lectura2'));
  });
  prueba('Patronal de sector: sin cuenta, esquina fecha y datos sector/santo/fecha', () => {
    assert.equal(TIPOS.patronalsector.cuenta, false);
    assert.equal(TIPOS.patronalsector.esquina, 'fecha');
    for (const d of ['sector', 'santo', 'fecha']) assert.ok(TIPOS.patronalsector.datos.includes(d), d);
  });
  prueba('tipoDe con una clave desconocida devuelve el dominical', () => {
    assert.equal(tipoDe({ tipo: 'noexiste' }), TIPOS.dominical);
  });
  prueba('rellenar: {constructor} y {toString} no toman nada heredado de Object', () => {
    for (const clave of ['constructor', 'toString', 'hasOwnProperty', '__proto__', 'valueOf']) {
      const r = rellenar('A {' + clave + '} B', { tipo: 'otros' });
      assert.equal(r, 'A [' + clave + '] B', clave);
    }
  });
  prueba('rellenar reemplaza {sector}', () => {
    assert.equal(rellenar('MISA PATRONAL · {sector}', { tipo: 'patronalsector', sector: 'SECTOR 8' }),
      'MISA PATRONAL · SECTOR 8');
  });
  prueba('rellenar usa novenaDia en la novena', () => {
    assert.equal(rellenar('NOVENA · DÍA {dia}', { tipo: 'novena', novenaDia: 3 }), 'NOVENA · DÍA 3');
  });
  prueba('rellenar usa prenovenaDia en la prenovena', () => {
    assert.equal(rellenar('DÍA {dia}', { tipo: 'prenovena', prenovenaDia: 2, novenaDia: 7 }), 'DÍA 2');
  });
  prueba('rellenar con dato vacío pone [santo]', () => {
    assert.equal(rellenar('{santo}', { tipo: 'otros', santo: '' }), '[santo]');
  });
  prueba('rellenar nunca deja una llave sin reemplazar', () => {
    const r = rellenar('{dia} {santo} {sector} {lugar} {evento} {anio} {otra}', { tipo: 'otros' });
    assert.ok(!/[{}]/.test(r), r);
  });
  prueba('cada uso tiene un base existente en ROTULOS y los id no se repiten', () => {
    for (const k of ORDEN_TIPOS) {
      const ids = TIPOS[k].rotulos.map((r) => r.id);
      assert.equal(new Set(ids).size, ids.length, 'id repetido en ' + k);
      for (const r of TIPOS[k].rotulos) assert.ok(ROTULOS[r.base], k + ': base ' + r.base);
    }
  });
  prueba('ROTULOS tiene las 10 bases', () => {
    assert.deepEqual(Object.keys(ROTULOS).sort(),
      ['evangelio', 'lectura1', 'lectura2', 'libre', 'lugar', 'oracion', 'persona', 'rosario', 'salmo', 'santisimo']);
  });
  prueba('se conservan los valores fijos del brief', () => {
    assert.equal(TIPOS.patronalsector.cursiva, 'Ruega por nosotros, {santo}');
    assert.equal(TIPOS.horasanta.esquinaTexto, 'JUEVES\nEUCARÍSTICO');
    assert.equal(TIPOS.procesion.tituloInicio, 'En breve\nsalimos');
    assert.equal(TIPOS.procesion.salida, true);
    assert.equal(TIPOS.dominical.cuenta.desdeDias, 60);
    for (const k of ['otros', 'prenovena', 'novena']) {
      assert.equal(TIPOS[k].cuenta.hasta, '12-08');
      assert.ok(!('desdeDias' in TIPOS[k].cuenta), k);
    }
  });
  prueba('todo tipo define todos los campos', () => {
    const campos = ['nombre', 'descripcion', 'titulo', 'ceja', 'cursiva', 'franja', 'graciasCursiva',
      'graciasPie', 'barra', 'imagen', 'esquina', 'esquinaTexto', 'cuenta', 'rotulos', 'datos',
      'nombrePanel', 'textosTipo'];
    for (const k of ORDEN_TIPOS) for (const f of campos) assert.ok(f in TIPOS[k], k + '.' + f);
  });

  /* ---------- Huecos de la parroquia (Tarea 4) ---------- */
  const textosDe = (obj, acc = []) => {
    if (typeof obj === 'string') acc.push(obj);
    else if (Array.isArray(obj)) obj.forEach((x) => textosDe(x, acc));
    else if (obj && typeof obj === 'object') Object.keys(obj).forEach((k) => textosDe(obj[k], acc));
    return acc;
  };
  const conTipos = (config) => cargarCon(['tipos.js', 'comun.js'], {}, config);
  const dia = (a, m, d) => new Date(a, m - 1, d);

  prueba('rellenar {fiesta}: «8 de diciembre» en Ciudad Arce y «19 de marzo» en San José', () => {
    assert.equal(rellenar('{fiesta}', {}), '8 de diciembre');
    assert.equal(conTipos(CONFIG_SAN_JOSE).rellenar('{fiesta}', {}), '19 de marzo');
  });
  prueba('rellenar {fiestaMayus}, {patrono}, {patronoCorto}, {parroquia} y {lema}', () => {
    assert.equal(rellenar('{fiestaMayus}', {}), '8 DE DICIEMBRE');
    assert.equal(rellenar('{patrono}', {}), 'Inmaculada Concepción de María');
    assert.equal(rellenar('{patronoCorto}', {}), 'Inmaculada');
    assert.equal(rellenar('{parroquia}', {}), 'Parroquia Inmaculada Concepción de María');
    assert.equal(rellenar('{lema}', {}), 'TODA HERMOSA ERES, MARÍA');
  });
  prueba('rellenar: un hueco de la parroquia vacío da vacío y uno de la transmisión sigue dando [santo]', () => {
    const sj = conTipos(CONFIG_SAN_JOSE);
    assert.equal(sj.rellenar('a{lema}b', {}), 'ab');
    assert.equal(sj.rellenar('{santo}', { santo: '' }), '[santo]');
    const neutra = conTipos(null);
    for (const h of ['fiesta', 'fiestaMayus', 'patrono', 'patronoCorto', 'parroquia', 'lema']) {
      assert.equal(neutra.rellenar('{' + h + '}', {}), '', h);
    }
  });
  prueba('sin fiesta.lema ningún texto de ningún tipo trae [lema], «» ni llaves', () => {
    const sj = conTipos(CONFIG_SAN_JOSE);
    for (const k of sj.ORDEN_TIPOS) {
      for (const t of textosDe(sj.TIPOS[k])) {
        const r = sj.rellenar(t, {});
        assert.ok(!/\[lema\]|«\s*»|[{}]/.test(r), k + ': ' + r);
      }
    }
  });
  prueba('con San José ningún texto de ningún tipo nombra Inmaculada, Ciudad Arce, diciembre, María ni «Patrona»', () => {
    const sj = conTipos(CONFIG_SAN_JOSE);
    for (const k of sj.ORDEN_TIPOS) {
      for (const t of textosDe(sj.TIPOS[k])) {
        const r = sj.rellenar(t, { tipo: k, santo: 'San Juan', sector: 'S8', lugar: 'L', evento: 'E', prenovenaDia: 1, novenaDia: 1 });
        assert.ok(!/Inmaculada|Ciudad Arce|diciembre|\bMar[ií]a\b|\bPatrona\b/i.test(r), k + ': ' + r);
      }
    }
  });
  prueba('con Ciudad Arce los textos fijos de antes salen de los huecos', () => {
    assert.equal(rellenar(TIPOS.dominical.barra, {}), 'Camino al 8 de diciembre');
    assert.equal(rellenar(TIPOS.dominical.graciasPie, {}), 'CAMINO AL 8 DE DICIEMBRE');
    assert.equal(rellenar(TIPOS.semana.franja, {}), '«TODA HERMOSA ERES, MARÍA»');
    assert.equal(rellenar(TIPOS.patronal.ceja, {}).toUpperCase(), 'SOLEMNIDAD DE INMACULADA CONCEPCIÓN DE MARÍA');
  });
  prueba('{anio} usa la fiesta de la parroquia: si este año ya pasó, el siguiente', () => {
    const r = conTipos(conFiesta(CONFIG_SAN_JOSE, 6, 1));
    assert.equal(r.rellenar('{anio}', {}, dia(2026, 12, 31)), '2027');
    assert.equal(r.rellenar('{anio}', {}, dia(2026, 1, 5)), '2026');
    assert.equal(r.rellenar('{anio}', {}, dia(2026, 1, 6)), '2026');
    assert.equal(r.rellenar('{anio}', {}, dia(2026, 1, 7)), '2027');
  });
  prueba('las cuentas cuentan hasta la fiesta de la parroquia, evaluada al usarse', () => {
    const sj = conTipos(CONFIG_SAN_JOSE);
    for (const k of ['dominical', 'otros', 'prenovena', 'novena']) assert.equal(sj.TIPOS[k].cuenta.hasta, '03-19', k);
    assert.equal(TIPOS.novena.cuenta.hasta, '12-08');
    vm.runInContext('PARROQUIA = ' + JSON.stringify(CONFIG_SAN_JOSE), c);   // la configuración llega después de cargar tipos.js
    assert.equal(TIPOS.novena.cuenta.hasta, '03-19');
  });
  prueba('la ventana de la cuenta dominical sale de fiesta.cuentaDesdeDias (60 por defecto)', () => {
    assert.equal(conTipos(CONFIG_CIUDAD_ARCE).TIPOS.dominical.cuenta.desdeDias, 60);
    const f = Object.assign({}, CONFIG_CIUDAD_ARCE, { fiesta: { dia: 8, mes: 12, cuentaDesdeDias: 30 } });
    assert.equal(conTipos(f).TIPOS.dominical.cuenta.desdeDias, 30);
  });
  prueba('las 11 claves de ORDEN_TIPOS siguen y las 5 de la fiesta existen', () => {
    assert.deepEqual(Array.from(ORDEN_TIPOS), ['dominical', 'semana', 'horasanta', 'sector', 'patronalsector',
      'procesion', 'otros', 'prenovena', 'novena', 'patronal', 'evento']);
    for (const k of ['dominical', 'otros', 'prenovena', 'novena', 'patronal']) assert.ok(TIPOS[k], k);
  });
  prueba('ningún tipo usa las imágenes virgen-*: la del patrono es «patrono»', () => {
    for (const k of ORDEN_TIPOS) assert.ok(!/^virgen-/.test(TIPOS[k].imagen), k);
    for (const k of ['dominical', 'semana', 'prenovena', 'novena', 'patronal']) assert.equal(TIPOS[k].imagen, 'patrono', k);
  });
});

/* Textos que las 5 transmisiones heredadas ya mostraban antes de leerlos del catálogo: no deben cambiar.
   Con la configuración de Ciudad Arce. Cambian a propósito (ahora salen de la configuración): marca,
   portada_titulo, portada_sub y capa_logo; y, por pasar a huecos (Tarea 4), la cursiva de «otros» y de la
   novena («de la Inmaculada Concepción» -> «de {patrono}», sin «la» para que sirva a San José) y la ceja de
   la patronal («DE LA INMACULADA» -> «DE {patrono}»), y (Tarea 7) portada_cursiva («en honor a la» -> «en honor a»); el resto es idéntico. */
grupo('textos heredados', () => {
  let c;
  try {
    c = cargarCon(['tipos.js', 'comun.js']);
  } catch (e) {
    prueba('se pueden cargar tipos.js y comun.js', () => { throw e; });
    return;
  }
  const hoy = new Date();
  const anio = hoy.getFullYear() + (hoy.getMonth() === 11 && hoy.getDate() > 8 ? 1 : 0);
  const comunes = {
    marca: 'Parroquia Inmaculada Concepción de María\nCiudad Arce, La Libertad',
    inicio_titulo: 'En breve\ncomenzamos',
    portada_ceja: 'FIESTAS PATRONALES ' + anio,
    portada_cursiva: 'en honor a',   // obs/ decía «en honor a la» (Tarea 7: sin «la», para que sirva a San José)
    portada_titulo: 'Inmaculada Concepción de María',
    portada_fecha: 'DE DICIEMBRE',
    portada_sub: 'Solemnidad de nuestro patrono',
    gracias_titulo: '¡Gracias por\nacompañarnos!',
    gracias_cursiva: 'Nos vemos en la próxima\ntransmisión',
    avisos_sub: 'PARROQUIA INMACULADA CONCEPCIÓN DE MARÍA',
    avisos_titulo: 'Avisos',
    horarios_titulo: 'Horarios de misa',   // clave nueva de la 1b (vista horarios); no cambia ninguna de la 1a
    capa_logo: 'Parroquia Inmaculada Concepción de María\nCiudad Arce, La Libertad',
    k_lectura1: 'PRIMERA LECTURA',
    k_salmo: 'SALMO RESPONSORIAL',
    k_lectura2: 'SEGUNDA LECTURA',
    k_evangelio: 'SANTO EVANGELIO',
    k_rosario: 'ORACIÓN',
    t_rosario: 'Santo Rosario',
    prod_ceja: 'UNA PRODUCCIÓN DE',   // claves nuevas de la pantalla final, con el texto que ya tenía produccion.html
    prod_nombre: 'Comunicaciones'
  };
  const cuenta = 'días para nuestra\nFiesta Patronal';
  const esperado = {
    dominical: { titulo: 'SANTA MISA DOMINICAL', ceja: 'CAMINO A NUESTRAS FIESTAS PATRONALES', cursiva: '¡Ya se acerca\nnuestra fiesta patronal!', pie: 'CAMINO AL 8 DE DICIEMBRE', barra: 'Camino al 8 de diciembre', cuenta },
    otros: { titulo: 'MISA EN HONOR A SAN JOSÉ', ceja: 'CAMINO A NUESTRA FIESTA PATRONAL', cursiva: 'rumbo a la fiesta de\nInmaculada Concepción de María', pie: 'CAMINO AL 8 DE DICIEMBRE', barra: 'Camino al 8 de diciembre', cuenta },
    prenovena: { titulo: 'PRENOVENA · DÍA 2', ceja: 'FIESTAS PATRONALES ' + anio, cursiva: 'preparándonos para celebrar\nnuestra fiesta patronal', pie: 'CAMINO AL 8 DE DICIEMBRE', barra: 'Fiestas Patronales ' + anio, cuenta },
    novena: { titulo: 'NOVENA · DÍA 3', ceja: 'FIESTAS PATRONALES ' + anio, cursiva: 'en honor a\nInmaculada Concepción de María', pie: 'CAMINO AL 8 DE DICIEMBRE', barra: 'Fiestas Patronales ' + anio, cuenta },
    // La cuenta de la patronal nunca se muestra, así que su texto no forma parte de lo heredado.
    patronal: { titulo: 'SANTA MISA PATRONAL', ceja: 'SOLEMNIDAD DE INMACULADA CONCEPCIÓN DE MARÍA', cursiva: '¡Felices Fiestas Patronales!', pie: '¡FELICES FIESTAS PATRONALES!', barra: '¡Felices Fiestas Patronales!', cuenta: undefined }
  };
  for (const tipo of Object.keys(esperado)) {
    const e = esperado[tipo];
    prueba(tipo + ': tituloCelebracion y textosBase no cambian', () => {
      const s = Object.assign({}, c.PREDETERMINADO, { tipo, santo: 'San José', prenovenaDia: 2, novenaDia: 3, diasManual: '5' });
      assert.equal(c.tituloCelebracion(s), e.titulo);
      const obtenido = Object.assign({}, c.textosBase(s));
      const previsto = Object.assign({}, comunes, {
        inicio_pildora: e.titulo, inicio_ceja: e.ceja, inicio_cursiva: e.cursiva, inicio_cuenta: e.cuenta,
        gracias_pildora: e.titulo, gracias_ceja: e.pie, barra_y: e.barra
      });
      if (e.cuenta === undefined) { delete obtenido.inicio_cuenta; delete previsto.inicio_cuenta; }
      // franja es una clave nueva (la frase por defecto); no existía antes.
      delete obtenido.franja;
      assert.deepEqual(obtenido, previsto);
    });
  }
  prueba('con un solo día que falta, la cuenta dice «día» en singular', () => {
    const s = Object.assign({}, c.PREDETERMINADO, { tipo: 'otros', santo: 'San José', diasManual: '1' });
    assert.equal(c.textosBase(s).inicio_cuenta, 'día para nuestra\nFiesta Patronal');
  });
});

grupo('estado', () => {
  let c;
  try {
    c = cargarCon(['tipos.js', 'comun.js'], {
      'pev_ciudad-arce_estado_v1': '{"tipo":"novena","virgen":"c","rotulo":"celebrante"}'
    });
  } catch (e) {
    prueba('se pueden cargar tipos.js y comun.js', () => { throw e; });
    return;
  }

  prueba('leerEstado migra virgen y celebrante al formato nuevo', () => {
    const s = c.leerEstado();
    assert.equal(s.imagen, 'patrono');
    assert.equal(s.rotulo, 'persona');
    assert.equal(s.tipo, 'novena');
    assert.ok(!('virgen' in s));
  });
  prueba('leerEstado migra mostrarCuenta:false a cuenta:false', () => {
    const m = cargarCon(['tipos.js', 'comun.js'], { 'pev_ciudad-arce_estado_v1': '{"mostrarCuenta":false}' });
    assert.equal(m.leerEstado().cuenta, false);
  });
  prueba('leerEstado sin nada guardado devuelve los valores nuevos por defecto', () => {
    const m = cargarCon(['tipos.js', 'comun.js']);
    const s = m.leerEstado();
    assert.equal(s.cuenta, null);
    assert.equal(s.imagen, '');
    assert.deepEqual(Object.assign({}, s.rotulosTexto), {});
    for (const k of ['sector', 'fecha', 'lugar', 'evento', 'esquina', 'esquinaTexto']) assert.equal(s[k], '', k);
  });
  prueba('mostrarCuenta:false se migra una sola vez (ida y vuelta por guardar)', () => {
    const m = cargarCon(['tipos.js', 'comun.js'], { 'pev_ciudad-arce_estado_v1': '{"mostrarCuenta":false,"cuenta":null}' });
    let s = m.leerEstado();
    assert.equal(s.cuenta, false);
    m.guardarEstado(s);
    s = m.leerEstado();
    s.cuenta = null;
    m.guardarEstado(s);
    assert.equal(m.leerEstado().cuenta, null);
  });
  prueba('imagenDe del logo apunta al logo blanco de la configuración', () => {
    assert.equal(c.imagenDe({ tipo: 'evento', imagen: '' }), 'medios/logo-blanco.png');
  });
  prueba('la frase antigua por defecto se migra a vacío y cada tipo muestra su franja', () => {
    const m = cargarCon(['tipos.js', 'comun.js'], { 'pev_ciudad-arce_estado_v1': '{"tipo":"novena","frase":"«TODA HERMOSA ERES, MARÍA»"}' });
    const s = m.leerEstado();
    assert.equal(s.frase, '');
    assert.equal(m.tx(s, 'franja'), '«TODA HERMOSA ERES, MARÍA»');
    for (const t of ['dominical', 'otros', 'prenovena', 'novena', 'patronal']) {
      assert.equal(m.tx(Object.assign({}, s, { tipo: t }), 'franja'), '«TODA HERMOSA ERES, MARÍA»', t);
    }
    assert.equal(m.tx(Object.assign({}, s, { tipo: 'horasanta' }), 'franja'), '«BENDITO Y ALABADO SEA JESÚS SACRAMENTADO»');
    assert.equal(m.tx(Object.assign({}, s, { frase: 'Mi frase' }), 'franja'), 'Mi frase');
  });
  prueba('imagenDe usa la imagen del tipo y respeta la elegida', () => {
    assert.equal(c.imagenDe({ tipo: 'horasanta', imagen: '' }), 'img/custodia.png');
    assert.equal(c.imagenDe({ tipo: 'semana', imagen: '' }), 'medios/patrono.png');   // el tipo usa «patrono»
    assert.equal(c.imagenDe({ tipo: 'sector', imagen: '' }), 'medios/fachada.jpg');
    assert.equal(c.imagenDe({ tipo: 'novena', imagen: 'patrono' }), 'medios/patrono.png');
    assert.equal(c.imagenDe({ tipo: 'novena', imagen: 'virgen-b' }), 'medios/fachada.jpg');
    assert.equal(c.imagenDe({ tipo: 'semana', imagen: 'fachada' }), 'medios/fachada.jpg');
  });
  prueba('esquinaDe: fecha del sector, leída como fecha local', () => {
    assert.deepEqual(Object.assign({}, c.esquinaDe({ tipo: 'patronalsector', fecha: '2026-11-27' })),
      { num: '27', txt: 'DE\nNOVIEMBRE' });
    assert.deepEqual(Object.assign({}, c.esquinaDe({ tipo: 'patronalsector', fecha: '2026-12-01' })),
      { num: '1', txt: 'DE\nDICIEMBRE' });
  });
  prueba('esquinaDe: fecha vacía usa la de hoy', () => {
    assert.deepEqual(Object.assign({}, c.esquinaDe({ tipo: 'patronalsector', fecha: '' }, new Date(2026, 10, 8))),
      { num: '8', txt: 'DE\nNOVIEMBRE' });
  });
  prueba('esquinaDe: hoy muestra día de la semana y mes en mayúsculas', () => {
    assert.deepEqual(Object.assign({}, c.esquinaDe({ tipo: 'dominical' }, new Date(2026, 10, 8))),
      { num: '8', txt: 'DOMINGO\nNOVIEMBRE' });
    assert.deepEqual(Object.assign({}, c.esquinaDe({ tipo: 'semana' }, new Date(2026, 10, 4))),
      { num: '4', txt: 'MIÉRCOLES\nNOVIEMBRE' });
  });
  prueba('esquinaDe: fiesta es el 8 de diciembre', () => {
    assert.deepEqual(Object.assign({}, c.esquinaDe({ tipo: 'novena' })), { num: '8', txt: 'DE\nDICIEMBRE' });
  });
  prueba('esquinaDe: texto usa esquinaTexto del estado o el del tipo, con los datos rellenados', () => {
    assert.deepEqual(Object.assign({}, c.esquinaDe({ tipo: 'horasanta' })), { num: '', txt: 'JUEVES\nEUCARÍSTICO' });
    assert.deepEqual(Object.assign({}, c.esquinaDe({ tipo: 'sector', sector: 'SECTOR 8' })), { num: '', txt: 'SECTOR 8' });
    assert.deepEqual(Object.assign({}, c.esquinaDe({ tipo: 'horasanta', esquinaTexto: 'JUEVES' })), { num: '', txt: 'JUEVES' });
  });
  prueba('esquinaDe: s.esquina fuerza el modo de la esquina', () => {
    assert.deepEqual(Object.assign({}, c.esquinaDe({ tipo: 'novena', esquina: 'fiesta' })), { num: '8', txt: 'DE\nDICIEMBRE' });
    assert.equal(c.esquinaDe({ tipo: 'novena', esquina: 'texto', esquinaTexto: 'HOLA' }).txt, 'HOLA');
  });
  prueba('diasHasta cuenta hasta la próxima ocurrencia', () => {
    assert.equal(c.diasHasta('12-08', new Date(2026, 11, 9)), 364);
    assert.equal(c.diasHasta('12-08', new Date(2026, 11, 8)), 0);
    assert.equal(c.diasHasta('12-08', new Date(2026, 10, 8)), 30);
  });
  prueba('diasFaltan respeta diasManual y acepta hoy', () => {
    assert.equal(c.diasFaltan({ tipo: 'novena', diasManual: '7' }, new Date(2026, 10, 8)), 7);
    assert.equal(c.diasFaltan({ tipo: 'novena', diasManual: '' }, new Date(2026, 10, 8)), 30);
  });
  prueba('cuentaVisible: con s.cuenta true se salta la ventana desdeDias (pero no si ya pasó)', () => {
    assert.equal(c.cuentaVisible({ tipo: 'dominical', cuenta: true, diasManual: '' }, new Date(2026, 6, 1)), true);
    assert.equal(c.cuentaVisible({ tipo: 'dominical', cuenta: null, diasManual: '' }, new Date(2026, 6, 1)), false);
    assert.equal(c.cuentaVisible({ tipo: 'dominical', cuenta: true, diasManual: '' }, new Date(2026, 11, 8)), false);
  });
  prueba('normalizarEstado devuelve copias: mutarlas no cambia PREDETERMINADO', () => {
    const antes = JSON.stringify(c.PREDETERMINADO);
    const s = c.normalizarEstado({});
    s.avisos[0].a = 'cambiado'; s.avisos.push({ a: 'x', f: 'y' });
    s.textos.k_rosario = 'z'; s.rotulosTexto.guia = { t: 'w' };
    assert.equal(JSON.stringify(c.PREDETERMINADO), antes);
    const g = c.normalizarEstado({ avisos: [{ a: 'p', f: 'q' }] });
    assert.equal(g.avisos.length, 4);
  });
  prueba('cuentaVisible: depende del tipo, de s.cuenta y de los días', () => {
    assert.equal(c.cuentaVisible({ tipo: 'patronalsector' }), false);
    assert.equal(c.cuentaVisible({ tipo: 'dominical', diasManual: '' }, new Date(2026, 10, 8)), true);
    assert.equal(c.cuentaVisible({ tipo: 'dominical', diasManual: '' }, new Date(2026, 6, 1)), false);
    assert.equal(c.cuentaVisible({ tipo: 'novena', diasManual: '' }, new Date(2026, 6, 1)), true);
    assert.equal(c.cuentaVisible({ tipo: 'novena', cuenta: false, diasManual: '' }, new Date(2026, 10, 8)), false);
    assert.equal(c.cuentaVisible({ tipo: 'semana', cuenta: true, diasManual: '' }, new Date(2026, 10, 8)), true);
    assert.equal(c.cuentaVisible({ tipo: 'novena', diasManual: '' }, new Date(2026, 11, 8)), false);
  });
  prueba('tituloCelebracion rellena los datos', () => {
    assert.equal(c.tituloCelebracion({ tipo: 'patronalsector', sector: 'SECTOR 8' }), 'MISA PATRONAL · SECTOR 8');
  });
  prueba('tituloCelebracion sigue en mayúsculas aunque el dato venga en minúsculas', () => {
    assert.equal(c.tituloCelebracion({ tipo: 'otros', santo: 'San José' }), 'MISA EN HONOR A SAN JOSÉ');
    assert.equal(c.tituloCelebracion({ tipo: 'evento', evento: 'Retiro de jóvenes' }), 'RETIRO DE JÓVENES');
  });
  prueba('textosBase: franja es la del tipo y s.frase gana cuando está escrita', () => {
    assert.equal(c.textosBase({ tipo: 'horasanta', frase: '' }).franja, '«BENDITO Y ALABADO SEA JESÚS SACRAMENTADO»');
    assert.equal(c.textosBase({ tipo: 'horasanta', frase: 'Hola' }).franja, 'Hola');
  });
  prueba('textosBase: la procesión dice «En breve salimos»', () => {
    assert.equal(c.textosBase({ tipo: 'procesion' }).inicio_titulo, 'En breve\nsalimos');
  });
  prueba('textosBase: un tipo sin cuenta no deja llaves sin reemplazar', () => {
    const t = c.textosBase({ tipo: 'patronalsector', sector: 'SECTOR 8' });
    for (const k of Object.keys(t)) assert.ok(!/[{}]/.test(t[k]), k + ': ' + t[k]);
  });
});

grupo('rotulos', () => {
  let c;
  try {
    c = cargarCon(['tipos.js', 'comun.js']);
  } catch (e) {
    prueba('se pueden cargar tipos.js y comun.js', () => { throw e; });
    return;
  }
  const ids = (s) => Array.from(c.rotulosDe(s), (r) => r.id);
  const uso = (s, id) => c.rotulosDe(s).find((r) => r.id === id);
  prueba('el orden de los rótulos es el del tipo', () => {
    assert.deepEqual(ids({ tipo: 'dominical' }), ['persona', 'lectura1', 'salmo', 'lectura2', 'evangelio']);
    assert.deepEqual(ids({ tipo: 'semana' }), ['persona', 'lectura1', 'salmo', 'evangelio']);
  });
  prueba('Hora Santa: la guía usa la ceja del uso y su propio nombre (no el del celebrante)', () => {
    const g = c.rotulosDe({ tipo: 'horasanta', celebrante: 'Pbro. X', rotulosTexto: { guia: { t: 'Juan' } } })[0];
    assert.equal(g.texto.k, 'GUÍA');
    assert.equal(g.texto.t, 'Juan');
  });
  prueba('procesión: el uso «persona» (Guía) lleva la ceja GUÍA, no CELEBRANTE', () => {
    assert.equal(uso({ tipo: 'procesion', celebrante: 'Ana' }, 'persona').texto.k, 'GUÍA');
    assert.equal(uso({ tipo: 'procesion', celebrante: 'Ana', rotulosTexto: { persona: { t: 'Beto' } } }, 'persona').texto.t, 'Beto');
  });
  prueba('persona con ceja propia (guía): el nombre sale de rotulosTexto, nunca de s.celebrante', () => {
    const s = { tipo: 'horasanta', celebrante: 'Pbro. Héctor', rotulosTexto: {} };
    assert.equal(uso(s, 'guia').texto.t, '');
    assert.equal(uso(Object.assign({}, s, { rotulosTexto: { guia: { t: 'Marta' } } }), 'guia').texto.t, 'Marta');
    assert.equal(uso({ tipo: 'procesion', celebrante: 'Pbro. Héctor' }, 'persona').texto.t, '');
  });
  prueba('persona sin ceja propia (dominical): sigue leyendo s.celebrante y s.celebranteRol', () => {
    const s = { tipo: 'dominical', celebrante: 'Pbro. Héctor', celebranteRol: 'PÁRROCO', rotulosTexto: { guia: { t: 'Marta' } } };
    assert.equal(uso(s, 'persona').texto.t, 'Pbro. Héctor');
    assert.equal(uso(s, 'persona').texto.k, 'PÁRROCO');
  });
  prueba('Santo Rosario: prenovena, novena y patronal lo llevan al final; dominical y otros no', () => {
    for (const k of ['prenovena', 'novena', 'patronal']) {
      const r = c.TIPOS[k].rotulos;
      assert.equal(r.length, 6, k);
      assert.deepEqual(Object.assign({}, r[5]), { id: 'rosario', base: 'rosario', nombre: 'Santo Rosario' }, k);
    }
    for (const k of ['dominical', 'otros']) assert.ok(!c.TIPOS[k].rotulos.some((r) => r.id === 'rosario'), k);
    assert.equal(c.TIPOS.dominical.rotulos.length, 5);
  });
  prueba('Hora Santa: la lectura única sale con ceja LECTURA; en la misa sigue PRIMERA LECTURA', () => {
    assert.equal(uso({ tipo: 'horasanta', rotulosTexto: {} }, 'lectura1').texto.k, 'LECTURA');
    assert.equal(uso({ tipo: 'dominical' }, 'lectura1').texto.k, 'PRIMERA LECTURA');
    assert.equal(uso({ tipo: 'dominical' }, 'lectura2').texto.k, 'SEGUNDA LECTURA');
    assert.equal(uso({ tipo: 'horasanta', rotulosTexto: { lectura1: { k: 'MI LECTURA' } } }, 'lectura1').texto.k, 'MI LECTURA');
  });
  prueba('portada: solo prenovena, novena, patronal y evento tienen portada propia', () => {
    const con = Object.keys(c.TIPOS).filter((k) => c.TIPOS[k].portada).sort();
    assert.deepEqual(con, ['evento', 'novena', 'patronal', 'prenovena']);
    assert.equal(c.TIPOS.evento.portada, 'evento');
  });
  prueba('Hora Santa: el último uso es la bendición con su texto y ceja', () => {
    const rs = c.rotulosDe({ tipo: 'horasanta', rotulosTexto: {} });
    const b = rs[rs.length - 1];
    assert.equal(b.texto.t, 'Bendición con el Santísimo');
    assert.equal(b.texto.k, 'BENDICIÓN');
  });
  prueba('persona: celebranteRol gana a la ceja del uso y rotulosTexto gana a todo', () => {
    assert.equal(uso({ tipo: 'dominical', celebranteRol: 'PÁRROCO' }, 'persona').texto.k, 'PÁRROCO');
    assert.equal(uso({ tipo: 'dominical' }, 'persona').texto.k, 'CELEBRANTE');
    assert.equal(uso({ tipo: 'horasanta', celebranteRol: 'PÁRROCO' }, 'guia').texto.k, 'GUÍA');
    assert.equal(uso({ tipo: 'horasanta', rotulosTexto: { guia: { k: 'DIÁCONO' } } }, 'guia').texto.k, 'DIÁCONO');
  });
  prueba('salmo: usa salmoResp, suma salmoNum en mayúsculas a la ceja y es chico', () => {
    const r = uso({ tipo: 'dominical', salmoNum: 'Sal 121', salmoResp: 'Vamos' }, 'salmo');
    assert.equal(r.texto.k, 'SALMO RESPONSORIAL · SAL 121');
    assert.equal(r.texto.t, 'Vamos');
    assert.equal(r.texto.chico, true);
  });
  prueba('lecturas y evangelio salen de los campos del mismo nombre, con s = parroquia', () => {
    const s = { tipo: 'dominical', lectura1: 'Is 1', lectura2: 'Hb 2', evangelio: 'Mt 3', parroquia: 'Parroquia X' };
    assert.equal(uso(s, 'lectura1').texto.t, 'Is 1');
    assert.equal(uso(s, 'lectura2').texto.t, 'Hb 2');
    assert.equal(uso(s, 'evangelio').texto.t, 'Mt 3');
    assert.equal(uso(s, 'evangelio').texto.s, 'Parroquia X');
    assert.equal(uso(s, 'evangelio').texto.k, 'SANTO EVANGELIO');
  });
  prueba('rosario: ceja y texto automáticos, s = s.rosario o la parroquia', () => {
    const r = uso({ tipo: 'procesion', rosario: 'Misterios gozosos', parroquia: 'P' }, 'rosario');
    assert.equal(r.texto.k, c.tx({ tipo: 'procesion' }, 'k_rosario'));
    assert.equal(r.texto.t, c.tx({ tipo: 'procesion' }, 't_rosario'));
    assert.equal(r.texto.s, 'Misterios gozosos');
    assert.equal(uso({ tipo: 'procesion', parroquia: 'P' }, 'rosario').texto.s, 'P');
  });
  prueba('bases nuevas: rotulosTexto, luego el uso, luego la base; s cae en la parroquia', () => {
    const s = { tipo: 'sector', parroquia: 'P', rotulosTexto: { lugar: { t: 'Capilla', s: 'Cantón' } } };
    assert.deepEqual(Object.assign({}, uso(s, 'lugar').texto), { k: 'LUGAR', t: 'Capilla', s: 'Cantón', chico: false });
    const v = uso({ tipo: 'sector', parroquia: 'P' }, 'lugar').texto;
    assert.equal(v.t, '');
    assert.equal(v.s, 'P');
    assert.equal(uso({ tipo: 'evento', rotulosTexto: { libre: { k: 'AVISO', t: 'Hola' } } }, 'libre').texto.k, 'AVISO');
  });
  prueba('lugar: sin texto propio, t cae en s.lugar y s en s.sector, luego en la parroquia', () => {
    const v = uso({ tipo: 'sector', lugar: 'Capilla San Juan', sector: 'SECTOR 8', parroquia: 'P' }, 'lugar').texto;
    assert.equal(v.t, 'Capilla San Juan');
    assert.equal(v.s, 'SECTOR 8');
    assert.equal(uso({ tipo: 'procesion', lugar: 'Parque central', parroquia: 'P' }, 'lugar').texto.t, 'Parque central');
    assert.equal(uso({ tipo: 'procesion', lugar: 'Parque central', sector: '', parroquia: 'P' }, 'lugar').texto.s, 'P');
    assert.equal(uso({ tipo: 'sector', sector: '   ', parroquia: 'P' }, 'lugar').texto.s, 'P');
  });
  prueba('lugar: lo escrito en rotulosTexto gana a s.lugar y s.sector', () => {
    const s = { tipo: 'sector', lugar: 'Capilla', sector: 'SECTOR 8', parroquia: 'P', rotulosTexto: { lugar: { t: 'Cancha', s: 'Cantón' } } };
    assert.equal(uso(s, 'lugar').texto.t, 'Cancha');
    assert.equal(uso(s, 'lugar').texto.s, 'Cantón');
  });
  prueba('lugar: las otras bases nuevas no usan s.lugar ni s.sector', () => {
    const o = uso({ tipo: 'procesion', lugar: 'Parque', sector: 'S8', parroquia: 'P' }, 'oracion').texto;
    assert.equal(o.t, '');
    assert.equal(o.s, 'P');
  });
  prueba('CARGOS: sugerencias del cargo de la persona, en tipos.js', () => {
    assert.deepEqual(Array.from(c.CARGOS || []), ['CELEBRANTE', 'PREDICADOR', 'CONCELEBRANTE', 'DIÁCONO', 'GUÍA', 'CORO']);
  });
  prueba('no muta el catálogo ni mezcla tipos que comparten la lista', () => {
    const antes = JSON.stringify(c.TIPOS.dominical.rotulos);
    c.rotulosDe({ tipo: 'dominical', salmoNum: 'x', celebrante: 'Ana' });
    assert.equal(JSON.stringify(c.TIPOS.dominical.rotulos), antes);
    assert.equal(uso({ tipo: 'novena', celebrante: 'Luis' }, 'persona').texto.t, 'Luis');
    assert.equal(uso({ tipo: 'patronal' }, 'persona').texto.t, '');
  });
  prueba('un id que no es del tipo no tiene rótulo (el contenido queda en null)', () => {
    assert.equal(uso({ tipo: 'semana' }, 'lectura2'), undefined);
    assert.equal(uso({ tipo: 'dominical' }, 'guia'), undefined);
  });
});

grupo('guardadas', () => {
  const KEY = 'pev_ciudad-arce_guardadas_v1';
  const ARCHIVOS = ['tipos.js', 'comun.js', 'guardadas-nucleo.js', 'guardadas.js'];   // el núcleo va antes
  const nuevo = (almacen) => cargarCon(ARCHIVOS, almacen);

  prueba('si lo guardado no es JSON, leerGuardadas() es []', () => {
    assert.deepEqual(Array.from(nuevo({ [KEY]: 'no-es-json' }).leerGuardadas()), []);
  });
  prueba('si lo guardado no es una lista, leerGuardadas() es []', () => {
    assert.deepEqual(Array.from(nuevo({ [KEY]: '{"a":1}' }).leerGuardadas()), []);
  });
  prueba('guardar una Hora Santa: lo guardado no trae rótulo al aire y al cargar queda «ninguno»', () => {
    const c = nuevo();
    const g = c.guardarTransmision('Hora Santa jueves', { ...c.PREDETERMINADO, tipo: 'horasanta', rotulo: 'guia', rotuloHasta: 99, rotuloDesde: 5, celebrante: 'Juan' });
    for (const campo of ['rotulo', 'rotuloHasta', 'rotuloDesde']) assert.ok(!(campo in g.datos), campo);
    const crudo = JSON.parse(c.__almacen[KEY])[0];
    assert.ok(!('rotulo' in crudo.datos));
    const e = c.cargarTransmision(g.id);
    assert.equal(e.rotulo, 'ninguno');
    assert.equal(e.rotuloHasta, 0);
    assert.equal(e.tipo, 'horasanta');
    assert.equal(e.celebrante, 'Juan');
  });
  prueba('guardar dos veces «hora santa JUEVES» deja una sola entrada', () => {
    const c = nuevo();
    c.guardarTransmision('Hora Santa jueves', { ...c.PREDETERMINADO, tipo: 'horasanta' });
    c.guardarTransmision('  hora santa JUEVES ', { ...c.PREDETERMINADO, tipo: 'horasanta', celebrante: 'Ana' });
    const lista = c.leerGuardadas();
    assert.equal(lista.length, 1);
    assert.equal(lista[0].datos.celebrante, 'Ana');
  });
  prueba('una transmisión con un tipo propio se guarda y se carga con ese tipo', () => {
    const cfg = JSON.parse(JSON.stringify(CONFIG_CIUDAD_ARCE));
    cfg.tipos = { propios: [{ clave: 'hora-misionera', nombre: 'Hora misionera' }] };
    const c = cargarCon(ARCHIVOS, {}, cfg);
    const g = c.guardarTransmision('Misionera', { ...c.PREDETERMINADO, tipo: 'hora-misionera' });
    assert.equal(g.tipo, 'hora-misionera');
    assert.equal(c.cargarTransmision(g.id).tipo, 'hora-misionera');
  });
  prueba('un nombre vacío no se guarda', () => {
    const c = nuevo();
    assert.equal(c.guardarTransmision('   ', c.PREDETERMINADO), null);
    assert.deepEqual(Array.from(c.leerGuardadas()), []);
  });
  prueba('una guardada con tipo «viejo» se carga como dominical', () => {
    const c = nuevo();
    const g = c.guardarTransmision('Vieja', { ...c.PREDETERMINADO, tipo: 'viejo' });
    assert.equal(c.cargarTransmision(g.id).tipo, 'dominical');
  });
  prueba('cargar migra un estado viejo (virgen b -> imagen patrono) y completa los campos que faltan', () => {
    const c = nuevo({ [KEY]: JSON.stringify([{ id: 'x', nombre: 'Antigua', tipo: 'novena', guardadaEn: 1, usadaEn: 1, datos: { tipo: 'novena', virgen: 'b' } }]) });
    const e = c.cargarTransmision('x');
    assert.equal(e.imagen, 'patrono');
    assert.ok(!('virgen' in e));
    assert.equal(e.avisos.length, 4);
  });
  prueba('cargar un id que no existe devuelve null', () => {
    assert.equal(nuevo().cargarTransmision('nada'), null);
  });
  prueba('cargar actualiza usadaEn y leerGuardadas ordena por usadaEn descendente', () => {
    const c = nuevo({ [KEY]: JSON.stringify([
      { id: 'a', nombre: 'A', tipo: 'novena', guardadaEn: 1, usadaEn: 10, datos: {} },
      { id: 'b', nombre: 'B', tipo: 'novena', guardadaEn: 2, usadaEn: 20, datos: {} }
    ]) });
    assert.deepEqual(Array.from(c.leerGuardadas(), (g) => g.id), ['b', 'a']);
    c.cargarTransmision('a');
    assert.deepEqual(Array.from(c.leerGuardadas(), (g) => g.id), ['a', 'b']);
    assert.ok(c.leerGuardadas()[0].usadaEn > 20);
  });
  prueba('lo guardado y lo cargado no comparten referencias con el estado vivo', () => {
    const c = nuevo();
    const vivo = { ...c.PREDETERMINADO, avisos: [{ a: 'uno', f: '' }, { a: '', f: '' }, { a: '', f: '' }, { a: '', f: '' }] };
    const g = c.guardarTransmision('Copia', vivo);
    vivo.avisos[0].a = 'cambiado';
    assert.equal(g.datos.avisos[0].a, 'uno');
    assert.equal(c.leerGuardadas()[0].datos.avisos[0].a, 'uno');
    const e = c.cargarTransmision(g.id);
    e.avisos[0].a = 'otro';
    assert.equal(c.leerGuardadas()[0].datos.avisos[0].a, 'uno');
  });
  prueba('duplicar crea «{nombre} (copia)» con los mismos datos y otro id; una segunda copia no repite el nombre', () => {
    const c = nuevo();
    const g = c.guardarTransmision('Novena 2026', { ...c.PREDETERMINADO, tipo: 'novena', santo: 'San Juan' });
    const d = c.duplicarTransmision(g.id);
    assert.equal(d.nombre, 'Novena 2026 (copia)');
    assert.notEqual(d.id, g.id);
    assert.equal(d.datos.santo, 'San Juan');
    assert.equal(c.duplicarTransmision(g.id).nombre, 'Novena 2026 (copia 2)');
    assert.equal(c.leerGuardadas().length, 3);
    assert.equal(new Set(Array.from(c.leerGuardadas(), (x) => x.id)).size, 3);
  });
  prueba('borrar quita solo esa entrada', () => {
    const c = nuevo();
    const a = c.guardarTransmision('A', c.PREDETERMINADO);
    c.guardarTransmision('B', c.PREDETERMINADO);
    c.borrarTransmision(a.id);
    assert.deepEqual(Array.from(c.leerGuardadas(), (g) => g.nombre), ['B']);
  });
  prueba('si el navegador no deja escribir: guardar y duplicar devuelven null, borrar devuelve false, y nada cambia', () => {
    const c = nuevo();
    const g = c.guardarTransmision('A', c.PREDETERMINADO);
    const antes = c.__almacen[KEY];
    c.localStorage.setItem = () => { throw new Error('cuota'); };
    assert.equal(c.guardarTransmision('B', c.PREDETERMINADO), null);
    assert.equal(c.duplicarTransmision(g.id), null);
    assert.equal(c.borrarTransmision(g.id), false);
    assert.equal(c.__almacen[KEY], antes);
  });
  prueba('existeGuardada compara sin importar mayúsculas ni espacios', () => {
    const c = nuevo();
    c.guardarTransmision('Hora Santa jueves', c.PREDETERMINADO);
    assert.equal(c.existeGuardada('  hora SANTA jueves '), true);
    assert.equal(c.existeGuardada('otra'), false);
  });
  prueba('las entradas rotas se esconden pero se conservan al guardar, duplicar, borrar y cargar', () => {
    const rota = { nombre: 'sin id', datos: {} };
    const c = nuevo({ [KEY]: JSON.stringify([5, rota, { id: 'ok', nombre: 'Ok', tipo: 'novena', guardadaEn: 1, usadaEn: 1, datos: {} }]) });
    const rotas = () => JSON.parse(c.__almacen[KEY]).filter((g) => !(g && typeof g === 'object' && typeof g.id === 'string'));
    const quedan = () => assert.deepEqual(rotas(), [5, rota]);
    c.guardarTransmision('Nueva', c.PREDETERMINADO); quedan();
    c.duplicarTransmision('ok'); quedan();
    c.cargarTransmision('ok'); quedan();
    c.borrarTransmision('ok'); quedan();
    assert.deepEqual(Array.from(c.leerGuardadas(), (g) => g.nombre).sort(), ['Nueva', 'Ok (copia)']);
  });
  prueba('si lo guardado es ilegible, el texto original se copia al respaldo antes de escribir', () => {
    const c = nuevo({ [KEY]: 'no-es-json' });
    assert.ok(c.guardarTransmision('A', c.PREDETERMINADO));
    assert.equal(c.__almacen['pev_ciudad-arce_guardadas_v1_respaldo'], 'no-es-json');
    assert.equal(c.leerGuardadas().length, 1);
    const d = nuevo({ [KEY]: '{"a":1}' });
    d.guardarTransmision('A', d.PREDETERMINADO);
    assert.equal(d.__almacen['pev_ciudad-arce_guardadas_v1_respaldo'], '{"a":1}');
  });
  prueba('las guardadas son por parroquia: la copia de otra parroquia no se ve ni se toca', () => {
    const otra = JSON.stringify([{ id: 'x', nombre: 'Ajena', tipo: 'novena', guardadaEn: 1, usadaEn: 1, datos: {} }]);
    const c = nuevo({ 'pev_san-jose_guardadas_v1': otra });
    assert.deepEqual(Array.from(c.leerGuardadas()), []);
    c.guardarTransmision('Mía', c.PREDETERMINADO);
    assert.equal(c.__almacen['pev_san-jose_guardadas_v1'], otra);
    assert.equal(JSON.parse(c.__almacen[KEY]).length, 1);
    assert.ok(!('parroquia_obs_guardadas_v1' in c.__almacen));
  });
  prueba('sin lo guardado ilegible no se crea respaldo', () => {
    const c = nuevo();
    c.guardarTransmision('A', c.PREDETERMINADO);
    assert.ok(!('pev_ciudad-arce_guardadas_v1_respaldo' in c.__almacen));
  });
  prueba('las entradas rotas de la lista se ignoran', () => {
    const c = nuevo({ [KEY]: JSON.stringify([null, 5, { id: 'ok', nombre: 'Ok', datos: {} }, { nombre: 'sin id', datos: {} }]) });
    assert.deepEqual(Array.from(c.leerGuardadas(), (g) => g.id), ['ok']);
  });

  const KEY_PEND = 'pev_ciudad-arce_guardadas_pendientes_v1';
  const pendientes = (c) => JSON.parse(c.__almacen[KEY_PEND] || '[]');
  const plano = (x) => JSON.parse(JSON.stringify(x));
  prueba('guardar anota un pendiente guardar y la guardada gana actualizadoEn', () => {
    const c = nuevo();
    const antes = Date.now();
    const g = c.guardarTransmision('Hora Santa', c.PREDETERMINADO);
    assert.ok(g.actualizadoEn >= antes);
    const p = pendientes(c);
    assert.equal(p.length, 1);
    assert.equal(p[0].op, 'guardar');
    assert.equal(p[0].id, g.id);
    assert.equal(typeof p[0].cuando, 'number');
    assert.deepEqual(plano(c.leerPendientes()), p);
    assert.match(g.id, /^[a-z0-9]{4,24}(-[a-z0-9]{4,12})?$/);
  });
  prueba('guardar dos veces el mismo nombre deja un solo pendiente guardar', () => {
    const c = nuevo();
    const g = c.guardarTransmision('A', c.PREDETERMINADO);
    c.guardarTransmision('a', c.PREDETERMINADO);
    assert.deepEqual(pendientes(c).map((x) => [x.op, x.id]), [['guardar', g.id]]);
  });
  prueba('cargar anota usar y no cambia actualizadoEn', () => {
    const c = nuevo({ [KEY]: JSON.stringify([{ id: 'a', nombre: 'A', tipo: 'novena', guardadaEn: 1, usadaEn: 10, actualizadoEn: 5, datos: {} }]) });
    c.cargarTransmision('a');
    const g = c.leerGuardadas()[0];
    assert.equal(g.actualizadoEn, 5);
    assert.ok(g.usadaEn > 10);
    const p = pendientes(c);
    assert.deepEqual(p.map((x) => [x.op, x.id]), [['usar', 'a']]);
    assert.equal(typeof p[0].cuando, 'number');
  });
  prueba('cargar un id que no existe no anota nada', () => {
    const c = nuevo();
    c.cargarTransmision('nada');
    assert.ok(!(KEY_PEND in c.__almacen));
  });
  prueba('borrar anota borrar con cuando, y la entrada sale de la lista sin lápida', () => {
    const c = nuevo();
    const a = c.guardarTransmision('A', c.PREDETERMINADO);
    assert.equal(c.borrarTransmision(a.id), true);
    assert.deepEqual(Array.from(c.leerGuardadas()), []);
    assert.deepEqual(JSON.parse(c.__almacen[KEY]), []);
    const p = pendientes(c);
    assert.deepEqual(p.map((x) => [x.op, x.id]), [['borrar', a.id]]);
    assert.equal(typeof p[0].cuando, 'number');
  });
  prueba('duplicar anota guardar de la copia, con id nuevo y actualizadoEn', () => {
    const c = nuevo();
    const g = c.guardarTransmision('A', c.PREDETERMINADO);
    const d = c.duplicarTransmision(g.id);
    assert.equal(typeof d.actualizadoEn, 'number');
    assert.ok(pendientes(c).some((x) => x.op === 'guardar' && x.id === d.id));
  });
  prueba('con 50 guardadas, guardar un nombre nuevo da {error:limite} y reemplazar uno existente funciona', () => {
    const c = nuevo();
    for (let i = 0; i < 50; i++) assert.ok(c.guardarTransmision('G' + i, c.PREDETERMINADO).id);
    const antesLista = c.__almacen[KEY];
    const antesPend = c.__almacen[KEY_PEND];
    assert.deepEqual(plano(c.guardarTransmision('Otra', c.PREDETERMINADO)), { error: 'limite' });
    assert.equal(c.__almacen[KEY], antesLista);
    assert.equal(c.__almacen[KEY_PEND], antesPend);
    const r = c.guardarTransmision(' g7 ', { ...c.PREDETERMINADO, celebrante: 'Ana' });
    assert.equal(r.datos.celebrante, 'Ana');
    assert.equal(c.leerGuardadas().length, 50);
  });
  prueba('con 50 guardadas, duplicar da {error:limite}', () => {
    const c = nuevo();
    let primero;
    for (let i = 0; i < 50; i++) { const g = c.guardarTransmision('G' + i, c.PREDETERMINADO); primero = primero || g; }
    assert.deepEqual(plano(c.duplicarTransmision(primero.id)), { error: 'limite' });
    assert.equal(c.leerGuardadas().length, 50);
  });
  prueba('si no se puede escribir la cola de pendientes, guardar falla y la lista queda como estaba', () => {
    const c = nuevo();
    c.guardarTransmision('A', c.PREDETERMINADO);
    const antes = c.__almacen[KEY];
    const set = c.localStorage.setItem;
    c.localStorage.setItem = (k, v) => { if (k === KEY_PEND) throw new Error('cuota'); set(k, v); };
    assert.equal(c.guardarTransmision('B', c.PREDETERMINADO), null);
    assert.equal(c.__almacen[KEY], antes);
  });
  prueba('leerPendientes ignora lo ilegible y las entradas rotas; escribirPendientes devuelve boolean', () => {
    const c = nuevo({ [KEY_PEND]: 'no-es-json' });
    assert.deepEqual(plano(c.leerPendientes()), []);
    const d = nuevo({ [KEY_PEND]: JSON.stringify([null, { op: 'x', id: 'a', cuando: 1 }, { op: 'usar', id: 'a', cuando: 2 }]) });
    assert.deepEqual(plano(d.leerPendientes()), [{ op: 'usar', id: 'a', cuando: 2 }]);
    assert.equal(d.escribirPendientes([{ op: 'borrar', id: 'b', cuando: 3 }]), true);
    assert.deepEqual(JSON.parse(d.__almacen[KEY_PEND]), [{ op: 'borrar', id: 'b', cuando: 3 }]);
    d.localStorage.setItem = () => { throw new Error('cuota'); };
    assert.equal(d.escribirPendientes([]), false);
  });
  prueba('reemplazarGuardadas escribe la lista de la fusión y conserva las entradas rotas', () => {
    const c = nuevo({ [KEY]: JSON.stringify([5, { id: 'v', nombre: 'V', datos: {} }]) });
    const lista = [{ id: 'n', nombre: 'N', tipo: 'novena', guardadaEn: 1, usadaEn: 1, actualizadoEn: 1, datos: {} }];
    assert.equal(c.reemplazarGuardadas(lista), true);
    assert.deepEqual(Array.from(c.leerGuardadas(), (g) => g.id), ['n']);
    assert.deepEqual(JSON.parse(c.__almacen[KEY]).filter((g) => typeof g !== 'object' || typeof g.id !== 'string'), [5]);
    c.localStorage.setItem = () => { throw new Error('cuota'); };
    assert.equal(c.reemplazarGuardadas([]), false);
  });
  prueba('una guardada vieja sin actualizadoEn se lee con el mayor entre guardadaEn y usadaEn', () => {
    const c = nuevo({ [KEY]: JSON.stringify([
      { id: 'vieja', nombre: 'Vieja', tipo: 'novena', guardadaEn: 100, usadaEn: 700, datos: {} },
      { id: 'otra', nombre: 'Otra', tipo: 'novena', guardadaEn: 900, datos: {} },
      { id: 'nueva', nombre: 'Nueva', tipo: 'novena', guardadaEn: 1, usadaEn: 1, actualizadoEn: 5, datos: {} }
    ]) });
    const por = Object.fromEntries(Array.from(c.leerGuardadas(), (g) => [g.id, g.actualizadoEn]));
    assert.deepEqual(por, { vieja: 700, otra: 900, nueva: 5 });
  });
  prueba('usoDeGuardada: «Guardada» si nunca se cargó, «Usada» si se cargó', () => {
    const c = nuevo();
    const plano = (x) => JSON.parse(JSON.stringify(x));
    assert.deepEqual(plano(c.usoDeGuardada({ guardadaEn: 500, usadaEn: 500 })), { palabra: 'Guardada', cuando: 500 });   // al guardar, usadaEn = guardadaEn
    assert.deepEqual(plano(c.usoDeGuardada({ guardadaEn: 500 })), { palabra: 'Guardada', cuando: 500 });
    assert.deepEqual(plano(c.usoDeGuardada({ guardadaEn: 500, usadaEn: 900 })), { palabra: 'Usada', cuando: 900 });
    const g = c.guardarTransmision('Nueva', { ...c.PREDETERMINADO, tipo: 'novena' });
    assert.equal(c.usoDeGuardada(c.leerGuardadas()[0]).palabra, 'Guardada');
    const lista = JSON.parse(c.__almacen[KEY]);
    lista[0].guardadaEn -= 5000; lista[0].usadaEn -= 5000;   // guardada hace 5 s
    c.__almacen[KEY] = JSON.stringify(lista);
    c.cargarTransmision(g.id, {});
    assert.equal(c.usoDeGuardada(c.leerGuardadas()[0]).palabra, 'Usada');
  });
});

grupo('comun por parroquia', () => {
  const COMUN = ['tipos.js', 'comun.js'];
  const leerVivo = (c, nombre) => vm.runInContext(nombre, c);

  prueba('estado: con SLUG san-jose se guarda en pev_san-jose_estado_v1 y nunca en parroquia_obs_estado_v1', () => {
    const c = cargarCon(COMUN, {}, CONFIG_SAN_JOSE);
    assert.equal(leerVivo(c, 'SLUG'), 'san-jose');
    assert.equal(c.CLAVE, 'pev_san-jose_estado_v1');
    assert.equal(c.CLAVE_LATIDO, 'pev_san-jose_latido_v1');
    c.guardarEstado(c.leerEstado());
    assert.ok('pev_san-jose_estado_v1' in c.__almacen);
    assert.ok(!('parroquia_obs_estado_v1' in c.__almacen));
    assert.ok(!Object.keys(c.__almacen).some((k) => k.startsWith('parroquia_')));
  });
  prueba('estado: el canal lleva el slug (pev_san-jose_canal)', () => {
    const nombres = [];
    class Canal { constructor(n) { nombres.push(n); this.onmessage = null; } postMessage() {} close() {} }
    cargarCon(COMUN, {}, CONFIG_SAN_JOSE, { BroadcastChannel: Canal });
    assert.deepEqual(nombres, ['pev_san-jose_canal']);
  });
  prueba('estado: dos parroquias no comparten el estado guardado', () => {
    const a = cargarCon(COMUN, { 'pev_ciudad-arce_estado_v1': '{"santo":"Ana"}' }, CONFIG_CIUDAD_ARCE);
    const b = cargarCon(COMUN, { 'pev_ciudad-arce_estado_v1': '{"santo":"Ana"}' }, CONFIG_SAN_JOSE);
    assert.equal(a.leerEstado().santo, 'Ana');
    assert.equal(b.leerEstado().santo, '');   // y el de una parroquia no se hereda de otra
  });
  prueba('estado: la línea de parroquia no se materializa; se resuelve al usarla (nombre · lugar)', () => {
    const c = cargarCon(COMUN, {}, CONFIG_SAN_JOSE);
    assert.equal(c.PREDETERMINADO.parroquia, '');
    assert.equal(c.leerEstado().parroquia, '');
    assert.equal(c.lineaParroquia(c.leerEstado()), 'Parroquia San José · Santa Tecla, La Libertad');
    assert.equal(c.normalizarEstado({ parroquia: 'Otra' }).parroquia, 'Otra');
    assert.equal(c.lineaParroquia(c.normalizarEstado({ parroquia: 'Otra' })), 'Otra');
  });
  prueba('estado: con un estado guardado bajo la config v1, cambiar PARROQUIA cambia la línea de los rótulos', () => {
    const c = cargarCon(COMUN, {}, CONFIG_CIUDAD_ARCE);
    c.guardarEstado(c.leerEstado());                                   // lo que haría el panel al abrir
    const guardado = JSON.parse(c.__almacen['pev_ciudad-arce_estado_v1']);
    assert.equal(guardado.parroquia, '');
    const linea = () => c.rotulosDe(c.leerEstado()).find((r) => r.id === 'persona').texto.s;
    assert.equal(linea(), 'Parroquia Inmaculada Concepción de María · Ciudad Arce, La Libertad');
    vm.runInContext('PARROQUIA = ' + JSON.stringify(Object.assign({}, CONFIG_CIUDAD_ARCE, { version: 2, lugar: 'Otro lugar' })), c);
    assert.equal(linea(), 'Parroquia Inmaculada Concepción de María · Otro lugar');
  });
  prueba('estado: una línea escrita a mano gana sobre la de la configuración', () => {
    const c = cargarCon(COMUN, { 'pev_ciudad-arce_estado_v1': '{"parroquia":"Mi línea"}' }, CONFIG_CIUDAD_ARCE);
    assert.equal(c.rotulosDe(c.leerEstado()).find((r) => r.id === 'persona').texto.s, 'Mi línea');
  });
  prueba('PREDETERMINADO no trae datos de Ciudad Arce (ni celebrante ni santo)', () => {
    const c = cargarCon(COMUN, {}, CONFIG_SAN_JOSE);
    assert.equal(c.PREDETERMINADO.celebrante, '');
    assert.equal(c.PREDETERMINADO.santo, '');
    const texto = JSON.stringify(c.PREDETERMINADO);
    for (const ajeno of ['Héctor', 'Cruz', 'San José', 'Inmaculada', 'Ciudad Arce']) assert.ok(!texto.includes(ajeno), ajeno);
  });
  prueba('un rótulo «Celebrante» sin escribir nada queda con el texto vacío (el panel lo marca como falta)', () => {
    const c = cargarCon(COMUN, {}, CONFIG_SAN_JOSE);
    const persona = c.rotulosDe(c.normalizarEstado({ tipo: 'dominical' })).find((r) => r.id === 'persona');
    assert.equal(persona.texto.t, '');
    assert.ok(!JSON.stringify(c.rotulosDe(c.leerEstado())).includes('Héctor'));
  });
  prueba('estado: imagen virgen-a|b|c se migra a patrono', () => {
    const c = cargarCon(COMUN);
    for (const v of ['virgen-a', 'virgen-b', 'virgen-c']) assert.equal(c.normalizarEstado({ imagen: v }).imagen, 'patrono', v);
    assert.equal(c.normalizarEstado({ imagen: 'santo' }).imagen, 'santo');
  });

  const hoy = (a, m, d) => new Date(a, m - 1, d);
  prueba('fiesta: fiestaMMDD sale de la configuración', () => {
    assert.equal(cargarCon(COMUN, {}, CONFIG_CIUDAD_ARCE).fiestaMMDD(), '12-08');
    assert.equal(cargarCon(COMUN, {}, CONFIG_SAN_JOSE).fiestaMMDD(), '03-19');
    assert.equal(cargarCon(COMUN, {}, conFiesta(CONFIG_SAN_JOSE, 29, 2)).fiestaMMDD(), '02-29');
  });
  prueba('fiesta: diasHasta con 8/12 -> 0 el mismo día, 364 al día siguiente', () => {
    const c = cargarCon(COMUN);
    assert.equal(c.diasHasta('12-08', hoy(2026, 12, 8)), 0);
    assert.equal(c.diasHasta('12-08', hoy(2026, 12, 9)), 364);
  });
  prueba('fiesta: diasHasta con 6/1 desde el 31/12 -> 6', () => {
    assert.equal(cargarCon(COMUN).diasHasta('01-06', hoy(2026, 12, 31)), 6);
  });
  prueba('fiesta: un 29 de febrero en un año sin bisiesto cuenta hasta el 1 de marzo', () => {
    const c = cargarCon(COMUN);
    assert.equal(c.diasHasta('02-29', hoy(2027, 2, 27)), 2);
    assert.equal(c.diasHasta('02-29', hoy(2027, 3, 1)), 0);
    // pasado el 1 de marzo de 2027 la próxima ocurrencia es el 29 de febrero de 2028
    assert.equal(c.diasHasta('02-29', hoy(2027, 3, 2)), 364);
  });
  prueba('fiesta: un 29 de febrero en año bisiesto cae el 29', () => {
    const c = cargarCon(COMUN);
    assert.equal(c.diasHasta('02-29', hoy(2028, 2, 27)), 2);
    assert.equal(c.diasHasta('02-29', hoy(2028, 2, 29)), 0);
  });
  prueba('fiesta: la cuenta del tipo cuenta hasta la fiesta de la parroquia', () => {
    const c = cargarCon(COMUN, {}, CONFIG_SAN_JOSE);
    assert.equal(c.diasFaltan({ tipo: 'novena', diasManual: '' }, hoy(2027, 3, 10)), 9);
    assert.equal(cargarCon(COMUN).diasFaltan({ tipo: 'novena', diasManual: '' }, hoy(2026, 11, 8)), 30);
  });
  prueba('fiesta: un tipo con su propio hasta cuenta hasta esa fecha', () => {
    const c = cargarCon(COMUN);
    c.TIPOS.navidad = Object.assign({}, c.TIPOS.novena, { cuenta: { hasta: '12-25', texto: 'para Navidad' } });
    assert.equal(c.diasFaltan({ tipo: 'navidad', diasManual: '' }, hoy(2026, 11, 8)), 47);
    assert.equal(c.diasFaltan({ tipo: 'novena', diasManual: '' }, hoy(2026, 11, 8)), 30);
  });
  prueba('fiesta: esquinaDe fiesta con 19/3 -> 19 DE MARZO', () => {
    const c = cargarCon(COMUN, {}, CONFIG_SAN_JOSE);
    assert.deepEqual(Object.assign({}, c.esquinaDe({ esquina: 'fiesta' })), { num: '19', txt: 'DE\nMARZO' });
    assert.deepEqual(Object.assign({}, c.esquinaDe({ tipo: 'novena' })), { num: '19', txt: 'DE\nMARZO' });
  });

  prueba('textos: con San José, portada_titulo dice San José y los textos de comun.js no nombran a otra parroquia', () => {
    const c = cargarCon(COMUN, {}, CONFIG_SAN_JOSE);
    const t = c.textosBase(c.normalizarEstado({ tipo: 'novena', santo: 'San José', diasManual: '5' }));
    assert.ok(t.portada_titulo.includes('San José'), t.portada_titulo);
    assert.equal(t.portada_fecha, 'DE MARZO');
    assert.equal(t.portada_cursiva, 'en honor a');   // sin «la»: «en honor a la San José» no se dice
    assert.equal(t.portada_sub, 'Solemnidad de nuestro patrono');
    assert.equal(t.marca, 'Parroquia San José\nSanta Tecla, La Libertad');   // F4:25: nombre y lugar en dos líneas
    assert.equal(t.capa_logo, 'Parroquia San José\nSanta Tecla, La Libertad');   // F4:37: la capa también
    assert.equal(c.lineaParroquia(c.normalizarEstado({ tipo: 'novena' })), 'Parroquia San José · Santa Tecla, La Libertad');   // el rótulo sigue en una línea
    assert.equal(t.avisos_sub, 'PARROQUIA SAN JOSÉ');
    for (const k of ['marca', 'portada_titulo', 'portada_fecha', 'portada_sub', 'avisos_sub', 'capa_logo']) {
      assert.ok(!/Inmaculada|Ciudad Arce|DICIEMBRE/i.test(t[k]), k + ': ' + t[k]);
    }
  });
  prueba('textos: con la configuración de Ciudad Arce salen los textos de siempre', () => {
    const c = cargarCon(COMUN);
    const t = c.textosBase(c.normalizarEstado({ tipo: 'novena', diasManual: '5' }));
    assert.equal(t.portada_titulo, 'Inmaculada Concepción de María');
    assert.equal(t.portada_fecha, 'DE DICIEMBRE');
    assert.equal(t.avisos_sub, 'PARROQUIA INMACULADA CONCEPCIÓN DE MARÍA');
  });

  prueba('imágenes: patrono sin patrono.imagen usa la fachada (ruta y alt)', () => {
    const c = cargarCon(COMUN, {}, CONFIG_SAN_JOSE);
    assert.equal(c.imagenDe({ imagen: 'patrono' }), 'medios/fachada.jpg');
    assert.equal(c.altDe({ imagen: 'patrono' }), 'Fachada del templo de San José');
  });
  prueba('imágenes: patrono con imagen, fachada y logo', () => {
    const c = cargarCon(COMUN);
    assert.equal(c.imagenDe({ imagen: 'patrono' }), 'medios/patrono.png');
    assert.equal(c.altDe({ imagen: 'patrono' }), 'Imagen de la Inmaculada Concepción');
    assert.equal(c.imagenDe({ imagen: 'fachada' }), 'medios/fachada.jpg');
    assert.equal(c.imagenDe({ imagen: 'logo' }), 'medios/logo-blanco.png');
    assert.equal(c.altDe({ imagen: 'logo' }), 'Logo blanco de la Parroquia Inmaculada Concepción de María');
  });
  prueba('imágenes: custodia y santo son comunes, en img/', () => {
    const c = cargarCon(COMUN, {}, CONFIG_SAN_JOSE);
    assert.equal(c.imagenDe({ imagen: 'custodia' }), 'img/custodia.png');
    assert.equal(c.imagenDe({ imagen: 'santo' }), 'img/santo.png');
  });
  prueba('imágenes: una clave desconocida (virgen-b) cae en la fachada', () => {
    const c = cargarCon(COMUN, {}, CONFIG_SAN_JOSE);
    assert.equal(c.imagenDe({ imagen: 'virgen-b' }), 'medios/fachada.jpg');
    assert.equal(c.altDe({ imagen: 'virgen-b' }), 'Fachada del templo de San José');
  });
  prueba('imágenes: con la configuración neutra no hay ruta ni alt', () => {
    const c = cargarCon(COMUN, {}, null);
    assert.equal(leerVivo(c, 'PARROQUIA'), c.CONFIG_NEUTRA);
    for (const k of ['patrono', 'fachada', 'logo', 'virgen-b']) {
      assert.equal(c.imagenDe({ imagen: k }), '', k);
      assert.equal(c.altDe({ imagen: k }), '', k);
    }
    assert.equal(c.imagenDe({ imagen: 'custodia' }), 'img/custodia.png');
  });
  prueba('imágenes: sin imagen elegida se usa la del tipo', () => {
    const c = cargarCon(COMUN);
    assert.equal(c.imagenDe({ tipo: 'horasanta', imagen: '' }), 'img/custodia.png');
    assert.equal(c.imagenDe({ tipo: 'evento', imagen: '' }), 'medios/logo-blanco.png');
  });
  prueba('PARROQUIA es un enlace vivo: imagenDe y fiestaMMDD siguen a la configuración nueva', () => {
    const c = cargarCon(COMUN, {}, CONFIG_SAN_JOSE);
    vm.runInContext('PARROQUIA = ' + JSON.stringify(CONFIG_CIUDAD_ARCE), c);
    assert.equal(c.imagenDe({ imagen: 'patrono' }), 'medios/patrono.png');
    assert.equal(c.fiestaMMDD(), '12-08');
  });

  prueba('portada: cajaFiesta da día y las tres primeras letras del mes (DIC, MAR)', () => {
    assert.deepEqual(Object.assign({}, cargarCon(COMUN).cajaFiesta()), { num: '8', mes: 'DIC' });
    assert.deepEqual(Object.assign({}, cargarCon(COMUN, {}, CONFIG_SAN_JOSE).cajaFiesta()), { num: '19', mes: 'MAR' });
  });
  prueba('portada: sin fiesta no hay caja ni «DE » suelto', () => {
    const c = cargarCon(COMUN, {}, null);
    assert.equal(c.cajaFiesta(), null);
    assert.equal(c.textosBase(c.normalizarEstado({})).portada_fecha, '');
  });
  prueba('imágenes: claseDeImagen reconoce la fachada y el logo por la ruta de la configuración', () => {
    const c = cargarCon(COMUN);
    assert.equal(c.claseDeImagen('medios/fachada.jpg'), 'foto');
    assert.equal(c.claseDeImagen('medios/logo-blanco.png'), 'logo');
    assert.equal(c.claseDeImagen('medios/patrono.png'), 'a');
    assert.equal(c.claseDeImagen('img/custodia.png'), 'a');
    assert.equal(c.claseDeImagen('fachada.jpg'), 'a');   // el nombre suelto no cuenta
    assert.equal(cargarCon(COMUN, {}, null).claseDeImagen(''), 'a');
  });
  prueba('imágenes: respaldoDeImagen cae a la fachada, y de la fachada a nada', () => {
    const c = cargarCon(COMUN);
    assert.deepEqual(Object.assign({}, c.respaldoDeImagen('medios/patrono.png')),
      { src: 'medios/fachada.jpg', alt: 'Fachada del templo parroquial de Ciudad Arce' });
    assert.deepEqual(Object.assign({}, c.respaldoDeImagen('img/custodia.png')),
      { src: 'medios/fachada.jpg', alt: 'Fachada del templo parroquial de Ciudad Arce' });
    assert.equal(c.respaldoDeImagen('medios/fachada.jpg'), null);
    assert.equal(cargarCon(COMUN, {}, null).respaldoDeImagen('medios/patrono.png'), null);
  });
});

grupo('parroquia', () => {
  const CIUDAD_ARCE = {
    esquema: 1,
    version: 1,
    publicado: '2026-11-07T12:00:00Z',
    slug: 'ciudad-arce',
    nombre: 'Parroquia Inmaculada Concepción de María',
    nombreCorto: 'Inmaculada Concepción',
    lugar: 'Ciudad Arce, La Libertad',
    colores: { principal: '#1155a4', oscuro: '#0c3562' },
    logos: {
      blanco: { src: 'medios/logo-blanco.png', alt: 'Logo de la Parroquia Inmaculada Concepción de María' },
      color: { src: 'medios/logo-color.png', alt: 'Logo de la Parroquia Inmaculada Concepción de María' }
    },
    fachada: { src: 'medios/fachada.jpg', alt: 'Fachada del templo parroquial de Ciudad Arce' },
    patrono: {
      nombre: 'Inmaculada Concepción de María',
      corto: 'Inmaculada',
      imagen: { src: 'medios/patrono.png', alt: 'Imagen de la Inmaculada Concepción' }
    },
    fiesta: { dia: 8, mes: 12, lema: 'Toda hermosa eres, María', cuentaDesdeDias: 60 }
  };
  const copia = (cambios) => {
    const c = JSON.parse(JSON.stringify(CIUDAD_ARCE));
    cambios(c);
    return c;
  };
  const en = (ruta) => cargar(['parroquia.js'], {}, { location: { pathname: ruta } });

  let p;
  try {
    p = en('/ciudad-arce/panel.html');
  } catch (e) {
    prueba('se puede cargar vicaria/parroquia.js', () => { throw e; });
    return;
  }

  prueba('slugDe toma el primer segmento si es un slug válido', () => {
    assert.equal(p.slugDe('/ciudad-arce/panel.html'), 'ciudad-arce');
    assert.equal(p.slugDe('/ciudad-arce/'), 'ciudad-arce');
  });
  prueba('slugDe devuelve null para lo inválido', () => {
    assert.equal(p.slugDe('/Ciudad-Arce/panel.html'), null);
    assert.equal(p.slugDe('/panel.html'), null);
    assert.equal(p.slugDe('/../panel.html'), null);
    assert.equal(p.slugDe('/a/panel.html'), null);
    assert.equal(p.slugDe('/san%20jose/x.html'), null);
    assert.equal(p.slugDe('/-ab/x.html'), null);
    assert.equal(p.slugDe('/ab--cd/x.html'), null);
  });
  prueba('slugDe acepta 40 caracteres y rechaza 41', () => {
    assert.equal(p.slugDe('/' + 'a'.repeat(40) + '/x.html'), 'a'.repeat(40));
    assert.equal(p.slugDe('/' + 'a'.repeat(41) + '/x.html'), null);
  });
  prueba('SLUG sale de location.pathname al cargar', () => {
    assert.equal(p.SLUG, 'ciudad-arce');
    assert.equal(en('/panel.html').SLUG, null);
  });
  prueba('claveDe lleva el prefijo pev_<slug>_ y nunca parroquia_', () => {
    const q = en('/san-jose/panel.html');
    assert.equal(q.claveDe('estado_v1'), 'pev_san-jose_estado_v1');
    assert.ok(!q.claveDe('estado_v1').startsWith('parroquia_'));
    assert.equal(en('/panel.html').claveDe('estado_v1'), 'pev__estado_v1');
  });

  prueba('contraste: blanco sobre #1155a4 está entre 7.3 y 7.4 (el brief decía 7.0-7.2, pero el WCAG da 7.34); igual con igual es 1', () => {
    const r = p.contraste('#ffffff', '#1155a4');
    assert.ok(r > 7.3 && r < 7.4, String(r));
    assert.equal(p.contraste('#ffffff', '#ffffff'), 1);
    assert.equal(p.contraste('#ffffff', '#000000'), 21);
  });

  prueba('validarConfig acepta la configuración de Ciudad Arce', () => {
    const r = p.validarConfig(CIUDAD_ARCE);
    assert.deepEqual(Array.from(r.errores), []);
    assert.equal(r.ok, true);
  });
  prueba('validarConfig acepta los campos opcionales ausentes', () => {
    const r = p.validarConfig(copia((c) => {
      delete c.nombreCorto; delete c.logos.color; delete c.patrono.imagen;
      delete c.fiesta.lema; delete c.fiesta.cuentaDesdeDias;
    }));
    assert.deepEqual(Array.from(r.errores), []);
  });
  const malo = (descripcion, cambios, campo) => {
    prueba('validarConfig rechaza: ' + descripcion, () => {
      const r = p.validarConfig(copia(cambios));
      assert.equal(r.ok, false);
      assert.ok(r.errores.some((e) => e.includes(campo)), 'ningún error menciona «' + campo + '»: ' + JSON.stringify(r.errores));
    });
  };
  malo('falta nombre', (c) => { delete c.nombre; }, 'nombre');
  malo('logos.blanco.alt vacío', (c) => { c.logos.blanco.alt = ''; }, 'logos.blanco');
  malo('fachada.alt solo espacios', (c) => { c.fachada.alt = '   '; }, 'fachada');
  malo('colores.principal sin contraste', (c) => { c.colores.principal = '#ffff00'; }, 'El texto blanco no se lee sobre el color principal');
  malo('colores.oscuro no es hex', (c) => { c.colores.oscuro = 'azul'; }, 'colores.oscuro');
  malo('fiesta 31 de abril', (c) => { c.fiesta = { dia: 31, mes: 4 }; }, 'fiesta.dia');
  malo('fiesta 30 de febrero', (c) => { c.fiesta = { dia: 30, mes: 2 }; }, 'fiesta.dia');
  malo('esquema 2', (c) => { c.esquema = 2; }, 'esquema');
  malo('slug distinto del de la página', (c) => { c.slug = 'san-jose'; }, 'slug');
  malo('version no entera', (c) => { c.version = 1.5; }, 'version');
  malo('patrono.imagen sin alt', (c) => { delete c.patrono.imagen.alt; }, 'patrono.imagen');
  prueba('validarConfig acepta fiesta del 29 de febrero', () => {
    const r = p.validarConfig(copia((c) => { c.fiesta = { dia: 29, mes: 2 }; }));
    assert.equal(r.ok, true, JSON.stringify(r.errores));
  });
  prueba('validarConfig: sin SLUG en la página cualquier config da error de slug', () => {
    const r = en('/panel.html').validarConfig(CIUDAD_ARCE);
    assert.equal(r.ok, false);
    assert.ok(r.errores.some((e) => e.includes('slug')));
  });
  prueba('validarConfig rechaza lo que no es objeto', () => {
    assert.equal(p.validarConfig(null).ok, false);
    assert.equal(p.validarConfig('x').ok, false);
  });

  prueba('paleta: rey y oscuro tal cual; celeste, claro y palido cada vez más claros', () => {
    const q = p.paleta('#1155a4', '#0c3562');
    assert.equal(q.rey, '#1155a4');
    assert.equal(q.oscuro, '#0c3562');
    for (const k of ['oscuro', 'rey', 'medio', 'celeste', 'claro', 'palido']) assert.match(q[k], /^#[0-9a-f]{6}$/, k);
    const lum = (h) => 1 / p.contraste('#ffffff', h);
    assert.ok(lum(q.celeste) < lum(q.claro) && lum(q.claro) < lum(q.palido));
    assert.ok(lum(q.rey) < lum(q.medio) && lum(q.medio) < lum(q.celeste));
  });

  prueba('paleta: --medio se lee sobre blanco (>= 4.5) aunque el principal apenas pase', () => {
    for (const principal of ['#2e7d32', '#2b70b0', '#1155a4', '#7a3b12', '#0c3562']) {
      const q = p.paleta(principal, '#0c3562');
      assert.ok(p.contraste('#ffffff', q.medio) >= 4.5, principal + ' -> ' + q.medio);
      assert.equal(q.rey, principal);
    }
  });
  prueba('paleta: --medio también se lee sobre el fondo fijo de las filas (#eef5fc, >= 4.5)', () => {
    for (const principal of ['#0066cc', '#007a33', '#767676', '#d1001f', '#c4161c', '#1155a4', '#7a3b12']) {
      const q = p.paleta(principal, '#0c3562');
      assert.ok(p.contraste('#ffffff', q.medio) >= 4.5, 'blanco ' + principal + ' -> ' + q.medio);
      assert.ok(p.contraste('#eef5fc', q.medio) >= 4.5, 'fila ' + principal + ' -> ' + q.medio + ' ' + p.contraste('#eef5fc', q.medio));
    }
  });
  prueba('paleta: Ciudad Arce y San José conservan su --medio (ya pasaba)', () => {
    assert.equal(p.paleta('#1155a4', '#0c3562').medio, '#356fb2');
    assert.equal(p.paleta('#7a3b12', '#4a2008').medio, '#8e5836');
  });
  prueba('CONFIG_NEUTRA: mismo slug, colores base con contraste, sin logos ni fachada, sin nombre', () => {
    const n = p.CONFIG_NEUTRA;
    assert.equal(n.slug, p.SLUG);
    assert.equal(n.colores.principal, '#1155a4');
    assert.equal(n.colores.oscuro, '#0c3562');
    assert.ok(p.contraste('#ffffff', n.colores.principal) >= 4.5);
    assert.ok(p.contraste('#ffffff', n.colores.oscuro) >= 4.5);
    assert.ok(!n.logos || (!(n.logos.blanco && n.logos.blanco.src) && !(n.logos.color && n.logos.color.src)));
    assert.ok(!n.fachada);
    assert.equal(n.nombre, '');
  });
});

grupo('validarConfig: campos del rediseño (1)', () => {
  const p = cargarCon([], {}, CONFIG_CIUDAD_ARCE);
  const copia = (cambios) => {
    const c = JSON.parse(JSON.stringify(CONFIG_CIUDAD_ARCE));
    cambios(c);
    return c;
  };
  const errs = (cambios) => Array.from(p.validarConfig(copia(cambios)).errores).join(' | ');
  const img = (extra) => Object.assign({ id: 'foto-1', src: 'medios/foto-1.png', alt: 'Una foto' }, extra);

  prueba('colores.acento: opcional, #rrggbb, sin exigir contraste', () => {
    assert.ok(p.validarConfig(copia((c) => { c.colores.acento = '#d9a441'; })).ok);
    assert.ok(p.validarConfig(copia((c) => { c.colores.acento = '#ffff00'; })).ok, 'el acento no exige contraste con blanco');
    assert.match(errs((c) => { c.colores.acento = 'dorado'; }), /colores\.acento/);
  });
  prueba('rotulos: lora, source-sans, suaves, logoEsquina y colorLinea', () => {
    assert.ok(p.validarConfig(copia((c) => { c.colores.acento = '#d9a441'; c.rotulos = { tipografia: 'lora', esquinas: 'suaves', colorLado: '#4b0f18', colorLinea: 'acento', logoEsquina: false }; })).ok);
    assert.ok(p.validarConfig(copia((c) => { c.rotulos = { tipografia: 'source-sans', colorLinea: '#d9a441', logoEsquina: true }; })).ok);
  });
  prueba('rotulos.colorLado ya no exige contraste con blanco y acepta nombres', () => {
    assert.ok(p.validarConfig(copia((c) => { c.rotulos = { colorLado: 'blanco' }; })).ok);
    assert.ok(p.validarConfig(copia((c) => { c.rotulos = { colorLado: '#f2e6c8' }; })).ok);
    assert.ok(p.validarConfig(copia((c) => { c.rotulos = { colorLado: 'principal', colorLinea: 'oscuro' }; })).ok);
    assert.match(errs((c) => { c.rotulos = { colorLado: 'verde' }; }), /rotulos\.colorLado/);
  });
  prueba('colorLado o colorLinea en acento sin colores.acento es error', () => {
    const e = errs((c) => { c.rotulos = { colorLado: 'acento', colorLinea: 'acento' }; });
    assert.match(e, /rotulos\.colorLado/); assert.match(e, /rotulos\.colorLinea/);
    assert.match(e, /usa el acento, pero falta colores\.acento\./);
  });
  prueba('rotulos.colorLinea no acepta blanco; logoEsquina debe ser booleano', () => {
    const e = errs((c) => { c.rotulos = { colorLinea: 'blanco', logoEsquina: 'si' }; });
    assert.match(e, /colorLinea/); assert.match(e, /logoEsquina/);
  });
  prueba('galeria[].nombre opcional, texto de hasta 200', () => {
    assert.ok(p.validarConfig(copia((c) => { c.galeria = [img({ nombre: 'Fachada principal' })]; })).ok);
    assert.ok(p.validarConfig(copia((c) => { c.galeria = [img({ nombre: 'x'.repeat(200) })]; })).ok);
    assert.match(errs((c) => { c.galeria = [img({ nombre: 'x'.repeat(201) })]; }), /galeria\[0\]\.nombre/);
    assert.match(errs((c) => { c.galeria = [img({ nombre: 5 })]; }), /galeria\[0\]\.nombre/);
  });
  prueba('avisos[].activo opcional y booleano', () => {
    assert.ok(p.validarConfig(copia((c) => { c.avisos = [{ texto: 'A', activo: true }, { texto: 'B', activo: false }]; })).ok);
    assert.match(errs((c) => { c.avisos = [{ texto: 'A', activo: 'no' }]; }), /avisos\[0\]\.activo/);
  });
  prueba('horarios: forma nueva {dia, horas:[{hora, nota?}], lugar?} y la vieja conviven', () => {
    assert.ok(p.validarConfig(copia((c) => { c.horarios = [
      { dia: 'Domingo', horas: [{ hora: '7:00 a. m.' }, { hora: '6:00 p. m.', nota: 'Hora Santa' }], lugar: 'Templo parroquial' },
      { dia: 'Sábado', hora: '5:00 p. m.' }]; })).ok);
  });
  prueba('horarios: horas vacía, más de 6 horas, o hora y horas a la vez son errores', () => {
    assert.match(errs((c) => { c.horarios = [{ dia: 'Domingo', horas: [] }]; }), /horarios\[0\]\.horas/);
    const siete = Array.from({ length: 7 }, (_, i) => ({ hora: i + ':00' }));
    assert.match(errs((c) => { c.horarios = [{ dia: 'Domingo', horas: siete }]; }), /horarios\[0\]\.horas/);
    assert.ok(p.validarConfig(copia((c) => { c.horarios = [{ dia: 'Domingo', horas: siete.slice(0, 6) }]; })).ok);
    assert.match(errs((c) => { c.horarios = [{ dia: 'Domingo', hora: '7:00', horas: [{ hora: '8:00' }] }]; }), /horarios\[0\]\.horas/);
  });
  prueba('horarios: cada hora lleva hora obligatoria, nota y lugar opcionales de hasta 200', () => {
    assert.match(errs((c) => { c.horarios = [{ dia: 'Domingo', horas: [{ nota: 'sin hora' }] }]; }), /horarios\[0\]\.horas\[0\]\.hora/);
    assert.match(errs((c) => { c.horarios = [{ dia: 'Domingo', horas: [{ hora: '7:00', nota: 'x'.repeat(201) }] }]; }), /horarios\[0\]\.horas\[0\]\.nota/);
    assert.match(errs((c) => { c.horarios = [{ dia: 'Domingo', horas: [{ hora: '7:00' }], lugar: 'x'.repeat(201) }]; }), /horarios\[0\]\.lugar/);
  });
  prueba('horarios: el límite de 12 filas no cambia', () => {
    assert.match(errs((c) => { c.horarios = Array.from({ length: 13 }, () => ({ dia: 'D', hora: '1' })); }), /horarios/);
  });
  prueba('colorDe resuelve nombres y hex', () => {
    const col = { principal: '#1155a4', oscuro: '#0c3562', acento: '#d9a441' };
    assert.equal(p.colorDe('acento', col), '#d9a441'); assert.equal(p.colorDe('blanco', col), '#ffffff');
    assert.equal(p.colorDe('principal', col), '#1155a4'); assert.equal(p.colorDe('oscuro', col), '#0c3562');
    assert.equal(p.colorDe('#123456', col), '#123456'); assert.equal(p.colorDe('acento', { principal: '#1155a4', oscuro: '#0c3562' }), null);
    assert.equal(p.colorDe('rojo', col), null); assert.equal(p.colorDe(undefined, col), null);
  });
  prueba('constantes nuevas', () => {
    assert.deepEqual(Array.from(p.TIPOGRAFIAS), ['montserrat', 'lora', 'source-sans']);
    assert.deepEqual(Array.from(p.ESQUINAS_ROTULO), ['rectas', 'suaves', 'redondas', 'redondeadas']);   // F6:24, más el nombre viejo
    assert.deepEqual(Object.assign({}, p.ESQUINAS_DISENO), { rectas: 'rectas', suaves: 'suaves', redondas: 'redondas', redondeadas: 'suaves' });
    assert.deepEqual(Array.from(p.COLORES_CON_NOMBRE), ['principal', 'oscuro', 'acento', 'blanco']);
  });
});

grupo('validarConfig: campos del rediseño (2)', () => {
  const p = cargarCon([], {}, CONFIG_CIUDAD_ARCE);
  const copia = (cambios) => {
    const c = JSON.parse(JSON.stringify(CONFIG_CIUDAD_ARCE));
    cambios(c);
    return c;
  };
  const errs = (cambios) => Array.from(p.validarConfig(copia(cambios)).errores).join(' | ');

  prueba('pantallas evento, produccion y envivo son válidas; mostrar acepta redes y horarios', () => {
    const r = p.validarConfig(copia((c) => { c.pantallas = {
      evento: { modo: 'personalizada', ocultar: ['franja'] },
      produccion: { modo: 'personalizada', ocultar: ['marca'], textos: { prod_ceja: 'UN TRABAJO DE', prod_nombre: 'Pastoral' } },
      envivo: { modo: 'personalizada', ocultar: ['envivo'] },
      inicio: { modo: 'personalizada', ocultar: ['cuenta'], mostrar: ['redes'] },
      horarios: { modo: 'personalizada', mostrar: ['redes', 'horarios'] } }; }));
    assert.deepEqual(Array.from(r.errores), []);
    assert.ok(r.ok);
  });
  prueba('mostrar con un elemento desconocido es error', () => {
    const e = errs((c) => { c.pantallas = { inicio: { modo: 'personalizada', mostrar: ['logo'] } }; });
    assert.ok(e.includes('pantallas.inicio.mostrar[0]'), e);
  });
  prueba('mostrar que no es lista, o con más de dos elementos, es error', () => {
    assert.ok(errs((c) => { c.pantallas = { inicio: { mostrar: 'redes' } }; }).includes('pantallas.inicio.mostrar'));
    assert.ok(errs((c) => { c.pantallas = { inicio: { mostrar: ['redes', 'horarios', 'redes'] } }; }).includes('pantallas.inicio.mostrar'));
  });
  prueba('las listas nuevas coinciden con lo pedido', () => {
    assert.deepEqual(Array.from(p.VISTAS_PERSONALIZABLES), ['inicio', 'portada', 'gracias', 'avisos', 'horarios', 'evento', 'produccion', 'envivo']);
    assert.ok(p.ELEMENTOS_OCULTABLES.includes('cuenta'));
    assert.deepEqual(Array.from(p.ELEMENTOS_MOSTRABLES), ['redes', 'horarios']);
    assert.ok(p.CLAVES_TEXTOS.includes('prod_ceja') && p.CLAVES_TEXTOS.includes('prod_nombre'));
    assert.deepEqual(Array.from(p.PORTADAS_PROPIO), ['ninguna', 'fiesta', 'evento']);
  });
  prueba('tipos.ajustes: claves comunes, textos, imagen y ocultarRotulos del propio tipo', () => {
    const r = p.validarConfig(copia((c) => { c.tipos = { ajustes: { horasanta: { nombrePanel: 'Hora Santa', textoInicio: 'En breve comenzamos', textoGracias: 'Gracias por adorar con nosotros', imagen: 'custodia', ocultarRotulos: ['bendicion'] } } }; }));
    assert.deepEqual(Array.from(r.errores), []);
    assert.ok(r.ok);
  });
  prueba('tipos.ajustes: clave desconocida, rótulo ajeno, imagen de galería inexistente y nombrePanel de 41 son errores', () => {
    const e = errs((c) => { c.tipos = { ajustes: {
      navidad: {}, dominical: { ocultarRotulos: ['santisimo'], imagen: 'galeria:no-existe', nombrePanel: 'x'.repeat(41) } } }; });
    ['tipos.ajustes.navidad', 'tipos.ajustes.dominical.ocultarRotulos[0]', 'tipos.ajustes.dominical.imagen', 'tipos.ajustes.dominical.nombrePanel'].forEach((k) => assert.ok(e.includes(k), k + ' en ' + e));
  });
  prueba('tipos.ajustes: imagen automatica no aplica, nombrePanel vacío y textos largos son errores; un tipo apagado admite ajustes', () => {
    const e = errs((c) => { c.tipos = { ajustes: { dominical: { imagen: 'automatica', nombrePanel: '', textoInicio: 'x'.repeat(201), textoGracias: 5 } } }; });
    ['tipos.ajustes.dominical.imagen', 'tipos.ajustes.dominical.nombrePanel', 'tipos.ajustes.dominical.textoInicio', 'tipos.ajustes.dominical.textoGracias'].forEach((k) => assert.ok(e.includes(k), k + ' en ' + e));
    assert.ok(errs((c) => { c.tipos = { ajustes: [] }; }).includes('tipos.ajustes'));
    assert.ok(errs((c) => { c.tipos = { ajustes: { semana: [] } }; }).includes('tipos.ajustes.semana'));
    assert.ok(errs((c) => { c.tipos = { ajustes: { semana: { ocultarRotulos: 'persona' } } }; }).includes('tipos.ajustes.semana.ocultarRotulos'));
    assert.ok(p.validarConfig(copia((c) => { c.tipos = { apagados: ['procesion'], ajustes: { procesion: { nombrePanel: 'Procesión' } } }; })).ok);
  });
  prueba('tipos.propios: nombrePanel, textoInicio, textoGracias y portada', () => {
    const base = { clave: 'misa-de-ninos', nombre: 'Misa de niños' };
    const ok = p.validarConfig(copia((c) => { c.tipos = { propios: [Object.assign({ nombrePanel: 'Niños', textoInicio: 'Ya empezamos', textoGracias: 'Gracias', portada: 'fiesta' }, base)] }; }));
    assert.deepEqual(Array.from(ok.errores), []);
    for (const v of ['ninguna', 'fiesta', 'evento']) {
      assert.ok(p.validarConfig(copia((c) => { c.tipos = { propios: [Object.assign({ portada: v }, base)] }; })).ok, v);
    }
    const e = errs((c) => { c.tipos = { propios: [Object.assign({ portada: 'otra', nombrePanel: 'x'.repeat(41), textoInicio: 'x'.repeat(201) }, base)] }; });
    ['tipos.propios[0].portada', 'tipos.propios[0].nombrePanel', 'tipos.propios[0].textoInicio'].forEach((k) => assert.ok(e.includes(k), k + ' en ' + e));
  });
});

grupo('aplicar paleta', () => {
  prueba('aplicarPaleta pone las seis variables CSS de :root y los tintes del diseño con los colores de la parroquia', () => {
    const puestas = {};
    const documento = { addEventListener() {}, querySelector: () => null, querySelectorAll: () => [], getElementById: () => null,
      documentElement: {
        style: { setProperty: (k, v) => { puestas[k] = v; }, removeProperty: (k) => { delete puestas[k]; } },
        classList: { add() {}, remove() {}, toggle() {}, contains: () => false }
      } };
    const c = cargarCon([], {}, CONFIG_SAN_JOSE, { document: documento });
    c.aplicarPaleta(CONFIG_SAN_JOSE);
    assert.deepEqual(Object.keys(puestas).sort(), ['--celeste', '--claro', '--fila-texto', '--gris', '--medio', '--oscuro', '--palido', '--papel', '--rey', '--tenue', '--tenue-rgb', '--tinta', '--velo', '--vivo', '--vivo-rgb']);
    assert.equal(puestas['--rey'], '#7a3b12');
    const t = c.tintes('#7a3b12', '#4a2008');
    assert.equal(puestas['--vivo'], t.vivo);
    assert.equal(puestas['--fila-texto'], t.filaTexto);
    assert.match(puestas['--vivo-rgb'], /^\d{1,3}, \d{1,3}, \d{1,3}$/);
    assert.equal(puestas['--oscuro'], '#4a2008');
  });
  /* documentElement falso que anota variables y clases. */
  const raizFalsa = () => {
    const vars = {};
    const clases = new Set();
    return {
      vars, clases,
      documento: {
        addEventListener() {}, querySelector: () => null, querySelectorAll: () => [], getElementById: () => null,
        documentElement: {
          style: { setProperty: (k, v) => { vars[k] = v; }, removeProperty: (k) => { delete vars[k]; } },
          classList: {
            add: (k) => { clases.add(k); },
            remove: (k) => { clases.delete(k); },
            toggle: (k, si) => { if (si) clases.add(k); else clases.delete(k); return !!si; },
            contains: (k) => clases.has(k)
          }
        }
      }
    };
  };
  const conAcento = (acento) => Object.assign({}, CONFIG_SAN_JOSE, { colores: Object.assign({}, CONFIG_SAN_JOSE.colores, { acento }) });
  prueba('aplicarPaleta con colores.acento pone --acento y la clase con-acento', () => {
    const r = raizFalsa();
    const c = cargarCon([], {}, conAcento('#d9a441'), { document: r.documento });
    c.aplicarPaleta(conAcento('#d9a441'));
    assert.equal(r.vars['--acento'], '#d9a441');
    assert.equal(r.vars['--acento-claro'], '#f0d08f');
    assert.ok(r.clases.has('con-acento'));
    assert.equal(r.vars['--rey'], '#7a3b12');
  });
  prueba('aplicarPaleta sin acento quita --acento y la clase con-acento, y no agrega otras', () => {
    const r = raizFalsa();
    const c = cargarCon([], {}, CONFIG_SAN_JOSE, { document: r.documento });
    c.aplicarPaleta(conAcento('#d9a441'));
    c.aplicarPaleta(CONFIG_SAN_JOSE);
    assert.equal(r.vars['--acento'], undefined);
    assert.equal(r.vars['--acento-claro'], undefined);
    assert.equal(r.clases.size, 0);
    assert.deepEqual(Object.keys(r.vars).sort(), ['--celeste', '--claro', '--fila-texto', '--gris', '--medio', '--oscuro', '--palido', '--papel', '--rey', '--tenue', '--tenue-rgb', '--tinta', '--velo', '--vivo', '--vivo-rgb']);
  });
  prueba('aplicarPaleta con un acento que no es #rrggbb lo trata como ausente', () => {
    const r = raizFalsa();
    const c = cargarCon([], {}, CONFIG_SAN_JOSE, { document: r.documento });
    c.aplicarPaleta(conAcento('dorado'));
    assert.equal(r.vars['--acento'], undefined);
    assert.equal(r.clases.has('con-acento'), false);
  });
});

grupo('tintes del diseño', () => {
  /* Artboards F4 (VicEdPantallas.dc.html, líneas 25, 31 y 35): los tintes vino del diseño. */
  const p = cargarCon([], {}, CONFIG_CIUDAD_ARCE);
  const plano = (o) => Object.assign({}, o);
  const COLORES = ['#8a1c2b', '#1155a4', '#7a3b12', '#2e7d32', '#6a1b9a', '#00695c', '#4e342e'];
  prueba('San José da los valores exactos del artboard', () => {
    const t = p.tintes('#8a1c2b', '#4b0f18', '#d9a441');
    assert.deepEqual(plano(t), { vivo: '#c0485a', tenue: '#f2d6da', velo: '#fbeef0', tinta: '#3a2a2c', gris: '#5a4a4c', papel: '#faf6f3', filaTexto: '#8a1c2b', acentoClaro: '#f0d08f' });
  });
  prueba('Ciudad Arce: el mismo tratamiento en azul', () => {
    const t = p.tintes('#1155a4', '#0c3562');
    assert.deepEqual(plano(t), { vivo: '#3176c3', tenue: '#d3e3f5', velo: '#edf4fc', tinta: '#28313c', gris: '#48515c', papel: '#f3f2fb', filaTexto: '#1155a4', acentoClaro: null });
  });
  prueba('--vivo siempre se lee sobre blanco (>= 4.5); --fila-texto sobre --velo (>= 4.5)', () => {
    for (const c of COLORES) {
      const t = p.tintes(c, '#222222');
      assert.ok(p.contraste('#ffffff', t.vivo) >= 4.5, c + ' -> ' + t.vivo);
      assert.ok(p.contraste(t.velo, t.filaTexto) >= 4.5, c + ' -> ' + t.filaTexto);
    }
  });
  prueba('--tenue se lee sobre --vivo como texto grande (>= 3)', () => {
    for (const c of COLORES) {
      const t = p.tintes(c, '#222222');
      assert.ok(p.contraste(t.tenue, t.vivo) >= 3, c + ': ' + t.tenue + ' sobre ' + t.vivo);
    }
  });
  prueba('principal muy claro: --fila-texto cae al oscuro', () => {
    const t = p.tintes('#9fc5ee', '#0c3562');
    assert.equal(t.filaTexto, '#0c3562');
  });
  prueba('todos los tintes son #rrggbb', () => {
    for (const c of COLORES) {
      const t = p.tintes(c, '#222222', '#3366cc');
      for (const k of Object.keys(t)) assert.match(t[k], /^#[0-9a-f]{6}$/, c + ' ' + k);
    }
  });
});

grupo('cargar parroquia', () => {
  const CIUDAD_ARCE = {
    esquema: 1, version: 1, publicado: '2026-11-07T12:00:00Z', slug: 'ciudad-arce',
    nombre: 'Parroquia Inmaculada Concepción de María', lugar: 'Ciudad Arce, La Libertad',
    colores: { principal: '#1155a4', oscuro: '#0c3562' },
    logos: { blanco: { src: 'medios/logo-blanco.png', alt: 'Logo de la parroquia' } },
    fachada: { src: 'medios/fachada.jpg', alt: 'Fachada del templo' },
    patrono: { nombre: 'Inmaculada Concepción de María', corto: 'Inmaculada' },
    fiesta: { dia: 8, mes: 12 }
  };
  const version = (n, extra) => Object.assign({}, CIUDAD_ARCE, { version: n }, extra || {});
  const CLAVE = 'pev_ciudad-arce_config_v1';
  const AVISO_COPIA = 'Usando la configuración guardada del 7 de noviembre de 2026';
  const AVISO_SIN_RED = 'Sin conexión y sin configuración guardada: se muestran pantallas neutras.';
  const AVISO_DANADA = 'La configuración del servidor está dañada: se usa la guardada.';

  // Respuesta falsa de fetch. cuerpo: objeto (JSON válido) o texto (JSON roto).
  const respuesta = (estado, cuerpo) => ({
    ok: estado >= 200 && estado < 300,
    status: estado,
    json: () => Promise.resolve().then(() => (typeof cuerpo === 'string' ? JSON.parse(cuerpo) : cuerpo))
  });
  // Servidor falso: cada llamada a fetch toma el siguiente paso (el último se repite). Anota los pedidos.
  const SIN_RED = new Error('sin red');
  const servidor = (...pasos) => {
    const f = (url, opciones) => {
      f.pedidos.push({ url, opciones });
      const paso = pasos[Math.min(f.pedidos.length - 1, pasos.length - 1)];
      return paso instanceof Error ? Promise.reject(paso) : Promise.resolve(paso);
    };
    f.pedidos = [];
    return f;
  };
  const nueva = (almacen, fetchFalso, ruta = '/ciudad-arce/panel.html') =>
    cargar(['parroquia.js'], almacen, { location: { pathname: ruta }, fetch: fetchFalso });
  // PARROQUIA, ESTADO_CONFIG y PARROQUIA_NO_EXISTE son enlaces `let` de un script clásico que se reasignan:
  // se leen en vivo dentro del contexto (la copia que hace cargar() es solo una foto del arranque).
  const leer = (c, nombre) => vm.runInContext(nombre, c);

  prueba('sin copia y sin red: configuración neutra, origen neutra y aviso', async () => {
    const c = nueva({}, servidor(SIN_RED));
    await c.cargarParroquia();
    assert.equal(leer(c, 'PARROQUIA'), c.CONFIG_NEUTRA);
    assert.equal(leer(c, 'ESTADO_CONFIG').origen, 'neutra');
    assert.equal(leer(c, 'ESTADO_CONFIG').aviso, AVISO_SIN_RED);
    assert.equal(leer(c, 'PARROQUIA_NO_EXISTE'), false);
  });
  prueba('con copia y sin red: usa la copia y el aviso lleva la fecha de publicación', async () => {
    const c = nueva({ [CLAVE]: JSON.stringify(CIUDAD_ARCE) }, servidor(SIN_RED));
    await c.cargarParroquia();
    assert.equal(leer(c, 'PARROQUIA').version, 1);
    assert.equal(leer(c, 'PARROQUIA').nombre, CIUDAD_ARCE.nombre);
    assert.equal(leer(c, 'ESTADO_CONFIG').origen, 'copia');
    assert.equal(leer(c, 'ESTADO_CONFIG').aviso, AVISO_COPIA);
  });
  prueba('al cargar el script, una copia válida ya es la configuración en uso (antes de pedir nada)', () => {
    const c = nueva({ [CLAVE]: JSON.stringify(CIUDAD_ARCE) }, servidor(SIN_RED));
    assert.equal(leer(c, 'PARROQUIA').nombre, CIUDAD_ARCE.nombre);
    assert.equal(leer(c, 'ESTADO_CONFIG').origen, 'copia');
    assert.equal(leer(c, 'ESTADO_CONFIG').aviso, AVISO_COPIA);
    const d = nueva({}, servidor(SIN_RED));
    assert.equal(leer(d, 'PARROQUIA'), d.CONFIG_NEUTRA);
    assert.equal(leer(d, 'ESTADO_CONFIG').origen, 'neutra');
  });
  prueba('pide config.json relativo a la página y sin caché', async () => {
    const f = servidor(respuesta(200, CIUDAD_ARCE));
    await nueva({}, f).cargarParroquia();
    assert.equal(f.pedidos.length, 1);
    assert.equal(f.pedidos[0].url, 'config.json');
    assert.equal(f.pedidos[0].opciones.cache, 'no-store');
  });
  prueba('el servidor responde una configuración válida: origen servidor, guardada, sin aviso', async () => {
    const c = nueva({}, servidor(respuesta(200, CIUDAD_ARCE)));
    await c.cargarParroquia();
    assert.equal(leer(c, 'PARROQUIA').version, 1);
    assert.equal(leer(c, 'ESTADO_CONFIG').origen, 'servidor');
    assert.equal(leer(c, 'ESTADO_CONFIG').aviso, '');
    assert.equal(leer(c, 'PARROQUIA_NO_EXISTE'), false);
    assert.equal(JSON.parse(c.__almacen[CLAVE]).version, 1);
  });
  prueba('JSON roto del servidor: sigue la copia con el aviso de configuración dañada', async () => {
    const c = nueva({ [CLAVE]: JSON.stringify(CIUDAD_ARCE) }, servidor(respuesta(200, '{roto')));
    await c.cargarParroquia();
    assert.equal(leer(c, 'PARROQUIA').version, 1);
    assert.equal(leer(c, 'ESTADO_CONFIG').origen, 'copia');
    assert.equal(leer(c, 'ESTADO_CONFIG').aviso, AVISO_DANADA);
    assert.equal(JSON.parse(c.__almacen[CLAVE]).version, 1);
  });
  prueba('esquema 2 del servidor: sigue la copia y no la pisa', async () => {
    const c = nueva({ [CLAVE]: JSON.stringify(CIUDAD_ARCE) }, servidor(respuesta(200, version(5, { esquema: 2 }))));
    await c.cargarParroquia();
    assert.equal(leer(c, 'PARROQUIA').version, 1);
    assert.equal(leer(c, 'ESTADO_CONFIG').aviso, AVISO_DANADA);
    assert.equal(JSON.parse(c.__almacen[CLAVE]).version, 1);
  });
  prueba('configuración dañada del servidor y sin copia: pantallas neutras, nada guardado', async () => {
    const c = nueva({}, servidor(respuesta(200, version(1, { esquema: 2 }))));
    await c.cargarParroquia();
    assert.equal(leer(c, 'PARROQUIA'), c.CONFIG_NEUTRA);
    assert.equal(leer(c, 'ESTADO_CONFIG').origen, 'neutra');
    assert.ok(leer(c, 'ESTADO_CONFIG').aviso.includes('dañada'));
    assert.ok(!(CLAVE in c.__almacen));
  });
  prueba('versión nueva: el oyente se llama una vez con la 2; repetir la 2 no avisa de nuevo', async () => {
    const c = nueva({ [CLAVE]: JSON.stringify(CIUDAD_ARCE) }, servidor(respuesta(200, version(2))));
    const avisos = [];
    c.alCambiarParroquia((cfg) => avisos.push(cfg.version));
    await c.cargarParroquia();
    assert.deepEqual(avisos, [2]);
    assert.equal(leer(c, 'PARROQUIA').version, 2);
    assert.equal(JSON.parse(c.__almacen[CLAVE]).version, 2);
    await c.cargarParroquia();
    assert.deepEqual(avisos, [2]);
  });
  prueba('el oyente recibe la configuración nueva como argumento', async () => {
    const c = nueva({}, servidor(respuesta(200, CIUDAD_ARCE)));
    let recibida = null;
    c.alCambiarParroquia((cfg) => { recibida = cfg; });
    await c.cargarParroquia();
    assert.equal(recibida, leer(c, 'PARROQUIA'));
  });
  prueba('un oyente que falla no impide avisar a los demás ni a cargarParroquia', async () => {
    const c = nueva({}, servidor(respuesta(200, CIUDAD_ARCE)));
    let segundo = 0;
    c.alCambiarParroquia(() => { throw new Error('oyente roto'); });
    c.alCambiarParroquia(() => { segundo++; });
    await c.cargarParroquia();
    assert.equal(segundo, 1);
  });
  prueba('también se avisa cuando cambia PARROQUIA_NO_EXISTE o el estado, y no si todo sigue igual', async () => {
    const c = nueva({}, servidor(SIN_RED, respuesta(404, {}), respuesta(404, {})));
    let n = 0;
    c.alCambiarParroquia(() => { n++; });
    await c.cargarParroquia(); // neutra, sin red: el aviso pasa de vacío a «Sin conexión…»
    assert.equal(n, 1);
    await c.cargarParroquia(); // 404 sin copia: NO_EXISTE pasa a true
    assert.equal(n, 2);
    assert.equal(leer(c, 'PARROQUIA_NO_EXISTE'), true);
    await c.cargarParroquia(); // otro 404 igual: nada cambia
    assert.equal(n, 2);
  });
  prueba('una copia guardada de otra parroquia (pev_otra_config_v1) se ignora', async () => {
    const c = nueva({ pev_otra_config_v1: JSON.stringify(Object.assign({}, CIUDAD_ARCE, { slug: 'otra' })) }, servidor(SIN_RED));
    await c.cargarParroquia();
    assert.equal(leer(c, 'PARROQUIA'), c.CONFIG_NEUTRA);
    assert.equal(leer(c, 'ESTADO_CONFIG').origen, 'neutra');
  });
  prueba('una copia con otro slug dentro (guardada en la clave de este) se ignora', async () => {
    const c = nueva({ [CLAVE]: JSON.stringify(Object.assign({}, CIUDAD_ARCE, { slug: 'otra' })) }, servidor(SIN_RED));
    await c.cargarParroquia();
    assert.equal(leer(c, 'PARROQUIA'), c.CONFIG_NEUTRA);
    assert.equal(leer(c, 'ESTADO_CONFIG').origen, 'neutra');
  });
  prueba('una copia ilegible se ignora', () => {
    const c = nueva({ [CLAVE]: 'no-es-json' }, servidor(SIN_RED));
    assert.equal(leer(c, 'PARROQUIA'), c.CONFIG_NEUTRA);
  });
  prueba('404 sin copia: PARROQUIA_NO_EXISTE es true y se muestra la neutra', async () => {
    const c = nueva({}, servidor(respuesta(404, {})));
    await c.cargarParroquia();
    assert.equal(leer(c, 'PARROQUIA_NO_EXISTE'), true);
    assert.equal(leer(c, 'PARROQUIA'), c.CONFIG_NEUTRA);
    assert.equal(leer(c, 'ESTADO_CONFIG').origen, 'neutra');
  });
  prueba('404 con copia: PARROQUIA_NO_EXISTE es false, sigue la copia y el aviso lo explica', async () => {
    const c = nueva({ [CLAVE]: JSON.stringify(CIUDAD_ARCE) }, servidor(respuesta(404, {})));
    await c.cargarParroquia();
    assert.equal(leer(c, 'PARROQUIA_NO_EXISTE'), false);
    assert.equal(leer(c, 'PARROQUIA').version, 1);
    assert.equal(leer(c, 'ESTADO_CONFIG').origen, 'copia');
    assert.equal(leer(c, 'ESTADO_CONFIG').aviso,
      'El link de esta parroquia ya no está en el servidor. Se usa la configuración guardada del 7 de noviembre de 2026.');
  });
  prueba('un error del servidor (500) se trata como falta de red, no como «no existe»', async () => {
    const c = nueva({}, servidor(respuesta(500, {})));
    await c.cargarParroquia();
    assert.equal(leer(c, 'PARROQUIA_NO_EXISTE'), false);
    assert.equal(leer(c, 'ESTADO_CONFIG').aviso, AVISO_SIN_RED);
  });
  prueba('si el servidor vuelve a responder bien, el aviso se limpia y NO_EXISTE vuelve a false', async () => {
    const c = nueva({}, servidor(respuesta(404, {}), respuesta(200, CIUDAD_ARCE)));
    await c.cargarParroquia();
    assert.equal(leer(c, 'PARROQUIA_NO_EXISTE'), true);
    await c.cargarParroquia();
    assert.equal(leer(c, 'PARROQUIA_NO_EXISTE'), false);
    assert.equal(leer(c, 'ESTADO_CONFIG').aviso, '');
    assert.equal(leer(c, 'ESTADO_CONFIG').origen, 'servidor');
  });
  prueba('slug inválido: PARROQUIA_NO_EXISTE es true desde el arranque y no se pide nada', async () => {
    const f = servidor(respuesta(200, CIUDAD_ARCE));
    const c = nueva({}, f, '/panel.html');
    assert.equal(leer(c, 'PARROQUIA_NO_EXISTE'), true);
    await c.cargarParroquia();
    assert.equal(f.pedidos.length, 0);
    assert.equal(leer(c, 'PARROQUIA_NO_EXISTE'), true);
  });
  prueba('la configuración neutra nunca se guarda ni cuenta como copia', async () => {
    const c = nueva({}, servidor(SIN_RED));
    await c.cargarParroquia();
    assert.ok(!(CLAVE in c.__almacen));
    const d = nueva({ [CLAVE]: JSON.stringify(c.CONFIG_NEUTRA) }, servidor(SIN_RED));
    await d.cargarParroquia();
    assert.equal(leer(d, 'ESTADO_CONFIG').origen, 'neutra');
    assert.equal(leer(d, 'ESTADO_CONFIG').aviso, AVISO_SIN_RED);
  });
  prueba('si el navegador no deja guardar, la configuración del servidor se usa igual', async () => {
    const c = nueva({}, servidor(respuesta(200, CIUDAD_ARCE)));
    c.localStorage.setItem = () => { throw new Error('cuota'); };
    await c.cargarParroquia();
    assert.equal(leer(c, 'PARROQUIA').version, 1);
    assert.equal(leer(c, 'ESTADO_CONFIG').origen, 'servidor');
  });
  prueba('la fecha del aviso sale de publicado, en español', async () => {
    const c = nueva({ [CLAVE]: JSON.stringify(version(1, { publicado: '2026-01-31T12:00:00Z' })) }, servidor(SIN_RED));
    await c.cargarParroquia();
    assert.equal(leer(c, 'ESTADO_CONFIG').aviso, 'Usando la configuración guardada del 31 de enero de 2026');
  });
  prueba('vigilarParroquia carga ya y vuelve a cargar cada ms (60000 por defecto)', async () => {
    const f = servidor(respuesta(200, CIUDAD_ARCE));
    const tics = [];
    const c = cargar(['parroquia.js'], {}, {
      location: { pathname: '/ciudad-arce/panel.html' }, fetch: f,
      setInterval: (fn, ms) => { tics.push({ fn, ms }); return 1; }
    });
    c.vigilarParroquia();
    assert.equal(f.pedidos.length, 1);
    assert.equal(tics.length, 1);
    assert.equal(tics[0].ms, 60000);
    tics[0].fn(); // el primer pedido sigue en vuelo: este tic se salta
    assert.equal(f.pedidos.length, 1);
    await c.cargarParroquia(); // deja terminar el pedido en vuelo
    tics[0].fn();
    assert.equal(f.pedidos.length, 2);
    await c.cargarParroquia();
    c.vigilarParroquia(5000);
    assert.equal(tics[1].ms, 5000);
    await c.cargarParroquia();
  });
  prueba('dos cargarParroquia() a la vez hacen un solo pedido y devuelven la misma promesa', async () => {
    const f = servidor(respuesta(200, CIUDAD_ARCE));
    const c = nueva({}, f);
    const a = c.cargarParroquia();
    const b = c.cargarParroquia();
    assert.equal(a, b);
    await Promise.all([a, b]);
    assert.equal(f.pedidos.length, 1);
    await c.cargarParroquia(); // ya terminó: un pedido nuevo sí se hace
    assert.equal(f.pedidos.length, 2);
  });
  prueba('un pedido que nunca responde termina como sin red al vencer el plazo de 20 s', async () => {
    const plazos = [];
    const colgado = (url, opciones) => new Promise((_, rechazar) => {
      opciones.signal.addEventListener('abort', () => rechazar(new Error('abortado')));
    });
    const c = cargar(['parroquia.js'], { [CLAVE]: JSON.stringify(CIUDAD_ARCE) }, {
      location: { pathname: '/ciudad-arce/panel.html' }, fetch: colgado, AbortController,
      setTimeout: (fn, ms) => { plazos.push({ fn, ms }); return plazos.length; }, clearTimeout() {}
    });
    const p = c.cargarParroquia();
    assert.equal(plazos.length, 1);
    assert.equal(plazos[0].ms, 20000);
    plazos[0].fn(); // vence el plazo
    await p;
    assert.equal(leer(c, 'ESTADO_CONFIG').aviso, AVISO_COPIA);
    // la vuelta siguiente no queda bloqueada
    const q = c.cargarParroquia();
    assert.equal(plazos.length, 2);
    plazos[1].fn();
    await q;
  });
  prueba('sin AbortController se pide igual, sin señal', async () => {
    const f = servidor(respuesta(200, CIUDAD_ARCE));
    await nueva({}, f).cargarParroquia();
    assert.equal(f.pedidos.length, 1);
    assert.equal(f.pedidos[0].opciones.signal, undefined);
  });
  for (const [nombre, cuerpo] of [['un número', 5], ['null', null], ['una lista', []], ['un texto', 'hola']]) {
    prueba('JSON que no es un objeto (' + nombre + '): configuración dañada, no «sin conexión»', async () => {
      const c = nueva({ [CLAVE]: JSON.stringify(CIUDAD_ARCE) }, servidor(respuesta(200, JSON.stringify(cuerpo))));
      await c.cargarParroquia();
      assert.equal(leer(c, 'ESTADO_CONFIG').aviso, AVISO_DANADA);
    });
  }
});

/* ---------- Parroquias de ejemplo y servidor local (Tarea 7) ---------- */

grupo('parroquias de ejemplo', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const RAIZ = path.join(__dirname, '..', '..', 'vicaria');
  const leerConfig = (slug) => JSON.parse(fs.readFileSync(path.join(RAIZ, slug, 'config.json'), 'utf8'));

  for (const slug of ['ciudad-arce', 'san-jose-ejemplo']) {
    prueba(slug + '/config.json es válido (con el slug de su carpeta)', () => {
      const config = leerConfig(slug);
      const c = cargar(['parroquia.js'], {}, { location: { pathname: '/' + slug + '/panel.html' } });
      const r = c.validarConfig(config);
      assert.deepEqual(Array.from(r.errores), []);
      assert.equal(r.ok, true);
      assert.equal(config.slug, slug);
    });
    prueba(slug + ': todas las imágenes de la configuración existen en medios/', () => {
      const config = leerConfig(slug);
      const imgs = [config.logos.blanco, config.logos.color, config.fachada, config.patrono.imagen].filter(Boolean);
      for (const img of imgs) assert.ok(fs.statSync(path.join(RAIZ, slug, img.src)).isFile(), img.src);
    });
  }
  prueba('San José de ejemplo: colores, fiesta 19/3, patrono, sin imagen de patrono y sin lema', () => {
    const c = leerConfig('san-jose-ejemplo');
    assert.deepEqual(c.colores, { principal: '#8a1c2b', oscuro: '#4b0f18' });
    assert.deepEqual([c.fiesta.dia, c.fiesta.mes], [19, 3]);
    assert.equal(c.patrono.nombre, 'San José');
    assert.equal(c.nombre, 'Parroquia San José (ejemplo)');
    assert.equal(c.patrono.imagen, undefined);
    assert.equal(c.fiesta.lema, undefined);
  });
  prueba('Ciudad Arce conserva los textos de obs/: lema, fiesta 8/12 y colores de estilos.css', () => {
    const c = leerConfig('ciudad-arce');
    assert.equal(c.fiesta.lema, 'TODA HERMOSA ERES, MARÍA');
    assert.deepEqual([c.fiesta.dia, c.fiesta.mes], [8, 12]);
    assert.deepEqual(c.colores, { principal: '#1155a4', oscuro: '#0c3562' });
  });
});

grupo('servidor-vicaria: tipos de contenido', () => {
  const { TIPOS } = require('../../herramientas/servidor-vicaria');
  prueba('sirve .webp y .jpeg con su tipo (RUTA_MEDIO los acepta)', () => {
    assert.equal(TIPOS['.webp'], 'image/webp');
    assert.equal(TIPOS['.jpeg'], 'image/jpeg');
    assert.equal(TIPOS['.jpg'], 'image/jpeg');
  });
});

grupo('servidor-vicaria: patrones de vercel.json', () => {
  const { compilarPatron, emparejar } = require('../../herramientas/servidor-vicaria');
  const fs = require('node:fs');
  const path = require('node:path');
  const reglas = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'vicaria', 'vercel.json'), 'utf8'));

  prueba(':nombre(a|b) acepta solo esas opciones y deja el punto literal', () => {
    const p = compilarPatron('/:slug/:pagina(panel|pantalla).html');
    assert.deepEqual(emparejar(p, '/ciudad-arce/panel.html'), { slug: 'ciudad-arce', pagina: 'panel' });
    assert.equal(emparejar(p, '/ciudad-arce/otra.html'), null);
    assert.equal(emparejar(p, '/ciudad-arce/panelXhtml'), null);
    assert.equal(emparejar(p, '/a/b/panel.html'), null);
  });
  prueba('un patrón que el servidor no entiende se rechaza en vez de ignorarse', () => {
    assert.throws(() => compilarPatron('/:slug/(panel).html'), /no soportado/);
    assert.throws(() => compilarPatron('/:slug/:archivo*'), /no soportado/);
  });
  prueba('todos los source de vercel.json se pueden compilar', () => {
    for (const r of reglas.rewrites.concat(reglas.headers)) compilarPatron(r.source);
  });
  prueba('pantallas.js se sirve desde la raíz como los demás scripts', () => {
    const r = reglas.rewrites.find((x) => emparejar(compilarPatron(x.source), '/ciudad-arce/pantallas.js'));
    assert.ok(r, 'falta la regla de pantallas.js');
    const m = emparejar(compilarPatron(r.source), '/ciudad-arce/pantallas.js');
    assert.equal(r.destination.replace(':script', m.script), '/pantallas.js');
  });
  prueba('LEEME-config.md existe pero ninguna regla de vercel.json lo sirve bajo /<slug>/ (da 404)', () => {
    assert.ok(fs.statSync(path.join(__dirname, '..', '..', 'vicaria', 'LEEME-config.md')).isFile());
    for (const ruta of ['/san-jose-ejemplo/LEEME-config.md', '/ciudad-arce/LEEME-config.md']) {
      const r = reglas.rewrites.concat(reglas.headers).find((x) => emparejar(compilarPatron(x.source), ruta));
      assert.equal(r, undefined, ruta);
    }
  });
  prueba('config.json lleva Cache-Control must-revalidate', () => {
    const h = reglas.headers.find((x) => emparejar(compilarPatron(x.source), '/ciudad-arce/config.json'));
    assert.ok(h);
    assert.deepEqual(h.headers, [{ key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' }]);
  });
  const cabecerasDe = (ruta) => {
    const k = {};
    for (const h of reglas.headers) if (emparejar(compilarPatron(h.source), ruta)) for (const kv of h.headers) k[kv.key] = kv.value;
    return k;
  };
  const CSP = "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'";
  prueba('toda imagen de medios/ lleva la CSP; la de repo sin versión no es immutable', () => {
    for (const ruta of ['/ciudad-arce/medios/logo-blanco.png', '/san-jose-ejemplo/medios/x.svg']) {
      assert.deepEqual(cabecerasDe(ruta), { 'Content-Security-Policy': CSP }, ruta);
    }
  });
  prueba('solo lo publicado (v<N>-nombre-<8 hex>.ext) lleva caché immutable, además de la CSP', () => {
    assert.deepEqual(cabecerasDe('/x-y/medios/v1-fachada-0a1b2c3d.png'), {
      'Content-Security-Policy': CSP,
      'Cache-Control': 'public, max-age=31536000, immutable',
    });
    for (const ruta of ['/x-y/medios/v1-fachada-0a1b2c3d.exe', '/x-y/medios/v1-fachada-0a1b2c3.png', '/x-y/medios/v1-fachada-0a1b2c3d.png/x', '/x-y/medios/fachada-0a1b2c3d.png']) {
      assert.ok(!('Cache-Control' in cabecerasDe(ruta)), ruta);
    }
  });
  prueba(':nombre(regex) admite grupos (?:…) pero rechaza grupos de captura internos', () => {
    const p = compilarPatron('/:a/:b(v\\d+\\.(?:png|jpg))');
    assert.deepEqual(emparejar(p, '/z/v12.jpg'), { a: 'z', b: 'v12.jpg' });
    assert.throws(() => compilarPatron('/:a/:b((x)y)'), /no soportado/);
    assert.throws(() => compilarPatron('/:a/:b(x'), /no soportado/);
  });
});

grupo('config 1b', () => {
  const p = cargarCon(['tipos.js', 'comun.js']);
  const base = () => JSON.parse(JSON.stringify(CONFIG_CIUDAD_ARCE));
  const con = (cambios) => {
    const c = base();
    cambios(c);
    return c;
  };
  const GALERIA = [
    { id: 'patrono-2', src: 'medios/patrono-2.jpg', alt: 'Segunda imagen del patrono', etiquetas: ['patrono'] },
    { id: 'fondo-fiesta', src: 'medios/fondo-fiesta.webp', alt: 'Fondo de la fiesta' }
  ];
  const conGaleria = (c) => { c.galeria = GALERIA.map((g) => Object.assign({}, g)); };
  const completa = () => con((c) => {
    conGaleria(c);
    c.pantallas = {
      inicio: {
        modo: 'personalizada',
        fondo: { tipo: 'imagen', imagen: 'fondo-fiesta' },
        imagen: 'galeria:patrono-2',
        distribucion: 'izquierda',
        ocultar: ['chispas', 'rayos', 'esquina'],
        textos: { inicio_titulo: 'Bienvenidos a {patrono}', franja: 'Fiesta de {fiesta}' }
      },
      portada: { modo: 'personalizada', fondo: { tipo: 'color', color: '#0c3562' }, imagen: 'patrono', distribucion: 'centro' },
      gracias: { modo: 'como-viene', imagen: 'ninguna' },
      avisos: { fondo: { tipo: 'degradado' }, imagen: 'automatica' },
      horarios: { modo: 'personalizada', imagen: 'fachada', distribucion: 'derecha', ocultar: ['marca', 'envivo', 'franja', 'fachada'] }
    };
    c.rotulos = { tipografia: 'montserrat', esquinas: 'rectas', posicion: 'centro', colorLado: '#7a3b12', cargos: ['CELEBRANTE', 'PREDICADOR'] };
    c.tipos = {
      apagados: ['horasanta', 'procesion'],
      propios: [{
        clave: 'hora-misionera', nombre: 'Hora misionera', descripcion: 'Oración por las misiones',
        titulo: 'Hora\nmisionera', ceja: 'MES MISIONERO', cursiva: 'con {patronoCorto}', franja: 'Rezamos juntos',
        imagen: 'galeria:patrono-2', esquina: 'texto', esquinaTexto: 'MISIONES', rotulos: ['persona', 'lectura1', 'libre']
      }]
    };
    c.horarios = [{ dia: 'Domingo', hora: '7:00 a. m.', nota: 'Misa con niños' }, { dia: 'Lunes', hora: '6:00 p. m.' }];
    c.redes = [{ red: 'facebook', url: 'https://facebook.com/ParroquiaCiudadArce', texto: '/ParroquiaCiudadArce' }];
    c.avisos = [{ texto: 'Retiro de jóvenes', detalle: 'Sáb 30 · 6:00 p. m.', desde: '2026-11-01', hasta: '2026-11-30', orden: 1 }, { texto: 'Colecta' }];
  });

  prueba('acepta la configuración de la 1a sin cambios', () => {
    for (const cfg of [CONFIG_CIUDAD_ARCE, CONFIG_SAN_JOSE]) {
      const r = cargarCon([], {}, cfg).validarConfig(cfg);
      assert.deepEqual(Array.from(r.errores), []);
      assert.equal(r.ok, true);
    }
  });
  prueba('acepta todos los bloques nuevos', () => {
    const r = p.validarConfig(completa());
    assert.deepEqual(Array.from(r.errores), []);
    assert.equal(r.ok, true);
  });

  const malo = (descripcion, cambios, campo) => {
    prueba('rechaza bloques nuevos inválidos: ' + descripcion, () => {
      const r = p.validarConfig(con(cambios));
      assert.equal(r.ok, false);
      assert.ok(r.errores.some((e) => e.includes(campo)), 'ningún error menciona «' + campo + '»: ' + JSON.stringify(r.errores));
    });
  };
  malo('fondo.tipo video', (c) => { c.pantallas = { inicio: { fondo: { tipo: 'video' } } }; }, 'pantallas.inicio.fondo.tipo');
  malo('fondo color sin color', (c) => { c.pantallas = { inicio: { fondo: { tipo: 'color' } } }; }, 'pantallas.inicio.fondo.color');
  malo('fondo color sin contraste', (c) => { c.pantallas = { inicio: { fondo: { tipo: 'color', color: '#ffff00' } } }; }, 'pantallas.inicio.fondo.color');
  malo('fondo imagen que no existe en la galería', (c) => { conGaleria(c); c.pantallas = { inicio: { fondo: { tipo: 'imagen', imagen: 'noexiste' } } }; }, 'pantallas.inicio.fondo.imagen');
  malo('imagen galeria:noexiste', (c) => { c.pantallas = { inicio: { imagen: 'galeria:noexiste' } }; }, 'pantallas.inicio.imagen');
  malo('imagen con una clave desconocida', (c) => { c.pantallas = { inicio: { imagen: 'paisaje' } }; }, 'pantallas.inicio.imagen');
  malo('vista desconocida', (c) => { c.pantallas = { menu: { modo: 'personalizada' } }; }, 'pantallas.menu');
  malo('modo desconocido', (c) => { c.pantallas = { inicio: { modo: 'libre' } }; }, 'pantallas.inicio.modo');
  malo('distribucion desconocida', (c) => { c.pantallas = { avisos: { distribucion: 'arriba' } }; }, 'pantallas.avisos.distribucion');
  malo('ocultar titulo', (c) => { c.pantallas = { inicio: { ocultar: ['titulo'] } }; }, 'pantallas.inicio.ocultar');
  malo('ocultar que no es lista', (c) => { c.pantallas = { inicio: { ocultar: 'chispas' } }; }, 'pantallas.inicio.ocultar');
  malo('textos con clave que no existe', (c) => { c.pantallas = { inicio: { textos: { inexistente: 'x' } } }; }, 'pantallas.inicio.textos.inexistente');
  malo('rotulos.tipografia arial', (c) => { c.rotulos = { tipografia: 'arial' }; }, 'rotulos.tipografia');
  malo('rotulos.esquinas desconocida', (c) => { c.rotulos = { esquinas: 'ovaladas' }; }, 'rotulos.esquinas');
  malo('rotulos.posicion desconocida', (c) => { c.rotulos = { posicion: 'derecha' }; }, 'rotulos.posicion');
  malo('rotulos.colorLado que no es #rrggbb ni un nombre de color', (c) => { c.rotulos = { colorLado: 'amarillo' }; }, 'rotulos.colorLado');
  malo('rotulos.cargos con 13 elementos', (c) => { c.rotulos = { cargos: Array.from({ length: 13 }, (_, i) => 'CARGO ' + i) }; }, 'rotulos.cargos');
  malo('tipo propio con clave dominical', (c) => { c.tipos = { propios: [{ clave: 'dominical', nombre: 'Otro' }] }; }, 'tipos.propios[0].clave');
  malo('tipo propio con clave inválida', (c) => { c.tipos = { propios: [{ clave: 'Hora Misionera', nombre: 'Otro' }] }; }, 'tipos.propios[0].clave');
  malo('tipo propio sin nombre', (c) => { c.tipos = { propios: [{ clave: 'hora-misionera' }] }; }, 'tipos.propios[0].nombre');
  malo('tipo propio con rotulos bailarin', (c) => { c.tipos = { propios: [{ clave: 'hora-misionera', nombre: 'X', rotulos: ['bailarin'] }] }; }, 'tipos.propios[0].rotulos');
  malo('tipo propio con esquina desconocida', (c) => { c.tipos = { propios: [{ clave: 'hora-misionera', nombre: 'X', esquina: 'luna' }] }; }, 'tipos.propios[0].esquina');
  malo('tipo propio con imagen de galería inexistente', (c) => { c.tipos = { propios: [{ clave: 'hora-misionera', nombre: 'X', imagen: 'galeria:noexiste' }] }; }, 'tipos.propios[0].imagen');
  malo('dos tipos propios con la misma clave', (c) => { c.tipos = { propios: [{ clave: 'mision', nombre: 'A' }, { clave: 'mision', nombre: 'B' }] }; }, 'tipos.propios[1].clave');
  malo('tipos.apagados con una clave que no es común', (c) => { c.tipos = { apagados: ['inventado'] }; }, 'tipos.apagados');
  malo('tipos.apagados con las 11 claves y sin propios', (c) => {
    c.tipos = { apagados: ['dominical', 'semana', 'horasanta', 'sector', 'patronalsector', 'procesion', 'otros', 'prenovena', 'novena', 'patronal', 'evento'] };
  }, 'tipos.apagados');
  malo('más de 10 tipos propios', (c) => {
    c.tipos = { propios: Array.from({ length: 11 }, (_, i) => ({ clave: 'tipo-' + i + 'x', nombre: 'T' + i })) };
  }, 'tipos.propios');
  malo('horarios con 13 elementos', (c) => { c.horarios = Array.from({ length: 13 }, () => ({ dia: 'Lunes', hora: '6:00 p. m.' })); }, 'horarios');
  malo('horarios sin hora', (c) => { c.horarios = [{ dia: 'Lunes' }]; }, 'horarios[0].hora');
  malo('redes con url http', (c) => { c.redes = [{ red: 'web', url: 'http://x', texto: 'x' }]; }, 'redes[0].url');
  malo('redes con red desconocida', (c) => { c.redes = [{ red: 'tiktok', url: 'https://x.org', texto: 'x' }]; }, 'redes[0].red');
  malo('más de 6 redes', (c) => { c.redes = Array.from({ length: 7 }, () => ({ red: 'web', url: 'https://x.org', texto: 'x' })); }, 'redes');
  malo('avisos con desde 2026-02-30', (c) => { c.avisos = [{ texto: 'x', desde: '2026-02-30' }]; }, 'avisos[0].desde');
  malo('avisos con fecha mal escrita', (c) => { c.avisos = [{ texto: 'x', hasta: '30/11/2026' }]; }, 'avisos[0].hasta');
  malo('avisos con desde mayor que hasta', (c) => { c.avisos = [{ texto: 'x', desde: '2026-12-01', hasta: '2026-11-01' }]; }, 'avisos[0].desde');
  malo('más de 10 avisos', (c) => { c.avisos = Array.from({ length: 11 }, () => ({ texto: 'x' })); }, 'avisos');
  malo('aviso con texto de 201 caracteres', (c) => { c.avisos = [{ texto: 'a'.repeat(201) }]; }, 'avisos[0].texto');
  malo('texto de pantalla de 201 caracteres', (c) => { c.pantallas = { inicio: { textos: { inicio_titulo: 'a'.repeat(201) } } }; }, 'pantallas.inicio.textos.inicio_titulo');
  malo('imagen de galería sin alt', (c) => { conGaleria(c); delete c.galeria[0].alt; }, 'galeria[0].alt');
  malo('galería con id repetido', (c) => { conGaleria(c); c.galeria[1].id = c.galeria[0].id; }, 'galeria[1].id');
  malo('galería con id inválido', (c) => { conGaleria(c); c.galeria[0].id = 'Patrono_2'; }, 'galeria[0].id');
  malo('galería con más de 30 imágenes', (c) => {
    c.galeria = Array.from({ length: 31 }, (_, i) => ({ id: 'img-' + i + 'x', src: 'medios/a.png', alt: 'a' }));
  }, 'galeria');
  malo('pantallas que no es objeto', (c) => { c.pantallas = []; }, 'pantallas');
  malo('horarios que no es lista', (c) => { c.horarios = {}; }, 'horarios');

  prueba('rutas de imagen solo dentro de medios/', () => {
    const malas = ['https://x/a.png', '//x/a.png', '../otra/medios/a.png', 'medios/../a.png', 'medios\\a.png', 'medios/a.gif'];
    const lugares = {
      'logos.blanco': (c, s) => { c.logos.blanco.src = s; },
      'fachada': (c, s) => { c.fachada.src = s; },
      'patrono.imagen': (c, s) => { c.patrono.imagen.src = s; },
      'galeria[0]': (c, s) => { conGaleria(c); c.galeria[0].src = s; }
    };
    for (const lugar of Object.keys(lugares)) {
      for (const s of malas) {
        const r = p.validarConfig(con((c) => lugares[lugar](c, s)));
        assert.equal(r.ok, false, lugar + ' acepta ' + s);
        assert.ok(r.errores.some((e) => e.includes(lugar)), lugar + ' ' + s + ': ' + JSON.stringify(r.errores));
      }
      const ok = p.validarConfig(con((c) => lugares[lugar](c, 'medios/a.webp')));
      assert.deepEqual(Array.from(ok.errores), [], lugar);
    }
  });
  prueba('RUTA_MEDIO acepta png, jpg, jpeg, webp y svg (también en mayúsculas)', () => {
    for (const s of ['medios/a.png', 'medios/a.jpg', 'medios/a.jpeg', 'medios/a.webp', 'medios/a.svg', 'medios/Foto-1_b.JPG']) {
      assert.ok(p.RUTA_MEDIO.test(s), s);
    }
  });
  prueba('CLAVES_COMUNES coincide con ORDEN_TIPOS', () => {
    assert.deepEqual(Array.from(p.CLAVES_COMUNES), Array.from(p.ORDEN_TIPOS));
  });
  prueba('IDS_ROTULO_COMUN coincide con los rótulos de cada tipo de tipos.js', () => {
    assert.deepEqual(Object.keys(p.IDS_ROTULO_COMUN), Array.from(p.ORDEN_TIPOS));
    for (const k of p.ORDEN_TIPOS) assert.deepEqual(Array.from(p.IDS_ROTULO_COMUN[k]), Array.from(p.TIPOS[k].rotulos, (r) => r.id), k);
  });
  prueba('BASES_ROTULO coincide con las claves de ROTULOS', () => {
    assert.deepEqual(Array.from(p.BASES_ROTULO).sort(), Object.keys(p.ROTULOS).sort());
  });
  prueba('CLAVES_TEXTOS coincide con las claves de textosBase', () => {
    assert.deepEqual(Array.from(p.CLAVES_TEXTOS).sort(), Object.keys(p.textosBase({})).sort());
  });
  prueba('los dos config.json de ejemplo siguen siendo válidos', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    for (const slug of ['ciudad-arce', 'san-jose-ejemplo']) {
      const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'vicaria', slug, 'config.json'), 'utf8'));
      const r = cargar(['parroquia.js'], {}, { location: { pathname: '/' + slug + '/panel.html' } }).validarConfig(cfg);
      assert.deepEqual(Array.from(r.errores), [], slug);
    }
  });
});

grupo('pantallas', () => {
  const base = () => JSON.parse(JSON.stringify(CONFIG_CIUDAD_ARCE));
  const GAL = [
    { id: 'patrono-2', src: 'medios/patrono-2.jpg', alt: 'Segunda imagen del patrono' },
    { id: 'fondo-fiesta', src: 'medios/fondo-fiesta.webp', alt: 'Fondo de la fiesta' }
  ];
  const cargarPantallas = (cambios) => {
    const cfg = base();
    if (cambios) cambios(cfg);
    return cargarCon(['tipos.js', 'comun.js', 'pantallas.js'], {}, cfg);
  };
  const VISTAS = ['inicio', 'portada', 'gracias', 'avisos', 'horarios'];
  let c;
  try {
    c = cargarPantallas();
  } catch (e) {
    prueba('se puede cargar pantallas.js', () => { throw e; });
    return;
  }
  // Para configuraciones que validarConfig rechazaría (referencias a la galería que ya no existen): se ponen después de cargar.
  const forzar = (x, cfg) => vm.runInContext('PARROQUIA = ' + JSON.stringify(cfg) + ';', x);
  const dia = (a, m, d) => new Date(a, m - 1, d);
  const arr = (x, f) => Array.from(x, f);
  const plano = (o) => Object.assign({}, o);

  prueba('sin bloques nuevos, ajustesDe de las 5 vistas da los valores de hoy', () => {
    for (const v of VISTAS) {
      const a = c.ajustesDe(v);
      assert.equal(a.personalizada, false, v);
      assert.equal(a.fondo.tipo, 'degradado', v);
      assert.equal(a.imagen, 'automatica', v);
      assert.equal(a.distribucion, 'izquierda', v);
      assert.deepEqual(arr(a.ocultar), [], v);
      assert.deepEqual(Object.keys(a.textos), [], v);
    }
  });
  prueba('sin bloques nuevos, textoDe = tx e imagenDeVista = la de hoy', () => {
    const s = c.normalizarEstado({ tipo: 'novena', novenaDia: 3 });
    for (const k of Object.keys(c.textosBase(s))) assert.equal(c.textoDe(s, 'inicio', k), c.tx(s, k), k);
    const im = c.imagenDeVista(s, 'inicio');
    assert.equal(im.src, c.imagenDe(s));
    assert.equal(im.alt, c.altDe(s));
    assert.equal(im.clase, c.claseDeImagen(im.src));
  });
  prueba('modo como-viene con otros campos: se ignoran', () => {
    const x = cargarPantallas((cfg) => {
      cfg.galeria = GAL;
      cfg.pantallas = { inicio: { modo: 'como-viene', fondo: { tipo: 'color', color: '#112233' }, imagen: 'ninguna', distribucion: 'derecha', ocultar: ['marca'], textos: { marca: 'Otro' } } };
    });
    const a = x.ajustesDe('inicio');
    assert.equal(a.personalizada, false);
    assert.equal(a.fondo.tipo, 'degradado');
    assert.equal(a.imagen, 'automatica');
    assert.equal(a.distribucion, 'izquierda');
    assert.deepEqual(arr(a.ocultar), []);
    assert.equal(x.visible('inicio', 'marca'), true);
    const s = x.normalizarEstado({});
    assert.equal(x.textoDe(s, 'inicio', 'marca'), x.tx(s, 'marca'));
  });
  prueba('modo ausente también cuenta como «como viene»', () => {
    const x = cargarPantallas((cfg) => { cfg.pantallas = { inicio: { distribucion: 'centro' } }; });
    assert.equal(x.ajustesDe('inicio').personalizada, false);
    assert.equal(x.ajustesDe('inicio').distribucion, 'izquierda');
  });
  prueba('personalizada: usa lo escrito y completa el resto con los valores de hoy', () => {
    const x = cargarPantallas((cfg) => {
      cfg.pantallas = { gracias: { modo: 'personalizada', distribucion: 'derecha', ocultar: ['chispas', 'rayos'] } };
    });
    const a = x.ajustesDe('gracias');
    assert.equal(a.personalizada, true);
    assert.equal(a.distribucion, 'derecha');
    assert.deepEqual(arr(a.ocultar), ['chispas', 'rayos']);
    assert.equal(a.imagen, 'automatica');
    assert.equal(a.fondo.tipo, 'degradado');
    assert.equal(x.visible('gracias', 'chispas'), false);
    assert.equal(x.visible('gracias', 'marca'), true);
    assert.equal(x.visible('inicio', 'chispas'), true, 'otra vista no se afecta');
  });
  prueba('fondoDe: color, imagen de galería y respaldo a degradado', () => {
    const x = cargarPantallas((cfg) => {
      cfg.galeria = GAL;
      cfg.pantallas = {
        inicio: { modo: 'personalizada', fondo: { tipo: 'color', color: '#223344' } },
        portada: { modo: 'personalizada', fondo: { tipo: 'imagen', imagen: 'fondo-fiesta' } }
      };
    });
    const roto = base();
    roto.pantallas = { gracias: { modo: 'personalizada', fondo: { tipo: 'imagen', imagen: 'no-existe' } } };
    const y = cargarPantallas();
    forzar(y, roto);
    assert.equal(y.fondoDe('gracias').tipo, 'degradado', 'galería que ya no existe');
    assert.deepEqual(plano(x.fondoDe('inicio')), { tipo: 'color', color: '#223344' });
    assert.deepEqual(plano(x.fondoDe('portada')), { tipo: 'imagen', src: 'medios/fondo-fiesta.webp', alt: 'Fondo de la fiesta' });
    assert.equal(x.fondoDe('avisos').tipo, 'degradado');
  });
  prueba('textoDe respeta la precedencia de 3 niveles', () => {
    const x = cargarPantallas((cfg) => {
      cfg.pantallas = { inicio: { modo: 'personalizada', textos: { inicio_titulo: 'De la config', marca: 'Marca config' } } };
    });
    const s0 = x.normalizarEstado({});
    assert.equal(x.textoDe(s0, 'inicio', 'inicio_titulo'), 'De la config');
    assert.equal(x.textoDe(s0, 'inicio', 'inicio_ceja'), x.textosBase(s0).inicio_ceja, 'sin config: lo automático');
    const s1 = x.normalizarEstado({ textos: { inicio_titulo: '  Del panel  ' } });
    assert.equal(x.textoDe(s1, 'inicio', 'inicio_titulo'), 'Del panel');
    const s2 = x.normalizarEstado({ textos: { inicio_titulo: '   ' } });
    assert.equal(x.textoDe(s2, 'inicio', 'inicio_titulo'), 'De la config', 'un texto del panel en blanco no gana');
    assert.equal(x.textoDe(s0, 'portada', 'marca'), x.tx(s0, 'marca'), 'otra vista no usa los textos de inicio');
  });
  prueba('{patrono} en un texto de la configuración se rellena', () => {
    const x = cargarPantallas((cfg) => {
      cfg.pantallas = { portada: { modo: 'personalizada', textos: { portada_sub: 'Fiesta de {patrono}, el {fiesta}' } } };
    });
    assert.equal(x.textoDe(x.normalizarEstado({}), 'portada', 'portada_sub'), 'Fiesta de Inmaculada Concepción de María, el 8 de diciembre');
  });
  prueba('imagenDeVista: ninguna, galeria:x, clave fija y automática', () => {
    const x = cargarPantallas((cfg) => {
      cfg.galeria = GAL;
      cfg.pantallas = {
        inicio: { modo: 'personalizada', imagen: 'ninguna' },
        portada: { modo: 'personalizada', imagen: 'galeria:patrono-2' },
        gracias: { modo: 'personalizada', imagen: 'fachada' }
      };
    });
    const s = x.normalizarEstado({ tipo: 'novena' });
    const ninguna = x.imagenDeVista(s, 'inicio');
    assert.equal(ninguna.src, '');
    assert.equal(ninguna.alt, '');
    const gal = x.imagenDeVista(s, 'portada');
    assert.equal(gal.src, 'medios/patrono-2.jpg');
    assert.equal(gal.alt, 'Segunda imagen del patrono');
    assert.equal(gal.clase, 'a');
    const fac = x.imagenDeVista(s, 'gracias');
    assert.equal(fac.src, 'medios/fachada.jpg');
    assert.equal(fac.clase, 'foto');
    // galería que ya no existe: cae a la automática, sin error
    const roto = base();
    roto.pantallas = { avisos: { modo: 'personalizada', imagen: 'galeria:borrada' } };
    forzar(x, roto);
    assert.equal(x.imagenDeVista(s, 'avisos').src, x.imagenDe(s));
    // automática = la de hoy
    const auto = x.imagenDeVista(s, 'horarios');
    assert.equal(auto.src, x.imagenDe(s));
    assert.equal(auto.alt, x.altDe(s));
  });
  prueba('imagenDeVista: la imagen elegida en el panel gana a la fija de la pantalla; esta solo reemplaza a automática', () => {
    const x = cargarPantallas((cfg) => {
      cfg.galeria = GAL;
      cfg.pantallas = { gracias: { modo: 'personalizada', imagen: 'fachada' }, inicio: { modo: 'personalizada', imagen: 'ninguna' } };
    });
    const elegida = x.normalizarEstado({ tipo: 'novena', imagen: 'logo' });
    assert.equal(x.imagenDeVista(elegida, 'gracias').src, x.imagenDe(elegida), 'gracias: la del panel');
    assert.notEqual(x.imagenDeVista(elegida, 'gracias').src, 'medios/fachada.jpg');
    assert.equal(x.imagenDeVista(elegida, 'inicio').src, x.imagenDe(elegida), 'inicio: «ninguna» tampoco le gana a la del panel');
    const auto = x.normalizarEstado({ tipo: 'novena' });
    assert.equal(x.imagenDeVista(auto, 'gracias').src, 'medios/fachada.jpg', 'sin elección del panel, la de la pantalla');
    assert.equal(x.imagenDeVista(auto, 'inicio').src, '');
  });
  prueba('imagenGaleria: la encuentra o da null', () => {
    const x = cargarPantallas((cfg) => { cfg.galeria = GAL; });
    assert.deepEqual(plano(x.imagenGaleria('patrono-2')), { src: 'medios/patrono-2.jpg', alt: 'Segunda imagen del patrono' });
    assert.equal(x.imagenGaleria('nada'), null);
    assert.equal(c.imagenGaleria('patrono-2'), null, 'sin galería');
  });
  prueba('el título nunca se oculta', () => {
    const x = cargarPantallas((cfg) => {
      cfg.pantallas = {};
      for (const v of VISTAS) cfg.pantallas[v] = { modo: 'personalizada', imagen: 'ninguna', ocultar: ['marca', 'envivo', 'chispas', 'rayos', 'fachada', 'franja', 'esquina'] };
    });
    for (const v of VISTAS) {
      assert.ok(!arr(x.ajustesDe(v).ocultar).includes('titulo'), v);
      assert.equal(x.visible(v, 'titulo'), true, v);
    }
    // aunque llegue una configuración sin validar con 'titulo' en ocultar
    const y = cargarPantallas((cfg) => { cfg.pantallas = { inicio: { modo: 'personalizada', ocultar: ['titulo', 'marca'] } }; });
    assert.equal(y.visible('inicio', 'titulo'), true);
    assert.ok(!arr(y.ajustesDe('inicio').ocultar).includes('titulo'));
  });

  const AVISOS = [
    { texto: 'Vigente', detalle: 'Sáb 30', desde: '2026-11-01', hasta: '2026-11-30', orden: 1 },
    { texto: 'Vencido', hasta: '2026-11-14', orden: 2 },
    { texto: 'Futuro', desde: '2026-11-16', orden: 3 },
    { texto: 'Último día', hasta: '2026-11-15', orden: 4 },
    { texto: 'Primer día', desde: '2026-11-15', orden: 5 },
    { texto: 'Siempre' }
  ];
  const sinPanel = () => c.normalizarEstado({});
  prueba('avisos vigentes: desde/hasta son inclusivos, en hora local', () => {
    const x = cargarPantallas((cfg) => { cfg.avisos = AVISOS; });
    assert.deepEqual(arr(x.avisosPara(sinPanel(), dia(2026, 11, 15)), (r) => r.a), ['Vigente', 'Último día', 'Primer día', 'Siempre']);
    assert.deepEqual(arr(x.avisosPara(sinPanel(), dia(2026, 11, 14)), (r) => r.a), ['Vigente', 'Vencido', 'Último día', 'Siempre']);
    assert.deepEqual(arr(x.avisosPara(sinPanel(), dia(2026, 11, 16)), (r) => r.a), ['Vigente', 'Futuro', 'Primer día', 'Siempre']);
  });
  prueba('avisos: la hora del día no cambia la vigencia', () => {
    const x = cargarPantallas((cfg) => { cfg.avisos = AVISOS; });
    const nombres = (h) => arr(x.avisosPara(sinPanel(), h), (r) => r.a);
    const tarde = nombres(new Date(2026, 10, 15, 23, 59, 59));
    assert.deepEqual(tarde, nombres(new Date(2026, 10, 15, 0, 0, 1)));
    assert.ok(tarde.includes('Último día'));
  });
  prueba('avisos fijos: forma {a, f}, detalle ausente = vacío', () => {
    const x = cargarPantallas((cfg) => { cfg.avisos = AVISOS; });
    const r = x.avisosPara(sinPanel(), dia(2026, 11, 15));
    assert.deepEqual(plano(r[0]), { a: 'Vigente', f: 'Sáb 30' });
    assert.deepEqual(plano(r[3]), { a: 'Siempre', f: '' });
  });
  prueba('avisos: orden por «orden» y, a igual orden, por posición', () => {
    const x = cargarPantallas((cfg) => {
      cfg.avisos = [{ texto: 'C', orden: 2 }, { texto: 'A1', orden: 1 }, { texto: 'B', orden: 2 }, { texto: 'A2', orden: 1 }];
    });
    assert.deepEqual(arr(x.avisosPara(sinPanel(), dia(2026, 11, 15)), (r) => r.a), ['A1', 'A2', 'C', 'B']);
  });
  prueba('avisos: los del panel van después de los fijos y los vacíos no cuentan', () => {
    const x = cargarPantallas((cfg) => { cfg.avisos = [{ texto: 'Fijo', orden: 1 }]; });
    const s = x.normalizarEstado({ avisos: [{ a: 'Panel 1', f: 'det' }, { a: '', f: 'suelto' }, { a: '  ', f: '' }, { a: 'Panel 2', f: '' }] });
    const r = x.avisosPara(s, dia(2026, 11, 15));
    assert.deepEqual(arr(r, (e) => e.a), ['Fijo', 'Panel 1', '', 'Panel 2'], 'la fila con solo detalle se ve, como en la 1a');
    assert.equal(r[1].f, 'det');
  });
  prueba('aviso del panel con solo detalle se ve, como en la 1a', () => {
    const s = c.normalizarEstado({ avisos: [{ a: '', f: 'Solo detalle' }, { a: '  ', f: '  ' }] });
    assert.deepEqual(arr(c.avisosPara(s, dia(2026, 11, 15)), plano), [{ a: '', f: 'Solo detalle' }]);
  });
  prueba('sin avisos fijos, avisosPara = los del panel no vacíos', () => {
    const s = c.normalizarEstado({ avisos: [{ a: 'Uno', f: 'x' }, { a: '', f: '' }] });
    assert.deepEqual(arr(c.avisosPara(s, dia(2026, 11, 15)), (e) => e.a), ['Uno']);
  });
  prueba('tope de 6 filas: 5 fijos + 4 del panel dan 6, los 5 fijos primero', () => {
    const x = cargarPantallas((cfg) => {
      cfg.avisos = [1, 2, 3, 4, 5].map((n) => ({ texto: 'Fijo ' + n, orden: n }));
    });
    const s = x.normalizarEstado({ avisos: [1, 2, 3, 4].map((n) => ({ a: 'Panel ' + n, f: '' })) });
    const r = arr(x.avisosPara(s, dia(2026, 11, 15)), (e) => e.a);
    assert.equal(r.length, 6);
    assert.deepEqual(r, ['Fijo 1', 'Fijo 2', 'Fijo 3', 'Fijo 4', 'Fijo 5', 'Panel 1']);
  });
  prueba('horariosPara y redesPara: leen la configuración en uso', () => {
    assert.deepEqual(arr(c.horariosPara()), []);
    assert.deepEqual(arr(c.redesPara()), []);
    const x = cargarPantallas((cfg) => {
      cfg.horarios = [{ dia: 'Domingo', hora: '7:00 a. m.', nota: 'Misa con niños' }, { dia: 'Lunes', hora: '6:00 p. m.' }];
      cfg.redes = [{ red: 'facebook', url: 'https://facebook.com/x', texto: '/ParroquiaCiudadArce' }];
    });
    assert.deepEqual(JSON.parse(JSON.stringify(x.horariosPara())), [
      { dia: 'Domingo', horas: [{ hora: '7:00 a. m.', nota: 'Misa con niños' }], lugar: '' },
      { dia: 'Lunes', horas: [{ hora: '6:00 p. m.', nota: '' }], lugar: '' }
    ]);
    assert.deepEqual(arr(x.redesPara(), plano), [{ red: 'facebook', texto: '/ParroquiaCiudadArce' }]);
  });
  prueba('textoDe = tx sin bloques nuevos: todas las vistas, todos los textos, 4 tipos', () => {
    const claves = Object.keys(c.textosBase({}));
    assert.ok(claves.includes('horarios_titulo'), 'horarios_titulo está en textosBase');
    for (const tipo of ['novena', 'evento', 'patronal', 'dominical']) {
      for (const extra of [{}, { textos: { inicio_titulo: '  Escrito en el panel  ', franja: '' } }]) {
        const s = c.normalizarEstado(Object.assign({ tipo, santo: 'Ana', fecha: '2026-12-01', lugar: 'El Carmen', evento: 'Retiro' }, extra));
        for (const v of VISTAS) {
          for (const k of claves) assert.equal(c.textoDe(s, v, k), c.tx(s, k), tipo + '/' + v + '/' + k);
        }
      }
    }
    assert.equal(c.textoDe(c.normalizarEstado({}), 'horarios', 'horarios_titulo'), 'Horarios de misa');
  });
  prueba('con CONFIG_NEUTRA (sin configuración) los ayudantes no lanzan', () => {
    const n = cargarCon(['tipos.js', 'comun.js', 'pantallas.js'], {}, null);
    const s = n.normalizarEstado({});
    for (const v of VISTAS) {
      assert.equal(n.ajustesDe(v).personalizada, false, v);
      assert.equal(n.fondoDe(v).tipo, 'degradado', v);
      assert.equal(n.visible(v, 'chispas'), true, v);
      assert.equal(n.imagenDeVista(s, v).src, '', v);
      for (const k of Object.keys(n.textosBase(s))) assert.equal(n.textoDe(s, v, k), n.tx(s, k), v + '/' + k);
    }
    assert.equal(n.imagenGaleria('x'), null);
    assert.deepEqual(arr(n.avisosPara(s, dia(2026, 11, 8))), []);
    assert.deepEqual(arr(n.horariosPara()), []);
    assert.deepEqual(arr(n.redesPara()), []);
  });
  prueba('horariosPara y redesPara ignoran elementos nulos o que no son objetos', () => {
    const x = cargarPantallas();
    forzar(x, Object.assign(base(), {
      horarios: [null, 'x', { dia: 'Lunes', hora: '6:00 p. m.' }],
      redes: [null, 7, { red: 'web', url: 'https://x.org', texto: 'x.org' }]
    }));
    assert.deepEqual(JSON.parse(JSON.stringify(x.horariosPara())), [{ dia: 'Lunes', horas: [{ hora: '6:00 p. m.', nota: '' }], lugar: '' }]);
    assert.deepEqual(arr(x.redesPara(), plano), [{ red: 'web', texto: 'x.org' }]);
  });
  prueba('sin bloque rotulos, estiloRotulos y cargosDe dan los valores de hoy', () => {
    assert.deepEqual(arr([c.estiloRotulos()], plano), [{ tipografia: 'montserrat', esquinas: 'suaves', posicion: 'izquierda', colorLado: null, colorLinea: null, ladoClaro: false, logoEsquina: true }]);
    assert.deepEqual(arr(c.cargosDe()), arr(vm.runInContext("CARGOS", c)));
  });
  prueba('el bloque rotulos de la configuración manda en estiloRotulos y cargosDe', () => {
    const x = cargarPantallas((cfg) => {
      cfg.rotulos = { esquinas: 'rectas', posicion: 'centro', colorLado: '#1a5276', cargos: ['LECTOR', 'MONAGUILLO'] };
    });
    assert.deepEqual(arr([x.estiloRotulos()], plano), [{ tipografia: 'montserrat', esquinas: 'rectas', posicion: 'centro', colorLado: '#1a5276', colorLinea: null, ladoClaro: false, logoEsquina: true }]);
    assert.deepEqual(arr(x.cargosDe()), ['LECTOR', 'MONAGUILLO']);
  });
  prueba('estiloRotulos ignora valores raros y un colorLado que no es #rrggbb; cargos vacío cae a CARGOS', () => {
    const x = cargarPantallas();
    forzar(x, Object.assign(base(), { rotulos: { esquinas: 'ovaladas', posicion: 'derecha', colorLado: 'rojo', cargos: [] } }));
    assert.deepEqual(arr([x.estiloRotulos()], plano), [{ tipografia: 'montserrat', esquinas: 'suaves', posicion: 'izquierda', colorLado: null, colorLinea: null, ladoClaro: false, logoEsquina: true }]);
    assert.deepEqual(arr(x.cargosDe()), arr(vm.runInContext("CARGOS", x)));
  });
  prueba('los ayudantes leen PARROQUIA al llamarse (la configuración llega después)', () => {
    const x = cargarPantallas();
    assert.equal(x.ajustesDe('inicio').personalizada, false);
    const nueva = base();
    nueva.pantallas = { inicio: { modo: 'personalizada', distribucion: 'centro' } };
    vm.runInContext('PARROQUIA = ' + JSON.stringify(nueva) + ';', x);
    assert.equal(x.ajustesDe('inicio').distribucion, 'centro');
  });
});

grupo('tipos propios y apagados', () => {
  const base = () => JSON.parse(JSON.stringify(CONFIG_CIUDAD_ARCE));
  const GAL = [{ id: 'patrono-2', src: 'medios/patrono-2.jpg', alt: 'Segunda imagen del patrono' }];
  const PROPIO = {
    clave: 'hora-misionera', nombre: 'Hora misionera', descripcion: 'Oración por las misiones de {parroquia}.',
    titulo: 'HORA MISIONERA', ceja: 'EN HONOR A {patronoCorto}', cursiva: 'Id y anunciad', franja: '«{lema}»',
    imagen: 'galeria:patrono-2', esquina: 'fiesta', rotulos: ['persona', 'lectura1', 'oracion']
  };
  const cargarTipos = (cambios) => {
    const cfg = base();
    if (cambios) cambios(cfg);
    return cargarCon(['tipos.js', 'comun.js', 'pantallas.js'], {}, cfg);
  };
  const forzar = (x, cfg) => vm.runInContext('PARROQUIA = ' + JSON.stringify(cfg) + ';', x);
  const arr = (x) => Array.from(x);
  const sinBloque = cargarTipos();

  prueba('ordenTipos sin bloque tipos es ORDEN_TIPOS', () => {
    assert.deepEqual(arr(sinBloque.ordenTipos()), arr(sinBloque.ORDEN_TIPOS));
    assert.equal(sinBloque.ORDEN_TIPOS.length, 11);
  });
  prueba('ordenTipos quita los apagados y pone los propios al final, en el orden de la configuración', () => {
    const x = cargarTipos((cfg) => {
      cfg.galeria = GAL;
      cfg.tipos = { apagados: ['horasanta', 'evento'], propios: [PROPIO, { clave: 'adoracion', nombre: 'Adoración' }] };
    });
    const o = arr(x.ordenTipos());
    assert.ok(!o.includes('horasanta') && !o.includes('evento'));
    assert.deepEqual(o, arr(x.ORDEN_TIPOS).filter((k) => k !== 'horasanta' && k !== 'evento').concat(['hora-misionera', 'adoracion']));
    assert.equal(x.ORDEN_TIPOS.length, 11, 'la constante no cambia');
  });
  prueba('ordenTipos se evalúa al llamarse (la configuración llega después)', () => {
    const x = cargarTipos();
    assert.equal(x.ordenTipos().length, 11);
    const nueva = base();
    nueva.tipos = { apagados: ['horasanta'], propios: [{ clave: 'adoracion', nombre: 'Adoración' }] };
    forzar(x, nueva);
    assert.deepEqual(arr(x.ordenTipos()).slice(-1), ['adoracion']);
    assert.ok(!arr(x.ordenTipos()).includes('horasanta'));
  });
  prueba('tipoDe de un propio completa los huecos con valores de «otros» y arma los rótulos desde las bases', () => {
    const x = cargarTipos((cfg) => { cfg.galeria = GAL; cfg.tipos = { propios: [PROPIO, { clave: 'adoracion', nombre: 'Adoración' }] }; });
    const t = x.tipoDe({ tipo: 'hora-misionera' });
    assert.equal(t.nombre, 'Hora misionera');
    assert.equal(t.imagen, 'galeria:patrono-2');
    assert.equal(t.esquina, 'fiesta');
    assert.equal(t.cuenta, false);
    assert.equal(t.portada, undefined);
    assert.deepEqual(arr(t.rotulos).map((r) => [r.id, r.base]), [['persona', 'persona'], ['lectura1', 'lectura1'], ['oracion', 'oracion']]);
    const v = x.tipoDe({ tipo: 'adoracion' });   // solo clave y nombre: el resto sale de los valores por defecto
    assert.equal(v.imagen, 'patrono');
    assert.equal(v.esquina, 'hoy');
    assert.equal(v.cuenta, false);
    assert.equal(v.portada, undefined);
    assert.deepEqual(arr(v.datos), []);
    assert.equal(x.tituloCelebracion({ tipo: 'adoracion' }), 'ADORACIÓN');
  });
  prueba('los textos de un propio son plantillas: rellenar pone los huecos', () => {
    const x = cargarTipos((cfg) => { cfg.galeria = GAL; cfg.tipos = { propios: [PROPIO] }; });
    const s = x.normalizarEstado({ tipo: 'hora-misionera' });
    const tb = x.textosBase(s);
    assert.equal(tb.inicio_ceja, 'EN HONOR A INMACULADA');
    assert.equal(tb.inicio_pildora, 'HORA MISIONERA');
    assert.equal(tb.franja, '«TODA HERMOSA ERES, MARÍA»');
    const ro = x.rotulosDe(s);
    assert.deepEqual(arr(ro).map((r) => r.id), ['persona', 'lectura1', 'oracion']);
    assert.equal(ro[0].texto.k, 'CELEBRANTE');
  });
  prueba('un propio con imagen galeria:<id> usa la imagen de la galería; si falta, la fachada', () => {
    const x = cargarTipos((cfg) => { cfg.galeria = GAL; cfg.tipos = { propios: [PROPIO] }; });
    const s = x.normalizarEstado({ tipo: 'hora-misionera' });
    assert.equal(x.imagenDe(s), 'medios/patrono-2.jpg');
    assert.equal(x.altDe(s), 'Segunda imagen del patrono');
    assert.equal(x.imagenDeVista(s, 'inicio').src, 'medios/patrono-2.jpg');
    const fachada = base().fachada;
    forzar(x, Object.assign(base(), { galeria: [], tipos: { propios: [PROPIO] } }));   // la galería ya no la trae
    assert.equal(x.imagenDe(s), fachada.src);
    assert.equal(x.altDe(s), fachada.alt);
    // la elección hecha en el panel pasa por el mismo camino
    forzar(x, Object.assign(base(), { galeria: GAL }));
    assert.equal(x.imagenDe(x.normalizarEstado({ tipo: 'dominical', imagen: 'galeria:patrono-2' })), 'medios/patrono-2.jpg');
    // y el respaldo si la imagen no carga es la fachada
    assert.equal(x.respaldoDeImagen('medios/patrono-2.jpg').src, fachada.src);
  });
  prueba('un propio con imagen «ninguna» no trae imagen', () => {
    const x = cargarTipos((cfg) => { cfg.tipos = { propios: [{ clave: 'silencio', nombre: 'Silencio', imagen: 'ninguna' }] }; });
    assert.equal(x.imagenDe(x.normalizarEstado({ tipo: 'silencio' })), '');
  });
  prueba('tipo guardado que ya no existe: tipoDe cae al primero disponible y normalizarEstado lo corrige', () => {
    const x = cargarTipos();   // sin el propio «hora-misionera»
    assert.equal(x.tipoDe({ tipo: 'hora-misionera' }), x.TIPOS.dominical);
    assert.equal(x.normalizarEstado({ tipo: 'hora-misionera' }).tipo, 'dominical');
    assert.equal(x.normalizarEstado({ tipo: 'hora-misionera', santo: 'Ana' }).santo, 'Ana');
    assert.equal(x.normalizarEstado({ tipo: 'novena' }).tipo, 'novena');
    const y = cargarTipos((cfg) => { cfg.tipos = { apagados: ['dominical', 'novena'] }; });   // el primero disponible ya no es el dominical
    assert.equal(y.tipoDe({ tipo: 'dominical' }), y.TIPOS.semana);
    assert.equal(y.normalizarEstado({}).tipo, 'semana');   // el tipo por defecto (novena) está apagado
    assert.equal(y.normalizarEstado({ tipo: 'inexistente' }).tipo, 'semana');
    assert.equal(y.tipoDe(null), y.TIPOS.semana);
  });
  prueba('con la configuración neutra (aún no llega) normalizarEstado no reescribe el tipo, pero tipoDe sigue válido', () => {
    const n = cargarCon(['tipos.js', 'comun.js'], {}, null);
    assert.equal(n.ESTADO_CONFIG.origen, 'neutra');
    const e = n.normalizarEstado({ tipo: 'hora-misionera' });
    assert.equal(e.tipo, 'hora-misionera');
    assert.equal(n.tipoDe(e), n.TIPOS.dominical);
  });
  prueba('un tipo propio guardado se conserva cuando la configuración lo trae', () => {
    const x = cargarTipos((cfg) => { cfg.tipos = { propios: [{ clave: 'adoracion', nombre: 'Adoración' }] }; });
    assert.equal(x.normalizarEstado({ tipo: 'adoracion' }).tipo, 'adoracion');
  });
  prueba('un tipo propio no pisa a los comunes ni los muta', () => {
    const x = cargarTipos((cfg) => { cfg.tipos = { propios: [{ clave: 'adoracion', nombre: 'Adoración', rotulos: ['persona'] }] }; });
    x.tipoDe({ tipo: 'adoracion' });
    assert.equal(Object.keys(x.TIPOS).length, 11);
    assert.equal(x.TIPOS.dominical.rotulos.length, 5);
    assert.equal(x.tipoDe({ tipo: 'dominical' }), x.TIPOS.dominical);
  });
});

/* ---------- Rediseño: opcionales, horarios, avisos, rótulos (Plan 1, Tarea 5) ---------- */

grupo('pantallas: lógica del rediseño', () => {
  const base = () => JSON.parse(JSON.stringify(CONFIG_CIUDAD_ARCE));
  const cargarP = (cambios) => {
    const cfg = base();
    if (cambios) cambios(cfg);
    return cargarCon(['tipos.js', 'comun.js', 'pantallas.js'], {}, cfg);
  };
  const forzar = (x, cfg) => vm.runInContext('PARROQUIA = ' + JSON.stringify(cfg) + ';', x);
  const plano = (o) => JSON.parse(JSON.stringify(o));
  const dia = (a, m, d) => new Date(a, m - 1, d);
  const c = cargarP();
  const HORARIOS = [
    { dia: 'Domingo', horas: [{ hora: '7:00 a. m.' }, { hora: '9:00 a. m.' }], lugar: 'Templo parroquial' },
    { dia: 'Jueves', horas: [{ hora: '6:00 p. m.', nota: 'Hora Santa' }] },
    { dia: 'Sábado', hora: '6:00 p. m.', nota: 'Misa de vigilia' }
  ];

  prueba('visible: redes y horarios solo con mostrar; sin personalizar, falso', () => {
    assert.equal(c.visible('inicio', 'redes'), false);
    assert.equal(c.visible('inicio', 'horarios'), false);
    assert.deepEqual(plano(c.ajustesDe('inicio').mostrar), []);
    const x = cargarP((cfg) => { cfg.pantallas = { inicio: { modo: 'personalizada', mostrar: ['redes'] } }; });
    assert.equal(x.visible('inicio', 'redes'), true);
    assert.equal(x.visible('inicio', 'horarios'), false);
    assert.deepEqual(plano(x.ajustesDe('inicio').mostrar), ['redes']);
    assert.equal(x.visible('gracias', 'redes'), false, 'otra vista no cambia');
  });
  prueba('visible: mostrar se ignora en modo como-viene', () => {
    const x = cargarP((cfg) => { cfg.pantallas = { inicio: { modo: 'como-viene', mostrar: ['redes'] } }; });
    assert.equal(x.visible('inicio', 'redes'), false);
  });
  prueba('ajustesDe.mostrar ignora elementos que no se pueden mostrar', () => {
    const x = cargarP();
    forzar(x, Object.assign(base(), { pantallas: { inicio: { modo: 'personalizada', mostrar: ['logo', 'horarios', 7] } } }));
    assert.deepEqual(plano(x.ajustesDe('inicio').mostrar), ['horarios']);
  });
  prueba('ocultar cuenta: visible(inicio, cuenta) es falso; sin ocultar, verdadero', () => {
    assert.equal(c.visible('inicio', 'cuenta'), true);
    const x = cargarP((cfg) => { cfg.pantallas = { inicio: { modo: 'personalizada', ocultar: ['cuenta'] } }; });
    assert.equal(x.visible('inicio', 'cuenta'), false);
  });
  prueba('produccion y envivo: fondo, imagen y distribución se ignoran; ocultar y textos cuentan', () => {
    const x = cargarP((cfg) => {
      cfg.pantallas = {};
      for (const v of ['produccion', 'envivo', 'inicio']) {
        cfg.pantallas[v] = { modo: 'personalizada', fondo: { tipo: 'color', color: '#123456' }, imagen: 'ninguna', distribucion: 'centro', ocultar: ['marca'], textos: { capa_logo: 'Pastoral' } };
      }
    });
    for (const v of ['produccion', 'envivo']) {
      const a = x.ajustesDe(v);
      assert.equal(a.fondo.tipo, 'degradado', v);
      assert.equal(a.imagen, 'automatica', v);
      assert.equal(a.distribucion, 'izquierda', v);
      assert.equal(x.visible(v, 'marca'), false, v);
      assert.equal(a.textos.capa_logo, 'Pastoral', v);
    }
    assert.equal(x.ajustesDe('inicio').fondo.tipo, 'color', 'en inicio sí cuentan');
    assert.equal(x.ajustesDe('inicio').distribucion, 'centro');
  });
  prueba('horariosPara normaliza la forma vieja como {dia, horas:[{hora, nota}], lugar:""}', () => {
    const x = cargarP((cfg) => { cfg.horarios = HORARIOS; });
    assert.deepEqual(plano(x.horariosPara()), [
      { dia: 'Domingo', horas: [{ hora: '7:00 a. m.', nota: '' }, { hora: '9:00 a. m.', nota: '' }], lugar: 'Templo parroquial' },
      { dia: 'Jueves', horas: [{ hora: '6:00 p. m.', nota: 'Hora Santa' }], lugar: '' },
      { dia: 'Sábado', horas: [{ hora: '6:00 p. m.', nota: 'Misa de vigilia' }], lugar: '' }
    ]);
  });
  prueba('filasHorarios: día y notas a la izquierda, horas a la derecha (artboard F11)', () => {
    const x = cargarP((cfg) => { cfg.horarios = HORARIOS; });
    assert.deepEqual(plano(x.filasHorarios()), [
      { a: 'Domingo', f: '7:00 a. m. · 9:00 a. m.' },
      { a: 'Jueves · Hora Santa', f: '6:00 p. m.' },
      { a: 'Sábado · Misa de vigilia', f: '6:00 p. m.' }
    ]);
    assert.deepEqual(plano(c.filasHorarios()), [], 'sin horarios');
  });
  prueba('filasGracias: los horarios de Gracias, como mucho MAX_FILAS_GRACIAS (6), en orden', () => {
    const doce = Array.from({ length: 12 }, (_, i) => ({ dia: 'Día ' + (i + 1), horas: [{ hora: '7:00 a. m.', nota: 'Misa' }, { hora: '9:00 a. m.' }] }));
    const x = cargarP((cfg) => { cfg.horarios = doce; });
    assert.equal(x.MAX_FILAS_GRACIAS, 6);
    assert.deepEqual(plano(x.filasGracias()), plano(x.filasHorarios()).slice(0, 6));
    const y = cargarP((cfg) => { cfg.horarios = HORARIOS; });
    assert.deepEqual(plano(y.filasGracias()), plano(y.filasHorarios()), 'con pocos horarios, todos');
  });
  prueba('avisosPara: sin los avisos con activo:false', () => {
    const x = cargarP((cfg) => {
      cfg.avisos = [{ texto: 'Activo', activo: true }, { texto: 'Apagado', activo: false }, { texto: 'Sin campo' }];
    });
    assert.deepEqual(plano(x.avisosPara(x.normalizarEstado({}), dia(2026, 11, 15))).map((r) => r.a), ['Activo', 'Sin campo']);
  });
  prueba('avisosPara: los horarios van al final solo con mostrar:[horarios], y se corta en 6', () => {
    const avisos = [{ texto: 'Fijo 1' }, { texto: 'Fijo 2' }];
    const sin = cargarP((cfg) => { cfg.avisos = avisos; cfg.horarios = HORARIOS; });
    const s = sin.normalizarEstado({ avisos: [{ a: 'Panel', f: 'x' }] });
    assert.deepEqual(plano(sin.avisosPara(s, dia(2026, 11, 15))).map((r) => r.a), ['Fijo 1', 'Fijo 2', 'Panel']);
    const con = cargarP((cfg) => {
      cfg.avisos = avisos; cfg.horarios = HORARIOS;
      cfg.pantallas = { avisos: { modo: 'personalizada', mostrar: ['horarios'] } };
    });
    const r = plano(con.avisosPara(s, dia(2026, 11, 15)));
    assert.equal(r.length, 6);
    assert.deepEqual(r.map((e) => e.a), ['Fijo 1', 'Fijo 2', 'Panel', 'Domingo', 'Jueves · Hora Santa', 'Sábado · Misa de vigilia']);
    assert.deepEqual(r[4], { a: 'Jueves · Hora Santa', f: '6:00 p. m.' });
    const mas = cargarP((cfg) => {
      cfg.avisos = [1, 2, 3, 4, 5].map((n) => ({ texto: 'Fijo ' + n })); cfg.horarios = HORARIOS;
      cfg.pantallas = { avisos: { modo: 'personalizada', mostrar: ['horarios'] } };
    });
    assert.deepEqual(plano(mas.avisosPara(mas.normalizarEstado({}), dia(2026, 11, 15))).map((e) => e.a),
      ['Fijo 1', 'Fijo 2', 'Fijo 3', 'Fijo 4', 'Fijo 5', 'Domingo']);
  });
  prueba('redesVisibles: las redes solo si la vista las muestra', () => {
    const redes = [{ red: 'facebook', url: 'https://facebook.com/x', texto: '/Parroquia' }];
    const sin = cargarP((cfg) => { cfg.redes = redes; });
    assert.deepEqual(plano(sin.redesVisibles('inicio')), []);
    const con = cargarP((cfg) => { cfg.redes = redes; cfg.pantallas = { inicio: { modo: 'personalizada', mostrar: ['redes'] } }; });
    assert.deepEqual(plano(con.redesVisibles('inicio')), [{ red: 'facebook', texto: '/Parroquia' }]);
    assert.deepEqual(plano(con.redesVisibles('gracias')), []);
  });
  prueba('estiloRotulos sin bloque rotulos: los valores de hoy más colorLinea null, ladoClaro false, logoEsquina true', () => {
    assert.deepEqual(plano(c.estiloRotulos()), {
      tipografia: 'montserrat', esquinas: 'suaves', posicion: 'izquierda', colorLado: null,
      colorLinea: null, ladoClaro: false, logoEsquina: true
    });
  });
  prueba('estiloRotulos: tipografía, esquinas suaves, logoEsquina y colores con nombre', () => {
    const x = cargarP((cfg) => {
      cfg.colores.acento = '#d9a441';
      cfg.rotulos = { tipografia: 'lora', esquinas: 'suaves', colorLado: 'oscuro', colorLinea: 'principal', logoEsquina: false };
    });
    assert.deepEqual(plano(x.estiloRotulos()), {
      tipografia: 'lora', esquinas: 'suaves', posicion: 'izquierda', colorLado: '#0c3562',
      colorLinea: '#1155a4', ladoClaro: false, logoEsquina: false
    });
  });
  prueba('esquinas (R3): validarConfig acepta los nombres del diseño y el viejo; estiloRotulos da el nombre del diseño', () => {
    for (const q of ['rectas', 'suaves', 'redondas', 'redondeadas']) {
      const x = cargarP((cfg) => { cfg.rotulos = { esquinas: q }; });
      assert.ok(x.validarConfig(x.PARROQUIA).ok, q);
    }
    const esq = (q) => cargarP((cfg) => { cfg.rotulos = q === undefined ? {} : { esquinas: q }; }).estiloRotulos().esquinas;
    assert.equal(esq('redondeadas'), 'suaves');
    assert.equal(esq('suaves'), 'suaves');
    assert.equal(esq(undefined), 'suaves');
    assert.equal(esq('redondas'), 'redondas');
    assert.equal(esq('rectas'), 'rectas');
  });
  prueba('estiloRotulos: colorLado blanco da ladoClaro', () => {
    const x = cargarP((cfg) => { cfg.rotulos = { colorLado: 'blanco' }; });
    const e = x.estiloRotulos();
    assert.equal(e.colorLado, '#ffffff');
    assert.equal(e.ladoClaro, true);
    const y = cargarP((cfg) => { cfg.rotulos = { colorLado: '#f0e6c8' }; });
    assert.equal(y.estiloRotulos().ladoClaro, true, 'un hex claro también');
  });
  prueba('estiloRotulos: con acento y sin colorLinea, la línea es el acento', () => {
    const x = cargarP((cfg) => { cfg.colores.acento = '#d9a441'; });
    assert.equal(x.estiloRotulos().colorLinea, '#d9a441');
    const y = cargarP((cfg) => { cfg.colores.acento = '#d9a441'; cfg.rotulos = { colorLado: 'acento' }; });
    assert.equal(y.estiloRotulos().colorLado, '#d9a441');
  });
});

/* ---------- Rediseño: ajustes de tipos comunes y portada de los propios (Plan 1, Tarea 4) ---------- */

grupo('tipos: ajustes y propios del rediseño', () => {
  const ARCHIVOS = ['tipos.js', 'comun.js', 'pantallas.js'];
  const base = () => JSON.parse(JSON.stringify(CONFIG_CIUDAD_ARCE));
  const conAjustes = (ajustes, cambios) => {
    const cfg = Object.assign(base(), { tipos: { ajustes } });
    if (cambios) cambios(cfg);
    return cargarCon(ARCHIVOS, {}, cfg);
  };
  const conPropios = (propios) => cargarCon(ARCHIVOS, {}, Object.assign(base(), { tipos: { propios } }));
  const forzar = (x, cfg) => vm.runInContext('PARROQUIA = ' + JSON.stringify(cfg) + ';', x);
  const plano = (o) => JSON.parse(JSON.stringify(o));
  const c = cargarCon(ARCHIVOS);
  const AJUSTE_HS = { nombrePanel: 'Adoración', textoInicio: 'Ya empezamos', textoGracias: 'Gracias', imagen: 'patrono', ocultarRotulos: ['bendicion'] };

  prueba('sin ajustes tipoDe devuelve TIPOS[clave] tal cual', () => {
    assert.equal(c.tipoDe({ tipo: 'horasanta' }), c.TIPOS.horasanta);
  });
  prueba('todo tipo común trae nombrePanel igual a su nombre y textosTipo vacío', () => {
    for (const k of c.ORDEN_TIPOS) {
      assert.equal(c.TIPOS[k].nombrePanel, c.TIPOS[k].nombre, k);
      assert.deepEqual(plano(c.TIPOS[k].textosTipo), {}, k);
    }
  });
  prueba('ajustes de un común: nombrePanel, textos, imagen y rótulos ocultos', () => {
    const x = conAjustes({ horasanta: AJUSTE_HS });
    const t = x.tipoDe({ tipo: 'horasanta' });
    assert.equal(t.nombrePanel, 'Adoración');
    assert.equal(t.nombre, 'Hora Santa');
    assert.deepEqual(plano(t.textosTipo), { inicio_titulo: 'Ya empezamos', gracias_cursiva: 'Gracias' });
    assert.equal(t.imagen, 'patrono');
    assert.ok(!t.rotulos.some((r) => r.id === 'bendicion'));
    assert.equal(t.rotulos.length, 4);
    assert.equal(x.TIPOS.horasanta.rotulos.length, 5, 'no muta TIPOS');
    assert.equal(x.TIPOS.horasanta.nombrePanel, 'Hora Santa', 'no muta TIPOS');
    assert.equal(x.TIPOS.horasanta.imagen, 'custodia', 'no muta TIPOS');
  });
  prueba('un ajuste de otro tipo no cambia este: sigue siendo TIPOS[clave]', () => {
    const x = conAjustes({ horasanta: AJUSTE_HS });
    assert.equal(x.tipoDe({ tipo: 'dominical' }), x.TIPOS.dominical);
  });
  prueba('el ajuste también vale cuando tipoDe cae al primer tipo disponible', () => {
    const x = conAjustes({ dominical: { nombrePanel: 'Domingo' } });
    assert.equal(x.tipoDe({ tipo: 'no-existe' }).nombrePanel, 'Domingo');
  });
  prueba('ajuste con imagen de galería inexistente usa la imagen del tipo', () => {
    const x = conAjustes({});
    forzar(x, Object.assign(base(), { tipos: { ajustes: { horasanta: { imagen: 'galeria:no-esta' } } } }));
    assert.equal(x.tipoDe({ tipo: 'horasanta' }).imagen, 'custodia');
    assert.equal(x.imagenDe({ tipo: 'horasanta' }), 'img/custodia.png');
  });
  prueba('ajuste con imagen de galería existente la usa', () => {
    const x = conAjustes({ horasanta: { imagen: 'galeria:patrono-2' } }, (cfg) => {
      cfg.galeria = [{ id: 'patrono-2', src: 'medios/patrono-2.jpg', alt: 'Segunda imagen del patrono' }];
    });
    assert.equal(x.tipoDe({ tipo: 'horasanta' }).imagen, 'galeria:patrono-2');
    assert.equal(x.imagenDe({ tipo: 'horasanta' }), 'medios/patrono-2.jpg');
  });
  prueba('el texto del tipo gana al de la pantalla, y el escrito en el panel gana a los dos', () => {
    const pantallas = { inicio: { modo: 'personalizada', textos: { inicio_titulo: 'De pantalla' } } };
    const x = conAjustes({ horasanta: { textoInicio: 'Del tipo' } }, (cfg) => { cfg.pantallas = pantallas; });
    assert.equal(x.textoDe({ tipo: 'horasanta' }, 'inicio', 'inicio_titulo'), 'Del tipo');
    assert.equal(x.textoDe({ tipo: 'horasanta', textos: { inicio_titulo: 'Del panel' } }, 'inicio', 'inicio_titulo'), 'Del panel');
    const sin = conAjustes({}, (cfg) => { cfg.pantallas = pantallas; });
    assert.equal(sin.textoDe({ tipo: 'horasanta' }, 'inicio', 'inicio_titulo'), 'De pantalla');
  });
  prueba('el texto de gracias del tipo rellena los huecos y llega a tx', () => {
    const x = conAjustes({ horasanta: { textoGracias: 'Gracias, {parroquia}' } });
    const s = { tipo: 'horasanta' };
    assert.equal(x.textoDe(s, 'gracias', 'gracias_cursiva'), 'Gracias, Parroquia Inmaculada Concepción de María');
    assert.equal(x.tx(s, 'gracias_cursiva'), 'Gracias, Parroquia Inmaculada Concepción de María');
  });
  prueba('propio con portada fiesta tiene cuenta de la fiesta y esquina fiesta', () => {
    const x = conPropios([{ clave: 'triduo', nombre: 'Triduo', portada: 'fiesta' }]);
    const t = x.tipoDe({ tipo: 'triduo' });
    assert.equal(t.portada, 'fiesta');
    assert.ok(t.cuenta, 'tiene cuenta');
    assert.equal(t.cuenta.hasta, x.fiestaMMDD());
    assert.equal(t.esquina, 'fiesta');
  });
  prueba('propio con portada fiesta y esquina propia conserva su esquina', () => {
    const x = conPropios([{ clave: 'triduo', nombre: 'Triduo', portada: 'fiesta', esquina: 'hoy' }]);
    assert.equal(x.tipoDe({ tipo: 'triduo' }).esquina, 'hoy');
  });
  prueba('propio con portada evento pide evento, fecha y lugar como el tipo evento', () => {
    const x = conPropios([{ clave: 'retiro', nombre: 'Retiro', portada: 'evento' }]);
    const t = x.tipoDe({ tipo: 'retiro' });
    assert.equal(t.portada, 'evento');
    assert.equal(t.portadaCeja, x.TIPOS.evento.portadaCeja);
    assert.equal(t.portadaCursiva, x.TIPOS.evento.portadaCursiva);
    assert.deepEqual(plano(t.datos), ['evento', 'fecha', 'lugar']);
    assert.notEqual(t.datos, x.TIPOS.evento.datos, 'lista nueva: no comparte la de TIPOS.evento');
  });
  prueba('portada de evento de un propio: el título es el evento escrito en el panel; sin él, el del tipo', () => {
    const x = conPropios([{ clave: 'rosario-aurora', nombre: 'Rosario de la aurora', portada: 'evento' }, { clave: 'retiro', nombre: 'Retiro', titulo: 'Retiro de {evento}', portada: 'evento' }]);
    assert.equal(x.tituloPortadaEvento({ tipo: 'rosario-aurora', evento: 'Rosario de la aurora · Barrio El Centro' }), 'ROSARIO DE LA AURORA · BARRIO EL CENTRO');
    assert.equal(x.tituloPortadaEvento({ tipo: 'rosario-aurora', evento: '   ' }), 'ROSARIO DE LA AURORA');
    assert.equal(x.tituloPortadaEvento({ tipo: 'rosario-aurora' }), 'ROSARIO DE LA AURORA');
    assert.equal(x.tituloPortadaEvento({ tipo: 'retiro', evento: 'Jóvenes' }), 'RETIRO DE JÓVENES', 'si el título ya usa {evento}, manda la plantilla del tipo');
  });
  prueba('portada de evento del tipo evento: igual que tituloCelebracion, con y sin evento', () => {
    for (const s of [{ tipo: 'evento', evento: 'Concierto' }, { tipo: 'evento' }]) {
      assert.equal(c.tituloPortadaEvento(s), c.tituloCelebracion(s), JSON.stringify(s));
    }
    assert.equal(c.tituloPortadaEvento({ tipo: 'evento', evento: 'Concierto' }), 'CONCIERTO');
  });
  prueba('propio sin portada sigue igual que hoy', () => {
    for (const portada of [undefined, 'ninguna']) {
      const p = { clave: 'retiro', nombre: 'Retiro' };
      if (portada) p.portada = portada;
      const t = conPropios([p]).tipoDe({ tipo: 'retiro' });
      assert.equal(t.portada, undefined, String(portada));
      assert.equal(t.cuenta, false, String(portada));
      assert.equal(t.esquina, 'hoy', String(portada));
      assert.deepEqual(plano(t.datos), [], String(portada));
    }
  });
  prueba('propio: nombrePanel, textoInicio y textoGracias', () => {
    const x = conPropios([
      { clave: 'retiro', nombre: 'Retiro juvenil', nombrePanel: 'Retiro', textoInicio: 'Ya casi', textoGracias: 'Hasta pronto' },
      { clave: 'vigilia', nombre: 'Vigilia' }
    ]);
    const t = x.tipoDe({ tipo: 'retiro' });
    assert.equal(t.nombrePanel, 'Retiro');
    assert.deepEqual(plano(t.textosTipo), { inicio_titulo: 'Ya casi', gracias_cursiva: 'Hasta pronto' });
    assert.equal(x.textoDe({ tipo: 'retiro' }, 'inicio', 'inicio_titulo'), 'Ya casi');
    const v = x.tipoDe({ tipo: 'vigilia' });
    assert.equal(v.nombrePanel, 'Vigilia');
    assert.deepEqual(plano(v.textosTipo), {});
  });
  prueba('ocultar el rótulo que está al aire: rotulosDe ya no lo trae', () => {
    const s = { tipo: 'horasanta', rotulo: 'bendicion' };
    assert.ok(c.rotulosDe(s).find((r) => r.id === 'bendicion'), 'sin ajuste sí lo trae');
    const x = conAjustes({ horasanta: { ocultarRotulos: ['bendicion'] } });
    assert.equal(x.rotulosDe(s).find((r) => r.id === 'bendicion'), undefined);
  });
});

/* ---------- Vista previa del editor (Etapa 2a) ---------- */

grupo('vista previa', () => {
  /* Carga parroquia.js con ?vista-previa=1 y una ventana que guarda sus oyentes de «message». */
  function cargarVista(dentroDeIframe, almacen = {}) {
    const oyentes = [];
    const ventana = { innerWidth: 1920, innerHeight: 1080, addEventListener: (t, f) => { if (t === 'message') oyentes.push(f); } };
    ventana.parent = dentroDeIframe ? { marca: 'padre' } : ventana;
    const loc = { pathname: '/ciudad-arce/pantalla.html', search: '?tipo=inicio&vista-previa=1', origin: 'http://editor.test' };
    const c = cargar(['parroquia.js'], almacen, { location: loc, window: ventana });
    return { c, ventana, oyentes, enviar: (e) => oyentes.forEach((f) => f(e)) };
  }
  const vivo = (c, nombre) => vm.runInContext(nombre, c);
  const mensaje = (ventana, extra) => Object.assign({
    origin: 'http://editor.test', source: ventana.parent, data: { tipo: 'pev-vista-previa', config: { nombre: 'Parroquia de Prueba' } }
  }, extra);

  prueba('vista previa: sin iframe se ignora ?vista-previa=1', () => {
    const v = cargarVista(false);
    assert.equal(v.c.VISTA_PREVIA, false);
    assert.equal(v.c.claveDe('estado_v1'), 'pev_ciudad-arce_estado_v1');
    assert.equal(v.oyentes.length, 0);
  });
  prueba('vista previa: sin ?vista-previa=1 tampoco, aunque haya padre', () => {
    const ventana = { addEventListener() {} };
    ventana.parent = { marca: 'padre' };
    const c = cargar(['parroquia.js'], {}, { location: { pathname: '/ciudad-arce/pantalla.html', search: '?tipo=inicio', origin: 'http://editor.test' }, window: ventana });
    assert.equal(c.VISTA_PREVIA, false);
  });
  prueba('vista previa: claves con pev_vistaprevia_', () => {
    const v = cargarVista(true);
    assert.equal(v.c.VISTA_PREVIA, true);
    assert.equal(v.c.claveDe('estado_v1'), 'pev_vistaprevia_ciudad-arce_estado_v1');
    assert.equal(v.c.claveDe('config_v1'), 'pev_vistaprevia_ciudad-arce_config_v1');
  });
  prueba('vista previa: no lee la copia guardada del OBS real y arranca neutra', () => {
    const copia = JSON.stringify(Object.assign({}, CONFIG_CIUDAD_ARCE));
    const v = cargarVista(true, { 'pev_ciudad-arce_config_v1': copia });
    assert.equal(vivo(v.c, 'PARROQUIA'), v.c.CONFIG_NEUTRA);
    assert.equal(vivo(v.c, 'ESTADO_CONFIG').origen, 'neutra');
  });
  prueba('vista previa: cargarParroquia no pide config.json', async () => {
    let pedidos = 0;
    const ventana = { addEventListener() {} };
    ventana.parent = { marca: 'padre' };
    const c = cargar(['parroquia.js'], {}, {
      location: { pathname: '/ciudad-arce/pantalla.html', search: '?vista-previa=1', origin: 'http://editor.test' },
      window: ventana, fetch: () => { pedidos++; return Promise.reject(new Error('no debía pedir')); }
    });
    await c.cargarParroquia();
    c.vigilarParroquia();
    assert.equal(pedidos, 0);
  });
  prueba('vista previa: un mensaje del padre y del mismo origen cambia PARROQUIA y avisa', () => {
    const v = cargarVista(true);
    const avisos = [];
    v.c.alCambiarParroquia((p) => avisos.push(p.nombre));
    v.enviar(mensaje(v.ventana));
    assert.equal(vivo(v.c, 'PARROQUIA').nombre, 'Parroquia de Prueba');
    assert.equal(vivo(v.c, 'PARROQUIA').version, 1);
    assert.equal(vivo(v.c, 'PARROQUIA').colores.principal, '#1155a4');
    assert.equal(vivo(v.c, 'ESTADO_CONFIG').origen, 'vista-previa');
    assert.deepEqual(avisos, ['Parroquia de Prueba']);
    assert.equal(Object.keys(v.c.__almacen).filter((k) => k.includes('config_v1')).length, 0, 'no guarda copia');
  });
  prueba('vista previa: un mensaje de otro origen no cambia PARROQUIA', () => {
    const v = cargarVista(true);
    v.enviar(mensaje(v.ventana, { origin: 'http://otro.test' }));
    assert.equal(vivo(v.c, 'PARROQUIA'), v.c.CONFIG_NEUTRA);
  });
  prueba('vista previa: un mensaje de otra ventana no cambia PARROQUIA', () => {
    const v = cargarVista(true);
    v.enviar(mensaje(v.ventana, { source: { marca: 'otra' } }));
    assert.equal(vivo(v.c, 'PARROQUIA'), v.c.CONFIG_NEUTRA);
  });
  prueba('vista previa: un mensaje de otro tipo o vacío no cambia PARROQUIA ni falla', () => {
    const v = cargarVista(true);
    v.enviar(mensaje(v.ventana, { data: { tipo: 'otra-cosa', config: { nombre: 'X' } } }));
    v.enviar(mensaje(v.ventana, { data: null }));
    v.enviar(mensaje(v.ventana, { data: { tipo: 'pev-vista-previa', config: null } }));
    assert.equal(vivo(v.c, 'PARROQUIA').nombre, '');
  });
  /* Con tipos.js y comun.js: el estado que manda el editor llega a leerEstado(). */
  function cargarVistaComun(dentroDeIframe, almacen = {}) {
    const oyentes = [];
    const ventana = { innerWidth: 1920, innerHeight: 1080, addEventListener: (t, f) => { if (t === 'message') oyentes.push(f); } };
    ventana.parent = dentroDeIframe ? { marca: 'padre' } : ventana;
    const loc = { pathname: '/ciudad-arce/pantalla.html', search: '?tipo=inicio&vista-previa=1', origin: 'http://editor.test' };
    const c = cargar(['parroquia.js', 'tipos.js', 'comun.js'], almacen, { location: loc, window: ventana });
    return { c, ventana, enviar: (e) => oyentes.forEach((f) => f(e)) };
  }
  const conEstado = (ventana, estado) => mensaje(ventana, { data: { tipo: 'pev-vista-previa', config: { nombre: 'Parroquia de Prueba' }, estado } });
  prueba('vista previa: el estado del mensaje llega a leerEstado()', () => {
    const v = cargarVistaComun(true);
    v.enviar(conEstado(v.ventana, { tipo: 'horasanta' }));
    assert.equal(v.c.leerEstado().tipo, 'horasanta');
    assert.equal(v.c.leerEstado().rotulo, 'ninguno', 'lo que no manda sale del guardado o del predeterminado');
  });
  prueba('vista previa: el estado se suma al guardado de la vista previa', () => {
    const v = cargarVistaComun(true, { 'pev_vistaprevia_ciudad-arce_estado_v1': JSON.stringify({ celebrante: 'P. Guardado', tipo: 'novena' }) });
    v.enviar(conEstado(v.ventana, { tipo: 'horasanta' }));
    const s = v.c.leerEstado();
    assert.equal(s.tipo, 'horasanta');
    assert.equal(s.celebrante, 'P. Guardado');
  });
  prueba('vista previa: un estado que no es un objeto plano se ignora', () => {
    for (const estado of ['x', 7, null, ['horasanta']]) {
      const v = cargarVistaComun(true);
      v.enviar(conEstado(v.ventana, { tipo: 'horasanta' }));
      v.enviar(conEstado(v.ventana, estado));
      assert.equal(vivo(v.c, 'ESTADO_VISTA_PREVIA'), null, JSON.stringify(estado));
      assert.equal(v.c.leerEstado().tipo, 'novena', JSON.stringify(estado));
      assert.equal(vivo(v.c, 'PARROQUIA').nombre, 'Parroquia de Prueba', 'la configuración sí se aplica');
    }
  });
  prueba('vista previa: sin VISTA_PREVIA, ESTADO_VISTA_PREVIA no se lee', () => {
    const v = cargarVistaComun(false);
    assert.equal(v.c.VISTA_PREVIA, false);
    vm.runInContext("ESTADO_VISTA_PREVIA = { tipo: 'horasanta' }", v.c);
    assert.equal(v.c.leerEstado().tipo, 'novena');
  });
  prueba('vista previa: el estado mandado no se guarda en el almacenamiento', () => {
    const v = cargarVistaComun(true);
    const antes = Object.keys(v.c.__almacen).sort();
    v.enviar(conEstado(v.ventana, { tipo: 'horasanta', rotulo: 'guia' }));
    v.c.leerEstado();
    assert.deepEqual(Object.keys(v.c.__almacen).sort(), antes);
    assert.equal(Object.keys(v.c.__almacen).filter((k) => k.includes('estado_v1')).length, 0);
  });
  prueba('vista previa: leerEstado no cambia lo que mandó el editor', () => {
    const v = cargarVistaComun(true);
    const estado = { tipo: 'horasanta', avisos: [{ a: 'Uno', f: '' }] };
    v.enviar(conEstado(v.ventana, estado));
    v.c.leerEstado(); v.c.leerEstado();
    assert.equal(vivo(v.c, 'ESTADO_VISTA_PREVIA').avisos.length, 1);
  });
});

grupo('semana', () => {
  const j = (x) => JSON.parse(JSON.stringify(x));
  const S = () => cargar(['semana.js']).SEMANA;
  const F = '11111111-1111-4111-8111-111111111111';
  const SID = '22222222-2222-4222-8222-222222222222';
  const fija = (extra = {}) => Object.assign({ id: F, dia_semana: 4, hora: '18:00', tipo: 'horasanta', datos: {}, activa: true }, extra);
  const serie = (extra = {}) => Object.assign({ id: SID, nombre: 'Prenovena 2026', tipo: 'prenovena', inicio: '2026-11-15', dias: 9, hora: '19:00', datos: { celebrante: 'P. Ana' } }, extra);
  const fila = (extra) => Object.assign({ id: 'fila-1', clave: 'fija:' + F + ':2026-11-19', fecha: '2026-11-19', hora: '18:00', tipo: 'horasanta', datos: {}, origen: 'fija', fija_id: F, serie_id: null, saltada: false, editada: false, actualizado_en: '2026-11-15T10:00:00Z', actualizado_desde: 'web' }, extra);

  prueba('fechas', () => {
    const s = S();
    assert.equal(s.lunesDe('2026-11-15'), '2026-11-09');
    assert.equal(s.lunesDe('2026-11-16'), '2026-11-16');
    assert.equal(s.diaSemana('2026-11-19'), 4);
    assert.equal(s.sumarDias('2026-12-28', 7), '2027-01-04');
    assert.equal(s.esFecha('2026-02-30'), false);
    assert.equal(s.esFecha('2026-11-19'), true);
    assert.equal(s.claveFija(F, '2026-11-19'), 'fija:' + F + ':2026-11-19');
    assert.equal(s.claveSerie(SID, '2026-11-19'), 'serie:' + SID + ':2026-11-19');
    assert.equal(s.claveUnica('x'), 'unica:x');
  });

  prueba('fijas: un día por fija activa', () => {
    const s = S();
    const items = j(s.armarSemana({ lunes: '2026-11-16', fijas: [fija()], series: [], transmisiones: [] }));
    assert.equal(items.length, 1);
    assert.equal(items[0].fecha, '2026-11-19');
    assert.equal(items[0].clave, 'fija:' + F + ':2026-11-19');
    assert.equal(items[0].origen, 'fija');
    assert.equal(items[0].diaSemanaFija, 4);
    assert.deepEqual(j(s.armarSemana({ lunes: '2026-11-16', fijas: [fija({ activa: false })], series: [], transmisiones: [] })), []);
  });

  prueba('una serie que cruza de semana', () => {
    const s = S();
    const de = (lunes) => j(s.armarSemana({ lunes, fijas: [], series: [serie()], transmisiones: [] }));
    const a = de('2026-11-09');
    assert.equal(a.length, 1);
    assert.equal(a[0].datos.dia, 1);
    const b = de('2026-11-16');
    assert.deepEqual(b.map((i) => i.datos.dia), [2, 3, 4, 5, 6, 7, 8]);
    const c = de('2026-11-23');
    assert.equal(c.length, 1);
    assert.equal(c[0].datos.dia, 9);
    assert.deepEqual(c[0].serie, { nombre: 'Prenovena 2026', dias: 9, dia: 9 });
  });

  prueba('un día editado gana sobre la fija, aunque la fija cambie', () => {
    const s = S();
    const t = [fila({ editada: true, hora: '19:30', datos: { celebrante: 'P. Luis' }, actualizado_desde: 'app' })];
    for (const f of [fija(), fija({ hora: '17:00' })]) {
      const [i] = j(s.armarSemana({ lunes: '2026-11-16', fijas: [f], series: [], transmisiones: t }));
      assert.equal(i.hora, '19:30');
      assert.deepEqual(i.datos, { celebrante: 'P. Luis' });
      assert.equal(i.editada, true);
      assert.equal(i.actualizadoDesde, 'app');
      assert.equal(i.id, 'fila-1');
    }
  });

  prueba('un día de serie editado sin dia lleva el del generado', () => {
    const s = S();
    const t = [fila({ clave: 'serie:' + SID + ':2026-11-17', fecha: '2026-11-17', origen: 'serie', fija_id: null, serie_id: SID, tipo: 'prenovena', editada: true, datos: { celebrante: 'P. Luis' } })];
    const items = j(s.armarSemana({ lunes: '2026-11-16', fijas: [], series: [serie()], transmisiones: t }));
    const i = items.find((x) => x.fecha === '2026-11-17');
    assert.deepEqual(i.datos, { celebrante: 'P. Luis', dia: 3 });
  });

  prueba('saltada sale saltada con los datos de la fija', () => {
    const s = S();
    const [i] = j(s.armarSemana({ lunes: '2026-11-16', fijas: [fija({ datos: { celebrante: 'Fija' } })], series: [], transmisiones: [fila({ saltada: true, datos: { celebrante: 'otro' } })] }));
    assert.equal(i.saltada, true);
    assert.deepEqual(i.datos, { celebrante: 'Fija' });
  });

  prueba('filas huérfanas: editada sale, solo saltada no', () => {
    const s = S();
    const arm = (t) => j(s.armarSemana({ lunes: '2026-11-16', fijas: [fija({ activa: false })], series: [], transmisiones: [t] }));
    assert.equal(arm(fila({ editada: true })).length, 1);
    assert.equal(arm(fila({ saltada: true })).length, 0);
  });

  prueba('una única sale como única, y el orden es fecha, hora y clave', () => {
    const s = S();
    const u = fila({ id: 'u1', clave: 'unica:u1', fecha: '2026-11-17', hora: '20:00', origen: 'unica', fija_id: null, tipo: 'dominical' });
    const u2 = fila({ id: 'u2', clave: 'unica:u2', fecha: '2026-11-17', hora: '08:00', origen: 'unica', fija_id: null, tipo: 'dominical' });
    const items = j(s.armarSemana({ lunes: '2026-11-16', fijas: [fija()], series: [serie()], transmisiones: [u, u2] }));
    const del17 = items.filter((i) => i.fecha === '2026-11-17');
    assert.deepEqual(del17.map((i) => i.clave), ['unica:u2', 'serie:' + SID + ':2026-11-17', 'unica:u1']);
    assert.equal(del17[0].origen, 'unica');
    const fechas = items.map((i) => i.fecha + i.hora);
    assert.deepEqual(fechas, fechas.slice().sort());
  });

  prueba('filas con forma mala se ignoran sin lanzar', () => {
    const s = S();
    const items = j(s.armarSemana({
      lunes: '2026-11-16',
      fijas: [fija({ dia_semana: 9 }), null, 'x'],
      series: [serie({ dias: -1 })],
      transmisiones: [fila({ fecha: 'x', editada: true }), fila({ datos: null, editada: true, clave: 'unica:z', origen: 'unica', fija_id: null }), 7]
    }));
    assert.deepEqual(items, []);
    assert.deepEqual(j(s.armarSemana(null)), []);
  });

  prueba('textos del día y del origen', () => {
    const s = S();
    assert.equal(s.textoDia('2026-11-19'), 'Jue 19');
    const [f] = s.armarSemana({ lunes: '2026-11-16', fijas: [fija()], series: [], transmisiones: [] });
    assert.equal(s.textoOrigen(f), 'Fija (todos los jueves)');
    const [sr] = s.armarSemana({ lunes: '2026-11-23', fijas: [], series: [serie()], transmisiones: [] });
    assert.equal(s.textoOrigen(sr), 'Parte de "Prenovena 2026" (9 días)');
    const [uno] = s.armarSemana({ lunes: '2026-11-09', fijas: [], series: [serie({ dias: 1 })], transmisiones: [] });
    assert.equal(s.textoOrigen(uno), 'Parte de "Prenovena 2026" (1 día)');
    assert.equal(s.textoOrigen({ origen: 'unica' }), 'Una sola vez');
  });

  prueba('CommonJS: require da el mismo SEMANA', () => {
    const r = require('../../vicaria/semana.js');
    assert.equal(r.lunesDe('2026-11-15'), '2026-11-09');
    assert.deepEqual(Object.keys(r).sort(), Object.keys(S()).sort());
    assert.ok(Object.isFrozen(r));
  });
});

grupo('semana: campos y faltas', () => {
  const j = (x) => JSON.parse(JSON.stringify(x));
  const ctx = () => cargar(['tipos.js', 'semana.js']); // sin parroquia.js: PARROQUIA no existe (comun.js la necesita al cargar)
  const comunes = (c) => c.SEMANA.tiposParaCampos(c.TIPOS, c.ORDEN_TIPOS);
  const deClave = (c, clave) => comunes(c).find((t) => t.clave === clave);
  const rutas = (c, clave) => j(c.SEMANA.camposDeTipo(deClave(c, clave))).map((x) => x.ruta);

  prueba('tiposParaCampos: los 11 comunes, sin leer getters', () => {
    const c = ctx();
    const l = j(comunes(c));
    assert.deepEqual(l.map((t) => t.clave), j(c.ORDEN_TIPOS));
    const hs = l.find((t) => t.clave === 'horasanta');
    assert.deepEqual(hs.rotulos[0], { id: 'guia', base: 'persona', nombre: 'Guía', ceja: 'GUÍA' });
    assert.deepEqual(hs.datos, []);
  });

  prueba('camposDeTipo sigue a faltas() del panel', () => {
    const c = ctx();
    assert.deepEqual(rutas(c, 'dominical'), ['celebrante', 'lectura1', 'salmoResp', 'lectura2', 'evangelio']);
    assert.deepEqual(j(c.SEMANA.camposDeTipo(deClave(c, 'dominical'))).map((x) => x.etiqueta), ['Celebrante', '1.ª lectura', 'Salmo', '2.ª lectura', 'Evangelio']);
    assert.deepEqual(rutas(c, 'horasanta'), ['rotulosTexto.guia.t', 'rotulosTexto.santisimo.t', 'lectura1', 'rotulosTexto.oracion.t']);
    assert.deepEqual(rutas(c, 'sector'), ['sector', 'lugar', 'celebrante', 'lectura1', 'salmoResp', 'evangelio']);
    const nov = rutas(c, 'novena');
    assert.ok(!nov.includes('dia') && !nov.some((r) => /rosario/.test(r)));
    const f = j(c.SEMANA.camposDeTipo(deClave(c, 'patronalsector'))).find((x) => x.ruta === 'fecha');
    assert.equal(f.entrada, 'fecha');
  });

  prueba('contarFaltas', () => {
    const c = ctx();
    const dom = deClave(c, 'dominical');
    assert.equal(c.SEMANA.contarFaltas(dom, { celebrante: 'P. Ana' }), 4);
    const conOpcional = Object.assign({}, dom, { rotulos: dom.rotulos.map((u) => (u.id === 'lectura2' ? Object.assign({}, u, { opcional: true }) : u)) });
    assert.equal(c.SEMANA.contarFaltas(conOpcional, { celebrante: 'P. Ana' }), 3);
    assert.equal(c.SEMANA.contarFaltas(null, {}), null);
    assert.equal(c.SEMANA.contarFaltas(dom, 'x'), 5);
    assert.equal(c.SEMANA.contarFaltas(dom, null), 5);
  });

  prueba('tiposDisponibles: apagados, ajustes y propios', () => {
    const c = ctx();
    const S = c.SEMANA;
    const com = comunes(c);
    assert.ok(!j(S.tiposDisponibles(com, { apagados: ['semana'] })).some((t) => t.clave === 'semana'));
    const aj = j(S.tiposDisponibles(com, { ajustes: { dominical: { nombrePanel: 'Misa del domingo', ocultarRotulos: ['lectura2'] } } }));
    const dom = aj.find((t) => t.clave === 'dominical');
    assert.equal(dom.nombre, 'Misa del domingo');
    assert.ok(!dom.rotulos.some((u) => u.id === 'lectura2'));
    const pr = j(S.tiposDisponibles(com, { propios: [{ clave: 'vigilia', nombre: 'Vigilia', rotulos: ['persona', 'lectura1', 'persona'], opcionales: ['persona-2'] }] }));
    const v = pr[pr.length - 1];
    assert.equal(v.clave, 'vigilia');
    assert.deepEqual(v.rotulos.map((u) => u.id), ['persona', 'lectura1', 'persona-2']);
    assert.equal(v.rotulos[2].opcional, true);
    assert.ok(!v.rotulos[0].opcional);
    assert.deepEqual(v.datos, []);
    const ev = j(S.tiposDisponibles(com, { propios: [{ clave: 'feria', nombre: 'Feria', rotulos: [], portada: 'evento' }] }));
    assert.deepEqual(ev[ev.length - 1].datos, ['evento', 'fecha', 'lugar']);
    const choca = j(S.tiposDisponibles(com, { propios: [{ clave: 'dominical', nombre: 'Otra', rotulos: ['persona'] }] }));
    assert.equal(choca.filter((t) => t.clave === 'dominical').length, 1);
    assert.equal(choca.find((t) => t.clave === 'dominical').nombre, 'Misa dominical');
    assert.equal(j(S.tiposDisponibles(com, null)).length, 11);
    assert.equal(j(S.tiposDisponibles(com, 'x')).length, 11);
    assert.equal(S.tipoDeClave(com, 'nada'), null);
  });

  prueba('limpiarDatos se queda solo con las claves de campo', () => {
    const S = ctx().SEMANA;
    const largo = 'x'.repeat(300);
    const l = j(S.limpiarDatos(JSON.parse('{"celebrante":"' + largo + '","clave":"k","servidor":"s","rotulo":"r","avisos":[],"__proto__":{"a":1}}')));
    assert.deepEqual(Object.keys(l), ['celebrante']);
    assert.equal(l.celebrante.length, 200);
    assert.deepEqual(j(S.limpiarDatos({ dia: '3' })), {});
    assert.deepEqual(j(S.limpiarDatos({ dia: 3 })), { dia: 3 });
    assert.deepEqual(j(S.limpiarDatos({ dia: 61 })), {});
    assert.deepEqual(j(S.limpiarDatos({ rotulosTexto: { guia: { t: 'Ana', k: 'X' }, 'a b': { t: 'y' } } })), { rotulosTexto: { guia: { t: 'Ana' } } });
    assert.deepEqual(j(S.limpiarDatos({ celebrante: 'FB-PRUEBA-MARCA-1111', clave: 'FB-PRUEBA-MARCA-1111' })), { celebrante: 'FB-PRUEBA-MARCA-1111' });
    assert.deepEqual(j(S.limpiarDatos(null)), {});
  });

  prueba('leerCampo y escribirCampo', () => {
    const S = ctx().SEMANA;
    const entrada = {};
    assert.deepEqual(j(S.escribirCampo(entrada, 'rotulosTexto.guia.t', 'Ana')), { rotulosTexto: { guia: { t: 'Ana' } } });
    assert.deepEqual(entrada, {});
    assert.equal(S.leerCampo({ rotulosTexto: { guia: { t: 'Ana' } } }, 'rotulosTexto.guia.t'), 'Ana');
    assert.equal(S.leerCampo(null, 'celebrante'), '');
  });

  prueba('datosDeEstado saca solo los campos del tipo', () => {
    const c = ctx();
    const estado = { tipo: 'novena', celebrante: 'P. Ana', lectura1: 'Is 1', rotulo: 'persona', avisos: [{ a: 'x' }], novenaDia: 4, sector: 'S8' };
    assert.deepEqual(j(c.SEMANA.datosDeEstado(estado, deClave(c, 'novena'))), { celebrante: 'P. Ana', lectura1: 'Is 1', dia: 4 });
  });

  prueba('parcheDePanel', () => {
    const c = ctx();
    const S = c.SEMANA;
    const p = j(S.parcheDePanel({ tipo: 'novena', datos: { dia: 12, celebrante: 'P. Ana' } }, deClave(c, 'novena')));
    assert.deepEqual(p.poner, { tipo: 'novena', celebrante: 'P. Ana', novenaDia: 9 });
    assert.deepEqual(p.limpiar, j(S.CLAVES_DE_TRANSMISION));
    const pre = j(S.parcheDePanel({ tipo: 'prenovena', datos: { dia: 3 } }, deClave(c, 'prenovena')));
    assert.equal(pre.poner.prenovenaDia, 3);
    const raro = j(S.parcheDePanel({ tipo: 'dominical', datos: { celebrante: 'A', clave: 'FB-PRUEBA-MARCA-1111', avisos: [], imagen: 'x' } }, deClave(c, 'dominical')));
    const permitidas = ['tipo', 'prenovenaDia', 'novenaDia'].concat(Object.keys(j(S.limpiarDatos({ celebrante: 'A' }))));
    assert.ok(Object.keys(raro.poner).every((k) => permitidas.includes(k)));
  });

  prueba('textoEstado', () => {
    const S = ctx().SEMANA;
    assert.equal(S.textoEstado(0), '● Listo');
    assert.equal(S.textoEstado(1), '● Falta 1 dato');
    assert.equal(S.textoEstado(3), '● Faltan 3 datos');
    assert.equal(S.textoEstado(null), '● Tipo no disponible');
  });

  prueba('los nombres de semana.js no chocan con los de las páginas', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const raiz = path.join(__dirname, '..', '..', 'vicaria');
    const nombresDe = (texto) => Array.from(texto.matchAll(/^(?:const|let|var|function)\s+(\w+)/gm), (m) => m[1]);
    const propios = nombresDe(fs.readFileSync(path.join(raiz, 'semana.js'), 'utf8'));
    assert.ok(propios.includes('SEMANA'));
    const panel = fs.readFileSync(path.join(raiz, 'panel.html'), 'utf8');
    const scripts = Array.from(panel.matchAll(/<script>([\s\S]*?)<\/script>/g), (m) => m[1]).join('\n');
    const otros = new Set(['parroquia.js', 'tipos.js', 'comun.js', 'pantallas.js', 'guardadas.js']
      .map((a) => fs.readFileSync(path.join(raiz, a), 'utf8')).concat([scripts]).flatMap(nombresDe));
    assert.deepEqual(propios.filter((n) => otros.has(n)), []);
  });
});

grupo('tipos propios: opcionales', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const p = cargarCon([], {}, CONFIG_CIUDAD_ARCE);
  const VIGILIA = { clave: 'vigilia', nombre: 'Vigilia', rotulos: ['persona', 'persona'], opcionales: ['persona-2'] };
  const conPropio = (propio) => {
    const c = JSON.parse(JSON.stringify(CONFIG_CIUDAD_ARCE));
    c.tipos = { propios: [propio] };
    return c;
  };
  const errs = (propio) => Array.from(p.validarConfig(conPropio(propio)).errores);

  prueba('opcionales con ids de sus rótulos es válido; sin opcionales, como hoy', () => {
    assert.deepEqual(errs(VIGILIA), []);
    const sin = Object.assign({}, VIGILIA);
    delete sin.opcionales;
    assert.deepEqual(errs(sin), []);
  });

  prueba('un opcional que no es de este tipo, una lista mala o más de 10 se rechazan', () => {
    assert.ok(errs(Object.assign({}, VIGILIA, { opcionales: ['lectura1'] })).includes('Ese rótulo no es de este tipo (tipos.propios[0].opcionales[0]).'));
    assert.ok(errs(Object.assign({}, VIGILIA, { opcionales: 'x' })).some((e) => /tipos\.propios\[0\]\.opcionales/.test(e) && /lista/.test(e)));
    const once = Array.from({ length: 11 }, () => 'persona');
    assert.ok(errs(Object.assign({}, VIGILIA, { opcionales: once })).some((e) => /como máximo 10/.test(e)));
  });

  prueba('el config.json real de Ciudad Arce sigue válido', () => {
    const real = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'vicaria', 'ciudad-arce', 'config.json'), 'utf8'));
    assert.deepEqual(Array.from(p.validarConfig(real).errores), []);
  });

  prueba('tipoDe marca opcional el uso del propio', () => {
    const x = cargarCon(['tipos.js', 'comun.js'], {}, conPropio(VIGILIA));
    const t = x.tipoDe({ tipo: 'vigilia' });
    assert.equal(t.rotulos[1].opcional, true);
    assert.ok(!t.rotulos[0].opcional);
  });
});

grupo('guardadas: núcleo', () => {
  const G = cargar(['guardadas-nucleo.js']).GUARDADAS;
  const PAR = '00000000-0000-0000-0000-000000000001';
  const local = (id, extra) => Object.assign({ id, nombre: 'N ' + id, tipo: 'sector', guardadaEn: 1000, usadaEn: 1000, actualizadoEn: 1000, borradaEn: null, datos: { a: 1 } }, extra);
  const fila = (id, extra) => Object.assign({ id, parroquia_id: PAR, nombre: 'N ' + id, tipo: 'sector', datos: { a: 1 },
    guardada_en: '1970-01-01T00:00:01.000Z', usada_en: '1970-01-01T00:00:01.000Z', actualizado_en: '1970-01-01T00:00:01.000Z',
    actualizado_desde: 'panel', actualizado_por: null, borrada_en: null }, extra);
  const ids = (l) => Array.from(l, (g) => g.id);
  const plano = (x) => JSON.parse(JSON.stringify(x));   // el contexto de vm tiene sus propios Object/Array

  prueba('LIMITE es 50', () => assert.equal(G.LIMITE, 50));

  prueba('fusionar no muestra una borrada en la nube', () => {
    const r = G.fusionar([], [fila('aaaa'), fila('bbbb', { borrada_en: '1970-01-01T00:00:05.000Z' })], []);
    assert.deepEqual(ids(r), ['aaaa']);
  });

  prueba('fusionar devuelve una borrada si hay un guardar local posterior', () => {
    const n = [fila('aaaa', { borrada_en: '1970-01-01T00:00:05.000Z', actualizado_en: '1970-01-01T00:00:05.000Z' })];
    const l = [local('aaaa', { actualizadoEn: 9000, nombre: 'Revivida' })];
    const r = G.fusionar(l, n, [{ op: 'guardar', id: 'aaaa', cuando: 9000 }]);
    assert.deepEqual(ids(r), ['aaaa']);
    assert.equal(r[0].nombre, 'Revivida');
    // si la local es anterior a la baja, sigue borrada
    const r2 = G.fusionar([local('aaaa', { actualizadoEn: 2000 })], n, [{ op: 'guardar', id: 'aaaa', cuando: 2000 }]);
    assert.deepEqual(ids(r2), []);
  });

  prueba('fusionar ignora una copia local sin pendiente que la nube ya no tiene', () => {
    const r = G.fusionar([local('viej'), local('nuev')], [fila('aaaa')], [{ op: 'guardar', id: 'nuev', cuando: 1 }]);
    assert.deepEqual(ids(r).sort(), ['aaaa', 'nuev']);
  });

  prueba('fusionar: la local con guardar pendiente gana solo si es más nueva', () => {
    const n = [fila('aaaa', { nombre: 'Nube', actualizado_en: '1970-01-01T00:00:05.000Z' })];
    const p = [{ op: 'guardar', id: 'aaaa', cuando: 1 }];
    assert.equal(G.fusionar([local('aaaa', { nombre: 'Local', actualizadoEn: 9000 })], n, p)[0].nombre, 'Local');
    assert.equal(G.fusionar([local('aaaa', { nombre: 'Local', actualizadoEn: 1000 })], n, p)[0].nombre, 'Nube');
    assert.equal(G.fusionar([local('aaaa', { nombre: 'Local', actualizadoEn: 9000 })], n, [])[0].nombre, 'Nube');
  });

  prueba('fusionar: un guardar rechazado sigue visible (no se filtra)', () => {
    const p = [{ op: 'guardar', id: 'aaaa', cuando: 1, rechazado: true }];
    assert.deepEqual(ids(G.fusionar([local('aaaa')], [], p)), ['aaaa']);
    // con una baja en la nube y una copia local más nueva, también vuelve
    const n = [fila('aaaa', { borrada_en: '1970-01-01T00:00:05.000Z', actualizado_en: '1970-01-01T00:00:05.000Z' })];
    assert.deepEqual(ids(G.fusionar([local('aaaa', { actualizadoEn: 9000 })], n, p)), ['aaaa']);
  });

  prueba('aFila no falla si falta guardadaEn: usa actualizadoEn', () => {
    const g = local('aaaa', { actualizadoEn: 5000, usadaEn: 0 });
    delete g.guardadaEn;
    const f = G.aFila(g, 'app', PAR);
    assert.equal(f.guardada_en, '1970-01-01T00:00:05.000Z');
    assert.equal(f.usada_en, '1970-01-01T00:00:05.000Z');
  });

  prueba('fusionar quita las que tienen un borrar pendiente', () => {
    const r = G.fusionar([], [fila('aaaa'), fila('bbbb')], [{ op: 'borrar', id: 'aaaa', cuando: 1 }]);
    assert.deepEqual(ids(r), ['bbbb']);
  });

  prueba('anotar: borrar después de guardar deja solo borrar', () => {
    let p = G.anotar([], { op: 'guardar', id: 'aaaa', cuando: 1 });
    p = G.anotar(p, { op: 'borrar', id: 'aaaa', cuando: 2 });
    assert.deepEqual(plano(p), [{ op: 'borrar', id: 'aaaa', cuando: 2 }]);
  });

  prueba('anotar: guardar reemplaza un borrar y deja intactos otros ids', () => {
    let p = [{ op: 'borrar', id: 'aaaa', cuando: 1 }, { op: 'guardar', id: 'bbbb', cuando: 1 }];
    p = G.anotar(p, { op: 'guardar', id: 'aaaa', cuando: 2 });
    assert.deepEqual(plano(p), [{ op: 'guardar', id: 'bbbb', cuando: 1 }, { op: 'guardar', id: 'aaaa', cuando: 2 }]);
  });

  prueba('anotar no agrega usar si hay un guardar posterior', () => {
    const p = [{ op: 'guardar', id: 'aaaa', cuando: 5 }];
    assert.deepEqual(plano(G.anotar(p, { op: 'usar', id: 'aaaa', cuando: 3 })), p);
    assert.equal(G.anotar(p, { op: 'usar', id: 'aaaa', cuando: 7 }).length, 2);
    assert.equal(G.anotar(p, { op: 'usar', id: 'bbbb', cuando: 3 }).length, 2);
  });

  prueba('anotar no modifica el arreglo recibido', () => {
    const p = [{ op: 'guardar', id: 'aaaa', cuando: 1 }];
    G.anotar(p, { op: 'borrar', id: 'aaaa', cuando: 2 });
    assert.equal(p.length, 1);
    assert.equal(p[0].op, 'guardar');
  });

  prueba('aFila quita rotulo, rotuloHasta y rotuloDesde', () => {
    const f = G.aFila(local('aaaa', { datos: { rotulo: 'x', rotuloHasta: 1, rotuloDesde: 2, titulo: 'T' } }), 'panel', PAR);
    assert.deepEqual(plano(f.datos), { titulo: 'T' });
    assert.equal(f.parroquia_id, PAR);
    assert.equal(f.actualizado_desde, 'panel');
  });

  prueba('aFila convierte ms a ISO y deFila lo revierte, conservando borradaEn y actualizadoEn', () => {
    const g = local('aaaa', { guardadaEn: 1700000000000, usadaEn: 1700000001000, actualizadoEn: 1700000002000, borradaEn: 1700000003000 });
    const f = G.aFila(g, 'app', PAR);
    assert.equal(f.guardada_en, '2023-11-14T22:13:20.000Z');
    assert.equal(f.borrada_en, '2023-11-14T22:13:23.000Z');
    assert.deepEqual(plano(G.deFila(f)), g);
    assert.equal(G.aFila(local('aaaa'), 'app', PAR).borrada_en, null);
    assert.equal(G.deFila(fila('aaaa')).borradaEn, null);
  });

  prueba('idNuevo cumple /^[a-z0-9]{4,24}-[a-z0-9]{6}$/', () => {
    const re = /^[a-z0-9]{4,24}-[a-z0-9]{6}$/;
    for (const azar of [() => 0, () => 0.999999, Math.random]) assert.match(G.idNuevo(1700000000000, azar), re);
    assert.equal(G.idNuevo(1700000000000, () => 0), (1700000000000).toString(36) + '-000000');
  });

  prueba('nombreLibre("Hora Santa", ["hora santa ", "Hora Santa (copia)"]) === "Hora Santa (copia 2)"', () => {
    assert.equal(G.nombreLibre('Hora Santa', ['hora santa ', 'Hora Santa (copia)']), 'Hora Santa (copia 2)');
    assert.equal(G.nombreLibre('Hora Santa', ['hora santa ']), 'Hora Santa (copia)');
  });
});

/* ---------- Cliente de la nube (Tarea 4) ---------- */
grupo('nube-cliente', () => {
  const KEY_SESION = 'pev_ciudad-arce_sesion_nube_v1';
  const FAKE = { url: 'https://falso.supabase.co', clavePublica: 'sb_publishable_FALSA' };
  const PAR = '11111111-1111-4111-8111-111111111111';
  const AHORA = 1700000000000;
  const plano = (x) => JSON.parse(JSON.stringify(x));

  /* fetch falso: `respuestas` es una función (url, init) -> {status, cuerpo} o lanza. Anota cada pedido. */
  function falso(respuestas) {
    const pedidos = [];
    const f = async (url, init) => {
      pedidos.push({ url, init });
      const r = await respuestas(url, init, pedidos.length);
      return { status: r.status, text: async () => (typeof r.cuerpo === 'string' ? r.cuerpo : JSON.stringify(r.cuerpo === undefined ? null : r.cuerpo)) };
    };
    f.pedidos = pedidos;
    return f;
  }
  const FechaFija = class extends Date { static now() { return AHORA; } };
  const nuevo = (f, almacen = {}, extras = {}) => cargarCon(['comun.js', 'nube-cliente.js'], almacen, CONFIG_CIUDAD_ARCE,
    Object.assign({ fetch: f, NUBE: FAKE, AbortController, Date: FechaFija }, extras));
  const tokenOk = (n = 1) => ({ status: 200, cuerpo: { access_token: 'acc' + n, refresh_token: 'ref' + n, expires_in: 3600, user: { id: 'u1', email: 'a@b.c' } } });
  const sesion = (vence, n = 0) => JSON.stringify({ access: 'acc' + n, refresh: 'ref' + n, vence });
  const cuerpoDe = (p) => JSON.parse(p.init.body);

  prueba('entrar guarda la sesión {access, refresh, vence} y pide con solo apikey', async () => {
    const f = falso(() => tokenOk(1));
    const c = nuevo(f);
    const r = await c.entrarNube('  A@B.c ', 'secreta');
    assert.equal(r.ok, true);
    assert.deepEqual(plano(JSON.parse(c.__almacen[KEY_SESION])), { access: 'acc1', refresh: 'ref1', vence: AHORA + 3600 * 1000 });
    const p = f.pedidos[0];
    assert.equal(p.url, FAKE.url + '/auth/v1/token?grant_type=password');
    assert.equal(p.init.method, 'POST');
    assert.equal(p.init.headers.apikey, FAKE.clavePublica);
    assert.ok(!('Authorization' in p.init.headers));
    assert.deepEqual(cuerpoDe(p), { email: 'a@b.c', password: 'secreta' });
    assert.ok(!JSON.stringify(r).includes('acc1') && !JSON.stringify(r).includes('secreta'));
  });
  prueba('credenciales malas dan tipo credenciales y no guardan nada', async () => {
    const c = nuevo(falso(() => ({ status: 400, cuerpo: { error_code: 'invalid_credentials' } })));
    const r = await c.entrarNube('a@b.c', 'mala');
    assert.deepEqual(plano(r), { ok: false, error: { tipo: 'credenciales' } });
    assert.ok(!(KEY_SESION in c.__almacen));
  });
  prueba('sin red da sin-conexion (y un 5xx también)', async () => {
    const c = nuevo(falso(() => { throw new Error('red caída'); }));
    assert.deepEqual(plano(await c.entrarNube('a@b.c', 'x')), { ok: false, error: { tipo: 'sin-conexion' } });
    const d = nuevo(falso(() => ({ status: 503, cuerpo: '' })));
    assert.equal((await d.entrarNube('a@b.c', 'x')).error.tipo, 'sin-conexion');
  });
  prueba('un 5xx es sin-conexion pero con su estado (hubo respuesta: la red anda); sin red no trae estado', async () => {
    const d = nuevo(falso(() => ({ status: 503, cuerpo: '' })));
    assert.deepEqual(plano(await d.entrarNube('a@b.c', 'x')), { ok: false, error: { tipo: 'sin-conexion', estado: 503 } });
    const e = nuevo(falso(() => ({ status: 502, cuerpo: '' })), { [KEY_SESION]: sesion(AHORA + 1000) });
    assert.deepEqual(plano(await e.renovarNube()), { ok: false, error: { tipo: 'sin-conexion', estado: 502 } });
    const g = nuevo(falso(() => ({ status: 500, cuerpo: {} })), { [KEY_SESION]: sesion(AHORA + 120000) });
    assert.deepEqual(plano(await g.listarGuardadasNube(PAR)), { ok: false, error: { tipo: 'sin-conexion', estado: 500 } });
  });
  prueba('dos renovaciones a la vez hacen un solo pedido y rotan el refresh', async () => {
    const f = falso(async () => { await new Promise((r) => setImmediate(r)); return tokenOk(2); });
    const c = nuevo(f, { [KEY_SESION]: sesion(AHORA + 1000) });
    const [a, b] = await Promise.all([c.renovarNube(), c.renovarNube()]);
    assert.equal(f.pedidos.length, 1);
    assert.equal(a.ok, true);
    assert.equal(b.ok, true);
    assert.equal(f.pedidos[0].url, FAKE.url + '/auth/v1/token?grant_type=refresh_token');
    assert.deepEqual(cuerpoDe(f.pedidos[0]), { refresh_token: 'ref0' });
    assert.equal(JSON.parse(c.__almacen[KEY_SESION]).refresh, 'ref2');
    await c.renovarNube();
    assert.equal(f.pedidos.length, 2); // terminada la primera, una nueva sí hace pedido
  });
  prueba('renovación rechazada (400 o 401) borra la sesión y da tipo sesion', async () => {
    for (const estado of [400, 401]) {
      const c = nuevo(falso(() => ({ status: estado, cuerpo: { error: 'invalid_grant' } })), { [KEY_SESION]: sesion(AHORA + 1000) });
      const r = await c.conSesion(async () => ({ ok: true, valor: 1 }));
      assert.deepEqual(plano(r), { ok: false, error: { tipo: 'sesion' } });
      assert.ok(!(KEY_SESION in c.__almacen));
    }
  });
  prueba('un fallo de red al renovar NO borra la sesión (con el access ya vencido da sin-conexion)', async () => {
    const c = nuevo(falso(() => { throw new Error('x'); }), { [KEY_SESION]: sesion(AHORA - 1000) });
    const r = await c.conSesion(async () => ({ ok: true, valor: 1 }));
    assert.equal(r.error.tipo, 'sin-conexion');
    assert.ok(KEY_SESION in c.__almacen);
  });
  prueba('si renovar falla por la red y el access todavía no venció, se usa ese access', async () => {
    const c = nuevo(falso(() => { throw new Error('x'); }), { [KEY_SESION]: sesion(AHORA + 30000) });
    let visto = null;
    const r = await c.conSesion(async (access) => { visto = access; return { ok: true, valor: 3 }; });
    assert.equal(r.ok, true);
    assert.equal(visto, 'acc0');
  });
  prueba('un 401 de REST renueva una vez y reintenta con el access nuevo', async () => {
    const f = falso((url) => (url.includes('/auth/v1/token') ? tokenOk(4) : null));
    const c = nuevo(f, { [KEY_SESION]: sesion(AHORA + 120000) });
    const vistos = [];
    const r = await c.conSesion(async (access) => {
      vistos.push(access);
      return access === 'acc0' ? { ok: false, error: { tipo: 'sesion', estado: 401 } } : { ok: true, valor: 'bien' };
    });
    assert.deepEqual(plano(r), { ok: true, valor: 'bien' });
    assert.deepEqual(vistos, ['acc0', 'acc4']);
    assert.equal(f.pedidos.length, 1);
    // si el reintento también da 401, no hay un tercer intento
    const d = nuevo(falso(() => tokenOk(5)), { [KEY_SESION]: sesion(AHORA + 120000) });
    let veces = 0;
    const r2 = await d.conSesion(async () => { veces++; return { ok: false, error: { tipo: 'sesion', estado: 401 } }; });
    assert.equal(r2.error.tipo, 'sesion');
    assert.equal(veces, 2);
  });
  prueba('una renovación con 429 o 403 da servidor con origen auth y no borra la sesión', async () => {
    for (const estado of [429, 403, 422]) {
      const c = nuevo(falso(() => ({ status: estado, cuerpo: {} })), { [KEY_SESION]: sesion(AHORA - 1000) });
      assert.deepEqual(plano(await c.renovarNube()), { ok: false, error: { tipo: 'servidor', estado, origen: 'auth' } });
      assert.ok(KEY_SESION in c.__almacen);
    }
  });
  prueba('un 401 de REST con la renovación rechazada borra la sesión', async () => {
    const f = falso((url) => (url.includes('/auth/v1/token') ? { status: 400, cuerpo: { error: 'invalid_grant' } } : { status: 401, cuerpo: {} }));
    const c = nuevo(f, { [KEY_SESION]: sesion(AHORA + 120000) });
    const r = await c.listarGuardadasNube(PAR);
    assert.equal(r.error.tipo, 'sesion');
    assert.ok(!(KEY_SESION in c.__almacen));
  });
  prueba('conSesion sin sesión da tipo sesion; con sesión vigente no renueva y pasa el access', async () => {
    const f = falso(() => tokenOk(9));
    const c = nuevo(f);
    assert.equal((await c.conSesion(async () => ({ ok: true, valor: 1 }))).error.tipo, 'sesion');
    const d = nuevo(f, { [KEY_SESION]: sesion(AHORA + 120000) });
    let visto = null;
    const r = await d.conSesion(async (access) => { visto = access; return { ok: true, valor: 7 }; });
    assert.equal(visto, 'acc0');
    assert.equal(r.valor, 7);
    assert.equal(f.pedidos.length, 0);
  });
  prueba('conSesion renueva si faltan menos de 60 s y usa el access nuevo', async () => {
    const f = falso(() => tokenOk(5));
    const c = nuevo(f, { [KEY_SESION]: sesion(AHORA + 59000) });
    let visto = null;
    await c.conSesion(async (access) => { visto = access; return { ok: true, valor: 1 }; });
    assert.equal(visto, 'acc5');
    assert.equal(f.pedidos.length, 1);
  });
  prueba('parroquiaIdNube pide por slug con Bearer = access y apikey aparte; lista vacía es permiso', async () => {
    const f = falso(() => ({ status: 200, cuerpo: [{ id: PAR }] }));
    const c = nuevo(f, { [KEY_SESION]: sesion(AHORA + 120000) });
    const r = await c.parroquiaIdNube('ciudad-arce');
    assert.deepEqual(plano(r), { ok: true, valor: PAR });
    const p = f.pedidos[0];
    assert.equal(p.url, FAKE.url + '/rest/v1/parroquias?select=id&slug=eq.ciudad-arce');
    assert.equal(p.init.headers.apikey, FAKE.clavePublica);
    assert.equal(p.init.headers.Authorization, 'Bearer acc0');
    assert.ok(!JSON.stringify(p.init.headers).includes('Bearer ' + FAKE.clavePublica));
    const d = nuevo(falso(() => ({ status: 200, cuerpo: [] })), { [KEY_SESION]: sesion(AHORA + 120000) });
    assert.deepEqual(plano(await d.parroquiaIdNube('otra')), { ok: false, error: { tipo: 'permiso' } });
  });
  prueba('listarGuardadasNube pide las activas y las bajas de los últimos 30 días', async () => {
    const filas = [{ id: 'a' }, { id: 'b', borrada_en: '2026-11-01T00:00:00Z' }];
    const f = falso(() => ({ status: 200, cuerpo: filas }));
    const c = nuevo(f, { [KEY_SESION]: sesion(AHORA + 120000) });
    const r = await c.listarGuardadasNube(PAR);
    assert.deepEqual(plano(r.valor), filas);
    const hace30 = new Date(AHORA - 30 * 86400000).toISOString();
    assert.equal(f.pedidos[0].url, FAKE.url + '/rest/v1/guardadas?select=*&parroquia_id=eq.' + PAR +
      '&or=' + encodeURIComponent('(borrada_en.is.null,borrada_en.gte.' + hace30 + ')'));
    assert.equal(f.pedidos[0].init.method, 'GET');
  });
  prueba('subirGuardadaNube hace upsert con merge-duplicates en parroquia_id,id', async () => {
    const f = falso(() => ({ status: 201, cuerpo: '' }));
    const c = nuevo(f, { [KEY_SESION]: sesion(AHORA + 120000) });
    const fila = { id: 'a', parroquia_id: PAR, nombre: 'X' };
    const r = await c.subirGuardadaNube(fila);
    assert.equal(r.ok, true);
    const p = f.pedidos[0];
    assert.equal(p.url, FAKE.url + '/rest/v1/guardadas?on_conflict=parroquia_id,id');
    assert.equal(p.init.method, 'POST');
    assert.equal(p.init.headers.Prefer, 'resolution=merge-duplicates');
    assert.deepEqual(cuerpoDe(p), [fila]);
  });
  prueba('23505 llega como codigo (409) y el tope P0001 como servidor con su estado', async () => {
    const c = nuevo(falso(() => ({ status: 409, cuerpo: { code: '23505', message: 'duplicate key' } })), { [KEY_SESION]: sesion(AHORA + 120000) });
    assert.deepEqual(plano(await c.subirGuardadaNube({ id: 'a' })), { ok: false, error: { tipo: 'servidor', estado: 409, codigo: '23505' } });
    const d = nuevo(falso(() => ({ status: 400, cuerpo: { code: 'P0001', message: 'tope de guardadas' } })), { [KEY_SESION]: sesion(AHORA + 120000) });
    assert.deepEqual(plano(await d.subirGuardadaNube({ id: 'a' })), { ok: false, error: { tipo: 'servidor', estado: 400, codigo: 'P0001' } });
  });
  prueba('un 403 es permiso, un 401 es sesion y un 500 es sin-conexion', async () => {
    const tipo = async (estado) => (await nuevo(falso(() => ({ status: estado, cuerpo: {} })), { [KEY_SESION]: sesion(AHORA + 120000) }).listarGuardadasNube(PAR)).error.tipo;
    assert.equal(await tipo(403), 'permiso');
    assert.equal(await tipo(401), 'sesion');
    assert.equal(await tipo(500), 'sin-conexion');
  });
  prueba('usarGuardadaNube llama al rpc usar_guardada con la fecha en ISO', async () => {
    const f = falso(() => ({ status: 204, cuerpo: '' }));
    const c = nuevo(f, { [KEY_SESION]: sesion(AHORA + 120000) });
    const r = await c.usarGuardadaNube(PAR, 'a', 1700000000000);
    assert.equal(r.ok, true);
    assert.equal(f.pedidos[0].url, FAKE.url + '/rest/v1/rpc/usar_guardada');
    assert.deepEqual(cuerpoDe(f.pedidos[0]), { p_parroquia: PAR, p_id: 'a', p_cuando: '2023-11-14T22:13:20.000Z' });
  });
  prueba('salirNube borra solo la sesión', () => {
    const c = nuevo(falso(() => tokenOk()), { [KEY_SESION]: sesion(AHORA), otra: 'x' });
    c.salirNube();
    assert.ok(!(KEY_SESION in c.__almacen));
    assert.equal(c.__almacen.otra, 'x');
  });
  prueba('el cliente no escribe en la consola ni deja tokens en los resultados de error', async () => {
    const registro = [];
    const consola = { log: (...a) => registro.push(a), error: (...a) => registro.push(a), warn: (...a) => registro.push(a) };
    const c = nuevo(falso(() => ({ status: 400, cuerpo: { code: 'X', message: 'acc0 ref0' } })), { [KEY_SESION]: sesion(AHORA + 120000) }, { console: consola });
    const r = await c.listarGuardadasNube(PAR);
    assert.equal(registro.length, 0);
    assert.ok(!JSON.stringify(r).includes('acc0'));
  });
});

grupo('guardadas: sincronizar', () => {
  const SLUGC = 'ciudad-arce';
  const K = (n) => 'pev_' + SLUGC + '_' + n;
  const KEY = K('guardadas_v1');
  const KEY_PEND = K('guardadas_pendientes_v1');
  const KEY_SESION = K('sesion_nube_v1');
  const KEY_MIGRADAS = K('guardadas_migradas_v1');
  const KEY_CANDADO = K('guardadas_candado');
  const FAKE = { url: 'https://falso.supabase.co', clavePublica: 'sb_publishable_FALSA' };
  const PAR = '11111111-1111-4111-8111-111111111111';
  const AHORA = 1800000000000;
  const iso = (ms) => new Date(ms).toISOString();
  const FechaFija = class extends Date { static now() { return AHORA; } };
  const ARCHIVOS = ['tipos.js', 'comun.js', 'guardadas-nucleo.js', 'guardadas.js', 'nube-cliente.js', 'guardadas-sync.js'];
  const local = (id, nombre, extra) => Object.assign({ id, nombre, tipo: 'novena', guardadaEn: 1000, usadaEn: 1000, actualizadoEn: 1000, datos: { tipo: 'novena' } }, extra);
  const filaDe = (id, nombre, extra) => Object.assign({ id, parroquia_id: PAR, nombre, tipo: 'novena', datos: { tipo: 'novena' }, guardada_en: iso(500), usada_en: iso(500), actualizado_en: iso(500), actualizado_desde: 'app', borrada_en: null }, extra);

  /* Nube falsa: guarda las filas, contesta como PostgREST y anota cada pedido.
     `alSubir(fila, n)` puede devolver una respuesta {status, cuerpo} para ese upsert (n = número de upsert). */
  function nubeFalsa(filas = [], alSubir) {
    const pedidos = [];
    const subidas = [];
    const usos = [];
    const f = async (url, init) => {
      pedidos.push({ url, init });
      const metodo = (init && init.method) || 'GET';
      let r;
      if (f.sinRed && f.sinRed(url, metodo)) throw new Error('red caída');
      if (url.includes('/auth/v1/token')) r = f.token ? f.token() : { status: 500, cuerpo: {} };
      else if (url.includes('/rest/v1/parroquias')) r = { status: 200, cuerpo: [{ id: PAR }] };
      else if (url.includes('/rest/v1/guardadas?select')) r = { status: 200, cuerpo: filas };
      else if (url.includes('/rest/v1/guardadas?on_conflict')) {
        const fila = JSON.parse(init.body)[0];
        subidas.push(fila);
        r = (alSubir && alSubir(fila, subidas.length)) || null;
        if (!r) {
          const i = filas.findIndex((x) => x.id === fila.id);
          if (i >= 0) filas[i] = fila; else filas.push(fila);
          r = { status: 201, cuerpo: '' };
        }
      } else if (url.includes('/rpc/usar_guardada')) { usos.push(JSON.parse(init.body)); r = { status: 204, cuerpo: '' }; }
      else r = { status: 404, cuerpo: {} };
      return { status: r.status, text: async () => (typeof r.cuerpo === 'string' ? r.cuerpo : JSON.stringify(r.cuerpo)) };
    };
    Object.assign(f, { pedidos, subidas, usos, filas });
    return f;
  }
  const conSesionYMarca = (almacen) => Object.assign({
    [KEY_SESION]: JSON.stringify({ access: 'acc0', refresh: 'ref0', vence: AHORA + 3600000 }),
    [KEY_MIGRADAS]: JSON.stringify({ cuando: 1, cantidad: 0 })
  }, almacen);
  const nuevo = (f, almacen, extras = {}) => cargarCon(ARCHIVOS, almacen, CONFIG_CIUDAD_ARCE,
    Object.assign({ fetch: f, NUBE: FAKE, AbortController, Date: FechaFija, setTimeout, clearTimeout }, extras));
  const pendientes = (c) => JSON.parse(c.__almacen[KEY_PEND] || '[]');
  const nombres = (c) => JSON.parse(c.__almacen[KEY]).map((g) => g.nombre).sort();

  prueba('sincronizar marca rechazado un 4xx y sigue con el siguiente', async () => {
    const f = nubeFalsa([], (fila) => (fila.id === 'aaaa1' ? { status: 400, cuerpo: { code: 'P0001', message: 'tope de guardadas' } } : null));
    const c = nuevo(f, conSesionYMarca({
      [KEY]: JSON.stringify([local('aaaa1', 'Primera'), local('bbbb2', 'Segunda')]),
      [KEY_PEND]: JSON.stringify([{ op: 'guardar', id: 'aaaa1', cuando: 10 }, { op: 'guardar', id: 'bbbb2', cuando: 11 }])
    }));
    assert.equal(await c.sincronizarGuardadas(), 'ok');
    assert.deepEqual(f.subidas.map((x) => x.id), ['aaaa1', 'bbbb2']);
    assert.deepEqual(pendientes(c), [{ op: 'guardar', id: 'aaaa1', cuando: 10, rechazado: true }]);
    assert.deepEqual(nombres(c), ['Primera', 'Segunda']);   // la rechazada sigue a la vista
    assert.equal(f.subidas[1].actualizado_desde, 'panel');
    assert.equal(f.subidas[1].parroquia_id, PAR);
    // la rechazada no se vuelve a mandar
    assert.equal(await c.sincronizarGuardadas(), 'ok');
    assert.equal(f.subidas.length, 2);
  });
  prueba('una renovación que falla con 429 o 403 durante la subida deja el pendiente sin rechazar', async () => {
    for (const estado of [429, 403]) {
      const f = nubeFalsa([], () => ({ status: 401, cuerpo: {} }));   // el access ya no sirve: hay que renovar
      f.token = () => ({ status: estado, cuerpo: { error: 'x' } });
      const pend = [{ op: 'guardar', id: 'aaaa1', cuando: 10 }];
      const c = nuevo(f, conSesionYMarca({ [KEY]: JSON.stringify([local('aaaa1', 'A')]), [KEY_PEND]: JSON.stringify(pend) }));
      assert.equal(await c.sincronizarGuardadas(), 'error-servidor', 'renovación ' + estado);
      assert.deepEqual(pendientes(c), pend, 'renovación ' + estado);
    }
  });
  prueba('un 429 de PostgREST corta y conserva el pendiente; un 422 sí lo rechaza', async () => {
    const pend = [{ op: 'guardar', id: 'aaaa1', cuando: 10 }];
    const f = nubeFalsa([], () => ({ status: 429, cuerpo: { message: 'demasiados pedidos' } }));
    const c = nuevo(f, conSesionYMarca({ [KEY]: JSON.stringify([local('aaaa1', 'A')]), [KEY_PEND]: JSON.stringify(pend) }));
    assert.equal(await c.sincronizarGuardadas(), 'error-servidor');
    assert.deepEqual(pendientes(c), pend);
    const g = nubeFalsa([], () => ({ status: 422, cuerpo: { code: '22023' } }));
    const d = nuevo(g, conSesionYMarca({ [KEY]: JSON.stringify([local('aaaa1', 'A')]), [KEY_PEND]: JSON.stringify(pend) }));
    assert.equal(await d.sincronizarGuardadas(), 'ok');
    assert.deepEqual(pendientes(d), [{ op: 'guardar', id: 'aaaa1', cuando: 10, rechazado: true }]);
  });
  prueba('23505 le pone «(copia)» frente a la nube, reintenta una vez y renombra la local', async () => {
    const f = nubeFalsa([filaDe('zzzz9', 'Hora Santa')], (fila, n) => (n === 1 ? { status: 409, cuerpo: { code: '23505' } } : null));
    const c = nuevo(f, conSesionYMarca({
      [KEY]: JSON.stringify([local('aaaa1', 'hora santa ')]),
      [KEY_PEND]: JSON.stringify([{ op: 'guardar', id: 'aaaa1', cuando: 10 }])
    }));
    assert.equal(await c.sincronizarGuardadas(), 'ok');
    assert.deepEqual(f.subidas.map((x) => x.nombre), ['hora santa ', 'hora santa (copia)']);
    assert.deepEqual(pendientes(c), []);
    assert.deepEqual(nombres(c), ['Hora Santa', 'hora santa (copia)']);
  });
  prueba('23505 dos veces deja el pendiente rechazado (no hay un tercer intento)', async () => {
    const f = nubeFalsa([filaDe('zzzz9', 'X')], () => ({ status: 409, cuerpo: { code: '23505' } }));
    const c = nuevo(f, conSesionYMarca({
      [KEY]: JSON.stringify([local('aaaa1', 'X')]),
      [KEY_PEND]: JSON.stringify([{ op: 'guardar', id: 'aaaa1', cuando: 10 }])
    }));
    assert.equal(await c.sincronizarGuardadas(), 'ok');
    assert.equal(f.subidas.length, 2);
    assert.equal(pendientes(c)[0].rechazado, true);
  });
  prueba('varios «usar» de la misma guardada mandan solo el último', async () => {
    const f = nubeFalsa([filaDe('aaaa1', 'A')]);
    const c = nuevo(f, conSesionYMarca({
      [KEY]: JSON.stringify([local('aaaa1', 'A')]),
      [KEY_PEND]: JSON.stringify([{ op: 'usar', id: 'aaaa1', cuando: 3000 }, { op: 'usar', id: 'aaaa1', cuando: 5000 }, { op: 'usar', id: 'aaaa1', cuando: 4000 }])
    }));
    assert.equal(await c.sincronizarGuardadas(), 'ok');
    assert.deepEqual(f.usos, [{ p_parroquia: PAR, p_id: 'aaaa1', p_cuando: iso(5000) }]);
    assert.deepEqual(pendientes(c), []);
  });
  prueba('borrar sube la baja con los datos de la nube', async () => {
    const f = nubeFalsa([filaDe('aaaa1', 'A')]);
    const c = nuevo(f, conSesionYMarca({ [KEY]: '[]', [KEY_PEND]: JSON.stringify([{ op: 'borrar', id: 'aaaa1', cuando: 7000 }]) }));
    assert.equal(await c.sincronizarGuardadas(), 'ok');
    assert.equal(f.subidas.length, 1);
    const baja = f.subidas[0];
    assert.equal(baja.nombre, 'A');
    assert.equal(baja.borrada_en, iso(7000));
    assert.equal(baja.actualizado_en, iso(7000));
    assert.equal(baja.actualizado_desde, 'panel');
    assert.ok(!('actualizado_por' in baja));
    assert.deepEqual(pendientes(c), []);
    assert.deepEqual(nombres(c), []);
  });
  prueba('sin conexión corta y conserva los pendientes', async () => {
    const f = nubeFalsa([]);
    f.sinRed = (url, metodo) => metodo === 'POST';
    const pend = [{ op: 'guardar', id: 'aaaa1', cuando: 10 }, { op: 'guardar', id: 'bbbb2', cuando: 11 }];
    const c = nuevo(f, conSesionYMarca({ [KEY]: JSON.stringify([local('aaaa1', 'A'), local('bbbb2', 'B')]), [KEY_PEND]: JSON.stringify(pend) }));
    assert.equal(await c.sincronizarGuardadas(), 'sin-conexion');
    assert.deepEqual(pendientes(c), pend);
    assert.equal(f.pedidos.filter((x) => x.init.method === 'POST').length, 1);   // cortó en el primero
    assert.deepEqual(nombres(c), ['A', 'B']);
  });
  prueba('sin sesión no hace ningún pedido', async () => {
    const f = nubeFalsa([]);
    const c = nuevo(f, { [KEY]: JSON.stringify([local('aaaa1', 'A')]), [KEY_PEND]: JSON.stringify([{ op: 'guardar', id: 'aaaa1', cuando: 10 }]) });
    assert.equal(await c.sincronizarGuardadas(), 'sin-sesion');
    assert.equal(f.pedidos.length, 0);
  });
  prueba('la primera vez con sesión sube todas las locales y guarda la marca con la cantidad', async () => {
    const f = nubeFalsa([]);
    const almacen = conSesionYMarca({ [KEY]: JSON.stringify([local('aaaa1', 'A', { actualizadoEn: undefined, usadaEn: 4000 }), local('bbbb2', 'B')]) });
    delete almacen[KEY_MIGRADAS];
    const c = nuevo(f, almacen);
    assert.equal(await c.sincronizarGuardadas(), 'ok');
    assert.deepEqual(f.subidas.map((x) => x.id).sort(), ['aaaa1', 'bbbb2']);
    assert.equal(f.subidas.find((x) => x.id === 'aaaa1').actualizado_en, iso(4000));   // R7: sin actualizadoEn, el mayor de guardadaEn y usadaEn
    assert.equal(JSON.parse(c.__almacen[KEY_MIGRADAS]).cantidad, 2);
    assert.equal(c.textoMigracion(2), 'Se guardaron 2 misas de esta computadora en la nube');
    assert.equal(c.textoMigracion(1), 'Se guardó 1 misa de esta computadora en la nube');
    assert.deepEqual(nombres(c), ['A', 'B']);
    // la segunda vez no vuelve a subir nada
    assert.equal(await c.sincronizarGuardadas(), 'ok');
    assert.equal(f.subidas.length, 2);
  });
  prueba('lo que llega de la nube aparece en la lista local', async () => {
    const f = nubeFalsa([filaDe('nube1', 'Del celular')]);
    const c = nuevo(f, conSesionYMarca({ [KEY]: '[]' }));
    assert.equal(await c.sincronizarGuardadas(), 'ok');
    assert.deepEqual(nombres(c), ['Del celular']);
  });
  prueba('con el candado de otro panel vigente devuelve ocupado sin pedir nada', async () => {
    const f = nubeFalsa([]);
    const c = nuevo(f, conSesionYMarca({ [KEY_CANDADO]: JSON.stringify({ dueno: 'otro-panel', vence: AHORA + 10000 }) }));
    assert.equal(await c.sincronizarGuardadas(), 'ocupado');
    assert.equal(f.pedidos.length, 0);
    // un candado vencido no cuenta, y al terminar se suelta
    const d = nuevo(f, conSesionYMarca({ [KEY_CANDADO]: JSON.stringify({ dueno: 'otro-panel', vence: AHORA - 1 }) }));
    assert.equal(await d.sincronizarGuardadas(), 'ok');
    assert.ok(!(KEY_CANDADO in d.__almacen));
  });
  prueba('en modo app no sincroniza ni pide nada', async () => {
    const f = nubeFalsa([]);
    const documento = { addEventListener() {}, querySelector: () => null, querySelectorAll: () => [], getElementById: () => null,
      documentElement: { classList: { contains: (c) => c === 'modo-app' } } };
    const c = nuevo(f, conSesionYMarca({}), { document: documento });
    assert.equal(await c.sincronizarGuardadas(), 'sin-sesion');
    assert.equal(f.pedidos.length, 0);
  });
  /* Arranca la sincronización sin sesión (no corre nada) y anota lo que le pasa al panel. */
  const conEstados = (c) => {
    const guardada = c.__almacen[KEY_SESION];
    delete c.__almacen[KEY_SESION];
    const v = [];
    c.iniciarSincronizacionGuardadas({ alEstado: (e, t) => v.push([e, t]) });
    if (guardada !== undefined) c.__almacen[KEY_SESION] = guardada;
    return v;
  };
  const TXT_CERRADA = 'Se cerró tu sesión. Entrá de nuevo para ver las del celular.';
  const TXT_ENTRA = 'Entrá para ver también las del celular';
  prueba('sin red: «Sin conexión. Ves las misas guardadas en esta computadora.»', async () => {
    const f = nubeFalsa([]);
    f.sinRed = () => true;
    const c = nuevo(f, conSesionYMarca({}));
    const v = conEstados(c);
    assert.equal(await c.sincronizarGuardadas(), 'sin-conexion');
    assert.deepEqual(v[v.length - 1], ['sin-conexion', 'Sin conexión. Ves las misas guardadas en esta computadora.']);
  });
  prueba('un 5xx de PostgREST o de Auth da error-servidor, con su texto, y conserva la cola sin rechazar nada', async () => {
    const pend = [{ op: 'guardar', id: 'aaaa1', cuando: 10 }];
    for (const caso of ['rest', 'auth']) {
      const f = nubeFalsa([], () => (caso === 'rest' ? { status: 503, cuerpo: {} } : { status: 401, cuerpo: {} }));
      f.token = () => ({ status: 500, cuerpo: {} });
      const c = nuevo(f, conSesionYMarca({ [KEY]: JSON.stringify([local('aaaa1', 'A')]), [KEY_PEND]: JSON.stringify(pend) }));
      const v = conEstados(c);
      assert.equal(await c.sincronizarGuardadas(), 'error-servidor', caso);
      assert.deepEqual(pendientes(c), pend, caso);
      assert.deepEqual(v[v.length - 1], ['error-servidor', 'No se pudo sincronizar. Se vuelve a intentar solo.'], caso);
    }
  });
  prueba('la sesión rechazada al renovar da sesion-cerrada; nunca haber entrado sigue invitando a entrar', async () => {
    const f = nubeFalsa([], () => ({ status: 401, cuerpo: {} }));
    f.token = () => ({ status: 400, cuerpo: { error: 'invalid_grant' } });
    const pend = [{ op: 'guardar', id: 'aaaa1', cuando: 10 }];
    const c = nuevo(f, conSesionYMarca({ [KEY]: JSON.stringify([local('aaaa1', 'A')]), [KEY_PEND]: JSON.stringify(pend) }));
    const v = conEstados(c);
    assert.deepEqual(v[0], ['sin-sesion', TXT_ENTRA]);   // nunca entró en este panel
    assert.equal(await c.sincronizarGuardadas(), 'sesion-cerrada');
    assert.deepEqual(v[v.length - 1], ['sesion-cerrada', TXT_CERRADA]);
    assert.ok(!(KEY_SESION in c.__almacen));
    assert.deepEqual(pendientes(c), pend);
    // al volver a abrir el panel lo sigue diciendo
    const d = nuevo(nubeFalsa([]), Object.assign({}, c.__almacen));
    const w = conEstados(d);
    assert.deepEqual(w[0], ['sesion-cerrada', TXT_CERRADA]);
    assert.equal(await d.sincronizarGuardadas(), 'sesion-cerrada');
    // Salir lo olvida: vuelve a «Entrá para ver también las del celular»
    d.salirGuardadas();
    assert.deepEqual(w[w.length - 1], ['sin-sesion', TXT_ENTRA]);
  });
  prueba('una sesión que ya no sirve para PostgREST (401 aun renovada) también es sesion-cerrada', async () => {
    const f = nubeFalsa([], () => ({ status: 401, cuerpo: {} }));
    f.token = () => ({ status: 200, cuerpo: { access_token: 'acc9', refresh_token: 'ref9', expires_in: 3600 } });
    const pend = [{ op: 'guardar', id: 'aaaa1', cuando: 10 }];
    const c = nuevo(f, conSesionYMarca({ [KEY]: JSON.stringify([local('aaaa1', 'A')]), [KEY_PEND]: JSON.stringify(pend) }));
    assert.equal(await c.sincronizarGuardadas(), 'sesion-cerrada');
    assert.ok(!(KEY_SESION in c.__almacen));
    assert.deepEqual(pendientes(c), pend);
  });
  prueba('entrar sin red dice «No hay internet. Probá de nuevo.»', async () => {
    const f = nubeFalsa([]);
    f.sinRed = () => true;
    const c = nuevo(f, {});
    assert.deepEqual(JSON.parse(JSON.stringify(await c.entrarGuardadas('a@b.c', 'x'))), { ok: false, texto: 'No hay internet. Probá de nuevo.' });
  });
  prueba('entrar con red pero el servidor falla o limita (5xx, 429) dice «No se pudo entrar. Probá de nuevo en un rato.»', async () => {
    const NO_ENTRA = 'No se pudo entrar. Probá de nuevo en un rato.';
    const plano = (x) => JSON.parse(JSON.stringify(x));
    for (const estado of [500, 503, 429]) {
      const f = nubeFalsa([]);
      f.token = () => ({ status: estado, cuerpo: {} });
      assert.deepEqual(plano(await nuevo(f, {}).entrarGuardadas('a@b.c', 'x')), { ok: false, texto: NO_ENTRA }, 'token ' + estado);
    }
    // entra, pero buscar la parroquia falla en el servidor: tampoco es «sin internet»
    const g = nubeFalsa([]);
    g.token = () => ({ status: 200, cuerpo: { access_token: 'acc1', refresh_token: 'ref1', expires_in: 3600 } });
    const original = g;
    const h = async (url, init) => (url.includes('/rest/v1/parroquias') ? { status: 502, text: async () => '' } : original(url, init));
    const c = nuevo(h, {});
    assert.deepEqual(plano(await c.entrarGuardadas('a@b.c', 'x')), { ok: false, texto: NO_ENTRA });
    assert.ok(!(KEY_SESION in c.__almacen), 'y no queda una sesión a medias');
    // sin red de verdad sigue «No hay internet»
    const sinRed = nubeFalsa([]);
    sinRed.sinRed = () => true;
    assert.equal((await nuevo(sinRed, {}).entrarGuardadas('a@b.c', 'x')).texto, 'No hay internet. Probá de nuevo.');
  });
  /* localStorage que anota, al borrar la sesión, si la marca de «sesión cerrada» ya estaba escrita. */
  function almacenQueMira(inicial) {
    const datos = Object.assign({}, inicial);
    const visto = [];
    return {
      datos, visto,
      ls: {
        getItem: (k) => (k in datos ? datos[k] : null),
        setItem: (k, v) => { datos[k] = String(v); },
        removeItem: (k) => { if (k === KEY_SESION) visto.push(K('guardadas_sesion_cerrada') in datos); delete datos[k]; }
      }
    };
  }
  prueba('al cerrarse la sesión la marca se escribe ANTES de borrar la sesión (los otros docks la ven en el evento storage)', async () => {
    // 401 aun con el access renovado: la sesión la borra la sincronización
    const f = nubeFalsa([], () => ({ status: 401, cuerpo: {} }));
    f.token = () => ({ status: 200, cuerpo: { access_token: 'acc9', refresh_token: 'ref9', expires_in: 3600 } });
    const a = almacenQueMira(conSesionYMarca({ [KEY]: JSON.stringify([local('aaaa1', 'A')]), [KEY_PEND]: JSON.stringify([{ op: 'guardar', id: 'aaaa1', cuando: 10 }]) }));
    const c = nuevo(f, {}, { localStorage: a.ls });
    assert.equal(await c.sincronizarGuardadas(), 'sesion-cerrada');
    assert.ok(a.visto.length > 0, 'se borró la sesión');
    assert.deepEqual(a.visto, a.visto.map(() => true), 'cada vez que se borró la sesión, la marca ya estaba');
    // la cuenta ya no es de esta parroquia (permiso): igual
    const g = nubeFalsa([]);
    const h = async (url, init) => (url.includes('/rest/v1/parroquias') ? { status: 200, text: async () => '[]' } : g(url, init));
    const b = almacenQueMira(conSesionYMarca({}));
    const d = nuevo(h, {}, { localStorage: b.ls });
    assert.equal(await d.sincronizarGuardadas(), 'sesion-cerrada');
    assert.deepEqual(b.visto, [true]);
  });
  prueba('otro dock ve la marca de sesión cerrada por el evento storage y lo dice', () => {
    const oyentes = {};
    const ventana = { innerWidth: 1920, innerHeight: 1080, addEventListener: (n, fn) => { (oyentes[n] = oyentes[n] || []).push(fn); } };
    const c = nuevo(nubeFalsa([]), {}, { window: ventana });
    const v = [];
    c.iniciarSincronizacionGuardadas({ alEstado: (e, tx) => v.push(e) });
    assert.deepEqual(v, ['sin-sesion']);
    // el renovar de otro dock borró la sesión primero y escribió la marca después
    c.__almacen[K('guardadas_sesion_cerrada')] = JSON.stringify({ cuando: 1 });
    oyentes.storage.forEach((fn) => fn({ key: K('guardadas_sesion_cerrada') }));
    assert.equal(v[v.length - 1], 'sesion-cerrada');
  });
  prueba('firmaEstado no mira el rótulo al aire ni el orden de las claves', () => {
    const c = nuevo(nubeFalsa([]), {});
    assert.equal(c.firmaEstado({ a: 1, b: { y: 2, x: 1 }, rotulo: 'guia', rotuloHasta: 9, rotuloDesde: 3 }), c.firmaEstado({ b: { x: 1, y: 2 }, a: 1 }));
    assert.notEqual(c.firmaEstado({ a: 1 }), c.firmaEstado({ a: 2 }));
  });
  prueba('hay cambios sin guardar si el estado no es el último cargado o guardado ni una misa lista', () => {
    const c = nuevo(nubeFalsa([]), {});
    const s = c.normalizarEstado({ tipo: 'novena', celebrante: 'Ana' });
    assert.equal(c.hayCambiosSinGuardar(s), true);   // todavía no hay referencia
    c.anotarFirmaGuardada(s);
    assert.equal(c.hayCambiosSinGuardar(Object.assign({}, s, { rotulo: 'guia' })), false);
    assert.equal(c.hayCambiosSinGuardar(Object.assign({}, s, { celebrante: 'Beto' })), true);
    // igual a una misa lista: no hay nada que perder
    const d = nuevo(nubeFalsa([]), { [KEY]: JSON.stringify([local('aaaa1', 'A', { datos: { tipo: 'novena', celebrante: 'Ana' } })]) });
    assert.equal(d.hayCambiosSinGuardar(d.normalizarEstado({ tipo: 'novena', celebrante: 'Ana' })), false);
  });
});

/* ---------- Resultado ---------- */
cola.then(() => {
  console.log('\n' + (total - fallos) + '/' + total + ' pruebas pasan');
  process.exit(fallos ? 1 : 0);
});
