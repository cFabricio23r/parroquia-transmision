// Lógica de Tipos de transmisión (plan 4, Tarea 7).
import { describe, expect, it } from 'vitest';
import {
  aplicarTipo,
  borrarPropio,
  CASILLAS_PROPIO,
  casillasDe,
  conFila,
  erroresTipo,
  filaEncendida,
  filasActivas,
  filasComunes,
  formularioDeTipo,
  MAX_PROPIOS,
  nuevaClavePropio,
  puedeApagar,
  puedeBorrarPropio,
  quitarAjustes,
  rotulosDeCasillas,
  type FormularioTipo,
} from '../../lib/editor/tipos';
import { tiposComunes } from '../../lib/validar-nucleo.mjs';

const comunes = tiposComunes();
const filas = filasComunes(comunes);
const fila = (id: string) => filas.find((f) => f.id === id)!;
const congelar = <T,>(o: T): T => {
  if (o && typeof o === 'object') {
    Object.values(o as object).forEach(congelar);
    Object.freeze(o);
  }
  return o;
};
const TODAS = comunes.map((c) => c.clave);

describe('filas de la tabla (Decisión 13)', () => {
  it('nombres, orden y el grupo de la novena', () => {
    expect(filas.map((f) => f.nombre)).toEqual([
      'Misa dominical',
      'Misa entre semana',
      'Misa de otro santo',
      'Hora Santa',
      'Misa en sector',
      'Patronal de sector',
      'Novena y fiesta patronal',
      'Procesión',
      'Evento especial',
    ]);
    expect(fila('novena').claves).toEqual(['prenovena', 'novena', 'patronal']);
    expect(fila('dominical').descripcion).toBe('Inicio y Gracias de domingo.');
    expect(fila('procesion').descripcion).toBe('Con rótulo de lugar o estación.');
  });

  it('cubren las 11 claves una sola vez, y un grupo tiene los mismos rótulos', () => {
    const claves = filas.flatMap((f) => f.claves);
    expect([...claves].sort()).toEqual([...TODAS].sort());
    for (const f of filas) {
      const ids = f.claves.map((k) => JSON.stringify(comunes.find((c) => c.clave === k)!.rotulos.map((r) => r.id)));
      expect(new Set(ids).size, f.id).toBe(1);
    }
  });
});

describe('interruptores', () => {
  it('una fila está encendida si alguna de sus claves lo está', () => {
    expect(filaEncendida({ apagados: ['novena'] }, fila('novena'))).toBe(true);
    expect(filaEncendida({ apagados: ['prenovena', 'novena', 'patronal'] }, fila('novena'))).toBe(false);
    expect(filaEncendida(undefined, fila('dominical'))).toBe(true);
  });

  it('conFila apaga o enciende todas las claves y conserva el resto', () => {
    const t = congelar({ apagados: ['semana'] });
    const apagada = conFila(t, fila('novena'), false)!;
    expect(apagada.apagados).toEqual(['semana', 'prenovena', 'novena', 'patronal']);
    expect(conFila(apagada, fila('novena'), true)!.apagados).toEqual(['semana']);
    expect(conFila(t, fila('semana'), true)).toBeUndefined();
    const conPropios = congelar({ apagados: ['semana'], propios: [{ clave: 'r', nombre: 'R' }] });
    expect(conFila(conPropios, fila('semana'), true)).toEqual({ propios: [{ clave: 'r', nombre: 'R' }] });
  });

  it('no se puede apagar la última fila sin propios', () => {
    const casiTodo = { apagados: TODAS.filter((k) => k !== 'dominical') };
    expect(puedeApagar(casiTodo, fila('dominical'), comunes)).toBe(false);
    expect(puedeApagar({ ...casiTodo, propios: [{ clave: 'r', nombre: 'R' }] }, fila('dominical'), comunes)).toBe(true);
    expect(puedeApagar({}, fila('dominical'), comunes)).toBe(true);
  });

  it('cuenta filas activas', () => {
    expect(filasActivas({ apagados: ['semana', 'sector', 'patronalsector', 'evento', 'procesion'], propios: [{ clave: 'r', nombre: 'R' }] }, comunes)).toBe(5);
    expect(filasActivas({}, comunes)).toBe(9);
  });

  it('no se puede borrar el único propio con todos los comunes apagados', () => {
    const t = { apagados: TODAS, propios: [{ clave: 'r', nombre: 'R' }] };
    expect(puedeBorrarPropio(t, 'r')).toBe(false);
    expect(puedeBorrarPropio({ ...t, propios: [...t.propios, { clave: 's', nombre: 'S' }] }, 'r')).toBe(true);
    expect(puedeBorrarPropio({ propios: t.propios }, 'r')).toBe(true);
    expect(MAX_PROPIOS).toBe(10);
  });
});

