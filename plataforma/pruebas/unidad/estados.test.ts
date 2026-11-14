import { describe, expect, it } from 'vitest';
import { estadoDeSeccion, estadosDelEditor } from '../../lib/editor/estados';
import { hoyIso, MESES } from '../../lib/fecha';

const hoy = '2026-11-14';
const img = (id: string, alt: string, nombre?: string) => ({ id, src: `medios/${id}.jpg`, alt, ...(nombre ? { nombre } : {}) });

// El borrador del artboard F1 (VicEdResumen).
export const borradorArtboard = {
  nombre: 'Parroquia San José',
  nombreCorto: 'San José',
  lugar: 'Lugar de ejemplo, La Libertad',
  colores: { principal: '#8a1c2b', oscuro: '#4b0f18', acento: '#d9a441' },
  logos: { blanco: { src: 'medios/logo.png', alt: 'Escudo' } },
  fachada: { src: 'medios/fachada.jpg', alt: 'Fachada' },
  patrono: { nombre: 'San José, esposo de la Virgen María', corto: 'San José' },
  fiesta: { dia: 19, mes: 3, lema: 'José, hombre justo y fiel' },
  pantallas: { inicio: { modo: 'personalizada', distribucion: 'derecha' }, avisos: { modo: 'personalizada' }, gracias: { modo: 'como-viene' } },
  tipos: {
    apagados: ['semana', 'sector', 'patronalsector', 'procesion', 'otros', 'prenovena', 'evento'],
    propios: [{ clave: 'rosario-aurora', nombre: 'Rosario de la aurora' }],
  },
  galeria: [
    img('img-aaaaa1', 'San José con el Niño'),
    img('img-aaaaa2', 'b'),
    img('img-aaaaa3', 'c'),
    img('img-aaaaa4', 'd'),
    img('img-aaaaa5', 'Santa Rosa de Lima'),
    img('img-aaaaa6', '', 'Fondo navideño'),
  ],
  horarios: [
    { dia: 'Domingo', horas: [{ hora: '7:00 a. m.' }] },
    { dia: 'Sábado', hora: '5:00 p. m.' },
    { dia: 'Jueves', horas: [{ hora: '6:00 p. m.', nota: 'Hora Santa' }] },
    { dia: 'Lunes a viernes', horas: [{ hora: '6:30 a. m.' }] },
  ],
  redes: [
    { red: 'facebook', url: 'https://facebook.com/x', texto: 'facebook.com/x' },
    { red: 'whatsapp', url: 'https://wa.me/50370000000', texto: '7000-0000' },
  ],
  // Un gris medio: ni el texto claro ni el oscuro llegan a 4.5 (Decisión 25).
  rotulos: { colorLado: '#808080' },
};
const erroresArtboard = ['Falta la descripción de la imagen (galeria[5].alt).'];

describe('estados del editor con el borrador del artboard', () => {
  const e = estadosDelEditor(borradorArtboard, erroresArtboard, hoy);
  it('da los estados y las frases del Resumen', () => {
    expect(e.identidad).toMatchObject({ estado: 'listo', frase: 'Nombre, logos, colores y fachada.' });
    expect(e.patrono).toMatchObject({ estado: 'listo', frase: 'San José · 19 de marzo · con lema.' });
    expect(e.pantallas).toMatchObject({ estado: 'listo', frase: '2 de 7 personalizadas; el resto, como vienen.' });
    expect(e.rotulos).toMatchObject({ estado: 'revisar', frase: 'El color del rótulo tiene poco contraste.' });
    expect(e.tipos).toMatchObject({ estado: 'listo', frase: '5 activos, 1 propio.' });
    expect(e.galeria).toMatchObject({ estado: 'falta', frase: '1 imagen sin descripción (alt).' });
    expect(e['horarios-y-redes']).toMatchObject({ estado: 'listo', frase: '4 horarios, Facebook y WhatsApp.' });
    expect(e.avisos).toMatchObject({ estado: 'opcional', frase: 'Sin avisos todavía.' });
    expect(e.resumen).toMatchObject({ estado: 'listo', frase: '' });
    expect('publicar' in e).toBe(false);
  });

  it('el problema de la galería usa el nombre de la imagen', () => {
    expect(e.galeria.errores).toEqual([
      { titulo: 'Fondo navideño no tiene descripción', detalle: 'Sin la descripción (alt) no se puede publicar.', seccion: 'galeria' },
    ]);
  });
});

