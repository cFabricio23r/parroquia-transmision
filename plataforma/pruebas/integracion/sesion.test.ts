// Entrar, salir y recuperar la contraseña, contra el Supabase LOCAL.
// Las acciones se prueban como funciones puras con clientes y buzón inyectados.
import { beforeEach, describe, expect, it } from 'vitest';
import { clienteAnonimo, clienteServicio, crearUsuario, sufijo } from './ayudas';
import {
  MENSAJE_ENTRAR,
  MENSAJE_RECUPERAR,
  cambiarClave,
  confirmarRecuperacion,
  entrar,
  pedirRecuperacion,
} from '../../lib/sesion';
import type { Mensaje } from '../../lib/correo';

const SITIO = 'http://localhost:3000';
const servicio = clienteServicio();
let buzon: Mensaje[];
const enviar = async (m: Mensaje) => {
  buzon.push(m);
};
const deps = () => ({ servicio, enviar, sitioUrl: SITIO });

beforeEach(() => {
  buzon = [];
});

describe('entrar', () => {
  it('con clave buena da sesión; con mala, el mensaje único', async () => {
    const correo = `entrar-${sufijo()}@ejemplo.test`;
    await crearUsuario(correo, 'clave-buena-1');

    const bueno = clienteAnonimo();
    expect(await entrar(bueno, correo, 'clave-buena-1')).toEqual({});
    expect((await bueno.auth.getUser()).data.user?.email).toBe(correo);

    const malo = clienteAnonimo();
    const r1 = await entrar(malo, correo, 'otra-clave-99');
    const r2 = await entrar(clienteAnonimo(), `nadie-${sufijo()}@ejemplo.test`, 'otra-clave-99');
    expect(r1).toEqual({ error: 'El correo o la contraseña no coinciden' });
    expect(r2).toEqual(r1);
    expect((await malo.auth.getUser()).data.user).toBeNull();
  });
});

describe('pedirRecuperacion', () => {
  it('para un correo inexistente no envía nada y responde lo mismo', async () => {
    const existente = `rec-${sufijo()}@ejemplo.test`;
    await crearUsuario(existente, 'clave-buena-1');
    const rExiste = await pedirRecuperacion(deps(), existente);
    const rNo = await pedirRecuperacion(deps(), `fantasma-${sufijo()}@ejemplo.test`);
    expect(rNo).toEqual(rExiste);
    expect(rNo.mensaje).toBe('Si ese correo tiene cuenta, te llegó un enlace. Vence en 1 hora');
    expect(rNo.mensaje).toBe(MENSAJE_RECUPERAR);
    expect(buzon).toHaveLength(1);
    expect(buzon[0].para).toBe(existente);
  });

  it('dos veces en 60 s envía un solo correo', async () => {
    const correo = `rec2-${sufijo()}@ejemplo.test`;
    await crearUsuario(correo, 'clave-buena-1');
    const a = await pedirRecuperacion(deps(), correo);
    const b = await pedirRecuperacion(deps(), correo.toUpperCase());
    expect(b).toEqual(a);
    expect(buzon).toHaveLength(1);
  });

  it('no pasa de 5 envíos en 24 h', async () => {
    const correo = `rec3-${sufijo()}@ejemplo.test`;
    await crearUsuario(correo, 'clave-buena-1');
    const hace = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
    const filas = [120, 240, 360, 480, 600].map((m) => ({ correo, tipo: 'recuperar', en: hace(m) }));
    expect((await servicio.from('envios_correo').insert(filas)).error).toBeNull();
    await pedirRecuperacion(deps(), correo);
    expect(buzon).toHaveLength(0);
  });

  it('el enlace de recuperación permite cambiar la clave y la vieja deja de servir', async () => {
    const correo = `rec4-${sufijo()}@ejemplo.test`;
    await crearUsuario(correo, 'clave-vieja-1');
    await pedirRecuperacion(deps(), correo);
    expect(buzon).toHaveLength(1);
    const enlace = buzon[0].texto.match(/https?:\/\/\S+/)![0];
    const url = new URL(enlace);
    expect(url.origin + url.pathname).toBe(`${SITIO}/editor/auth/confirmar`);
    expect(url.searchParams.get('type')).toBe('recovery');
    const tokenHash = url.searchParams.get('token_hash')!;
    expect(tokenHash).toBeTruthy();

    const cliente = clienteAnonimo();
    expect(await confirmarRecuperacion(cliente, tokenHash, 'recovery')).toEqual({});
    expect(await cambiarClave(cliente, 'clave-nueva-2', 'clave-nueva-2')).toEqual({});

    expect((await clienteAnonimo().auth.signInWithPassword({ email: correo, password: 'clave-vieja-1' })).error).not.toBeNull();
    expect((await clienteAnonimo().auth.signInWithPassword({ email: correo, password: 'clave-nueva-2' })).error).toBeNull();

    // El enlace sirve una sola vez.
    const otro = await confirmarRecuperacion(clienteAnonimo(), tokenHash, 'recovery');
    expect(otro.error).toBeTruthy();
  });
});

describe('cambiarClave', () => {
  it('con 7 caracteres falla con «La contraseña necesita al menos 8 caracteres»', async () => {
    const u = await crearUsuario(`cc-${sufijo()}@ejemplo.test`, 'clave-buena-1');
    expect(await cambiarClave(u.cliente, '1234567', '1234567')).toEqual({
      error: 'La contraseña necesita al menos 8 caracteres',
    });
  });

  it('exige que las dos coincidan', async () => {
    const u = await crearUsuario(`cc2-${sufijo()}@ejemplo.test`, 'clave-buena-1');
    expect(await cambiarClave(u.cliente, 'abcdefgh1', 'abcdefgh2')).toEqual({ error: 'Las contraseñas no coinciden' });
  });
});
