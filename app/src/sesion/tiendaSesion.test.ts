import {
  AVISO_SESION_VENCIDA,
  ESTADO_SESION_INICIAL,
  crearTiendaSesion,
  reducirSesion,
  type EstadoSesion,
} from './tiendaSesion';
import type { Cuenta, ParroquiaApp } from './tipos';

const A: ParroquiaApp = { id: 'p-1', slug: 'ciudad-arce', nombre: 'Ciudad Arce' };
const B: ParroquiaApp = { id: 'p-2', slug: 'san-jose', nombre: 'San José' };
const CUENTA: Cuenta = { usuarioId: 'u-1', correo: 'ana@x.com', nombre: 'Ana', esAdmin: false };

const LISTA: EstadoSesion = { ...ESTADO_SESION_INICIAL, fase: 'lista', cuenta: CUENTA, parroquia: A, parroquias: [A, B] };

it('el aviso de sesión vencida es el de la plataforma', () => {
  expect(AVISO_SESION_VENCIDA).toBe('Tu sesión venció. Entra de nuevo');
});

it('el estado inicial está cargando y vacío', () => {
  expect(ESTADO_SESION_INICIAL).toEqual({
    fase: 'cargando',
    cuenta: null,
    parroquia: null,
    parroquias: [],
    perdida: null,
    aviso: null,
    pendiente: null,
  });
});

describe('cargada', () => {
  const cargar = (conSesion: boolean, parroquia: ParroquiaApp | null, parroquias: ParroquiaApp[]) =>
    reducirSesion(ESTADO_SESION_INICIAL, { tipo: 'cargada', conSesion, cuenta: CUENTA, parroquia, parroquias });

  it('sin sesión va a entrar', () => {
    expect(cargar(false, A, [A]).fase).toBe('entrar');
  });

  it('con sesión y parroquia va directo a lista (Decisión 10)', () => {
    const e = cargar(true, A, []);
    expect(e.fase).toBe('lista');
    expect(e.parroquia).toEqual(A);
    expect(e.cuenta).toEqual(CUENTA);
  });

  it('con sesión, sin parroquia y una sola en la lista, va a lista con esa', () => {
    const e = cargar(true, null, [B]);
    expect(e.fase).toBe('lista');
    expect(e.parroquia).toEqual(B);
  });

  it('con sesión, sin parroquia y dos o ninguna en la lista, va a elegir', () => {
    expect(cargar(true, null, [A, B]).fase).toBe('elegir');
    expect(cargar(true, null, []).fase).toBe('elegir');
  });
});

describe('entro', () => {
  const desde: EstadoSesion = { ...ESTADO_SESION_INICIAL, fase: 'entrar', aviso: AVISO_SESION_VENCIDA };

  it('sin parroquias va a sin-parroquias', () => {
    const e = reducirSesion(desde, { tipo: 'entro', cuenta: CUENTA, parroquias: [] });
    expect(e.fase).toBe('sin-parroquias');
    expect(e.aviso).toBeNull();
  });

  it('con una va a lista con esa', () => {
    const e = reducirSesion(desde, { tipo: 'entro', cuenta: CUENTA, parroquias: [B] });
    expect(e).toMatchObject({ fase: 'lista', parroquia: B, cuenta: CUENTA, parroquias: [B], aviso: null });
  });

  it('con dos va a elegir', () => {
    const e = reducirSesion(desde, { tipo: 'entro', cuenta: CUENTA, parroquias: [A, B] });
    expect(e).toMatchObject({ fase: 'elegir', parroquia: null, parroquias: [A, B] });
  });

  it('si la parroquia guardada sigue en la lista, va a lista con esa (y su nombre de la lista)', () => {
    const A2 = { ...A, nombre: 'Ciudad Arce 2' };
    const e = reducirSesion({ ...desde, parroquia: A }, { tipo: 'entro', cuenta: CUENTA, parroquias: [B, A2] });
    expect(e).toMatchObject({ fase: 'lista', parroquia: A2 });
  });

  it('si la parroquia guardada no está, la deja y sigue como sin ella', () => {
    const e = reducirSesion({ ...desde, parroquia: A }, { tipo: 'entro', cuenta: CUENTA, parroquias: [B] });
    expect(e).toMatchObject({ fase: 'lista', parroquia: B });
  });
});

describe('eligio y cambiar', () => {
  it('eligio va a lista con esa', () => {
    const e = reducirSesion({ ...LISTA, fase: 'elegir', parroquia: null }, { tipo: 'eligio', parroquia: B });
    expect(e).toMatchObject({ fase: 'lista', parroquia: B, perdida: null });
  });

  it('desde sin-acceso, eligio limpia la perdida', () => {
    const e = reducirSesion({ ...LISTA, fase: 'sin-acceso', parroquia: null, perdida: A }, { tipo: 'eligio', parroquia: B });
    expect(e).toMatchObject({ fase: 'lista', parroquia: B, perdida: null });
  });

  it('cambiar desde lista va a elegir', () => {
    expect(reducirSesion(LISTA, { tipo: 'cambiar' }).fase).toBe('elegir');
  });

  it('cambiar fuera de lista no hace nada', () => {
    const e = { ...LISTA, fase: 'entrar' as const };
    expect(reducirSesion(e, { tipo: 'cambiar' })).toBe(e);
  });
});

