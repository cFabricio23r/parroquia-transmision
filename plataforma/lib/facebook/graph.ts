// Verificado contra la API el 2026-11-27 (spec «Verificado contra la API», Tarea 0): estados de `status`, crearVivo sin
// `privacy`, `crossposted_broadcasts{id,status,from{id}}`, `permalink_url` relativo, `end_live_video`, tokens de página
// para estado y terminar, y el plazo de crear (3 a 11,5 s).
// NO VERIFICADO (se confirma al probar con Facebook, marcado en cada método):
//  - cambiarCodigo / alargar: GET oauth/access_token (client_id, client_secret, redirect_uri, code; grant_type=fb_exchange_token).
//  - paginas: GET me/accounts con fields=id,name,access_token,followers_count y limit=100 (sin paginar).
//  - activarCrosspost: POST <vivo> con crossposting_actions = JSON [{page_id, action:'enable_crossposting_and_create_post'}].
//  - handshake / permiteLive: ruta <pagina>/crosspost_whitelisted_pages; el handshake es un POST page_id en ambos sentidos.
// Cliente de la Graph API de Facebook detrás de una interfaz.
// El token (de usuario o de página) va en el cuerpo de los POST y como parámetro de los GET.
// Nunca se registra ni se copia a un error: los errores solo llevan tipo y códigos numéricos.

export function versionGraph(entorno: Record<string, string | undefined> = process.env): string {
  const v = entorno.FACEBOOK_VERSION_GRAPH;
  if (!v || !/^v\d+\.\d+$/.test(v)) throw new Error('Falta FACEBOOK_VERSION_GRAPH');
  return v;
}

export type ErrorGraph = {
  tipo: 'token' | 'requisitos' | 'red' | 'otro';
  codigo?: number;
  subcodigo?: number;
};
export type ResultadoGraph<T> = { ok: true; valor: T } | { ok: false; error: ErrorGraph };
export interface PaginaGraph {
  id: string;
  nombre: string;
  token: string;
  seguidores: number | null;
}
export interface EstadosVivoGraph {
  activo: readonly string[];
  terminado: readonly string[];
}

// Verificado (2026-11-27): LIVE desde que se crea; PROCESSING, VOD y LIVE_STOPPED después. Cualquier otro valor es «otro».
export const ESTADOS_VIVO_GRAPH: EstadosVivoGraph = {
  activo: ['LIVE'],
  terminado: ['PROCESSING', 'VOD', 'LIVE_STOPPED'],
};

export interface GraphFacebook {
  cambiarCodigo(codigo: string, redirect: string): Promise<ResultadoGraph<string>>;
  alargar(tokenCorto: string): Promise<ResultadoGraph<string>>;
  yo(token: string): Promise<ResultadoGraph<{ id: string; nombre: string }>>;
  paginas(tokenUsuario: string): Promise<ResultadoGraph<PaginaGraph[]>>;
  crearVivo(
    pageId: string,
    tokenPagina: string,
    titulo: string,
  ): Promise<ResultadoGraph<{ vivoId: string; url: string }>>;
  activarCrosspost(vivoId: string, tokenPagina: string, pageIds: string[]): Promise<ResultadoGraph<void>>;
  /** Los ids de las PÁGINAS (`from.id`) donde el vivo ya se publicó por crosspost; no los ids de los broadcasts. */
  crosspostHechos(vivoId: string, tokenPagina: string): Promise<ResultadoGraph<string[]>>;
  estadoVivo(vivoId: string, tokenPagina: string): Promise<ResultadoGraph<'activo' | 'terminado'>>;
  urlDeVivo(vivoId: string, tokenPagina: string): Promise<ResultadoGraph<string>>;
  /** El enlace público del vivo, siempre absoluto. */
  enlaceDeVivo(vivoId: string, tokenPagina: string): Promise<ResultadoGraph<string>>;
  terminarVivo(vivoId: string, tokenPagina: string): Promise<ResultadoGraph<void>>;
  handshake(
    origen: { id: string; token: string },
    destino: { id: string; token: string },
  ): Promise<ResultadoGraph<void>>;
  permiteLive(origen: { id: string; token: string }, destinoId: string): Promise<ResultadoGraph<boolean>>;
}

const BASE = 'https://graph.facebook.com';
const OTRO: ResultadoGraph<never> = { ok: false, error: { tipo: 'otro' } };

function errorDe(json: unknown): ErrorGraph {
  const e = (json as { error?: { code?: unknown; error_subcode?: unknown } } | null)?.error;
  const codigo = typeof e?.code === 'number' ? e.code : undefined;
  const subcodigo = typeof e?.error_subcode === 'number' ? e.error_subcode : undefined;
  let tipo: ErrorGraph['tipo'] = 'otro';
  if (codigo === 190) tipo = 'token';
  else if (codigo === 200 && (subcodigo === 1363144 || subcodigo === 1363120)) tipo = 'requisitos';
  const err: ErrorGraph = { tipo };
  if (codigo !== undefined) err.codigo = codigo;
  if (subcodigo !== undefined) err.subcodigo = subcodigo;
  return err;
}

