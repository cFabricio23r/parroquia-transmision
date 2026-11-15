/**
 * @jest-environment node
 */
import type { ItemApp } from './pendientes';
import { proximaDeHoy, TEXTOS_SEMANA, textoActualizado } from './textos';

test('los textos de la spec, exactos', () => {
  const todos = Object.values(TEXTOS_SEMANA);
  for (const t of [
    'Usar esta', 'Editar', 'Ver toda la semana', 'Transmisión sin preparar',
    'Lo que edites aquí vuelve a la web cuando hay internet. Sin internet, usa lo último que bajó.',
    'Transmisiones de hoy', 'Hoy no hay transmisiones preparadas.', 'Esta semana', '‹ Volver a hoy',
    'Pendiente de subir', 'No se pudo subir este cambio. Revísalo en la web.',
    'Este tipo ya no está en la parroquia. Cámbialo en la web.', 'Todavía no se bajó ninguna semana.',
  ]) {
    expect(todos).toContain(t);
  }
});

function item(hora: string, extra: Partial<ItemApp> = {}): ItemApp {
  return {
    clave: 'fija:' + hora, fecha: '2026-11-19', hora, tipo: 'dominical', datos: {}, origen: 'fija',
    fijaId: 'f', serieId: null, serie: null, diaSemanaFija: 4, id: null, saltada: false, editada: false,
    actualizadoEn: null, actualizadoDesde: null, pendiente: false, rechazado: false, ...extra,
  };
}

test('proximaDeHoy', () => {
  const items = [item('07:00'), item('10:00'), item('18:00')];
  expect(proximaDeHoy(items, new Date(2026, 10, 19, 10, 30))).toBe('fija:10:00');
  expect(proximaDeHoy(items, new Date(2026, 10, 19, 11, 5))).toBe('fija:18:00');
  expect(proximaDeHoy(items, new Date(2026, 10, 19, 19, 30))).toBeNull();
  const conSaltada = [item('10:00', { saltada: true }), item('18:00')];
  expect(proximaDeHoy(conSaltada, new Date(2026, 10, 19, 10, 30))).toBe('fija:18:00');
  expect(proximaDeHoy([item('10:00', { fecha: '2026-11-20' })], new Date(2026, 10, 19, 9, 0))).toBeNull();
});

test('textoActualizado', () => {
  const iso = new Date(2026, 10, 14, 18, 42).toISOString();
  expect(textoActualizado(iso, new Date(2026, 10, 19, 10, 0))).toBe('Actualizado el 14 nov, 18:42');
});
