/* Pruebas de unidad de los módulos de obs/ (sin navegador). Se corren con: npm run prueba:unidad
   Para agregar un grupo: grupo('nombre', () => { prueba('qué comprueba', () => { ... }); });
   Los grupos van antes del bloque «Resultado». */
const assert = require('node:assert/strict');
const { cargar } = require('./cargar');

let fallos = 0;
let total = 0;

function grupo(nombre, definir) {
  console.log('\n' + nombre);
  definir();
}

function prueba(descripcion, fn) {
  total++;
  try {
    fn();
    console.log('  ✓ ' + descripcion);
  } catch (e) {
    fallos++;
    console.log('  ✗ ' + descripcion + '\n      ' + String(e.message).split('\n').join('\n      '));
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
    assert.equal(c.imagenDe({ tipo: 'semana', imagen: '' }), 'img/fachada.jpg');
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
  prueba('Hora Santa: la guía usa la ceja del uso y el nombre del celebrante', () => {
    const g = c.rotulosDe({ tipo: 'horasanta', celebrante: 'Juan', rotulosTexto: {} })[0];
    assert.equal(g.texto.k, 'GUÍA');
    assert.equal(g.texto.t, 'Juan');
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

/* ---------- Resultado ---------- */
console.log('\n' + (total - fallos) + '/' + total + ' pruebas pasan');
process.exit(fallos ? 1 : 0);
