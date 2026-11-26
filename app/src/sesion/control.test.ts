// Pruebas del control de la sesión. Los tokens y claves son falsos, solo para pruebas.
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));

import { crearClienteSupabase, type ClienteSupabase, type Resultado, type SesionSupabase } from '../supabase/cliente';
import { crearLimpiezas, crearSincronizador, type Limpiezas } from '../sincronizar/sincronizar';
import { LLAVES, crearAlmacen, type AlmacenSesion } from './almacen';
import { crearControlSesion, controlSesion } from './control';
import { crearGuardia } from './guardia';
import { AVISO_SESION_VENCIDA } from './tiendaSesion';
import type { Cuenta, ParroquiaApp } from './tipos';

const AHORA_S = Math.floor(Date.now() / 1000);
const SESION: SesionSupabase = {
  accessToken: 'TOKEN-ACCESO-FALSO-1111',
  refreshToken: 'TOKEN-RENOVAR-FALSO-2222',
  expiraEn: AHORA_S + 3600,
  usuarioId: 'u-1',
  correo: 'ana@x.com',
};
const A: ParroquiaApp = { id: 'p-1', slug: 'ciudad-arce', nombre: 'Ciudad Arce' };
const B: ParroquiaApp = { id: 'p-2', slug: 'san-jose', nombre: 'San José' };
const CUENTA: Cuenta = { usuarioId: 'u-1', correo: 'ana@x.com', nombre: 'Ana', esAdmin: false };

function almacenEnMemoria() {
  const mem: Record<string, string> = {};
  const almacen = crearAlmacen({
    getItemAsync: async (k) => (k in mem ? mem[k] : null),
    setItemAsync: async (k, v) => {
      mem[k] = v;
    },
    deleteItemAsync: async (k) => {
      delete mem[k];
    },
  });
  for (const k of Object.keys(almacen) as Array<keyof AlmacenSesion>) jest.spyOn(almacen, k);
  return { almacen, mem };
}

function clienteFalso(o: {
  entrar?: () => Promise<Resultado<SesionSupabase>>;
  renovar?: () => Promise<Resultado<SesionSupabase>>;
  parroquias?: () => Resultado<unknown[]>;
} = {}) {
  const c = {
    entrar: jest.fn(o.entrar ?? (async () => ({ ok: true as const, valor: SESION }))),
    renovar: jest.fn(o.renovar ?? (async () => ({ ok: true as const, valor: SESION }))),
    seleccionar: jest.fn(async (_s: SesionSupabase, tabla: string) => {
      if (tabla === 'parroquias') return o.parroquias ? o.parroquias() : { ok: true, valor: [A, B] };
      if (tabla === 'perfiles') return { ok: true, valor: [{ nombre: 'Ana' }] };
      return { ok: true, valor: [] };
    }),
    upsert: jest.fn(),
  };
  return { cliente: c as unknown as ClienteSupabase, mock: c };
}

function limpiezasFalsas() {
  const l = crearLimpiezas();
  jest.spyOn(l, 'limpiar');
  return l as Limpiezas & { limpiar: jest.Mock };
}

async function guardarTodo(almacen: AlmacenSesion, s: SesionSupabase | null, p: ParroquiaApp | null) {
  if (s) await almacen.guardarSesion(s);
  if (p) await almacen.guardarParroquia(p);
  await almacen.guardarCuenta(CUENTA);
  if (s) await almacen.guardarDueno(s.usuarioId); // el celular ya es de esa cuenta
  jest.clearAllMocks();
}

function armar(o: { cliente?: ClienteSupabase } = {}) {
  const { almacen, mem } = almacenEnMemoria();
  const cl = clienteFalso();
  const guardia = crearGuardia();
  const limpiezas = limpiezasFalsas();
  const sincronizador = crearSincronizador();
  const control = crearControlSesion({ cliente: o.cliente ?? cl.cliente, almacen, guardia, limpiezas, sincronizador });
  return { control, almacen, mem, cl, guardia, limpiezas, sincronizador };
}

const esperar = () => new Promise((r) => setTimeout(r, 0));

