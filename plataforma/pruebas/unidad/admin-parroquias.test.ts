import { describe, expect, it } from 'vitest';
import { chipParroquia, estadoParroquia, sugerirSlug, textoCoordinadores, type FilaParroquia } from '../../lib/admin-parroquias';

describe('estadoParroquia (Decisión 7)', () => {
  it('desactivada gana a todo; después publicada, borrador y sin configurar', () => {
    expect(estadoParroquia({ desactivadaEn: '2026-11-01T00:00:00Z', version: 4, clavesBorrador: ['nombre', 'colores'] })).toEqual({
      clave: 'desactivada',
    });
    expect(estadoParroquia({ desactivadaEn: null, version: 4, clavesBorrador: ['nombre', 'lugar'] })).toEqual({ clave: 'publicada', version: 4 });
    expect(estadoParroquia({ desactivadaEn: null, version: null, clavesBorrador: ['nombre', 'lugar'] })).toEqual({ clave: 'sin-configurar' });
    expect(estadoParroquia({ desactivadaEn: null, version: null, clavesBorrador: ['nombre', 'lugar', 'colores'] })).toEqual({ clave: 'borrador' });
    expect(estadoParroquia({ desactivadaEn: null, version: null, clavesBorrador: ['nombre'] })).toEqual({ clave: 'sin-configurar' });
    expect(estadoParroquia({ desactivadaEn: null, version: null, clavesBorrador: [] })).toEqual({ clave: 'sin-configurar' });
  });
});

describe('chipParroquia', () => {
  it('los cuatro textos y tonos', () => {
    expect(chipParroquia({ clave: 'publicada', version: 4 })).toEqual({ texto: 'Publicada · v4', tono: 'verde' });
    expect(chipParroquia({ clave: 'borrador' })).toEqual({ texto: 'Borrador', tono: 'ambar' });
    expect(chipParroquia({ clave: 'sin-configurar' })).toEqual({ texto: 'Sin configurar', tono: 'azul' });
    expect(chipParroquia({ clave: 'desactivada' })).toEqual({ texto: 'Desactivada', tono: 'gris' });
  });
});

describe('sugerirSlug (Decisión 10)', () => {
  it('quita tildes y el prefijo «parroquia», pasa a minúsculas con guiones', () => {
    expect(sugerirSlug('Parroquia Santa Lucía')).toBe('santa-lucia');
    expect(sugerirSlug('Inmaculada Concepción de María')).toBe('inmaculada-concepcion-de-maria');
    expect(sugerirSlug('  San José!! ')).toBe('san-jose');
  });
  it('menos de 3 caracteres: vacío', () => {
    expect(sugerirSlug('Ñu')).toBe('');
    expect(sugerirSlug('')).toBe('');
  });
  it('corta a 40 sin guion al final', () => {
    const s = sugerirSlug('a'.repeat(60));
    expect(s).toBe('a'.repeat(40));
    const t = sugerirSlug(`${'b'.repeat(39)} c`);
    expect(t).toBe('b'.repeat(39));
    expect(t.endsWith('-')).toBe(false);
  });
});

describe('textoCoordinadores (Decisión 8)', () => {
  const fila = (coordinadores: string[], invitacionPendiente: boolean): FilaParroquia => ({
    id: 'x',
    slug: 'x',
    nombre: 'X',
    lugar: null,
    estado: { clave: 'sin-configurar' },
    coordinadores,
    invitacionPendiente,
  });
  it('los nombres separados por coma; sin miembros, la invitación o una raya', () => {
    expect(textoCoordinadores(fila(['Fabricio Ramírez', 'Hno. Danilo'], false))).toBe('Fabricio Ramírez, Hno. Danilo');
    expect(textoCoordinadores(fila(['Ana'], true))).toBe('Ana');
    expect(textoCoordinadores(fila([], true))).toBe('invitación enviada');
    expect(textoCoordinadores(fila([], false))).toBe('—');
  });
});

describe('validarNuevaParroquia (plan 5, ronda 2)', () => {
  it('revisa en el orden del formulario (nombre, link, lugar) y devuelve todos los errores', async () => {
    const { validarNuevaParroquia } = await import('../../lib/admin-textos');
    expect(validarNuevaParroquia('Santa Ana', 'ab', '', [])).toEqual([
      { campo: 'slug', texto: 'La dirección debe tener entre 3 y 40 caracteres.' },
      { campo: 'lugar', texto: 'Escribe el lugar.' },
    ]);
    expect(validarNuevaParroquia(' ', 'santa-ana', 'x'.repeat(201), [])).toEqual([
      { campo: 'nombre', texto: 'Escribe el nombre de la parroquia.' },
      { campo: 'lugar', texto: 'El lugar puede tener hasta 200 caracteres.' },
    ]);
    expect(validarNuevaParroquia('Santa Ana', 'santa-ana', 'Chalchuapa', [])).toEqual([]);
  });

  it('con el formulario vacío no culpa al link, que sale del nombre', async () => {
    const { validarNuevaParroquia } = await import('../../lib/admin-textos');
    expect(validarNuevaParroquia('', '', '', [])).toEqual([
      { campo: 'nombre', texto: 'Escribe el nombre de la parroquia.' },
      { campo: 'lugar', texto: 'Escribe el lugar.' },
    ]);
  });
});