describe('lista-revisada', () => {
  it('sin la elegida y fuera del vivo va a sin-acceso, con la perdida', () => {
    const e = reducirSesion(LISTA, { tipo: 'lista-revisada', parroquias: [B], enVivo: false });
    expect(e).toMatchObject({ fase: 'sin-acceso', perdida: A, parroquia: null, parroquias: [B] });
  });

  it('con la elegida con otro nombre, toma el nombre nuevo', () => {
    const A2 = { ...A, nombre: 'Nueva' };
    const e = reducirSesion(LISTA, { tipo: 'lista-revisada', parroquias: [A2, B], enVivo: false });
    expect(e).toMatchObject({ fase: 'lista', parroquia: A2 });
  });

  it('en vivo la fase sigue en lista y el evento queda pendiente; termino-transmision lo aplica', () => {
    const ev = { tipo: 'lista-revisada' as const, parroquias: [B], enVivo: true };
    const e = reducirSesion(LISTA, ev);
    expect(e).toMatchObject({ fase: 'lista', parroquia: A, pendiente: ev });
    const f = reducirSesion(e, { tipo: 'termino-transmision' });
    expect(f).toMatchObject({ fase: 'sin-acceso', perdida: A, parroquia: null, pendiente: null });
  });

  it('en elegir, con una sola, entra a esa; con ninguna, sin-parroquias', () => {
    const elegir: EstadoSesion = { ...LISTA, fase: 'elegir', parroquia: null, parroquias: [] };
    expect(reducirSesion(elegir, { tipo: 'lista-revisada', parroquias: [B], enVivo: false })).toMatchObject({
      fase: 'lista',
      parroquia: B,
    });
    expect(reducirSesion(elegir, { tipo: 'lista-revisada', parroquias: [], enVivo: false }).fase).toBe('sin-parroquias');
    expect(reducirSesion(elegir, { tipo: 'lista-revisada', parroquias: [A, B], enVivo: false })).toMatchObject({
      fase: 'elegir',
      parroquias: [A, B],
    });
  });

  it('termino-transmision sin pendiente no cambia nada', () => {
    expect(reducirSesion(LISTA, { tipo: 'termino-transmision' })).toBe(LISTA);
  });
});

describe('sesion-invalida', () => {
  it('fuera del vivo va a entrar con el aviso y conserva la parroquia', () => {
    const e = reducirSesion(LISTA, { tipo: 'sesion-invalida', enVivo: false });
    expect(e).toMatchObject({ fase: 'entrar', aviso: AVISO_SESION_VENCIDA, parroquia: A });
  });

  it('en vivo queda pendiente y se aplica al terminar', () => {
    const e = reducirSesion(LISTA, { tipo: 'sesion-invalida', enVivo: true });
    expect(e).toMatchObject({ fase: 'lista', pendiente: { tipo: 'sesion-invalida', enVivo: true } });
    expect(reducirSesion(e, { tipo: 'termino-transmision' })).toMatchObject({
      fase: 'entrar',
      aviso: AVISO_SESION_VENCIDA,
      parroquia: A,
      pendiente: null,
    });
  });

  it('una lista revisada en vivo no pisa una sesión inválida pendiente', () => {
    const e = reducirSesion(LISTA, { tipo: 'sesion-invalida', enVivo: true });
    const f = reducirSesion(e, { tipo: 'lista-revisada', parroquias: [B], enVivo: true });
    expect(f.pendiente).toEqual({ tipo: 'sesion-invalida', enVivo: true });
  });
});

describe('salio y error-almacen', () => {
  it('salio vuelve al inicial, en entrar', () => {
    expect(reducirSesion(LISTA, { tipo: 'salio' })).toEqual({ ...ESTADO_SESION_INICIAL, fase: 'entrar' });
  });

  it('error-almacen va a su fase', () => {
    expect(reducirSesion(ESTADO_SESION_INICIAL, { tipo: 'error-almacen' }).fase).toBe('error-almacen');
  });
});

describe('crearTiendaSesion', () => {
  it('aplica los eventos y avisa a los suscriptos solo si algo cambió', () => {
    const t = crearTiendaSesion();
    const cb = jest.fn();
    const quitar = t.suscribir(cb);
    t.despachar({ tipo: 'cargada', conSesion: false, cuenta: null, parroquia: null, parroquias: [] });
    expect(t.obtener().fase).toBe('entrar');
    expect(cb).toHaveBeenCalledTimes(1);
    t.despachar({ tipo: 'cambiar' });
    expect(cb).toHaveBeenCalledTimes(1);
    quitar();
    t.despachar({ tipo: 'error-almacen' });
    expect(cb).toHaveBeenCalledTimes(1);
  });
});