describe('cargar', () => {
  it('con sesión y parroquia guardadas, y un cliente que nunca responde, llega a lista (Review Focus 1)', async () => {
    const nunca = (() => new Promise<Response>(() => {})) as unknown as typeof fetch;
    const cliente = crearClienteSupabase({ url: 'https://ref.supabase.co', clavePublica: 'sb_publishable_FALSA_DE_PRUEBA', fetch: nunca });
    const { control, almacen } = armar({ cliente });
    await guardarTodo(almacen, SESION, A);
    await control.cargar();
    expect(control.tienda.obtener()).toMatchObject({ fase: 'lista', parroquia: A, cuenta: CUENTA });
    expect(control.sesion.actual()).toEqual(SESION);
  });

  it('sin sesión va a entrar', async () => {
    const { control } = armar();
    await control.cargar();
    expect(control.tienda.obtener().fase).toBe('entrar');
  });

  it('si el almacén falla, va a error-almacen', async () => {
    const { control, almacen } = armar();
    (almacen.leerSesion as jest.Mock).mockRejectedValueOnce(new Error('keystore'));
    await control.cargar();
    expect(control.tienda.obtener().fase).toBe('error-almacen');
  });

  it('con una sola parroquia en la lista guardada, la elige y la guarda', async () => {
    const { control, almacen } = armar();
    await almacen.guardarSesion(SESION);
    await almacen.guardarParroquias([B]);
    await control.cargar();
    await esperar();
    expect(control.tienda.obtener()).toMatchObject({ fase: 'lista', parroquia: B });
    expect(await almacen.leerParroquia()).toEqual(B);
  });
});

const TODO = { tipo: 'todo' };
const vecesTodo = (l: { limpiar: jest.Mock }) => l.limpiar.mock.calls.filter(([a]) => a?.tipo === 'todo').length;

describe('dueño al cargar', () => {
  it('con sesión de X y dueño Y limpia todo una vez y guarda X', async () => {
    const { control, almacen, limpiezas } = armar();
    await guardarTodo(almacen, SESION, A);
    await almacen.guardarDueno('u-otro');
    await control.cargar();
    expect(limpiezas.limpiar).toHaveBeenCalledWith(TODO);
    expect(vecesTodo(limpiezas)).toBe(1);
    expect(await almacen.leerDueno()).toBe('u-1');
  });

  it('con sesión de X y dueño X no limpia', async () => {
    const { control, almacen, limpiezas } = armar();
    await guardarTodo(almacen, SESION, A);
    await almacen.guardarDueno('u-1');
    await control.cargar();
    expect(vecesTodo(limpiezas)).toBe(0);
  });

  it('con sesión y sin dueño (celular actualizado) limpia una vez', async () => {
    const { control, almacen, limpiezas, mem } = armar();
    await guardarTodo(almacen, SESION, A);
    delete mem[LLAVES.dueno];
    await control.cargar();
    await control.cargar();
    expect(vecesTodo(limpiezas)).toBe(1);
    expect(await almacen.leerDueno()).toBe('u-1');
  });

  it('sin sesión no limpia ni guarda dueño', async () => {
    const { control, almacen, limpiezas } = armar();
    await control.cargar();
    expect(vecesTodo(limpiezas)).toBe(0);
    expect(almacen.guardarDueno).not.toHaveBeenCalled();
  });

  it('si leer el dueño rechaza, se toma como distinto', async () => {
    const { control, almacen, limpiezas } = armar();
    await guardarTodo(almacen, SESION, A);
    (almacen.leerDueno as jest.Mock).mockRejectedValueOnce(new Error('keystore'));
    await control.cargar();
    expect(vecesTodo(limpiezas)).toBe(1);
  });
});

describe('dueño al entrar', () => {
  it('con otra cuenta limpia todo y guarda su dueño', async () => {
    const { control, almacen, limpiezas } = armar();
    await control.cargar();
    await almacen.guardarDueno('u-otro');
    await control.entrar('ana@x.com', 'clave-de-prueba-123');
    expect(vecesTodo(limpiezas)).toBe(1);
    expect(await almacen.leerDueno()).toBe('u-1');
  });

  it('con la misma cuenta del dueño no limpia', async () => {
    const { control, almacen, limpiezas } = armar();
    await control.cargar();
    await almacen.guardarDueno('u-1');
    await control.entrar('ana@x.com', 'clave-de-prueba-123');
    expect(vecesTodo(limpiezas)).toBe(0);
  });
});