describe('reglas sueltas', () => {
  it('un aviso activo vencido pide revisar; uno apagado no', () => {
    const b = { avisos: [{ texto: 'Colecta', hasta: '2026-11-13' }] };
    const r = estadoDeSeccion(b, 'avisos', [], hoy);
    expect(r.estado).toBe('revisar');
    expect(r.avisos[0].titulo).toBe('El aviso «Colecta» ya terminó');
    expect(r.frase).toBe('El aviso «Colecta» ya terminó.');
    expect(estadoDeSeccion({ avisos: [{ texto: 'Colecta', hasta: '2026-11-13', activo: false }] }, 'avisos', [], hoy).estado).toBe('listo');
  });

  it('el acento claro como fondo de rótulo avisa', () => {
    const b = { colores: { principal: '#8a1c2b', oscuro: '#4b0f18', acento: '#808080' }, rotulos: { colorLado: 'acento' } };
    const r = estadoDeSeccion(b, 'rotulos', [], hoy);
    expect(r.avisos[0]).toMatchObject({
      titulo: 'El acento como fondo de rótulo tiene poco contraste',
      detalle: 'Se puede publicar, pero conviene usarlo solo como línea.',
    });
  });

  it('un error de identidad deja «Falta algo» con la frase limpia', () => {
    const r = estadoDeSeccion({}, 'identidad', ['Falta el lugar (lugar).'], hoy);
    expect(r).toMatchObject({ estado: 'falta', frase: 'Falta el lugar.' });
  });

  it('frases de los avisos y de horarios y redes', () => {
    expect(estadoDeSeccion({ avisos: [{ texto: 'a' }] }, 'avisos', [], hoy).frase).toBe('1 aviso fijo; 1 se muestra.');
    expect(
      estadoDeSeccion({ avisos: [{ texto: 'a' }, { texto: 'b' }, { texto: 'c', activo: false }] }, 'avisos', [], hoy).frase,
    ).toBe('3 avisos fijos; 2 se muestran.');
    expect(estadoDeSeccion({}, 'horarios-y-redes', [], hoy)).toMatchObject({ estado: 'opcional', frase: 'Sin horarios ni redes todavía.' });
    expect(estadoDeSeccion({ redes: borradorArtboard.redes }, 'horarios-y-redes', [], hoy).frase).toBe('Facebook y WhatsApp.');
    expect(estadoDeSeccion({ horarios: [{ dia: 'a', hora: 'b' }] }, 'horarios-y-redes', [], hoy).frase).toBe('1 horario.');
    expect(estadoDeSeccion({}, 'galeria', [], hoy)).toMatchObject({ estado: 'opcional', frase: 'Sin imágenes todavía.' });
    expect(estadoDeSeccion({ galeria: [img('img-1', 'a')] }, 'galeria', [], hoy).frase).toBe('1 imagen.');
  });

  it('frases de rótulos, tipos y pantallas', () => {
    expect(estadoDeSeccion({}, 'rotulos', [], hoy).frase).toBe('Tipografía Montserrat, esquinas suaves.');
    expect(estadoDeSeccion({ rotulos: { tipografia: 'lora', esquinas: 'redondeadas' } }, 'rotulos', [], hoy).frase).toBe(
      'Tipografía Lora, esquinas suaves.',
    );
    expect(estadoDeSeccion({}, 'tipos', [], hoy).frase).toBe('11 activos, sin propios.');
    expect(estadoDeSeccion({}, 'pantallas', [], hoy).frase).toBe('Las 7, como vienen.');
    expect(estadoDeSeccion({ patrono: { nombre: 'San X', corto: '' }, fiesta: { dia: 1, mes: 2 } }, 'patrono', [], hoy).frase).toBe(
      'San X · 1 de febrero · sin lema.',
    );
  });

  it('resumen siempre listo', () => {
    expect(estadoDeSeccion({}, 'resumen', ['Falta el lugar (lugar).'], hoy)).toMatchObject({ estado: 'listo', frase: '' });
  });
});

describe('fechas', () => {
  it('hoyIso usa la hora de El Salvador', () => {
    expect(hoyIso(new Date('2026-11-15T03:00:00Z'))).toBe('2026-11-14');
    expect(MESES[2]).toBe('marzo');
  });
});
