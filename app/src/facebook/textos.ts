// Título y descripción del vivo de Facebook (spec facebook-en-vivo-directo, «Cambio del usuario: título y
// descripción», 2026-11-27). Los escribe el coordinador en Semana (datos.facebook); el voluntario los puede
// cambiar en la app solo para ese vivo. Vacío = título automático y sin descripción.
import { SEMANA } from '../semana/nucleo';

export type TextosVivo = { titulo: string; descripcion: string };

const VACIO: TextosVivo = { titulo: '', descripcion: '' };

function objeto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Lo guardado en `datos.facebook` de una transmisión; lo que falta o no es texto, vacío. */
export function leerFacebook(datos: unknown): TextosVivo {
  if (!objeto(datos) || !objeto(datos.facebook)) return { ...VACIO };
  const fb = datos.facebook;
  return {
    titulo: typeof fb.titulo === 'string' ? fb.titulo : '',
    descripcion: typeof fb.descripcion === 'string' ? fb.descripcion : '',
  };
}

/** Los textos que van a Facebook: lo editado, si no lo guardado, si no el título automático. */
export function textosVivo(e: {
  guardado: TextosVivo;
  tipo: string | null;
  parroquia: string;
  editado: TextosVivo | null;
}): TextosVivo {
  const { titulo: maxTitulo, descripcion: maxDescripcion } = SEMANA.LIMITES_FACEBOOK;
  const automatico = `${e.tipo ?? 'Transmisión'} · ${e.parroquia}`;
  const titulo = [e.editado?.titulo, e.guardado.titulo, automatico].map((t) => (t ?? '').trim()).find((t) => t !== '') ?? automatico;
  // Una descripción editada vacía vale: el voluntario la borró a propósito.
  const descripcion = (e.editado !== null ? e.editado.descripcion : e.guardado.descripcion).trim();
  return { titulo: titulo.slice(0, maxTitulo), descripcion: descripcion.slice(0, maxDescripcion) };
}
