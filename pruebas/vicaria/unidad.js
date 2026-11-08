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

/* ---------- Grupos ---------- */

grupo('tipos', () => {
  let c;
  try {
    c = cargar(['tipos.js']);
  } catch (e) {
    prueba('se puede cargar obs/tipos.js', () => { throw e; });
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
    assert.equal(TIPOS.patronalsector.cursiva, 'Oh María sin pecado concebida,\nrogad por nosotros que recurrimos a vos');
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
});

/* Textos que las 5 transmisiones heredadas ya mostraban antes de leerlos del catálogo: no deben cambiar. */
grupo('textos heredados', () => {
  let c;
  try {
    c = cargar(['tipos.js', 'comun.js']);
  } catch (e) {
    prueba('se pueden cargar tipos.js y comun.js', () => { throw e; });
    return;
  }
  const hoy = new Date();
  const anio = hoy.getFullYear() + (hoy.getMonth() === 11 && hoy.getDate() > 8 ? 1 : 0);
  const comunes = {
    marca: 'Parroquia Inmaculada\nConcepción de María · Ciudad Arce',
    inicio_titulo: 'En breve\ncomenzamos',
    portada_ceja: 'FIESTAS PATRONALES ' + anio,
    portada_cursiva: 'en honor a la',
    portada_titulo: 'Inmaculada\nConcepción\nde María',
    portada_fecha: 'DE DICIEMBRE',
    portada_sub: 'Solemnidad de nuestra Patrona',
    gracias_titulo: '¡Gracias por\nacompañarnos!',
    gracias_cursiva: 'Nos vemos en la próxima\ntransmisión',
    avisos_sub: 'PARROQUIA INMACULADA CONCEPCIÓN DE MARÍA',
    avisos_titulo: 'Avisos',
    capa_logo: 'Parroquia Inmaculada\nConcepción de María',
    k_lectura1: 'PRIMERA LECTURA',
    k_salmo: 'SALMO RESPONSORIAL',
    k_lectura2: 'SEGUNDA LECTURA',
    k_evangelio: 'SANTO EVANGELIO',
    k_rosario: 'ORACIÓN',
    t_rosario: 'Santo Rosario'
  };
  const cuenta = 'días para nuestra\nFiesta Patronal';
  const esperado = {
    dominical: { titulo: 'SANTA MISA DOMINICAL', ceja: 'CAMINO A NUESTRAS FIESTAS PATRONALES', cursiva: '¡Ya se acerca la fiesta\nde nuestra Patrona!', pie: 'CAMINO AL 8 DE DICIEMBRE', barra: 'Camino al 8 de diciembre', cuenta },
    otros: { titulo: 'MISA EN HONOR A SAN JOSÉ', ceja: 'CAMINO A NUESTRA FIESTA PATRONAL', cursiva: 'rumbo a la fiesta de la\nInmaculada Concepción', pie: 'CAMINO AL 8 DE DICIEMBRE', barra: 'Camino al 8 de diciembre', cuenta },
    prenovena: { titulo: 'PRENOVENA · DÍA 2', ceja: 'FIESTAS PATRONALES ' + anio, cursiva: 'preparándonos para celebrar\na nuestra Patrona', pie: 'CAMINO AL 8 DE DICIEMBRE', barra: 'Fiestas Patronales ' + anio, cuenta },
    novena: { titulo: 'NOVENA · DÍA 3', ceja: 'FIESTAS PATRONALES ' + anio, cursiva: 'en honor a la Inmaculada\nConcepción de María', pie: 'CAMINO AL 8 DE DICIEMBRE', barra: 'Fiestas Patronales ' + anio, cuenta },
    // La cuenta de la patronal nunca se muestra, así que su texto no forma parte de lo heredado.
    patronal: { titulo: 'SANTA MISA PATRONAL', ceja: 'SOLEMNIDAD DE LA INMACULADA CONCEPCIÓN', cursiva: '¡Felices Fiestas Patronales!', pie: '¡FELICES FIESTAS PATRONALES!', barra: '¡Felices Fiestas Patronales!', cuenta: undefined }
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
    c = cargar(['tipos.js', 'comun.js'], {
      parroquia_obs_estado_v1: '{"tipo":"novena","virgen":"c","rotulo":"celebrante"}'
    });
  } catch (e) {
    prueba('se pueden cargar tipos.js y comun.js', () => { throw e; });
    return;
  }

  prueba('leerEstado migra virgen y celebrante al formato nuevo', () => {
    const s = c.leerEstado();
    assert.equal(s.imagen, 'virgen-c');
    assert.equal(s.rotulo, 'persona');
    assert.equal(s.tipo, 'novena');
    assert.ok(!('virgen' in s));
  });
  prueba('leerEstado migra mostrarCuenta:false a cuenta:false', () => {
    const m = cargar(['tipos.js', 'comun.js'], { parroquia_obs_estado_v1: '{"mostrarCuenta":false}' });
    assert.equal(m.leerEstado().cuenta, false);
  });
  prueba('leerEstado sin nada guardado devuelve los valores nuevos por defecto', () => {
    const m = cargar(['tipos.js', 'comun.js']);
    const s = m.leerEstado();
    assert.equal(s.cuenta, null);
    assert.equal(s.imagen, '');
    assert.deepEqual(Object.assign({}, s.rotulosTexto), {});
    for (const k of ['sector', 'fecha', 'lugar', 'evento', 'esquina', 'esquinaTexto']) assert.equal(s[k], '', k);
  });
  prueba('mostrarCuenta:false se migra una sola vez (ida y vuelta por guardar)', () => {
    const m = cargar(['tipos.js', 'comun.js'], { parroquia_obs_estado_v1: '{"mostrarCuenta":false,"cuenta":null}' });
    let s = m.leerEstado();
    assert.equal(s.cuenta, false);
    m.guardarEstado(s);
    s = m.leerEstado();
    s.cuenta = null;
    m.guardarEstado(s);
    assert.equal(m.leerEstado().cuenta, null);
  });
  prueba('imagenDe del logo apunta a logo-blanco.png', () => {
    assert.equal(c.imagenDe({ tipo: 'evento', imagen: '' }), 'img/logo-blanco.png');
  });
  prueba('la frase antigua por defecto se migra a vacío y cada tipo muestra su franja', () => {
    const m = cargar(['tipos.js', 'comun.js'], { parroquia_obs_estado_v1: '{"tipo":"novena","frase":"«TODA HERMOSA ERES, MARÍA»"}' });
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
    assert.equal(c.imagenDe({ tipo: 'semana', imagen: '' }), 'img/virgen-a.png');
    assert.equal(c.imagenDe({ tipo: 'novena', imagen: 'virgen-b' }), 'img/virgen-b.png');
    assert.equal(c.imagenDe({ tipo: 'semana', imagen: 'fachada' }), 'img/fachada.jpg');
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
    c = cargar(['tipos.js', 'comun.js']);
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
  const KEY = 'parroquia_obs_guardadas_v1';
  const nuevo = (almacen) => cargar(['tipos.js', 'comun.js', 'guardadas.js'], almacen);

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
  prueba('cargar migra un estado viejo (virgen b -> imagen virgen-b) y completa los campos que faltan', () => {
    const c = nuevo({ [KEY]: JSON.stringify([{ id: 'x', nombre: 'Antigua', tipo: 'novena', guardadaEn: 1, usadaEn: 1, datos: { tipo: 'novena', virgen: 'b' } }]) });
    const e = c.cargarTransmision('x');
    assert.equal(e.imagen, 'virgen-b');
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
    assert.equal(c.__almacen[KEY + '_respaldo'], 'no-es-json');
    assert.equal(c.leerGuardadas().length, 1);
    const d = nuevo({ [KEY]: '{"a":1}' });
    d.guardarTransmision('A', d.PREDETERMINADO);
    assert.equal(d.__almacen[KEY + '_respaldo'], '{"a":1}');
  });
  prueba('sin lo guardado ilegible no se crea respaldo', () => {
    const c = nuevo();
    c.guardarTransmision('A', c.PREDETERMINADO);
    assert.ok(!(KEY + '_respaldo' in c.__almacen));
  });
  prueba('las entradas rotas de la lista se ignoran', () => {
    const c = nuevo({ [KEY]: JSON.stringify([null, 5, { id: 'ok', nombre: 'Ok', datos: {} }, { nombre: 'sin id', datos: {} }]) });
    assert.deepEqual(Array.from(c.leerGuardadas(), (g) => g.id), ['ok']);
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
    tics[0].fn();
    assert.equal(f.pedidos.length, 2);
    c.vigilarParroquia(5000);
    assert.equal(tics[1].ms, 5000);
    await c.cargarParroquia(); // deja terminar los pedidos pendientes
  });
});

/* ---------- Resultado ---------- */
cola.then(() => {
  console.log('\n' + (total - fallos) + '/' + total + ' pruebas pasan');
  process.exit(fallos ? 1 : 0);
});
