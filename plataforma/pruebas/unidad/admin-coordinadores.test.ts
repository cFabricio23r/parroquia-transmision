import { describe, expect, it } from 'vitest';
import { armarFilasCoordinadores, chipCoordinador } from '../../lib/admin-coordinadores';

const AHORA = Date.parse('2026-11-14T20:00:00Z');
const parroquias = {
  pa: { nombre: 'Alfa', slug: 'alfa' },
  pb: { nombre: 'Beta', slug: 'beta' },
};
const personas = {
  u1: { nombre: 'Zoila', correo: 'z@x.test', ultimaEntrada: '2026-11-14T15:00:00Z' },
  u2: { nombre: null, correo: 'b@x.test', ultimaEntrada: null },
};

describe('armarFilasCoordinadores (Decisión 11)', () => {
  it('una fila por membresía; un miembro en dos parroquias da dos filas', () => {
    const filas = armarFilasCoordinadores(
      {
        miembros: [
          { usuarioId: 'u1', parroquiaId: 'pa' },
          { usuarioId: 'u1', parroquiaId: 'pb' },
        ],
        personas,
        invitaciones: [],
        parroquias,
      },
      AHORA,
    );
    expect(filas.map((f) => [f.tipo, f.usuarioId, f.parroquiaNombre, f.estado])).toEqual([
      ['miembro', 'u1', 'Alfa', 'activo'],
      ['miembro', 'u1', 'Beta', 'activo'],
    ]);
    expect(filas[0]).toMatchObject({ nombre: 'Zoila', correo: 'z@x.test', parroquiaSlug: 'alfa', ultimaEntrada: '2026-11-14T15:00:00Z' });
    expect(new Set(filas.map((f) => f.clave)).size).toBe(2);
  });

  it('dos invitaciones al mismo correo y parroquia: solo la más reciente', () => {
    const filas = armarFilasCoordinadores(
      {
        miembros: [],
        personas: {},
        invitaciones: [
          { id: 'i1', correo: 'n@x.test', parroquiaId: 'pa', venceEn: '2026-11-20T00:00:00Z', creadaEn: '2026-11-10T00:00:00Z' },
          { id: 'i2', correo: 'n@x.test', parroquiaId: 'pa', venceEn: '2026-11-21T00:00:00Z', creadaEn: '2026-11-11T00:00:00Z' },
        ],
        parroquias,
      },
      AHORA,
    );
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({ tipo: 'invitacion', invitacionId: 'i2', correo: 'n@x.test', nombre: null, estado: 'invitacion-enviada', ultimaEntrada: null });
  });

  it('una invitación a un correo que ya es miembro de esa parroquia no sale', () => {
    const filas = armarFilasCoordinadores(
      {
        miembros: [{ usuarioId: 'u1', parroquiaId: 'pa' }],
        personas,
        invitaciones: [
          { id: 'i1', correo: 'Z@x.test', parroquiaId: 'pa', venceEn: '2026-11-20T00:00:00Z', creadaEn: '2026-11-10T00:00:00Z' },
          { id: 'i2', correo: 'z@x.test', parroquiaId: 'pb', venceEn: '2026-11-20T00:00:00Z', creadaEn: '2026-11-10T00:00:00Z' },
        ],
        parroquias,
      },
      AHORA,
    );
    expect(filas.map((f) => [f.tipo, f.parroquiaId])).toEqual([
      ['miembro', 'pa'],
      ['invitacion', 'pb'],
    ]);
  });

  it('vence justo en ahora: vencida', () => {
    const filas = armarFilasCoordinadores(
      {
        miembros: [],
        personas: {},
        invitaciones: [{ id: 'i1', correo: 'n@x.test', parroquiaId: 'pa', venceEn: new Date(AHORA).toISOString(), creadaEn: '2026-11-10T00:00:00Z' }],
        parroquias,
      },
      AHORA,
    );
    expect(filas[0].estado).toBe('invitacion-vencida');
  });

  it('orden: activos (por parroquia y persona), enviadas, vencidas', () => {
    const filas = armarFilasCoordinadores(
      {
        miembros: [
          { usuarioId: 'u1', parroquiaId: 'pb' },
          { usuarioId: 'u1', parroquiaId: 'pa' },
          { usuarioId: 'u2', parroquiaId: 'pa' },
        ],
        personas,
        invitaciones: [
          { id: 'v', correo: 'a@x.test', parroquiaId: 'pa', venceEn: '2026-11-01T00:00:00Z', creadaEn: '2026-10-20T00:00:00Z' },
          { id: 'e2', correo: 'c@x.test', parroquiaId: 'pb', venceEn: '2026-11-20T00:00:00Z', creadaEn: '2026-11-10T00:00:00Z' },
          { id: 'e1', correo: 'd@x.test', parroquiaId: 'pa', venceEn: '2026-11-20T00:00:00Z', creadaEn: '2026-11-10T00:00:00Z' },
        ],
        parroquias,
      },
      AHORA,
    );
    expect(filas.map((f) => `${f.estado}:${f.parroquiaNombre}:${f.nombre ?? f.correo}`)).toEqual([
      'activo:Alfa:b@x.test',
      'activo:Alfa:Zoila',
      'activo:Beta:Zoila',
      'invitacion-enviada:Alfa:d@x.test',
      'invitacion-enviada:Beta:c@x.test',
      'invitacion-vencida:Alfa:a@x.test',
    ]);
  });

  it('un miembro cuya cuenta ya no existe o una parroquia desconocida no sale', () => {
    const filas = armarFilasCoordinadores(
      {
        miembros: [
          { usuarioId: 'borrado', parroquiaId: 'pa' },
          { usuarioId: 'u1', parroquiaId: 'otra' },
        ],
        personas,
        invitaciones: [],
        parroquias,
      },
      AHORA,
    );
    expect(filas).toEqual([]);
  });
});

describe('chipCoordinador', () => {
  it('los 3 textos y tonos', () => {
    expect(chipCoordinador('activo')).toEqual({ texto: 'Activo', tono: 'verde' });
    expect(chipCoordinador('invitacion-enviada')).toEqual({ texto: 'Invitación enviada', tono: 'azul' });
    expect(chipCoordinador('invitacion-vencida')).toEqual({ texto: 'Invitación vencida', tono: 'ambar' });
  });
});
