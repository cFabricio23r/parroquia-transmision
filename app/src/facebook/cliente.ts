/**
 * Cliente de Facebook en vivo a través de la plataforma.
 * La app nunca habla con Facebook ni ve su token: pide a la plataforma que cree el vivo y
 * transmite a la URL que devuelve.
 *
 * Nada de este archivo escribe en `console.*` ni pone la clave de transmisión o el token en un resultado de error.
 */
import { PLAZO_POR_DEFECTO_MS, leerJson, pedirConPlazo, type Resultado as ResultadoSupabase } from '../supabase/cliente';
import type { SesionApp } from '../sesion/sesion';
import { esSlugValido, normalizarOrigen } from '../plataforma/direcciones';

export type ErrorFacebook = {
  tipo: 'sin-conexion' | 'sin-facebook' | 'reconectar' | 'requisitos' | 'facebook' | 'muchos' | 'sesion' | 'otro';
};
export type ResultadoFacebook<T> = { ok: true; valor: T } | { ok: false; error: ErrorFacebook };

export interface Destinos {
  conectado: boolean;
  principal: { id: string; nombre: string } | null;
  extras: { id: string; nombre: string; porDefecto: boolean }[];
}
export interface VivoCreado {
  id: string;
  servidor: string;
  clave: string;
  principal: { id: string; nombre: string };
  extras: { id: string; nombre: string }[];
}
export interface EstadoVivo {
  estado: 'activo' | 'terminado';
  extras: { id: string; nombre: string; salio: boolean }[];
}

export interface ClienteFacebook {
  destinos(): Promise<ResultadoFacebook<Destinos>>;
  crear(extras: string[], titulo: string): Promise<ResultadoFacebook<VivoCreado>>;
  estado(id: string): Promise<ResultadoFacebook<EstadoVivo>>;
  terminar(id: string): Promise<ResultadoFacebook<void>>;
}

export const PLAZO_CREAR_MS = 8_000;

const CODIGOS: readonly ErrorFacebook['tipo'][] = ['sin-facebook', 'reconectar', 'requisitos', 'facebook', 'muchos'];

const OTRO: ResultadoFacebook<never> = { ok: false, error: { tipo: 'otro' } };

function esObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function esTexto(v: unknown): v is string {
  return typeof v === 'string' && v !== '';
}
function esPagina(v: unknown): v is { id: string; nombre: string } {
  return esObjeto(v) && esTexto(v.id) && typeof v.nombre === 'string';
}
function lista<T>(v: unknown, ok: (x: unknown) => x is T): T[] | null {
  return Array.isArray(v) && v.every(ok) ? (v as T[]) : null;
}

function leerDestinos(c: unknown): Destinos | null {
  if (!esObjeto(c) || typeof c.conectado !== 'boolean') return null;
  if (c.principal !== null && !esPagina(c.principal)) return null;
  const extras = lista(c.extras, (x): x is { id: string; nombre: string; porDefecto: boolean } => esPagina(x) && typeof (x as Record<string, unknown>).porDefecto === 'boolean');
  if (!extras) return null;
  return {
    conectado: c.conectado,
    principal: c.principal === null ? null : { id: c.principal.id, nombre: c.principal.nombre },
    extras: extras.map((e) => ({ id: e.id, nombre: e.nombre, porDefecto: e.porDefecto })),
  };
}

function leerVivo(c: unknown): VivoCreado | null {
  if (!esObjeto(c) || !esTexto(c.id) || !esTexto(c.clave)) return null;
  if (typeof c.servidor !== 'string' || !c.servidor.startsWith('rtmps://')) return null;
  if (!esPagina(c.principal)) return null;
  const extras = lista(c.extras, esPagina);
  if (!extras) return null;
  return {
    id: c.id,
    servidor: c.servidor,
    clave: c.clave,
    principal: { id: c.principal.id, nombre: c.principal.nombre },
    extras: extras.map((e) => ({ id: e.id, nombre: e.nombre })),
  };
}

