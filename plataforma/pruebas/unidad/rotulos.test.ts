// Lógica de Rótulos y estilo (plan 4, Tarea 5).
import { describe, expect, it } from 'vitest';
import {
  conValor,
  errorColorRotulo,
  esquinasDe,
  leerCargos,
  notaAcento,
  OPCIONES_ESQUINAS,
  OPCIONES_POSICION,
  OPCIONES_TIPOGRAFIA,
  opcionesColorRotulo,
  posicionDe,
  textoCargos,
  tipografiaDe,
} from '../../lib/editor/rotulos';

const colores = { principal: '#8a1c2b', oscuro: '#4b0f18', acento: '#d9a441' };
const sinAcento = { principal: '#8a1c2b', oscuro: '#4b0f18' };

describe('opciones de los segmentados (Decisión 12)', () => {
  it('textos del artboard', () => {
    expect(OPCIONES_TIPOGRAFIA.map((o) => o.texto)).toEqual(['Montserrat (la de hoy)', 'Lora (clásica)', 'Source Sans (sencilla)']);
    expect(OPCIONES_ESQUINAS.map((o) => o.texto)).toEqual(['Rectas', 'Suaves', 'Redondas']);
    expect(OPCIONES_POSICION.map((o) => [o.valor, o.texto])).toEqual([
      ['izquierda', 'Abajo a la izquierda'],
      ['centro', 'Abajo al centro'],
    ]);
  });

  it('valores por defecto y «redondeadas»', () => {
    expect(tipografiaDe({})).toBe('montserrat');
    expect(tipografiaDe({ tipografia: 'lora' })).toBe('lora');
    expect(esquinasDe({ esquinas: 'redondeadas' })).toBe('suaves');
    expect(esquinasDe(undefined)).toBe('suaves');
    expect(posicionDe({})).toBe('izquierda');
    expect(posicionDe({ posicion: 'centro' })).toBe('centro');
  });
});

describe('colores del rótulo (Decisión 8)', () => {
  it('«Fondo del rótulo» con la paleta de la parroquia', () => {
    const o = opcionesColorRotulo(colores, 'colorLado', undefined);
    expect(o.map((x) => x.texto)).toEqual(['Como viene (degradado)', '#8a1c2b (principal)', '#4b0f18 (oscuro)', '#d9a441 (acento)', '#ffffff (blanco)']);
    expect(o.map((x) => x.valor)).toEqual(['', 'principal', 'oscuro', 'acento', 'blanco']);
    expect(o[0].hex).toBeNull();
    expect(o[2].hex).toBe('#4b0f18');
  });

  it('sin acento no hay opción de acento; la línea no tiene blanco', () => {
    expect(opcionesColorRotulo(sinAcento, 'colorLado', undefined).map((x) => x.valor)).toEqual(['', 'principal', 'oscuro', 'blanco']);
    const linea = opcionesColorRotulo(colores, 'colorLinea', undefined);
    expect(linea.map((x) => x.valor)).toEqual(['', 'principal', 'oscuro', 'acento']);
    expect(linea[0].texto).toBe('Como viene (acento)');
    expect(opcionesColorRotulo(sinAcento, 'colorLinea', undefined)[0].texto).toBe('Como viene');
  });

  it('un hex propio se conserva como «otro color»', () => {
    const o = opcionesColorRotulo(colores, 'colorLado', '#123456');
    expect(o[o.length - 1]).toEqual({ valor: '#123456', texto: '#123456 (otro color)', hex: '#123456' });
  });

  it('el acento borrado en Identidad se muestra y da error', () => {
    const o = opcionesColorRotulo(sinAcento, 'colorLado', 'acento');
    expect(o[o.length - 1]).toEqual({ valor: 'acento', texto: 'acento (falta en Identidad)', hex: null });
    expect(errorColorRotulo(sinAcento, 'acento')).toBe('Falta el color de acento en Identidad. Elige otro color.');
    expect(errorColorRotulo(colores, 'acento')).toBeNull();
    expect(errorColorRotulo(sinAcento, 'oscuro')).toBeNull();
  });
});

describe('nota del acento (Decisión 9a)', () => {
  it('con el acento claro da su razón; con uno oscuro, nada', () => {
    expect(notaAcento(colores)).toEqual({ hex: '#d9a441', razon: '2,2' });
    expect(notaAcento({ ...colores, acento: '#0c3562' })).toBeNull();
    expect(notaAcento(sinAcento)).toBeNull();
  });
});

describe('cargos sugeridos (Decisión 10)', () => {
  it('se leen separados por «·»', () => {
    expect(leerCargos('Párroco · Vicario ·  · Diácono')).toEqual({ cargos: ['Párroco', 'Vicario', 'Diácono'] });
    expect(leerCargos('  ')).toEqual({ cargos: undefined });
    expect(leerCargos(Array.from({ length: 13 }, (_, i) => `C${i}`).join(' · '))).toEqual({ error: 'Hasta 12 cargos.' });
    expect(leerCargos('a'.repeat(201))).toEqual({ error: 'Cada cargo, hasta 200 caracteres.' });
  });

  it('se muestran unidos con « · »', () => {
    expect(textoCargos(['Párroco', 'Vicario'])).toBe('Párroco · Vicario');
    expect(textoCargos(undefined)).toBe('');
  });
});

describe('conValor', () => {
  it('quita la clave y el objeto vacío', () => {
    expect(conValor({ logoEsquina: false }, 'logoEsquina', undefined)).toBeUndefined();
    expect(conValor({ logoEsquina: false, tipografia: 'lora' }, 'logoEsquina', undefined)).toEqual({ tipografia: 'lora' });
    expect(conValor(undefined, 'esquinas', 'rectas')).toEqual({ esquinas: 'rectas' });
    const original = Object.freeze({ esquinas: 'redondeadas' });
    expect(conValor(original, 'tipografia', 'lora')).toEqual({ esquinas: 'redondeadas', tipografia: 'lora' });
  });
});
