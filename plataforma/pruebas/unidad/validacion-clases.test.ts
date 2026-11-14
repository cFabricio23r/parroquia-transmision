import { describe, expect, it } from 'vitest';
import {
  clasificarErrores,
  clavesDesconocidas,
  completarParaForma,
  erroresDeFormaEn,
} from '../../lib/editor/validacion';
import { tiposComunes } from '../../lib/validar-nucleo.mjs';
import { CLAVES_TIPOS_COMUNES } from '../../lib/editor/estados';

const slug = 'prueba-clases';

describe('errores de forma y de completitud', () => {
  it('lo obligatorio vacío es de completitud', () => {
    const r = clasificarErrores({ nombre: '', lugar: 'X' }, slug);
    expect(r.completitud).toContain('Falta el nombre de la parroquia (nombre).');
    expect(r.completitud).toContain('Faltan los logos (logos).');
    expect(r.forma).toEqual([]);
  });

  it('un hex mal formado es de forma', () => {
    const r = clasificarErrores({ colores: { principal: '#8a1' } }, slug);
    expect(r.forma).toContain('El color principal (colores.principal) debe tener la forma #rrggbb.');
  });

  it('el poco contraste de un color válido es de completitud', () => {
    const r = clasificarErrores({ colores: { principal: '#ffff00', oscuro: '#0c3562' } }, slug);
    const error = r.todos.find((e) => e.includes('colores.principal'));
    expect(error).toBeDefined();
    expect(r.completitud).toContain(error);
    expect(r.forma).not.toContain(error);
  });

  it('galería: alt vacío es completitud; id malo es forma', () => {
    const a = clasificarErrores({ galeria: [{ id: 'img-a1b2c3', src: 'medios/x.png', alt: '' }] }, slug);
    expect(a.completitud).toContain('Falta la descripción de la imagen (galeria[0].alt).');
    const b = clasificarErrores({ galeria: [{ id: 'X', src: 'medios/x.png', alt: 'a' }] }, slug);
    expect(b.forma.some((e) => e.includes('galeria[0].id'))).toBe(true);
  });

  it('avisos: fecha mala es forma; texto vacío es completitud', () => {
    const a = clasificarErrores({ avisos: [{ texto: 'a', desde: '2026-02-30' }] }, slug);
    expect(a.forma.some((e) => e.includes('avisos[0].desde'))).toBe(true);
    const b = clasificarErrores({ avisos: [{ texto: '' }] }, slug);
    expect(b.completitud.some((e) => e.includes('avisos[0].texto'))).toBe(true);
    expect(b.forma.some((e) => e.includes('avisos'))).toBe(false);
  });

  it('un horario sin horas es de completitud', () => {
    const r = clasificarErrores({ horarios: [{ dia: 'Domingo', horas: [] }] }, slug);
    expect(r.completitud).toContain('Falta al menos una hora (horarios[0].horas).');
  });

  it('forma y completitud reparten todos, sin repetidos', () => {
    const b = { nombre: '', colores: { principal: '#8a1', oscuro: '#ffff00' }, avisos: [{ texto: '', hasta: 'x' }] };
    const r = clasificarErrores(b, slug);
    expect([...r.forma, ...r.completitud].sort()).toEqual([...r.todos].sort());
    expect(r.forma.filter((e) => r.completitud.includes(e))).toEqual([]);
  });

  it('erroresDeFormaEn mira solo los bloques pedidos', () => {
    const r = erroresDeFormaEn({ colores: { principal: '#8a1' }, avisos: [{ texto: 'a', desde: 'x' }] }, slug, ['avisos']);
    expect(r.length).toBe(1);
    expect(r[0]).toContain('avisos[0].desde');
  });

  it('clavesDesconocidas', () => {
    expect(clavesDesconocidas({ nombre: 'a', esquema: 1, foo: 2 })).toEqual(['esquema', 'foo']);
  });

  it('completarParaForma no muta', () => {
    const b = { nombre: '', logos: { blanco: { src: 'medios/a.png', alt: '' } }, galeria: [{ id: 'img-1', src: 'medios/b.png', alt: '' }] };
    const antes = structuredClone(b);
    completarParaForma(b);
    expect(b).toEqual(antes);
  });
});

describe('tiposComunes', () => {
  it('lista los 11 tipos comunes en el orden del panel', () => {
    const t = tiposComunes();
    expect(t).toHaveLength(11);
    expect(t[0]).toEqual({ clave: 'dominical', nombre: 'Misa dominical' });
    expect(t).toContainEqual({ clave: 'horasanta', nombre: 'Hora Santa' });
    expect(t[10]).toEqual({ clave: 'evento', nombre: 'Evento especial' });
    expect(t.map((x) => x.clave)).toEqual([...CLAVES_TIPOS_COMUNES]);
  });
});
