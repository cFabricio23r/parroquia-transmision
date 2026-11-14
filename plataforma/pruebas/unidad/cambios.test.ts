import { describe, expect, it } from 'vitest';
import { cambiosEntre, normalizarMedios, textoChipBorrador } from '../../lib/editor/cambios';
import { aFormaNueva } from '../../lib/editor/horarios';

const nombresTipos = { dominical: 'Misa dominical', horasanta: 'Hora Santa', semana: 'Misa entre semana' };

const base = {
  nombre: 'Parroquia San José',
  lugar: 'L',
  colores: { principal: '#8a1c2b', oscuro: '#4b0f18' },
  logos: { blanco: { src: 'medios/logo-ab12cd34.png', alt: 'Escudo' } },
  horarios: [
    { dia: 'Domingo', horas: [{ hora: '7:00 a. m.' }] },
    { dia: 'Sábado', horas: [{ hora: '5:00 p. m.' }] },
  ],
};

describe('cambiosEntre', () => {
  it('el caso del artboard F12', () => {
    const publicada = {
      ...base,
      logos: { blanco: { src: 'medios/v3-logo-ab12cd34.png', alt: 'Escudo' } },
      pantallas: { inicio: { modo: 'personalizada', ocultar: ['cuenta'] } },
    };
    const borrador = {
      ...base,
      pantallas: { inicio: { modo: 'personalizada', distribucion: 'derecha' } },
      tipos: { propios: [{ clave: 'rosario-aurora', nombre: 'Rosario de la aurora' }] },
      rotulos: { tipografia: 'lora' },
      avisos: [{ texto: 'Inscripciones' }, { texto: 'Colecta' }],
      horarios: [
        { dia: 'Domingo', horas: [{ hora: '7:00 a. m.' }] },
        { dia: 'Sábado', horas: [{ hora: '6:00 p. m.' }] },
      ],
    };
    const c = cambiosEntre(publicada, borrador, nombresTipos);
    expect(c.flatMap((s) => s.frases)).toEqual([
      'Pantalla de Inicio: imagen a la derecha y cuenta regresiva',
      'Tipografía de rótulos: Lora',
      'Nuevo tipo: Rosario de la aurora',
      'Horario del sábado',
      '2 avisos fijos nuevos',
    ]);
    expect(c.map((s) => s.seccion)).toEqual(['pantallas', 'rotulos', 'tipos', 'horarios-y-redes', 'avisos']);
    expect(c.length).toBe(5);
  });

  it('el prefijo de versión de los medios publicados no cuenta como cambio', () => {
    const publicada = { ...base, logos: { blanco: { src: 'medios/v3-logo-ab12cd34.png', alt: 'Escudo' } } };
    expect(cambiosEntre(publicada, base, nombresTipos)).toEqual([]);
  });

  it('el mismo contenido con las claves en otro orden no cambia nada', () => {
    const publicada = { lugar: 'L', horarios: base.horarios, logos: base.logos, colores: { oscuro: '#4b0f18', principal: '#8a1c2b' }, nombre: base.nombre };
    expect(cambiosEntre(publicada, base, nombresTipos)).toEqual([]);
  });

  it('un horario viejo publicado y el mismo en forma nueva no es un cambio', () => {
    const publicada = { ...base, horarios: [{ dia: 'Domingo', hora: '7:00 a. m.' }, { dia: 'Sábado', hora: '5:00 p. m.' }] };
    expect(cambiosEntre(publicada, base, nombresTipos)).toEqual([]);
  });

  it('identidad y patrono listan las partes', () => {
    const borrador = { ...base, lugar: 'Otro', colores: { principal: '#000000', oscuro: '#4b0f18' }, fiesta: { dia: 1, mes: 2, lema: 'x' } };
    const c = cambiosEntre({ ...base, fiesta: { dia: 1, mes: 3 } }, borrador, nombresTipos);
    expect(c.flatMap((s) => s.frases)).toEqual(['Identidad: lugar y colores', 'Patrono y fiesta: fecha de la fiesta y lema']);
  });

  it('galería, tipos comunes, redes y orden de avisos', () => {
    const publicada = {
      ...base,
      galeria: [{ id: 'img-1', src: 'medios/v2-a.png', alt: 'a' }, { id: 'img-2', src: 'medios/b.png', alt: 'b' }],
      tipos: { apagados: ['semana'] },
      avisos: [{ texto: 'a', orden: 1 }, { texto: 'b', orden: 2 }],
      redes: [{ red: 'facebook', url: 'https://facebook.com/a', texto: 'a' }],
    };
    const borrador = {
      ...base,
      galeria: [{ id: 'img-1', src: 'medios/a.png', alt: 'otra' }, { id: 'img-3', src: 'medios/c.png', alt: 'c' }],
      tipos: { apagados: ['horasanta'], ajustes: { dominical: { nombrePanel: 'Domingo' } } },
      avisos: [{ texto: 'b', orden: 1 }, { texto: 'a', orden: 2 }],
      redes: [
        { red: 'facebook', url: 'https://facebook.com/a', texto: 'a' },
        { red: 'youtube', url: 'https://youtube.com/@a', texto: '@a' },
      ],
    };
    const frases = cambiosEntre(publicada, borrador, nombresTipos).flatMap((s) => s.frases);
    expect(frases).toEqual([
      'Cambios en el tipo Misa dominical',
      'Se apagó: Hora Santa',
      'Se encendió: Misa entre semana',
      '1 imagen nueva en la galería',
      '1 imagen quitada de la galería',
      'Cambios en 1 imagen de la galería',
      'Redes: YouTube',
      'Orden de los avisos fijos',
    ]);
  });

  it('sin versión publicada no hay lista', () => {
    expect(cambiosEntre(null, base, nombresTipos)).toEqual([]);
  });
});

describe('normalizarMedios y aFormaNueva', () => {
  it('quita el prefijo vN- de los src', () => {
    expect(normalizarMedios({ a: { src: 'medios/v12-x.png' }, galeria: [{ src: 'medios/v1-y.jpg' }] })).toEqual({
      a: { src: 'medios/x.png' },
      galeria: [{ src: 'medios/y.jpg' }],
    });
  });
  it('pasa un horario viejo a la forma nueva', () => {
    expect(aFormaNueva({ dia: 'Sábado', hora: '5:00 p. m.', nota: 'Vigilia' })).toEqual({ dia: 'Sábado', horas: [{ hora: '5:00 p. m.', nota: 'Vigilia' }] });
    expect(aFormaNueva({ dia: 'Sábado', hora: '5:00 p. m.' })).toEqual({ dia: 'Sábado', horas: [{ hora: '5:00 p. m.' }] });
    const nuevo = { dia: 'Jueves', horas: [{ hora: '6:00 p. m.' }], lugar: 'Templo' };
    expect(aFormaNueva(nuevo)).toEqual(nuevo);
  });
});

describe('textoChipBorrador', () => {
  it('cuenta los cambios o dice que está al día', () => {
    expect(textoChipBorrador(5, 3)).toEqual({ texto: 'Borrador · 5 cambios sin publicar', tono: 'ambar' });
    expect(textoChipBorrador(1, 3)).toEqual({ texto: 'Borrador · 1 cambio sin publicar', tono: 'ambar' });
    expect(textoChipBorrador(0, 3)).toEqual({ texto: 'Al día con la versión 3', tono: 'verde' });
    expect(textoChipBorrador(0, null)).toEqual({ texto: 'Borrador · sin publicar todavía', tono: 'ambar' });
    expect(textoChipBorrador(4, null)).toEqual({ texto: 'Borrador · sin publicar todavía', tono: 'ambar' });
  });
});