describe('clave de un propio nuevo (Decisión 17)', () => {
  it('sale del nombre y nunca choca', () => {
    expect(nuevaClavePropio('Rosario de la aurora', [])).toBe('rosario-de-la-aurora');
    expect(nuevaClavePropio('Novena', [])).toBe('novena-2');
    expect(nuevaClavePropio('Nuevo', [])).toBe('nuevo-2');
    expect(nuevaClavePropio('¡!', [])).toBe('tipo');
    expect(nuevaClavePropio('Rosario de la aurora', ['rosario-de-la-aurora'])).toBe('rosario-de-la-aurora-2');
    expect(nuevaClavePropio('Rosario de la aurora', ['rosario-de-la-aurora', 'rosario-de-la-aurora-2'])).toBe('rosario-de-la-aurora-3');
    const larga = nuevaClavePropio('a'.repeat(30) + ' ' + 'b'.repeat(30), []);
    expect(larga.length).toBeLessThanOrEqual(40);
    expect(larga).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    const larga2 = nuevaClavePropio('a'.repeat(60), ['a'.repeat(40)]);
    expect(larga2.length).toBeLessThanOrEqual(40);
    expect(larga2.endsWith('-2')).toBe(true);
  });
});

describe('casillas de rótulos (Decisión 20)', () => {
  it('orden visual y bases', () => {
    expect(CASILLAS_PROPIO.map((c) => c.texto)).toEqual([
      'Celebrante o persona', '1.ª lectura', 'Salmo', '2.ª lectura', 'Evangelio', 'Misterio del rosario', 'Oración', 'Lugar o estación', 'Libre',
    ]);
    // Una casilla por rótulo: las lecturas, el salmo y el evangelio ya no van juntos.
    expect(CASILLAS_PROPIO.every((c) => c.bases.length === 1 && c.bases[0] === c.id)).toBe(true);
  });

  it('de casillas a rótulos, con lo que no está en ninguna al final', () => {
    expect(
      rotulosDeCasillas({ persona: true, lectura1: true, salmo: true, lectura2: false, evangelio: true, rosario: false, oracion: true, lugar: false, libre: true }, ['santisimo']),
    ).toEqual(['persona', 'lectura1', 'salmo', 'evangelio', 'oracion', 'libre', 'santisimo']);
    expect(casillasDe(['salmo']).salmo).toBe(true);
    expect(casillasDe(['salmo']).lectura1).toBe(false);
    expect(casillasDe(['salmo']).persona).toBe(false);
  });
});

