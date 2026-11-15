import { describe, expect, it } from 'vitest';
import { MENSAJE_FORMA } from '../../lib/borrador';
import { leerOperacion } from '../../lib/semana-editor';

const ID = '11111111-2222-4333-8444-555555555555';
const datos = { celebrante: 'Ana', otra: 'x' };

const validas = [
  { op: 'crear-fija', dia_semana: 4, hora: '18:00', tipo: 'horasanta', datos },
  { op: 'cambiar-fija', id: ID, dia_semana: 4, hora: '18:00', tipo: 'horasanta', datos, activa: false },
  { op: 'borrar-fija', id: ID },
  { op: 'crear-serie', nombre: 'Prenovena 2026', tipo: 'prenovena', inicio: '2026-11-16', dias: 9, hora: '19:00', datos },
  { op: 'cambiar-serie', id: ID, nombre: 'Prenovena', tipo: 'prenovena', inicio: '2026-11-16', dias: 9, hora: '19:00', datos },
  { op: 'borrar-serie', id: ID },
  { op: 'crear-unica', fecha: '2026-11-20', hora: '10:00', tipo: 'evento', datos },
  { op: 'borrar-unica', id: ID },
  { op: 'editar-dia', clave: `fija:${ID}:2026-11-19`, hora: '18:00', tipo: 'horasanta', datos },
  { op: 'saltar-dia', clave: `serie:${ID}:2026-11-19`, hora: '19:00', tipo: 'prenovena', datos },
  { op: 'restaurar-dia', clave: `fija:${ID}:2026-11-19` },
];

describe('leerOperacion', () => {
  it('acepta cada operación válida, con los datos limpios', () => {
    for (const v of validas) {
      const r = leerOperacion(v) as Record<string, unknown>;
      expect(r.error, v.op).toBeUndefined();
      expect(r.op).toBe(v.op);
      if ('datos' in v) expect(r.datos, v.op).toEqual({ celebrante: 'Ana' });
    }
  });

  it('rechaza formas malas con MENSAJE_FORMA', () => {
    const malas: unknown[] = [
      { ...validas[0], hora: '7:00' },
      { ...validas[0], dia_semana: 0 },
      { ...validas[3], dias: 61 },
      { ...validas[3], nombre: '' },
      { ...validas[0], tipo: 'A B' },
      { op: 'borrar-fija', id: 'x' },
      { ...validas[6], fecha: '2026-02-30' },
      { op: 'otra' },
      { ...validas[8], clave: `fija:${ID}:2026-02-30` },
      { ...validas[8], clave: `otro:${ID}:2026-11-19` },
      null,
      'texto',
      [],
    ];
    for (const m of malas) expect(leerOperacion(m), JSON.stringify(m)).toEqual({ error: MENSAJE_FORMA });
  });

  it('deriva el origen, el id y la fecha de la clave, y no salta una suelta', () => {
    expect(leerOperacion(validas[8])).toMatchObject({ origen: 'fija', fija_id: ID, serie_id: null, fecha: '2026-11-19' });
    expect(leerOperacion(validas[9])).toMatchObject({ origen: 'serie', fija_id: null, serie_id: ID, fecha: '2026-11-19' });
    expect(leerOperacion({ ...validas[9], clave: `unica:${ID}` })).toEqual({ error: MENSAJE_FORMA });
  });
});
