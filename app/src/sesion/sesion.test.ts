import type { ClienteSupabase, Resultado, SesionSupabase } from '../supabase/cliente';
import type { AlmacenSesion } from './almacen';
import { MARGEN_RENOVAR_S, crearSesionApp } from './sesion';

const AHORA_MS = 1_700_000_000_000;
const AHORA_S = AHORA_MS / 1000;

const VIGENTE: SesionSupabase = {
  accessToken: 'TOKEN-ACCESO-FALSO-1111',
  refreshToken: 'TOKEN-RENOVAR-FALSO-2222',
  expiraEn: AHORA_S + 3600,
  usuarioId: 'u-1',
  correo: 'ana@x.com',
};
const VENCIDA: SesionSupabase = { ...VIGENTE, expiraEn: AHORA_S - 10 };
const NUEVA: SesionSupabase = {
  ...VIGENTE,
  accessToken: 'TOKEN-ACCESO-FALSO-3333',
  refreshToken: 'TOKEN-RENOVAR-FALSO-4444',
  expiraEn: AHORA_S + 3600,
};

function almacenFalso(inicial: SesionSupabase | null) {
  let guardada = inicial;
  const a = {
    leerSesion: jest.fn(async () => guardada),
    guardarSesion: jest.fn(async (s: SesionSupabase) => {
      guardada = s;
    }),
    borrarSesion: jest.fn(async () => {
      guardada = null;
    }),
  };
  return { almacen: a as unknown as AlmacenSesion, mock: a, guardada: () => guardada };
}

function clienteFalso(renovar: (t: string) => Promise<Resultado<SesionSupabase>>) {
  const c = { renovar: jest.fn(renovar), entrar: jest.fn(), seleccionar: jest.fn(), upsert: jest.fn() };
  return { cliente: c as unknown as ClienteSupabase, mock: c };
}

const ok = <T>(valor: T): Resultado<T> => ({ ok: true, valor });

async function armar(inicial: SesionSupabase | null, renovar: (t: string) => Promise<Resultado<SesionSupabase>>) {
  const al = almacenFalso(inicial);
  const cl = clienteFalso(renovar);
  const sesion = crearSesionApp({ cliente: cl.cliente, almacen: al.almacen, ahora: () => AHORA_MS });
  await sesion.cargar();
  return { sesion, al, cl };
}

it('el margen para renovar es de 60 s', () => {
  expect(MARGEN_RENOVAR_S).toBe(60);
});

describe('cargar, guardar, olvidar', () => {
  it('cargar lee del almacén y actual la devuelve', async () => {
    const { sesion } = await armar(VIGENTE, async () => ok(NUEVA));
    expect(sesion.actual()).toEqual(VIGENTE);
  });

  it('guardar la pone como actual y la escribe; olvidar la borra', async () => {
    const { sesion, al } = await armar(null, async () => ok(NUEVA));
    expect(sesion.actual()).toBeNull();
    await sesion.guardar(NUEVA);
    expect(sesion.actual()).toEqual(NUEVA);
    expect(al.guardada()).toEqual(NUEVA);
    await sesion.olvidar();
    expect(sesion.actual()).toBeNull();
    expect(al.guardada()).toBeNull();
  });
});