describe('formulario y aplicar', () => {
  const nuevo = (cambios: Partial<FormularioTipo>): FormularioTipo => ({ ...formularioDeTipo({}, 'nuevo', comunes)!, ...cambios });

  it('formularioDeTipo', () => {
    expect(formularioDeTipo({}, 'nada', comunes)).toBeNull();
    const f = formularioDeTipo({}, 'nuevo', comunes)!;
    expect(f.clase).toBe('nuevo');
    // Un tipo nuevo empieza con los rótulos de una misa: celebrante, 1.ª lectura, salmo y evangelio.
    expect(Object.entries(f.casillas).filter(([, v]) => v).map(([k]) => k)).toEqual(['persona', 'lectura1', 'salmo', 'evangelio']);
    const c = formularioDeTipo({ tipos: { ajustes: { horasanta: { ocultarRotulos: ['bendicion'] } } } }, 'horasanta', comunes)!;
    expect(c.clase).toBe('comun');
    expect(c.nombre).toBe('Hora Santa');
    expect(c.casillas).toEqual({ guia: true, santisimo: true, lectura1: true, oracion: true, bendicion: false });
    const g = formularioDeTipo({ tipos: { ajustes: { novena: { textoGracias: 'G' } } } }, 'novena', comunes)!;
    expect(g.claves).toEqual(['prenovena', 'novena', 'patronal']);
    expect(g.textoGracias).toBe('G');
    expect(formularioDeTipo({}, 'patronal', comunes)).toBeNull();
    const p = formularioDeTipo({ tipos: { propios: [{ clave: 'r', nombre: 'R', portada: 'evento', rotulos: ['rosario'] }] } }, 'r', comunes)!;
    expect(p).toMatchObject({ clase: 'propio', nombre: 'R', portada: 'evento' });
    expect(p.casillas.rosario).toBe(true);
  });

  it('un propio nuevo', () => {
    const f = nuevo({
      nombre: 'Rosario de la aurora',
      nombrePanel: 'Rosario',
      portada: 'fiesta',
      casillas: { persona: true, lectura1: false, salmo: false, lectura2: false, evangelio: false, rosario: true, oracion: true, lugar: false, libre: true },
    });
    const r = aplicarTipo(congelar({ apagados: ['procesion'] }), f, comunes, []);
    expect(r.clave).toBe('rosario-de-la-aurora');
    expect(r.tipos).toEqual({
      apagados: ['procesion'],
      propios: [
        { clave: 'rosario-de-la-aurora', nombre: 'Rosario de la aurora', nombrePanel: 'Rosario', portada: 'fiesta', rotulos: ['persona', 'rosario', 'oracion', 'libre'] },
      ],
    });
  });

  it('editar un propio conserva lo que el editor no muestra', () => {
    const tipos = congelar({ propios: [{ clave: 'r', nombre: 'R', titulo: 'X', esquina: 'fecha', rotulos: ['santisimo'] }, { clave: 's', nombre: 'S' }] });
    const f = { ...formularioDeTipo({ tipos }, 'r', comunes)!, nombrePanel: 'Erre' };
    const r = aplicarTipo(tipos, f, comunes, ['r', 's']);
    expect(r.clave).toBe('r');
    expect((r.tipos!.propios as unknown[])[0]).toEqual({ clave: 'r', nombre: 'R', nombrePanel: 'Erre', titulo: 'X', esquina: 'fecha', rotulos: ['santisimo'] });
    expect((r.tipos!.propios as unknown[])[1]).toEqual({ clave: 's', nombre: 'S' });
  });

  it('editar otra cosa de un propio viejo no toca sus rótulos (ronda 2)', () => {
    const tipos = congelar({ propios: [{ clave: 'v', nombre: 'Viejo', rotulos: ['evangelio', 'persona'] }] });
    const f = { ...formularioDeTipo({ tipos }, 'v', comunes)!, nombrePanel: 'V' };
    expect((aplicarTipo(tipos, f, comunes, ['v']).tipos!.propios as Record<string, unknown>[])[0].rotulos).toEqual(['evangelio', 'persona']);
  });

  it('marcar «2.ª lectura» en un tipo nuevo la pone antes del evangelio (el orden de la misa)', () => {
    const nuevoTipo = ['persona', 'lectura1', 'salmo', 'evangelio'];
    expect(rotulosDeCasillas({ ...casillasDe(nuevoTipo), lectura2: true }, nuevoTipo)).toEqual(['persona', 'lectura1', 'salmo', 'lectura2', 'evangelio']);
    // una base sin casilla (santisimo) se queda en su lugar
    const conSantisimo = ['persona', 'santisimo', 'lectura1', 'evangelio'];
    expect(rotulosDeCasillas({ ...casillasDe(conSantisimo), salmo: true }, conSantisimo)).toEqual(['persona', 'santisimo', 'lectura1', 'salmo', 'evangelio']);
  });

  it('una casilla que cambia toca solo sus bases y respeta el orden (ronda 2)', () => {
    const base = ['evangelio', 'santisimo', 'persona'];
    const marcadas = casillasDe(base);
    expect(rotulosDeCasillas(marcadas, base)).toEqual(base);
    expect(rotulosDeCasillas({ ...marcadas, oracion: true }, base)).toEqual(['evangelio', 'santisimo', 'persona', 'oracion']);
    expect(rotulosDeCasillas({ ...marcadas, persona: false }, base)).toEqual(['evangelio', 'santisimo']);
    expect(rotulosDeCasillas({ ...marcadas, evangelio: false }, base)).toEqual(['santisimo', 'persona']);
    expect(rotulosDeCasillas({ ...marcadas, salmo: true }, base)).toEqual(['salmo', 'evangelio', 'santisimo', 'persona']);
    const vacio = congelar({ propios: [{ clave: 'w', nombre: 'W', rotulos: [] }] });
    const g = { ...formularioDeTipo({ tipos: vacio }, 'w', comunes)!, nombrePanel: 'Doble' };
    expect((aplicarTipo(vacio, g, comunes, ['w']).tipos!.propios as Record<string, unknown>[])[0].rotulos).toEqual([]);
  });

  it('un común escribe el ajuste en todas sus claves y omite lo que es igual a vicaria', () => {
    const g = { ...formularioDeTipo({}, 'novena', comunes)!, textoInicio: 'En breve' };
    expect(aplicarTipo({}, g, comunes, []).tipos).toEqual({
      ajustes: { prenovena: { textoInicio: 'En breve' }, novena: { textoInicio: 'En breve' }, patronal: { textoInicio: 'En breve' } },
    });
    const h = { ...formularioDeTipo({}, 'horasanta', comunes)!, nombrePanel: 'Hora Santa' };
    expect(aplicarTipo(congelar({ ajustes: { horasanta: { textoInicio: 'x' } } }), h, comunes, []).tipos).toBeUndefined();
    const b = formularioDeTipo({}, 'horasanta', comunes)!;
    const sinBendicion = { ...b, casillas: { ...b.casillas, bendicion: false } };
    expect(aplicarTipo({}, sinBendicion, comunes, []).tipos).toEqual({ ajustes: { horasanta: { ocultarRotulos: ['bendicion'] } } });
  });

  it('errores del formulario (Decisión 21)', () => {
    expect(erroresTipo(nuevo({}), {})).toEqual({ nombre: 'Escribe el nombre.' });
    expect(erroresTipo(nuevo({ nombre: 'X', nombrePanel: 'a'.repeat(41) }), {})).toEqual({ nombrePanel: 'Hasta 40 caracteres.' });
    expect(erroresTipo(nuevo({ nombre: 'X', textoInicio: 'a'.repeat(201) }), {})).toEqual({ textoInicio: 'Hasta 200 caracteres.' });
    const diez = { propios: Array.from({ length: 10 }, (_, i) => ({ clave: `p${i}x`, nombre: `P${i}` })) };
    expect(erroresTipo(nuevo({ nombre: 'X' }), diez)).toEqual({ general: 'Hasta 10 tipos propios.' });
    expect(erroresTipo(formularioDeTipo({}, 'horasanta', comunes)!, {})).toEqual({});
  });

  it('borrar un propio y quitar ajustes', () => {
    expect(borrarPropio(congelar({ propios: [{ clave: 'r', nombre: 'R' }] }), 'r')).toBeUndefined();
    expect(borrarPropio(congelar({ apagados: ['semana'], propios: [{ clave: 'r', nombre: 'R' }] }), 'r')).toEqual({ apagados: ['semana'] });
    expect(quitarAjustes(congelar({ ajustes: { novena: {}, patronal: {}, horasanta: { textoInicio: 'x' } } }), ['prenovena', 'novena', 'patronal'])).toEqual({
      ajustes: { horasanta: { textoInicio: 'x' } },
    });
    expect(quitarAjustes(congelar({ ajustes: { horasanta: {} } }), ['horasanta'])).toBeUndefined();
  });
});

