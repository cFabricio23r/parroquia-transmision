// «App y transmisión» (etapa 3c): leer y guardar los ajustes de la app y la clave fija, sin Next.
// Recibe la sesión de quien actúa (RLS decide) y el cliente de servicio solo para `registro`,
// como lib/publicar.ts. Los envoltorios están en app/editor/api/[slug]/app/.
//
// La clave: nada de este archivo la vuelve a leer (cada select de claves_transmision es
// 'guardada_en') y ningún error se escribe con su detalle: falloSinDetalle y registrarSinFallar
// (Decisión 5 del plan 3c). Se valida antes de escribir, así el check de la tabla no falla con ella.
import type { SupabaseClient } from '@supabase/supabase-js';
import { comprobarAcceso, conError, falloSinDetalle, type ConError, type Respuesta } from './borrador';
import { registrarSinFallar } from './admin';
import {
  camposCambiados,
  validarAjustesApp,
  validarClave,
  type AjustesAppEditor,
  type CalidadApp,
  type CampoApp,
  type EstadoAppTransmision,
  type EstiloFinalApp,
} from './app-transmision-reglas';

export interface DepsAppTransmision {
  sesion: SupabaseClient;
  servicio: SupabaseClient;
}

type FilaAjustes = { servidor: string | null; calidad_defecto: string; estilo_final: string; actualizado_en: string };
const COLUMNAS_AJUSTES = 'servidor, calidad_defecto, estilo_final, actualizado_en';

const aEditor = (f: FilaAjustes): AjustesAppEditor => ({
  servidor: f.servidor,
  calidadDefecto: f.calidad_defecto as CalidadApp,
  estiloFinal: f.estilo_final as EstiloFinalApp,
  actualizadoEn: f.actualizado_en,
});

async function nombreDe(sesion: SupabaseClient, parroquiaId: string): Promise<string | null> {
  const { data, error } = await sesion.from('parroquias').select('nombre').eq('id', parroquiaId).single();
  return error || !data ? null : (data.nombre as string);
}

export async function leerAppTransmision(sesion: SupabaseClient, slug: string): Promise<Respuesta<EstadoAppTransmision | ConError>> {
  const acceso = await comprobarAcceso(sesion, slug);
  if (!acceso.ok) return acceso.respuesta;
  const a = await sesion.from('ajustes_app').select(COLUMNAS_AJUSTES).eq('parroquia_id', acceso.parroquiaId).maybeSingle();
  if (a.error) return falloSinDetalle('leerAppTransmision');
  const k = await sesion.from('claves_transmision').select('guardada_en').eq('parroquia_id', acceso.parroquiaId).maybeSingle();
  if (k.error) return falloSinDetalle('leerAppTransmision');
  return {
    estado: 200,
    cuerpo: {
      ajustes: a.data ? aEditor(a.data as FilaAjustes) : null,
      clave: k.data ? { guardadaEn: k.data.guardada_en as string } : null,
    },
  };
}

export async function guardarAjustesApp(
  d: DepsAppTransmision,
  slug: string,
  entrada: unknown,
): Promise<Respuesta<AjustesAppEditor | (ConError & { errores?: Partial<Record<CampoApp, string>> })>> {
  const acceso = await comprobarAcceso(d.sesion, slug);
  if (!acceso.ok) return acceso.respuesta;
  const v = validarAjustesApp(entrada);
  if (!v.ok) {
    const primero = Object.values(v.errores)[0] ?? 'Revisa los datos.';
    return { estado: 422, cuerpo: { error: primero, errores: v.errores } };
  }
  const nombre = await nombreDe(d.sesion, acceso.parroquiaId);
  if (nombre === null) return falloSinDetalle('guardarAjustesApp');
  const previa = await d.sesion.from('ajustes_app').select(COLUMNAS_AJUSTES).eq('parroquia_id', acceso.parroquiaId).maybeSingle();
  if (previa.error) return falloSinDetalle('guardarAjustesApp');
  const antes = previa.data ? aEditor(previa.data as FilaAjustes) : null;
  const campos = camposCambiados(
    antes ? { servidor: antes.servidor, calidadDefecto: antes.calidadDefecto, estiloFinal: antes.estiloFinal } : null,
    v.valor,
  );
  if (!campos.length && antes) return { estado: 200, cuerpo: antes };
  const { data, error } = await d.sesion
    .from('ajustes_app')
    .upsert(
      {
        parroquia_id: acceso.parroquiaId,
        servidor: v.valor.servidor,
        calidad_defecto: v.valor.calidadDefecto,
        estilo_final: v.valor.estiloFinal,
        actualizado_en: new Date().toISOString(),
        actualizado_por: acceso.usuarioId,
      },
      { onConflict: 'parroquia_id' },
    )
    .select(COLUMNAS_AJUSTES)
    .single();
  if (error || !data) return falloSinDetalle('guardarAjustesApp');
  await registrarSinFallar(
    d.servicio,
    { parroquia_id: acceso.parroquiaId, usuario_id: acceso.usuarioId, accion: 'cambiar_ajustes_app', detalle: { slug, nombre, campos } },
    'guardarAjustesApp',
  );
  return { estado: 200, cuerpo: aEditor(data as FilaAjustes) };
}

export async function guardarClave(d: DepsAppTransmision, slug: string, entrada: unknown): Promise<Respuesta<{ guardadaEn: string } | ConError>> {
  const acceso = await comprobarAcceso(d.sesion, slug);
  if (!acceso.ok) return acceso.respuesta;
  const v = validarClave(entrada);
  if (!v.ok) return conError(422, v.error);
  const nombre = await nombreDe(d.sesion, acceso.parroquiaId);
  if (nombre === null) return falloSinDetalle('guardarClave');
  const previa = await d.sesion.from('claves_transmision').select('guardada_en').eq('parroquia_id', acceso.parroquiaId).maybeSingle();
  if (previa.error) return falloSinDetalle('guardarClave');
  const guardadaEn = new Date().toISOString();
  const { error } = await d.sesion
    .from('claves_transmision')
    .upsert({ parroquia_id: acceso.parroquiaId, clave: v.clave, guardada_en: guardadaEn, guardada_por: acceso.usuarioId }, { onConflict: 'parroquia_id' });
  if (error) return falloSinDetalle('guardarClave');
  await registrarSinFallar(
    d.servicio,
    {
      parroquia_id: acceso.parroquiaId,
      usuario_id: acceso.usuarioId,
      accion: 'cambiar_clave_transmision',
      detalle: { slug, nombre, cambio: previa.data ? 'reemplazar' : 'guardar' },
    },
    'guardarClave',
  );
  return { estado: 200, cuerpo: { guardadaEn } };
}

export async function quitarClave(d: DepsAppTransmision, slug: string): Promise<Respuesta<Record<string, never> | ConError>> {
  const acceso = await comprobarAcceso(d.sesion, slug);
  if (!acceso.ok) return acceso.respuesta;
  const nombre = await nombreDe(d.sesion, acceso.parroquiaId);
  if (nombre === null) return falloSinDetalle('quitarClave');
  const { data, error } = await d.sesion.from('claves_transmision').delete().eq('parroquia_id', acceso.parroquiaId).select('guardada_en');
  if (error) return falloSinDetalle('quitarClave');
  if (data && data.length) {
    await registrarSinFallar(
      d.servicio,
      { parroquia_id: acceso.parroquiaId, usuario_id: acceso.usuarioId, accion: 'cambiar_clave_transmision', detalle: { slug, nombre, cambio: 'quitar' } },
      'quitarClave',
    );
  }
  return { estado: 200, cuerpo: {} };
}