describe('conSesion', () => {
  it('con el token vigente llama a fn con la sesión guardada y no renueva', async () => {
    const { sesion, cl } = await armar(VIGENTE, async () => ok(NUEVA));
    const fn = jest.fn(async (s: SesionSupabase) => ok(s.accessToken));
    expect(await sesion.conSesion(fn)).toEqual(ok('TOKEN-ACCESO-FALSO-1111'));
    expect(fn).toHaveBeenCalledTimes(1);
    expect(cl.mock.renovar).not.toHaveBeenCalled();
  });

  it('si vence en 30 s renueva, guarda la nueva y llama a fn con ella', async () => {
    const { sesion, cl, al } = await armar({ ...VIGENTE, expiraEn: AHORA_S + 30 }, async () => ok(NUEVA));
    const fn = jest.fn(async (s: SesionSupabase) => ok(s.accessToken));
    expect(await sesion.conSesion(fn)).toEqual(ok('TOKEN-ACCESO-FALSO-3333'));
    expect(cl.mock.renovar).toHaveBeenCalledWith('TOKEN-RENOVAR-FALSO-2222');
    expect(al.guardada()).toEqual(NUEVA);
    expect(sesion.actual()).toEqual(NUEVA);
  });

  it('dos pedidos en paralelo con el token vencido renuevan una sola vez (Review Focus 3)', async () => {
    let soltar!: () => void;
    const espera = new Promise<void>((r) => (soltar = r));
    const { sesion, cl } = await armar(VENCIDA, async () => {
      await espera;
      return ok(NUEVA);
    });
    const fn = jest.fn(async (s: SesionSupabase) => ok(s.accessToken));
    const a = sesion.conSesion(fn);
    const b = sesion.conSesion(fn);
    soltar();
    expect(await Promise.all([a, b])).toEqual([ok('TOKEN-ACCESO-FALSO-3333'), ok('TOKEN-ACCESO-FALSO-3333')]);
    expect(cl.mock.renovar).toHaveBeenCalledTimes(1);
    expect(await sesion.conSesion(fn)).toEqual(ok('TOKEN-ACCESO-FALSO-3333'));
    expect(cl.mock.renovar).toHaveBeenCalledTimes(1);
  });

  it('si renovar da sin-conexion, no borra la sesión ni avisa', async () => {
    const { sesion, al } = await armar(VENCIDA, async () => ({ ok: false, error: { tipo: 'sin-conexion' } }));
    const aviso = jest.fn();
    sesion.alInvalidarse(aviso);
    const fn = jest.fn();
    expect(await sesion.conSesion(fn)).toEqual({ ok: false, error: { tipo: 'sin-conexion' } });
    expect(fn).not.toHaveBeenCalled();
    expect(al.mock.borrarSesion).not.toHaveBeenCalled();
    expect(sesion.actual()).toEqual(VENCIDA);
    expect(aviso).not.toHaveBeenCalled();
  });

  it('si renovar da sesion-invalida, borra la sesión, avisa una vez y devuelve sesion-invalida', async () => {
    const { sesion, al } = await armar(VENCIDA, async () => ({ ok: false, error: { tipo: 'sesion-invalida' } }));
    const aviso = jest.fn();
    sesion.alInvalidarse(aviso);
    const fn = jest.fn();
    const [a, b] = await Promise.all([sesion.conSesion(fn), sesion.conSesion(fn)]);
    expect(a).toEqual({ ok: false, error: { tipo: 'sesion-invalida' } });
    expect(b).toEqual({ ok: false, error: { tipo: 'sesion-invalida' } });
    expect(fn).not.toHaveBeenCalled();
    expect(al.guardada()).toBeNull();
    expect(sesion.actual()).toBeNull();
    expect(aviso).toHaveBeenCalledTimes(1);
  });

  it('alInvalidarse devuelve con qué quitar el aviso', async () => {
    const { sesion } = await armar(VENCIDA, async () => ({ ok: false, error: { tipo: 'sesion-invalida' } }));
    const aviso = jest.fn();
    const quitar = sesion.alInvalidarse(aviso);
    quitar();
    await sesion.conSesion(jest.fn());
    expect(aviso).not.toHaveBeenCalled();
  });

  it('si fn da sesion-invalida con un token vigente, renueva una vez y reintenta una sola vez', async () => {
    const { sesion, cl } = await armar(VIGENTE, async () => ok(NUEVA));
    const fn = jest.fn(async (_s: SesionSupabase): Promise<Resultado<string>> => ({
      ok: false,
      error: { tipo: 'sesion-invalida' },
    }));
    expect(await sesion.conSesion(fn)).toEqual({ ok: false, error: { tipo: 'sesion-invalida' } });
    expect(cl.mock.renovar).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn.mock.calls[1][0]).toEqual(NUEVA);
  });

  it('si fn da sesion-invalida y el reintento sale bien, devuelve lo del reintento', async () => {
    const { sesion } = await armar(VIGENTE, async () => ok(NUEVA));
    const fn = jest.fn(async (s: SesionSupabase): Promise<Resultado<string>> =>
      s.accessToken === NUEVA.accessToken ? ok('bien') : { ok: false, error: { tipo: 'sesion-invalida' } },
    );
    expect(await sesion.conSesion(fn)).toEqual(ok('bien'));
  });

  it('sin sesión guardada da sesion-invalida sin llamar a fn', async () => {
    const { sesion, cl } = await armar(null, async () => ok(NUEVA));
    const fn = jest.fn();
    expect(await sesion.conSesion(fn)).toEqual({ ok: false, error: { tipo: 'sesion-invalida' } });
    expect(fn).not.toHaveBeenCalled();
    expect(cl.mock.renovar).not.toHaveBeenCalled();
  });
});