describe('entrar', () => {
  it('con incorrectos devuelve el error y no guarda nada', async () => {
    const { almacen } = almacenEnMemoria();
    const cl = clienteFalso({ entrar: async () => ({ ok: false, error: { tipo: 'incorrectos' } }) });
    const control = crearControlSesion({
      cliente: cl.cliente,
      almacen,
      guardia: crearGuardia(),
      limpiezas: limpiezasFalsas(),
      sincronizador: crearSincronizador(),
    });
    await control.cargar();
    expect(await control.entrar('ana@x.com', 'clave-de-prueba-123')).toEqual({ error: { tipo: 'incorrectos' } });
    expect(almacen.guardarSesion).not.toHaveBeenCalled();
    expect(almacen.guardarCuenta).not.toHaveBeenCalled();
    expect(almacen.guardarParroquias).not.toHaveBeenCalled();
    expect(control.tienda.obtener().fase).toBe('entrar');
  });

  it('bien guarda la sesión, la cuenta y la lista, y la fase sale de entro', async () => {
    const { control, almacen, cl } = armar();
    await control.cargar();
    expect(await control.entrar('ana@x.com', 'clave-de-prueba-123')).toEqual({});
    expect(cl.mock.entrar).toHaveBeenCalledWith('ana@x.com', 'clave-de-prueba-123');
    expect(await almacen.leerSesion()).toEqual(SESION);
    expect(await almacen.leerCuenta()).toEqual(CUENTA);
    expect(await almacen.leerParroquias()).toEqual([A, B]);
    expect(control.tienda.obtener()).toMatchObject({ fase: 'elegir', cuenta: CUENTA, parroquias: [A, B] });
  });

  it('si no puede leer la lista, devuelve el error y no deja la sesión a medias', async () => {
    const { almacen } = almacenEnMemoria();
    const cl = clienteFalso({ parroquias: () => ({ ok: false, error: { tipo: 'sin-conexion' } }) });
    const control = crearControlSesion({
      cliente: cl.cliente,
      almacen,
      guardia: crearGuardia(),
      limpiezas: limpiezasFalsas(),
      sincronizador: crearSincronizador(),
    });
    await control.cargar();
    expect(await control.entrar('ana@x.com', 'clave-de-prueba-123')).toEqual({ error: { tipo: 'sin-conexion' } });
    expect(await almacen.leerSesion()).toBeNull();
    expect(control.sesion.actual()).toBeNull();
    expect(control.tienda.obtener().fase).toBe('entrar');
  });

  it('otra cuenta sin la parroquia guardada la limpia (Decisión 11)', async () => {
    const { almacen } = almacenEnMemoria();
    const C: ParroquiaApp = { id: 'p-9', slug: 'otra-mas', nombre: 'Otra' };
    await almacen.guardarParroquia(C);
    const cl = clienteFalso({ parroquias: () => ({ ok: true, valor: [B] }) });
    const limpiezas = limpiezasFalsas();
    const control = crearControlSesion({ cliente: cl.cliente, almacen, guardia: crearGuardia(), limpiezas, sincronizador: crearSincronizador() });
    await control.cargar();
    await control.entrar('otra@x.com', 'clave-de-prueba-123');
    await esperar();
    expect(limpiezas.limpiar).toHaveBeenCalledWith({ tipo: 'parroquia', parroquia: C });
    expect(control.tienda.obtener()).toMatchObject({ fase: 'lista', parroquia: B });
    expect(await almacen.leerParroquia()).toEqual(B);
  });
});