describe('«Borrar tipo» que no se pudo guardar (revisión)', () => {
  it('el texto dice qué pasó, según el estado del guardado', async () => {
    const { textoNoSeBorroTipo } = await import('../../lib/editor/tipos');
    expect(textoNoSeBorroTipo('sin-conexion')).toBe('No se pudo borrar el tipo. Revisa tu conexión y vuelve a intentarlo.');
    expect(textoNoSeBorroTipo('sesion-cerrada')).toBe('No se pudo borrar el tipo: tu sesión se cerró. Entra de nuevo y vuelve a intentarlo.');
    expect(textoNoSeBorroTipo('conflicto')).toBe('No se pudo borrar el tipo: otra persona cambió el borrador mientras editabas. Vuelve a intentarlo.');
    expect(textoNoSeBorroTipo('error')).toBe('No se pudo borrar el tipo. Intenta de nuevo.');
    expect(textoNoSeBorroTipo('rechazado')).toBe('No se pudo borrar el tipo. Intenta de nuevo.');
  });
});

describe('rótulo «Oración de los fieles» (mejora 3)', () => {
  it('tiposComunes trae «fieles» justo después del evangelio en dominical', () => {
    const ids = comunes.find((c) => c.clave === 'dominical')!.rotulos.map((r) => r.id);
    expect(ids.indexOf('fieles')).toBe(ids.indexOf('evangelio') + 1);
    const u = comunes.find((c) => c.clave === 'dominical')!.rotulos.find((r) => r.id === 'fieles')!;
    expect(u).toMatchObject({ base: 'libre', nombre: 'Oración de los fieles' });
  });
  it('el formulario de dominical tiene la casilla fieles marcada', () => {
    expect(formularioDeTipo({}, 'dominical', comunes)!.casillas.fieles).toBe(true);
  });
  it('desmarcar fieles guarda ocultarRotulos [fieles]', () => {
    const f = formularioDeTipo({}, 'dominical', comunes)!;
    const sin = { ...f, casillas: { ...f.casillas, fieles: false } };
    expect(aplicarTipo({}, sin, comunes, []).tipos).toEqual({ ajustes: { dominical: { ocultarRotulos: ['fieles'] } } });
  });
});
