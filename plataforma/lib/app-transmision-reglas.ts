// «App y transmisión» (etapa 3c): reglas puras, sin base ni Next. Las importa también el cliente.
// Son las mismas reglas que los check de la migración 20261114000011: así la base nunca rechaza una
// fila con la clave adentro (un error de la base podría traerla en `details`).

export type CalidadApp = '720p' | '1080p';
export type EstiloFinalApp = 'claro' | 'azul';

export interface AjustesAppEditor {
  servidor: string | null;
  calidadDefecto: CalidadApp;
  estiloFinal: EstiloFinalApp;
  actualizadoEn: string;
}

export interface EstadoAppTransmision {
  ajustes: AjustesAppEditor | null;
  clave: { guardadaEn: string } | null;
}

export type CampoApp = 'servidor' | 'calidadDefecto' | 'estiloFinal';
type ValorAjustes = Omit<AjustesAppEditor, 'actualizadoEn'>;

export const MENSAJE_SERVIDOR = 'El servidor debe empezar con rtmps://';
export const MENSAJE_CALIDAD = 'Elige 720p o 1080p.';
export const MENSAJE_ESTILO = 'Elige Claro o Azul.';
export const MENSAJE_CLAVE_VACIA = 'Pega la clave de transmisión.';
export const MENSAJE_CLAVE_ESPACIOS = 'La clave no puede tener espacios.';
export const MENSAJE_CLAVE_LARGA = 'La clave es demasiado larga.';

export const NOMBRES_CAMPOS_APP: Record<CampoApp, string> = {
  servidor: 'servidor',
  calidadDefecto: 'calidad por defecto',
  estiloFinal: 'pantalla final',
};

const MAX_SERVIDOR = 300;
const MAX_CLAVE = 200;
const RE_SERVIDOR = /^rtmps:\/\/\S+$/;

const esObjeto = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);

export function validarAjustesApp(
  entrada: unknown,
): { ok: true; valor: ValorAjustes } | { ok: false; errores: Partial<Record<CampoApp, string>> } {
  if (!esObjeto(entrada)) return { ok: false, errores: { servidor: MENSAJE_SERVIDOR } };
  const errores: Partial<Record<CampoApp, string>> = {};
  const crudo = typeof entrada.servidor === 'string' ? entrada.servidor.trim() : entrada.servidor == null ? '' : null;
  let servidor: string | null = null;
  if (crudo === null) errores.servidor = MENSAJE_SERVIDOR;
  else if (crudo !== '') {
    if (!RE_SERVIDOR.test(crudo) || crudo.length > MAX_SERVIDOR) errores.servidor = MENSAJE_SERVIDOR;
    else servidor = crudo;
  }
  const calidad = entrada.calidadDefecto;
  if (calidad !== '720p' && calidad !== '1080p') errores.calidadDefecto = MENSAJE_CALIDAD;
  const estilo = entrada.estiloFinal;
  if (estilo !== 'claro' && estilo !== 'azul') errores.estiloFinal = MENSAJE_ESTILO;
  if (Object.keys(errores).length) return { ok: false, errores };
  return { ok: true, valor: { servidor, calidadDefecto: calidad as CalidadApp, estiloFinal: estilo as EstiloFinalApp } };
}

/** Nunca devuelve la clave dentro de un error. */
export function validarClave(entrada: unknown): { ok: true; clave: string } | { ok: false; error: string } {
  const crudo = esObjeto(entrada) && typeof entrada.clave === 'string' ? entrada.clave.trim() : '';
  if (!crudo) return { ok: false, error: MENSAJE_CLAVE_VACIA };
  if (/\s/.test(crudo)) return { ok: false, error: MENSAJE_CLAVE_ESPACIOS };
  if (crudo.length > MAX_CLAVE) return { ok: false, error: MENSAJE_CLAVE_LARGA };
  return { ok: true, clave: crudo };
}

const CAMPOS: CampoApp[] = ['servidor', 'calidadDefecto', 'estiloFinal'];

/** Los campos que cambian. Sin fila previa, un servidor vacío no cuenta y la calidad y el estilo sí (se guardan por primera vez). */
export function camposCambiados(antes: ValorAjustes | null, despues: ValorAjustes): CampoApp[] {
  const previo: ValorAjustes = antes ?? { servidor: null, calidadDefecto: '' as CalidadApp, estiloFinal: '' as EstiloFinalApp };
  return CAMPOS.filter((c) => previo[c] !== despues[c]);
}
