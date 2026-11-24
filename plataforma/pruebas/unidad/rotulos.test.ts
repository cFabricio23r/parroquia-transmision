// Lógica de Rótulos y estilo (plan 4, Tarea 5).
import { describe, expect, it } from 'vitest';
import {
  conValor,
  disenoDe,
  errorColorRotulo,
  FAMILIA_TIPOGRAFIA,
  NOTA_MINIMAL,
  OPCIONES_DISENO,
  usaCampo,
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
    expect(OPCIONES_TIPOGRAFIA.map((o) => [o.valor, o.texto])).toEqual([
      ['montserrat', 'Montserrat (la de hoy)'],
      ['lora', 'Lora (clásica)'],
      ['source-sans', 'Source Sans (sencilla)'],
      ['cinzel', 'Cinzel (solemne)'],
      ['playfair', 'Playfair Display (elegante)'],
      ['eb-garamond', 'EB Garamond (de libro)'],
      ['merriweather', 'Merriweather (firme)'],
      ['nunito', 'Nunito (cercana)'],
      ['oswald', 'Oswald (angosta)'],
    ]);
    expect(OPCIONES_ESQUINAS.map((o) => o.texto)).toEqual(['Rectas', 'Suaves', 'Redondas']);
    expect(OPCIONES_POSICION.map((o) => [o.valor, o.texto])).toEqual([
      ['izquierda', 'Abajo a la izquierda'],
      ['centro', 'Abajo al centro'],
      ['derecha', 'Abajo a la derecha'],
      ['arriba-derecha', 'Arriba a la derecha'],
    ]);
    expect(OPCIONES_DISENO.map((o) => [o.valor, o.texto])).toEqual([
      ['clasico', 'Clásico'],
      ['tarjeta', 'Tarjeta'],
      ['minimal', 'Minimal'],
      ['etiqueta', 'Etiqueta'],
    ]);
  });

  it('valores por defecto y «redondeadas»', () => {
    expect(tipografiaDe({})).toBe('montserrat');
    expect(tipografiaDe({ tipografia: 'lora' })).toBe('lora');
    expect(esquinasDe({ esquinas: 'redondeadas' })).toBe('suaves');
    expect(esquinasDe(undefined)).toBe('suaves');
    expect(posicionDe({})).toBe('izquierda');
    expect(posicionDe({ posicion: 'centro' })).toBe('centro');
    expect(posicionDe({ posicion: 'arriba-derecha' })).toBe('arriba-derecha');
    expect(tipografiaDe({ tipografia: 'oswald' })).toBe('oswald');
    expect(disenoDe({})).toBe('clasico');
    expect(disenoDe({ diseno: 'etiqueta' })).toBe('etiqueta');
    expect(disenoDe({ diseno: 'banda' })).toBe('clasico');
  });

  it('cada tipografía tiene su familia para la lista del editor', () => {
    expect(OPCIONES_TIPOGRAFIA.every((o) => typeof FAMILIA_TIPOGRAFIA[o.valor] === 'string')).toBe(true);
    expect(FAMILIA_TIPOGRAFIA).toMatchObject({ montserrat: 'Montserrat', lora: 'Lora', 'source-sans': 'SourceSans', cinzel: 'Cinzel', oswald: 'Oswald' });
  });

  it('Minimal no usa esquinas ni fondo; los demás diseños, sí', () => {
    expect(usaCampo('minimal', 'esquinas')).toBe(false);
    expect(usaCampo('minimal', 'colorLado')).toBe(false);
    for (const d of ['clasico', 'tarjeta', 'etiqueta']) {
      expect(usaCampo(d, 'esquinas')).toBe(true);
      expect(usaCampo(d, 'colorLado')).toBe(true);
    }
    expect(NOTA_MINIMAL).toBe('El diseño Minimal no tiene caja');
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
    const deHoy = 'Si usas el acento como fondo, el texto va oscuro; como línea, está bien.';
    expect(notaAcento(colores, 'clasico')).toEqual({ hex: '#d9a441', razon: '2,2', frase: deHoy });
    expect(notaAcento({ ...colores, acento: '#0c3562' }, 'clasico')).toBeNull();
    expect(notaAcento(sinAcento, 'clasico')).toBeNull();
  });
  it('en Tarjeta y Etiqueta la línea es el fondo de la ceja: la nota no dice que como línea está bien', () => {
    for (const d of ['tarjeta', 'etiqueta']) {
      const n = notaAcento(colores, d);
      expect(n).toMatchObject({ hex: '#d9a441', razon: '2,2' });
      expect(n?.frase).not.toContain('como línea, está bien');
      expect(n?.frase).toContain('oscuro');
    }
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
