// Plan 5, ronda 2: las páginas de la administración no leen nada con la llave de servicio si quien
// visita no es admin. El layout cambia `children` por un aviso, pero Next igual ejecuta la página y
// manda su resultado en el HTML/RSC (node_modules/next/dist/docs/01-app/02-guides/authentication.md).
import { beforeEach, describe, expect, it, vi } from 'vitest';

const guardia = vi.hoisted(() => ({ servicioDeAdmin: vi.fn() }));
const listar = vi.hoisted(() => ({
  parroquias: vi.fn(async () => []),
  coordinadores: vi.fn(async () => []),
  registro: vi.fn(async () => []),
  filas: vi.fn(async () => []),
}));
const servicio = vi.hoisted(() => vi.fn(() => ({ marca: 'servicio' })));

vi.mock('../../app/editor/admin/guardia', () => guardia);
vi.mock('../../lib/supabase/servicio', () => ({ clienteServicio: servicio }));
vi.mock('../../lib/supabase/servidor', () => ({ clienteServidor: async () => ({}) }));
vi.mock('../../app/editor/admin/acciones', () => ({}));
vi.mock('../../lib/admin-parroquias', async (original) => ({
  ...(await original<typeof import('../../lib/admin-parroquias')>()),
  listarParroquias: listar.parroquias,
  todasLasFilas: listar.filas,
}));
vi.mock('../../lib/admin-coordinadores', async (original) => ({
  ...(await original<typeof import('../../lib/admin-coordinadores')>()),
  listarCoordinadores: listar.coordinadores,
}));
vi.mock('../../lib/registro', async (original) => ({
  ...(await original<typeof import('../../lib/registro')>()),
  listarRegistro: listar.registro,
}));

import Parroquias from '../../app/editor/admin/page';
import Coordinadores from '../../app/editor/admin/coordinadores/page';
import Registro from '../../app/editor/admin/registro/page';

const sinFiltro = { searchParams: Promise.resolve({}) };

beforeEach(() => {
  for (const f of [guardia.servicioDeAdmin, servicio, ...Object.values(listar)]) f.mockClear();
});

describe('páginas del admin sin ser admin', () => {
  it('no leen nada ni usan la llave de servicio, y no devuelven contenido', async () => {
    guardia.servicioDeAdmin.mockResolvedValue(null);
    expect(await Parroquias()).toBeNull();
    expect(await Coordinadores(sinFiltro)).toBeNull();
    expect(await Registro(sinFiltro)).toBeNull();
    expect(guardia.servicioDeAdmin).toHaveBeenCalledTimes(3);
    expect(servicio).not.toHaveBeenCalled();
    for (const f of Object.values(listar)) expect(f).not.toHaveBeenCalled();
  });

  it('siendo admin, leen con el cliente que da la guardia', async () => {
    const delAdmin = { marca: 'de-la-guardia' };
    guardia.servicioDeAdmin.mockResolvedValue(delAdmin);
    expect(await Parroquias()).not.toBeNull();
    expect(listar.parroquias).toHaveBeenCalledWith(delAdmin);
    expect(await Coordinadores(sinFiltro)).not.toBeNull();
    expect(listar.coordinadores).toHaveBeenCalledWith(delAdmin);
    expect(await Registro(sinFiltro)).not.toBeNull();
    expect(listar.registro).toHaveBeenCalledWith(delAdmin, undefined);
    expect(servicio).not.toHaveBeenCalled();
  });
});