describe('elegir y cambiar', () => {
  it('elegir guarda la parroquia y va a lista', async () => {
    const { control, almacen } = armar();
    await control.cargar();
    await control.entrar('ana@x.com', 'clave-de-prueba-123');
    await control.elegir(B);
    expect(control.tienda.obtener()).toMatchObject({ fase: 'lista', parroquia: B });
    expect(await almacen.leerParroquia()).toEqual(B);
  });

  it('cambiarParroquia va a elegir, pero no en vivo', async () => {
    const { control, almacen, guardia } = armar();
    await guardarTodo(almacen, SESION, A);
    await control.cargar();
    guardia.fijar(true);
    control.cambiarParroquia();
    expect(control.tienda.obtener().fase).toBe('lista');
    guardia.fijar(false);
    control.cambiarParroquia();
    expect(control.tienda.obtener().fase).toBe('elegir');
  });
});

describe('revisar', () => {
  it('se registra como la tarea acceso de abrir', async () => {
    const { control, almacen, sincronizador } = armar();
    await guardarTodo(almacen, SESION, A);
    await control.cargar();
    const r = await sincronizador.sincronizar('abrir', {
      parroquia: A,
      sesion: control.sesion,
      cliente: control.cliente,
      enVivo: () => false,
      sigueElegida: () => true,
    });
    expect(r).toEqual({ acceso: 'ok' });
  });

  it('si la parroquia ya no está, va a sin-acceso, limpia su copia y la olvida', async () => {
    const { almacen } = almacenEnMemoria();
    await guardarTodo(almacen, SESION, A);
    const cl = clienteFalso({ parroquias: () => ({ ok: true, valor: [B] }) });
    const limpiezas = limpiezasFalsas();
    const control = crearControlSesion({ cliente: cl.cliente, almacen, guardia: crearGuardia(), limpiezas, sincronizador: crearSincronizador() });
    await control.cargar();
    await control.revisar();
    expect(control.tienda.obtener()).toMatchObject({ fase: 'sin-acceso', perdida: A, parroquia: null });
    expect(limpiezas.limpiar).toHaveBeenCalledWith({ tipo: 'parroquia', parroquia: A });
    expect(almacen.borrarParroquia).toHaveBeenCalled();
    expect(await almacen.leerParroquia()).toBeNull();
    expect(await almacen.leerParroquias()).toEqual([B]);
  });

  it('en vivo no limpia nada hasta terminar', async () => {
    const { almacen } = almacenEnMemoria();
    await guardarTodo(almacen, SESION, A);
    const cl = clienteFalso({ parroquias: () => ({ ok: true, valor: [B] }) });
    const limpiezas = limpiezasFalsas();
    const guardia = crearGuardia();
    const control = crearControlSesion({ cliente: cl.cliente, almacen, guardia, limpiezas, sincronizador: crearSincronizador() });
    await control.cargar();
    guardia.fijar(true);
    await control.revisar();
    expect(control.tienda.obtener()).toMatchObject({ fase: 'lista', parroquia: A });
    expect(limpiezas.limpiar).not.toHaveBeenCalled();
    expect(almacen.borrarParroquia).not.toHaveBeenCalled();
    guardia.fijar(false);
    await esperar();
    expect(control.tienda.obtener()).toMatchObject({ fase: 'sin-acceso', perdida: A, pendiente: null });
    expect(limpiezas.limpiar).toHaveBeenCalledWith({ tipo: 'parroquia', parroquia: A });
    expect(await almacen.leerParroquia()).toBeNull();
  });

  it('con el nombre cambiado, guarda el nombre nuevo', async () => {
    const { almacen } = almacenEnMemoria();
    await guardarTodo(almacen, SESION, A);
    const A2 = { ...A, nombre: 'Nuevo nombre' };
    const cl = clienteFalso({ parroquias: () => ({ ok: true, valor: [A2] }) });
    const control = crearControlSesion({ cliente: cl.cliente, almacen, guardia: crearGuardia(), limpiezas: limpiezasFalsas(), sincronizador: crearSincronizador() });
    await control.cargar();
    await control.revisar();
    await esperar();
    expect(control.tienda.obtener().parroquia).toEqual(A2);
    expect(await almacen.leerParroquia()).toEqual(A2);
  });

  it('sin red no cambia nada', async () => {
    const { almacen } = almacenEnMemoria();
    await guardarTodo(almacen, SESION, A);
    const cl = clienteFalso({ parroquias: () => ({ ok: false, error: { tipo: 'sin-conexion' } }) });
    const control = crearControlSesion({ cliente: cl.cliente, almacen, guardia: crearGuardia(), limpiezas: limpiezasFalsas(), sincronizador: crearSincronizador() });
    await control.cargar();
    const antes = control.tienda.obtener();
    await control.revisar();
    expect(control.tienda.obtener()).toBe(antes);
  });
});

