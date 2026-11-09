// proxy.ts: Supabase caído no se confunde con una sesión vencida.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuthApiError, AuthRetryableFetchError, AuthSessionMissingError, AuthUnknownError } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { esFalloDeConexion, MENSAJE_SIN_CONEXION, proxy } from '../../proxy';

/** Una cookie de sesión como la que escribe @supabase/ssr (prefijo base64-), con un token que no vence pronto. */
function cookieDeSesion(): string {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const ahora = Math.floor(Date.now() / 1000);
  const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: '00000000-0000-0000-0000-000000000001', exp: ahora + 3600, role: 'authenticated' })}.firma`;
  const sesion = {
    access_token: jwt,
    refresh_token: 'refresco',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: ahora + 3600,
    user: { id: '00000000-0000-0000-0000-000000000001', aud: 'authenticated', role: 'authenticated' },
  };
  // storageKey por defecto: sb-<primer trozo del host>-auth-token → host 127.0.0.1 → «sb-127-auth-token».
  return `sb-127-auth-token=base64-${Buffer.from(JSON.stringify(sesion)).toString('base64url')}`;
}

const pedir = (ruta: string, conSesion = true) =>
  new NextRequest(new URL(ruta, 'http://127.0.0.1:3000'), { headers: conSesion ? { cookie: cookieDeSesion() } : {} });

let caido: Server; // Supabase «en pausa»: responde 503 a todo
let urlCaido = '';
beforeAll(async () => {
  caido = createServer((_q, r) => {
    r.statusCode = 503;
    r.end('Service Unavailable');
  });
  await new Promise<void>((ok) => caido.listen(0, '127.0.0.1', () => ok()));
  urlCaido = `http://127.0.0.1:${(caido.address() as AddressInfo).port}`;
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'clave-publicable-de-prueba';
});
afterAll(() => new Promise((ok) => caido.close(ok)));

describe('esFalloDeConexion', () => {
  it('red caída, 5xx y respuesta ilegible son fallo de conexión; sin sesión o token inválido, no', () => {
    expect(esFalloDeConexion(new AuthRetryableFetchError('fetch failed', 0))).toBe(true);
    expect(esFalloDeConexion(new AuthRetryableFetchError('Service Unavailable', 503))).toBe(true);
    expect(esFalloDeConexion(new AuthUnknownError('Unexpected token <', null))).toBe(true);
    expect(esFalloDeConexion(new AuthSessionMissingError())).toBe(false);
    expect(esFalloDeConexion(new AuthApiError('invalid JWT', 401, 'bad_jwt'))).toBe(false);
    expect(esFalloDeConexion(null)).toBe(false);
  });
});

describe('proxy con Supabase sin responder', () => {
  for (const [nombre, url] of [
    ['puerto cerrado', () => 'http://127.0.0.1:1'],
    ['en pausa (503)', () => urlCaido],
  ] as const) {
    it(`${nombre}: la API responde 503 en JSON con el mensaje`, async () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = url();
      const r = await proxy(pedir('/editor/api/una-parroquia/borrador'));
      expect(r.status).toBe(503);
      expect(await r.json()).toEqual({ error: MENSAJE_SIN_CONEXION });
    });

    it(`${nombre}: una página muestra el mensaje con 503 y no redirige a entrar`, async () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = url();
      const r = await proxy(pedir('/editor/p/una-parroquia'));
      expect(r.status).toBe(503);
      expect(r.headers.get('location')).toBeNull();
      expect(r.headers.get('content-type')).toContain('text/html');
      const html = await r.text();
      expect(html).toContain(MENSAJE_SIN_CONEXION);
      expect(html).toContain('lang="es"');
      expect(html).toContain('role="alert"');
    });
  }

  it('sin cookie de sesión sigue siendo «sesión vencida»: 401 en la API y redirección en las páginas', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:1';
    const api = await proxy(pedir('/editor/api/una-parroquia/borrador', false));
    expect(api.status).toBe(401);
    const pagina = await proxy(pedir('/editor/p/una-parroquia', false));
    expect(pagina.status).toBe(307);
    expect(new URL(pagina.headers.get('location')!).pathname).toBe('/editor/entrar');
  });

  it('las páginas públicas (entrar) no se bloquean aunque Supabase no responda', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:1';
    const r = await proxy(pedir('/editor/entrar'));
    expect(r.status).toBe(200);
  });
});