/** Plazo de cada llamada a Graph: pasado esto, la llamada cuenta como `tipo:'red'`. Crear un vivo tardó hasta 11,5 s. */
export const PLAZO_GRAPH_MS = 12_000;

const ORIGEN_FACEBOOK = 'https://www.facebook.com';

export function crearGraph(o: {
  appId: string;
  secreto: string;
  fetch?: typeof fetch;
  version?: string;
  estados?: EstadosVivoGraph;
  plazoMs?: number;
}): GraphFacebook {
  const version = o.version ?? versionGraph();
  const estados = o.estados ?? ESTADOS_VIVO_GRAPH;
  const f = o.fetch ?? fetch;
  const url = (ruta: string) => `${BASE}/${version}/${ruta}`;

  async function llamar(
    metodo: 'GET' | 'POST',
    ruta: string,
    params: Record<string, string>,
  ): Promise<ResultadoGraph<Record<string, unknown>>> {
    const plazo = o.plazoMs ?? PLAZO_GRAPH_MS;
    const senal = AbortSignal.timeout(plazo);
    let reloj: ReturnType<typeof setTimeout> | undefined;
    // Un solo plazo para la llamada entera (pedido y lectura). El error de aborto o de red nunca sale ni se registra.
    const vencido = new Promise<'vencido'>((ok) => {
      reloj = setTimeout(() => ok('vencido'), plazo);
    });
    const pedir = async (): Promise<{ res: Response; json: unknown } | 'otro'> => {
      const res =
        metodo === 'GET'
          ? await f(`${url(ruta)}?${new URLSearchParams(params).toString()}`, { signal: senal })
          : await f(url(ruta), {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams(params).toString(),
              signal: senal,
            });
      try {
        return { res, json: await res.json() };
      } catch {
        return 'otro';
      }
    };
    let salida: { res: Response; json: unknown } | 'otro' | 'vencido';
    try {
      salida = await Promise.race([pedir(), vencido]);
    } catch {
      return { ok: false, error: { tipo: 'red' } };
    } finally {
      clearTimeout(reloj);
    }
    if (salida === 'vencido') return { ok: false, error: { tipo: 'red' } };
    if (salida === 'otro') return OTRO;
    const { res, json } = salida;
    if (!res.ok || (json as { error?: unknown } | null)?.error) return { ok: false, error: errorDe(json) };
    if (typeof json !== 'object' || json === null) return OTRO;
    return { ok: true, valor: json as Record<string, unknown> };
  }

  const texto = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);
  const vacio = (r: ResultadoGraph<unknown>): ResultadoGraph<void> =>
    r.ok ? { ok: true, valor: undefined } : r;

  return {
    // NO VERIFICADO (Tarea 0 Paso 2): GET oauth/access_token con client_id, client_secret, redirect_uri y code.
    async cambiarCodigo(codigo, redirect) {
      const r = await llamar('GET', 'oauth/access_token', {
        client_id: o.appId,
        client_secret: o.secreto,
        redirect_uri: redirect,
        code: codigo,
      });
      if (!r.ok) return r;
      const t = texto(r.valor.access_token);
      return t ? { ok: true, valor: t } : OTRO;
    },

    // NO VERIFICADO (Tarea 0 Paso 2): GET oauth/access_token con grant_type=fb_exchange_token.
    async alargar(tokenCorto) {
      const r = await llamar('GET', 'oauth/access_token', {
        grant_type: 'fb_exchange_token',
        client_id: o.appId,
        client_secret: o.secreto,
        fb_exchange_token: tokenCorto,
      });
      if (!r.ok) return r;
      const t = texto(r.valor.access_token);
      return t ? { ok: true, valor: t } : OTRO;
    },

    async yo(token) {
      const r = await llamar('GET', 'me', { fields: 'id,name', access_token: token });
      if (!r.ok) return r;
      const id = texto(r.valor.id);
      return id ? { ok: true, valor: { id, nombre: texto(r.valor.name) ?? '' } } : OTRO;
    },

    // NO VERIFICADO (Tarea 0 Paso 2): GET me/accounts con fields id,name,access_token,followers_count; sin paginar.
    async paginas(tokenUsuario) {
      const r = await llamar('GET', 'me/accounts', {
        fields: 'id,name,access_token,followers_count',
        limit: '100',
        access_token: tokenUsuario,
      });
      if (!r.ok) return r;
      const data = Array.isArray(r.valor.data) ? (r.valor.data as Array<Record<string, unknown>>) : [];
      const valor: PaginaGraph[] = [];
      for (const p of data) {
        const id = texto(p.id);
        const token = texto(p.access_token);
        if (!id || !token) continue;
        valor.push({
          id,
          nombre: texto(p.name) ?? '',
          token,
          seguidores: typeof p.followers_count === 'number' ? p.followers_count : null,
        });
      }
      return { ok: true, valor };
    },

    async crearVivo(pageId, tokenPagina, titulo) {
      // Sin `privacy` el vivo sale público (verificado): no se manda.
      const r = await llamar('POST', `${pageId}/live_videos`, {
        status: 'LIVE_NOW',
        title: titulo,
        access_token: tokenPagina,
      });
      if (!r.ok) return r;
      const vivoId = texto(r.valor.id);
      const urlStream = texto(r.valor.secure_stream_url); // nunca stream_url
      return vivoId && urlStream ? { ok: true, valor: { vivoId, url: urlStream } } : OTRO;
    },

    // NO VERIFICADO (Tarea 0 Paso 2): forma y nombre de acción de crossposting_actions.
    async activarCrosspost(vivoId, tokenPagina, pageIds) {
      const acciones = pageIds.map((page_id) => ({
        page_id,
        action: 'enable_crossposting_and_create_post',
      }));
      return vacio(
        await llamar('POST', vivoId, {
          crossposting_actions: JSON.stringify(acciones),
          access_token: tokenPagina,
        }),
      );
    },

    // Verificado: {crossposted_broadcasts:{data:[{id,status,from:{id}}]}}; `id` es el del broadcast y la página
    // destino es `from.id`. Si nada se publicó, el campo no viene.
    async crosspostHechos(vivoId, tokenPagina) {
      const r = await llamar('GET', vivoId, {
        fields: 'crossposted_broadcasts{id,status,from{id}}',
        access_token: tokenPagina,
      });
      if (!r.ok) return r;
      const cb = r.valor.crossposted_broadcasts as { data?: unknown } | undefined;
      const data = Array.isArray(cb?.data) ? (cb.data as Array<Record<string, unknown>>) : [];
      const ids = data.map((d) => texto((d?.from as { id?: unknown } | undefined)?.id)).filter((x): x is string => x !== null);
      return { ok: true, valor: ids };
    },

    // Verificado: `status` con los valores de ESTADOS_VIVO_GRAPH; con el token de la PÁGINA (con el de la cuenta, error 100/33).
    async estadoVivo(vivoId, tokenPagina) {
      const r = await llamar('GET', vivoId, { fields: 'status', access_token: tokenPagina });
      if (!r.ok) return r;
      const s = texto(r.valor.status);
      if (s && estados.activo.includes(s)) return { ok: true, valor: 'activo' };
      if (s && estados.terminado.includes(s)) return { ok: true, valor: 'terminado' };
      return OTRO;
    },

    async urlDeVivo(vivoId, tokenPagina) {
      const r = await llamar('GET', vivoId, {
        fields: 'secure_stream_url',
        access_token: tokenPagina,
      });
      if (!r.ok) return r;
      const u = texto(r.valor.secure_stream_url);
      return u ? { ok: true, valor: u } : OTRO;
    },

    // Verificado: `permalink_url` viene relativo («/<id>/videos/<id>»); se le antepone el origen de Facebook.
    async enlaceDeVivo(vivoId, tokenPagina) {
      const r = await llamar('GET', vivoId, { fields: 'permalink_url', access_token: tokenPagina });
      if (!r.ok) return r;
      const u = texto(r.valor.permalink_url);
      if (!u) return OTRO;
      return { ok: true, valor: u.startsWith('/') ? `${ORIGEN_FACEBOOK}${u}` : u };
    },

    // Verificado: POST end_live_video=true con el token de la PÁGINA; repetirlo sobre uno terminado no da error.
    async terminarVivo(vivoId, tokenPagina) {
      return vacio(await llamar('POST', vivoId, { end_live_video: 'true', access_token: tokenPagina }));
    },

    // NO VERIFICADO (Tarea 0 Paso 2): ruta crosspost_whitelisted_pages y dirección del handshake (ambos sentidos).
    async handshake(origen, destino) {
      const a = await llamar('POST', `${origen.id}/crosspost_whitelisted_pages`, {
        page_id: destino.id,
        access_token: origen.token,
      });
      if (!a.ok) return a;
      return vacio(
        await llamar('POST', `${destino.id}/crosspost_whitelisted_pages`, {
          page_id: origen.id,
          access_token: destino.token,
        }),
      );
    },

    // NO VERIFICADO (Tarea 0 Paso 2): GET crosspost_whitelisted_pages con fields=id.
    async permiteLive(origen, destinoId) {
      const r = await llamar('GET', `${origen.id}/crosspost_whitelisted_pages`, {
        fields: 'id',
        access_token: origen.token,
      });
      if (!r.ok) return r;
      const data = Array.isArray(r.valor.data) ? (r.valor.data as Array<Record<string, unknown>>) : [];
      return { ok: true, valor: data.some((d) => d?.id === destinoId) };
    },
  };
}

export function partirUrlStream(url: string): { servidor: string; clave: string } | null {
  if (!url.startsWith('rtmps://')) return null;
  const marca = '/rtmp/';
  const i = url.indexOf(marca);
  if (i === -1) return null;
  const clave = url.slice(i + marca.length);
  if (!clave) return null;
  return { servidor: url.slice(0, i + marca.length), clave };
}
