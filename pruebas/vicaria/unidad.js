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
      'graciasPie', 'barra', 'imagen', 'esquina', 'esquinaTexto', 'cuenta', 'rotulos', 'datos'];
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
    marca: 'Parroquia Inmaculada Concepción de María · Ciudad Arce, La Libertad',
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
    capa_logo: 'Parroquia Inmaculada Concepción de María',
    k_lectura1: 'PRIMERA LECTURA',
    k_salmo: 'SALMO RESPONSORIAL',
    k_lectura2: 'SEGUNDA LECTURA',
    k_evangelio: 'SANTO EVANGELIO',
    k_rosario: 'ORACIÓN',
    t_rosario: 'Santo Rosario'
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
  const nuevo = (almacen) => cargarCon(['tipos.js', 'comun.js', 'guardadas.js'], almacen);

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
    assert.equal(t.marca, 'Parroquia San José · Santa Tecla, La Libertad');
    assert.equal(t.capa_logo, 'Parroquia San José');
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

grupo('aplicar paleta', () => {
  prueba('aplicarPaleta pone las seis variables CSS de :root con los colores de la parroquia', () => {
    const puestas = {};
    const documento = { addEventListener() {}, querySelector: () => null, querySelectorAll: () => [], getElementById: () => null,
      documentElement: { style: { setProperty: (k, v) => { puestas[k] = v; } } } };
    const c = cargarCon([], {}, CONFIG_SAN_JOSE, { document: documento });
    c.aplicarPaleta(CONFIG_SAN_JOSE);
    assert.deepEqual(Object.keys(puestas).sort(), ['--celeste', '--claro', '--medio', '--oscuro', '--palido', '--rey']);
    assert.equal(puestas['--rey'], '#7a3b12');
    assert.equal(puestas['--oscuro'], '#4a2008');
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
  prueba('config.json lleva Cache-Control must-revalidate', () => {
    const h = reglas.headers.find((x) => emparejar(compilarPatron(x.source), '/ciudad-arce/config.json'));
    assert.ok(h);
    assert.deepEqual(h.headers, [{ key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' }]);
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
  malo('rotulos.colorLado sin contraste', (c) => { c.rotulos = { colorLado: '#ffff00' }; }, 'rotulos.colorLado');
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
    assert.deepEqual(arr(x.horariosPara(), plano), [
      { dia: 'Domingo', hora: '7:00 a. m.', nota: 'Misa con niños' },
      { dia: 'Lunes', hora: '6:00 p. m.', nota: '' }
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
    assert.deepEqual(arr(x.horariosPara(), plano), [{ dia: 'Lunes', hora: '6:00 p. m.', nota: '' }]);
    assert.deepEqual(arr(x.redesPara(), plano), [{ red: 'web', texto: 'x.org' }]);
  });
  prueba('sin bloque rotulos, estiloRotulos y cargosDe dan los valores de hoy', () => {
    assert.deepEqual(arr([c.estiloRotulos()], plano), [{ tipografia: 'montserrat', esquinas: 'redondeadas', posicion: 'izquierda', colorLado: null }]);
    assert.deepEqual(arr(c.cargosDe()), arr(vm.runInContext("CARGOS", c)));
  });
  prueba('el bloque rotulos de la configuración manda en estiloRotulos y cargosDe', () => {
    const x = cargarPantallas((cfg) => {
      cfg.rotulos = { esquinas: 'rectas', posicion: 'centro', colorLado: '#1a5276', cargos: ['LECTOR', 'MONAGUILLO'] };
    });
    assert.deepEqual(arr([x.estiloRotulos()], plano), [{ tipografia: 'montserrat', esquinas: 'rectas', posicion: 'centro', colorLado: '#1a5276' }]);
    assert.deepEqual(arr(x.cargosDe()), ['LECTOR', 'MONAGUILLO']);
  });
  prueba('estiloRotulos ignora valores raros y un colorLado que no es #rrggbb; cargos vacío cae a CARGOS', () => {
    const x = cargarPantallas();
    forzar(x, Object.assign(base(), { rotulos: { esquinas: 'ovaladas', posicion: 'derecha', colorLado: 'rojo', cargos: [] } }));
    assert.deepEqual(arr([x.estiloRotulos()], plano), [{ tipografia: 'montserrat', esquinas: 'redondeadas', posicion: 'izquierda', colorLado: null }]);
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

/* ---------- Resultado ---------- */
cola.then(() => {
  console.log('\n' + (total - fallos) + '/' + total + ' pruebas pasan');
  process.exit(fallos ? 1 : 0);
});