function leerEstado(c: unknown): EstadoVivo | null {
  if (!esObjeto(c) || (c.estado !== 'activo' && c.estado !== 'terminado')) return null;
  const extras = lista(c.extras, (x): x is { id: string; nombre: string; salio: boolean } => esPagina(x) && typeof (x as Record<string, unknown>).salio === 'boolean');
  if (!extras) return null;
  return { estado: c.estado, extras: extras.map((e) => ({ id: e.id, nombre: e.nombre, salio: e.salio })) };
}

/**
 * Tope total (renovar sesion + pedido + reintento incluidos): a `ms` resuelve sin-conexion.
 * Un resultado tardio se descarta en silencio (sin console, sin dejar ver la clave).
 */
function conLimite<T>(p: Promise<ResultadoFacebook<T>>, ms: number): Promise<ResultadoFacebook<T>> {
  return new Promise((resolver) => {
    const t = setTimeout(() => resolver({ ok: false, error: { tipo: 'sin-conexion' } }), ms);
    p.then(
      (r) => {
        clearTimeout(t);
        resolver(r);
      },
      () => {
        clearTimeout(t);
        resolver({ ok: false, error: { tipo: 'otro' } });
      },
    );
  });
}

export function crearClienteFacebook(o: { origen: string; slug: string; sesion: SesionApp; fetch?: typeof fetch }): ClienteFacebook {
  const origen = normalizarOrigen(o.origen);
  if (!origen) throw new Error('Origen de la plataforma inválido.');
  if (!esSlugValido(o.slug)) throw new Error('slug inválido');
  const base = (resto: string) => origen + '/editor/api/' + o.slug + '/app/' + resto;
  const f = (...args: Parameters<typeof fetch>) => (o.fetch ?? fetch)(...args);

  /** Un pedido con sesión; `leer` convierte el cuerpo 2xx en el valor (null = cuerpo inválido). */
  async function pedir<T>(
    metodo: 'GET' | 'POST' | 'DELETE',
    resto: string,
    plazoMs: number,
    cuerpo: object | undefined,
    leer: (c: unknown) => T | null,
  ): Promise<ResultadoFacebook<T>> {
    const r = await o.sesion.conSesion<ResultadoFacebook<T>>(async (s) => {
      const headers: Record<string, string> = { Authorization: 'Bearer ' + s.accessToken };
      const init: RequestInit = { method: metodo, headers };
      if (cuerpo !== undefined) {
        headers['content-type'] = 'application/json';
        init.body = JSON.stringify(cuerpo);
      }
      const resp = await pedirConPlazo(f, base(resto), init, plazoMs);
      if (resp === null) return { ok: true, valor: { ok: false, error: { tipo: 'sin-conexion' } } };
      // 401: deja que conSesion renueve y reintente una vez.
      if (resp.estado === 401) return { ok: false, error: { tipo: 'sesion-invalida' } } as ResultadoSupabase<never>;
      const json = leerJson(resp.texto);
      if (resp.estado < 200 || resp.estado >= 300) {
        const codigo = esObjeto(json) ? json.codigo : undefined;
        const tipo = CODIGOS.find((c) => c === codigo);
        return { ok: true, valor: { ok: false, error: { tipo: tipo ?? 'otro' } } };
      }
      const valor = leer(json);
      return { ok: true, valor: valor === null ? OTRO : { ok: true, valor } };
    });
    if (r.ok) return r.valor;
    return { ok: false, error: { tipo: r.error.tipo === 'sin-conexion' ? 'sin-conexion' : 'sesion' } };
  }

  return {
    destinos: () => pedir('GET', 'facebook', PLAZO_POR_DEFECTO_MS, undefined, leerDestinos),
    crear: (extras, titulo) => conLimite(pedir('POST', 'vivo', PLAZO_CREAR_MS, { extras, titulo }, leerVivo), PLAZO_CREAR_MS),
    estado: (id) => pedir('GET', 'vivo/' + encodeURIComponent(id), PLAZO_POR_DEFECTO_MS, undefined, leerEstado),
    terminar: (id) => pedir<void>('DELETE', 'vivo/' + encodeURIComponent(id), PLAZO_POR_DEFECTO_MS, undefined, () => undefined),
  };
}
