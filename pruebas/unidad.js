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
      'graciasPie', 'imagen', 'esquina', 'esquinaTexto', 'cuenta', 'rotulos', 'datos'];
    for (const k of ORDEN_TIPOS) for (const f of campos) assert.ok(f in TIPOS[k], k + '.' + f);
  });
});

/* ---------- Resultado ---------- */
console.log('\n' + (total - fallos) + '/' + total + ' pruebas pasan');
process.exit(fallos ? 1 : 0);
