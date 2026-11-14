// Horarios y redes (plan 3, Tarea 15; Decisiones 13 y 14).
import { describe, expect, it } from 'vitest';
import { aFormaNueva, erroresHorario, limpiarHorario, MAX_HORARIOS, MAX_HORAS, MAX_TEXTO, textoHoras } from '../../lib/editor/horarios';
import { CAMPOS_REDES, normalizarRed, ponerRed } from '../../lib/editor/redes';

describe('horarios', () => {
  it('constantes', () => {
    expect([MAX_HORARIOS, MAX_HORAS, MAX_TEXTO]).toEqual([12, 6, 200]);
  });
  it('textoHoras y aFormaNueva', () => {
    expect(textoHoras({ dia: 'Jueves', horas: [{ hora: '6:00 p. m.', nota: 'Hora Santa' }] })).toBe('6:00 p. m. · Hora Santa');
    expect(textoHoras({ dia: 'Domingo', horas: [{ hora: '7:00 a. m.' }, { hora: '9:00 a. m.' }, { hora: '6:00 p. m.' }] })).toBe(
      '7:00 a. m. · 9:00 a. m. · 6:00 p. m.',
    );
    expect(aFormaNueva({ dia: 'Sábado', hora: '5:00 p. m.', nota: 'Vigilia' })).toEqual({ dia: 'Sábado', horas: [{ hora: '5:00 p. m.', nota: 'Vigilia' }] });
  });
  it('erroresHorario y limpiarHorario', () => {
    expect(erroresHorario({ dia: ' ', horas: [{ hora: '' }] })).toEqual({ dia: 'Escribe el día.', horas: 'Escribe al menos una hora.' });
    expect(erroresHorario({ dia: 'Martes', horas: [{ hora: '7:00' }], lugar: 'x'.repeat(201) })).toEqual({ lugar: 'Hasta 200 caracteres.' });
    expect(erroresHorario({ dia: 'Martes', horas: [{ hora: '7:00' }] })).toEqual({});
    expect(limpiarHorario({ dia: ' Martes ', horas: [{ hora: ' 7:00 ', nota: '' }, { hora: '' }], lugar: ' ' })).toEqual({
      dia: 'Martes',
      horas: [{ hora: '7:00' }],
    });
  });
});

describe('redes', () => {
  it('CAMPOS_REDES en el orden del editor', () => {
    expect(CAMPOS_REDES.map((c) => c.red)).toEqual(['facebook', 'youtube', 'whatsapp', 'web', 'instagram']);
  });
  it('normalizarRed', () => {
    expect(normalizarRed('facebook', 'facebook.com/parroquiasanjose')).toEqual({
      url: 'https://facebook.com/parroquiasanjose',
      texto: 'facebook.com/parroquiasanjose',
    });
    expect(normalizarRed('whatsapp', '7000-0000')).toEqual({ url: 'https://wa.me/50370000000', texto: '7000-0000' });
    expect(normalizarRed('whatsapp', '+503 7000 0000')).toMatchObject({ url: 'https://wa.me/50370000000' });
    expect(normalizarRed('whatsapp', '123')).toEqual({ error: 'Escribe el número con 8 dígitos, o con el código del país.' });
    expect(normalizarRed('youtube', '@parroquia')).toMatchObject({ url: 'https://youtube.com/@parroquia' });
    expect(normalizarRed('facebook', 'parroquiasanjose')).toMatchObject({ url: 'https://facebook.com/parroquiasanjose' });
    expect(normalizarRed('instagram', '@parroquia')).toMatchObject({ url: 'https://instagram.com/parroquia' });
    expect(normalizarRed('web', 'parroquia')).toEqual({ error: 'Escribe la dirección completa, por ejemplo parroquia.org.' });
    expect(normalizarRed('web', 'http://parroquia.org')).toMatchObject({ url: 'https://parroquia.org' });
    expect(normalizarRed('web', 'https://parroquia.org/x')).toMatchObject({ url: 'https://parroquia.org/x' });
    expect(normalizarRed('instagram', '  ')).toBeNull();
    expect(normalizarRed('facebook', 'mi pagina')).toEqual({ error: 'No pudimos convertir esto en una dirección. Escríbelo como facebook.com/tu-pagina.' });
    expect(normalizarRed('instagram', 'mi pagina')).toEqual({ error: 'No pudimos convertir esto en una dirección. Escríbelo como instagram.com/tu-pagina.' });
    expect(normalizarRed('facebook', 'a'.repeat(201))).toEqual({ error: 'Hasta 200 caracteres.' });
    for (const [red, v] of [['facebook', 'x.com/a'], ['youtube', 'canal'], ['whatsapp', '50370000000'], ['web', 'a.org']] as const) {
      const r = normalizarRed(red, v);
      expect(r && 'url' in r && /^https:\/\//.test(r.url)).toBe(true);
    }
  });
  it('ponerRed conserva el orden, agrega al final y quita el bloque vacío', () => {
    const w = { red: 'whatsapp', url: 'https://wa.me/50370000000', texto: '7000-0000' };
    const f = { red: 'facebook', url: 'https://facebook.com/x', texto: 'facebook.com/x' };
    expect(ponerRed([w, f], 'facebook', null)).toEqual([w]);
    expect(ponerRed([w], 'whatsapp', null)).toBeUndefined();
    expect(ponerRed(undefined, 'web', null)).toBeUndefined();
    expect(ponerRed([w], 'web', { url: 'https://a.org', texto: 'a.org' })).toEqual([w, { red: 'web', url: 'https://a.org', texto: 'a.org' }]);
    expect(ponerRed([w, f], 'whatsapp', { url: 'https://wa.me/1234567890', texto: '1234567890' })![0]).toEqual({
      red: 'whatsapp',
      url: 'https://wa.me/1234567890',
      texto: '1234567890',
    });
  });
});
