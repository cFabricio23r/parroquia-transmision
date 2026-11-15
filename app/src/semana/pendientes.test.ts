/**
 * @jest-environment node
 */
import type { ItemSemana } from './nucleo';
import type { Pendiente } from './almacen';
import { combinarConPendientes } from './pendientes';

function item(extra: Partial<ItemSemana> = {}): ItemSemana {
  return {
    clave: 'fija:f1:2026-11-19', fecha: '2026-11-19', hora: '18:00', tipo: 'dominical',
    datos: { celebrante: 'P. Web' }, origen: 'fija', fijaId: 'f1', serieId: null, serie: null,
    diaSemanaFija: 4, id: 't1', saltada: false, editada: true,
    actualizadoEn: '2026-11-19T15:00:00.000Z', actualizadoDesde: 'web', ...extra,
  };
}

function pendiente(extra: Partial<Pendiente> = {}): Pendiente {
  return {
    clave: 'fija:f1:2026-11-19', fecha: '2026-11-19', hora: '18:30', tipo: 'dominical', origen: 'fija',
    fijaId: 'f1', serieId: null, datos: { celebrante: 'P. App' },
    editadoEn: '2026-11-19T16:00:00.000Z', rechazado: false, ...extra,
  };
}

test('un pendiente más nuevo que el servidor gana y sale marcado', () => {
  const r = combinarConPendientes([item()], [pendiente()]);
  expect(r.perdidos).toEqual([]);
  expect(r.items[0]).toMatchObject({ datos: { celebrante: 'P. App' }, hora: '18:30', pendiente: true, rechazado: false });
});

test('si la web guardó después, gana el servidor y el pendiente se pierde', () => {
  const r = combinarConPendientes([item({ actualizadoEn: '2026-11-19T17:00:00.000Z' })], [pendiente()]);
  expect(r.perdidos).toEqual(['fija:f1:2026-11-19']);
  expect(r.items[0]).toMatchObject({ datos: { celebrante: 'P. Web' }, pendiente: false });
});

test('un pendiente rechazado deja los datos del servidor y la marca', () => {
  const r = combinarConPendientes([item()], [pendiente({ rechazado: true })]);
  expect(r.items[0]).toMatchObject({ datos: { celebrante: 'P. Web' }, pendiente: false, rechazado: true });
});
