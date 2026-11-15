// Avisos fijos (plan 3, Tarea 16; Decisiones 15 y 16).
import { describe, expect, it } from 'vitest';
import { clavesDeFilas, erroresAviso, lugarTrasMover, MAX_AVISOS, mover, moverA, numerar, ordenarAvisos, textoLugar, textoRango, vencido } from '../../lib/editor/avisos';

const HOY = '2026-11-14';
const lista3 = [{ texto: 'a', orden: 1 }, { texto: 'b', orden: 2 }, { texto: 'c', orden: 3 }];

describe('avisos fijos', () => {
  it('MAX_AVISOS', () => expect(MAX_AVISOS).toBe(10));
  it('ordenarAvisos: por orden, estable, los sin orden al final', () => {
    expect(ordenarAvisos([{ texto: 'b', orden: 2 }, { texto: 'a', orden: 1 }, { texto: 'c' }]).map((a) => a.texto)).toEqual(['a', 'b', 'c']);
    expect(ordenarAvisos([{ texto: 'x' }, { texto: 'y', orden: 1 }, { texto: 'z' }]).map((a) => a.texto)).toEqual(['y', 'x', 'z']);
    expect(ordenarAvisos([{ texto: 'p', orden: 1 }, { texto: 'q', orden: 1 }]).map((a) => a.texto)).toEqual(['p', 'q']);
  });
  it('numerar y mover', () => {
    expect(numerar([{ texto: 'x' }, { texto: 'y', orden: 9 }]).map((a) => a.orden)).toEqual([1, 2]);
    expect(mover(lista3, 0, -1).map((a) => a.texto)).toEqual(['a', 'b', 'c']);
    expect(mover(lista3, 2, 1).map((a) => a.texto)).toEqual(['a', 'b', 'c']);
    const movida = mover(lista3, 0, 1);
    expect(movida.map((a) => a.texto)).toEqual(['b', 'a', 'c']);
    expect(movida.map((a) => a.orden)).toEqual([1, 2, 3]);
    expect(lista3[0].texto).toBe('a'); // no muta
  });
  it('moverA (arrastrar): el último sobre el primero', () => {
    const r = moverA(lista3, 2, 0);
    expect(r.map((a) => a.texto)).toEqual(['c', 'a', 'b']);
    expect(r.map((a) => a.orden)).toEqual([1, 2, 3]);
  });
  it('textoRango (Decisión 16)', () => {
    expect(textoRango({ texto: 'x', desde: '2026-11-01', hasta: '2027-01-30' }, HOY)).toBe('Hasta el 30 de enero de 2027');
    expect(textoRango({ texto: 'x', desde: '2026-11-01', hasta: '2026-11-30' }, HOY)).toBe('Hasta el 30 de noviembre');
    expect(textoRango({ texto: 'x' }, HOY)).toBe('Sin fecha de fin');
    expect(textoRango({ texto: 'x', desde: '2026-12-01', hasta: '2026-12-14' }, HOY)).toBe('Del 1 al 14 de diciembre');
    expect(textoRango({ texto: 'x', desde: '2026-12-01', hasta: '2027-01-30' }, HOY)).toBe('Del 1 de diciembre al 30 de enero de 2027');
    expect(textoRango({ texto: 'x', desde: '2026-12-01' }, HOY)).toBe('Desde el 1 de diciembre');
    expect(textoRango({ texto: 'x', hasta: '2026-11-13' }, HOY)).toBe('Terminó el 13 de noviembre');
    expect(textoRango({ texto: 'x', desde: '2027-02-01', hasta: '2027-02-14' }, HOY)).toBe('Del 1 al 14 de febrero de 2027');
  });
  it('vencido', () => {
    expect(vencido({ texto: 'x', hasta: '2026-11-13' }, HOY)).toBe(true);
    expect(vencido({ texto: 'x', hasta: HOY }, HOY)).toBe(false);
    expect(vencido({ texto: 'x' }, HOY)).toBe(false);
  });
  it('erroresAviso', () => {
    expect(erroresAviso({ texto: '', desde: '2026-12-02', hasta: '2026-12-01' })).toEqual({
      texto: 'Escribe el título.',
      fechas: 'La fecha «Desde» no puede ser después de «Hasta».',
    });
    expect(erroresAviso({ texto: 'x'.repeat(201) })).toEqual({ texto: 'Hasta 200 caracteres.' });
    expect(erroresAviso({ texto: 'Colecta', detalle: 'y'.repeat(201) })).toEqual({ detalle: 'Hasta 200 caracteres.' });
    expect(erroresAviso({ texto: 'Colecta' })).toEqual({});
  });
});

describe('filas de avisos estables al reordenar (ronda final)', () => {
  it('la clave de una fila no depende de su lugar: sigue al aviso al moverlo', () => {
    const lista = [{ texto: 'A' }, { texto: 'B' }, { texto: 'C' }];
    const antes = clavesDeFilas(lista);
    const despues = clavesDeFilas(mover(lista, 0, 1));
    expect(despues).toEqual([antes[1], antes[0], antes[2]]);
  });

  it('dos avisos con el mismo título tienen claves distintas', () => {
    const claves = clavesDeFilas([{ texto: 'Misa' }, { texto: 'Misa' }, { texto: 'Otra' }]);
    expect(new Set(claves).size).toBe(3);
  });

  it('el anuncio dice el lugar nuevo', () => {
    expect(textoLugar('Retiro de jóvenes', 0, 3)).toBe('Retiro de jóvenes, ahora 1.º de 3');
    expect(textoLugar('Colecta', 2, 3)).toBe('Colecta, ahora 3.º de 3');
  });
});

describe('el aviso que se edita sigue siendo el mismo al reordenar (F11, revisión)', () => {
  const lista = ['A', 'B', 'C', 'D', 'E'].map((texto, i) => ({ texto, orden: i + 1 }));

  it('arrastrar otro aviso por encima del editado (editando el 2, de 0 a 3)', () => {
    const nueva = moverA(lista, 0, 3);
    const lugar = lugarTrasMover(2, 0, 3);
    expect(lugar).toBe(1);
    expect(nueva[lugar as number].texto).toBe('C');
  });

  it('para cualquier movimiento, el lugar nuevo apunta al mismo aviso', () => {
    for (let desde = 0; desde < lista.length; desde++)
      for (let hasta = 0; hasta < lista.length; hasta++) {
        const nueva = moverA(lista, desde, hasta);
        for (let e = 0; e < lista.length; e++) expect(nueva[lugarTrasMover(e, desde, hasta) as number].texto).toBe(lista[e].texto);
      }
  });

  it('con «Subir» y «Bajar» también (son movimientos de un lugar)', () => {
    for (let i = 0; i < lista.length; i++)
      for (const delta of [-1, 1] as const) {
        const hasta = Math.min(lista.length - 1, Math.max(0, i + delta));
        const nueva = mover(lista, i, delta);
        for (let e = 0; e < lista.length; e++) expect(nueva[lugarTrasMover(e, i, hasta) as number].texto).toBe(lista[e].texto);
      }
  });

  it('el aviso nuevo sigue siendo nuevo', () => {
    expect(lugarTrasMover('nuevo', 0, 3)).toBe('nuevo');
  });
});