describe('sesión inválida', () => {
  it('alInvalidarse despacha sesion-invalida: fuera del vivo va a entrar con el aviso', async () => {
    const { almacen } = almacenEnMemoria();
    await guardarTodo(almacen, { ...SESION, expiraEn: AHORA_S - 10 }, A);
    const cl = clienteFalso({ renovar: async () => ({ ok: false, error: { tipo: 'sesion-invalida' } }) });
    const control = crearControlSesion({ cliente: cl.cliente, almacen, guardia: crearGuardia(), limpiezas: limpiezasFalsas(), sincronizador: crearSincronizador() });
    await control.cargar();
    await control.revisar();
    expect(control.tienda.obtener()).toMatchObject({ fase: 'entrar', aviso: AVISO_SESION_VENCIDA, parroquia: A });
    expect(await almacen.leerSesion()).toBeNull();
    expect(await almacen.leerParroquia()).toEqual(A);
  });

  it('en vivo queda pendiente y guardia.alTerminar lo aplica', async () => {
    const { almacen } = almacenEnMemoria();
    await guardarTodo(almacen, { ...SESION, expiraEn: AHORA_S - 10 }, A);
    const cl = clienteFalso({ renovar: async () => ({ ok: false, error: { tipo: 'sesion-invalida' } }) });
    const guardia = crearGuardia();
    const control = crearControlSesion({ cliente: cl.cliente, almacen, guardia, limpiezas: limpiezasFalsas(), sincronizador: crearSincronizador() });
    await control.cargar();
    guardia.fijar(true);
    await control.revisar();
    expect(control.tienda.obtener()).toMatchObject({ fase: 'lista', pendiente: { tipo: 'sesion-invalida', enVivo: true } });
    guardia.fijar(false);
    expect(control.tienda.obtener()).toMatchObject({ fase: 'entrar', aviso: AVISO_SESION_VENCIDA, pendiente: null });
  });
});

describe('cerrarSesion', () => {
  it('en vivo devuelve en-vivo y no borra nada', async () => {
    const { control, almacen, guardia, limpiezas } = armar();
    await guardarTodo(almacen, SESION, A);
    await control.cargar();
    guardia.fijar(true);
    expect(await control.cerrarSesion()).toEqual({ error: 'en-vivo' });
    expect(limpiezas.limpiar).not.toHaveBeenCalled();
    expect(almacen.borrarTodo).not.toHaveBeenCalled();
    expect(control.tienda.obtener().fase).toBe('lista');
  });

  it('fuera del vivo limpia todo, borra el almacén y va a entrar', async () => {
    const { control, almacen, mem, limpiezas } = armar();
    await guardarTodo(almacen, SESION, A);
    mem.parroquia_ajustes_v1 = '{"clave":"FB-123-abc"}';
    await control.cargar();
    expect(await control.cerrarSesion()).toEqual({});
    expect(limpiezas.limpiar).toHaveBeenCalledWith({ tipo: 'todo' });
    expect(almacen.borrarTodo).toHaveBeenCalled();
    expect(control.tienda.obtener().fase).toBe('entrar');
    expect(control.sesion.actual()).toBeNull();
    expect(Object.keys(mem)).toEqual(['parroquia_ajustes_v1']);
    for (const k of Object.values(LLAVES)) expect(mem[k]).toBeUndefined();
  });
});

describe('controlSesion de la app', () => {
  it('existe y arranca cargando', () => {
    expect(controlSesion.tienda.obtener().fase).toBe('cargando');
  });

  it('sin configuración de compilación, cargar va a error-almacen', async () => {
    // En jest no hay EXPO_PUBLIC_* (el modo test no lee .env.local).
    await controlSesion.cargar();
    expect(controlSesion.tienda.obtener().fase).toBe('error-almacen');
  });
});
