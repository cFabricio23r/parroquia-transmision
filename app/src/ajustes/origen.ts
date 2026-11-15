// La regla del ajuste que manda: el del celular, el de la parroquia o el valor de la app.
// Funciones puras: no mutan lo que reciben y nunca escriben la clave en ningún lado.
import { Ajustes, AJUSTES_INICIALES, Calidad, EstiloFinal, limpiarClave, Microfono } from './ajustes';

export type Origen = 'parroquia' | 'celular' | 'app';
export type CampoAjuste = 'servidor' | 'clave' | 'calidad' | 'estiloFinal' | 'microfono';
export type CampoCelular = 'servidor' | 'clave' | 'calidad';
export interface AjustesDeParroquia {
  servidor: string | null;
  calidad: Calidad;
  estiloFinal: EstiloFinal;
  actualizadoEn: string;
}
export interface ClaveDeParroquia {
  clave: string;
  guardadaEn: string;
}
export interface AjustesCelular {
  servidor?: string;
  clave?: string;
  calidad?: Calidad;
  claveParroquiaVista?: string | null;
}
export interface AjustesEfectivos {
  ajustes: Ajustes;
  origen: Record<CampoAjuste, Origen>;
  /** La parroquia también tiene un valor para ese campo (para «Volver a la de la parroquia»). */
  deParroquia: Record<CampoCelular, boolean>;
  claveNueva: boolean;
}

export const TEXTOS_AJUSTES = {
  cabecera: 'Algunos vienen de la parroquia',
  volver: 'Volver a la de la parroquia',
  claveNueva: 'La parroquia cambió su clave.',
  usarParroquia: 'Usar la de la parroquia',
  seguirCelular: 'Seguir con la de este celular',
  claveNuevaCorta: 'La parroquia cambió su clave',
  placeholderClave: 'Guardada por la parroquia',
} as const;

export function resolverAjustes(
  p: AjustesDeParroquia | null,
  k: ClaveDeParroquia | null,
  c: AjustesCelular,
  microfono: Microfono,
): AjustesEfectivos {
  const servidorP = p && p.servidor ? p.servidor : null;
  const servidor = c.servidor ? c.servidor : servidorP ?? AJUSTES_INICIALES.servidor;
  const clave = c.clave ? c.clave : k ? k.clave : AJUSTES_INICIALES.clave;
  const calidad = c.calidad ? c.calidad : p ? p.calidad : AJUSTES_INICIALES.calidad;
  const estiloFinal = p ? p.estiloFinal : AJUSTES_INICIALES.estiloFinal;
  return {
    ajustes: { servidor, clave, calidad, microfono, estiloFinal },
    origen: {
      servidor: c.servidor ? 'celular' : servidorP ? 'parroquia' : 'app',
      clave: c.clave ? 'celular' : k ? 'parroquia' : 'app',
      calidad: c.calidad ? 'celular' : p ? 'parroquia' : 'app',
      estiloFinal: p ? 'parroquia' : 'app',
      microfono: 'celular',
    },
    deParroquia: { servidor: servidorP !== null, clave: k !== null, calidad: p !== null },
    claveNueva: Boolean(c.clave) && k !== null && k.guardadaEn !== c.claveParroquiaVista,
  };
}

function sin(c: AjustesCelular, ...campos: (keyof AjustesCelular)[]): AjustesCelular {
  const r = { ...c };
  for (const x of campos) delete r[x];
  return r;
}

export function aplicarCambioCelular(
  c: AjustesCelular,
  p: AjustesDeParroquia | null,
  k: ClaveDeParroquia | null,
  campo: CampoCelular,
  valor: string,
): AjustesCelular {
  if (campo === 'clave') {
    const v = limpiarClave(valor);
    if (v === '' || (k && v === k.clave)) return sin(c, 'clave', 'claveParroquiaVista');
    return { ...c, clave: v, claveParroquiaVista: k ? k.guardadaEn : null };
  }
  if (campo === 'servidor') {
    const v = valor.trim();
    if (v === '' || (p && v === p.servidor)) return sin(c, 'servidor');
    return { ...c, servidor: v };
  }
  if (valor !== '720p' && valor !== '1080p') return { ...c };
  if (p && valor === p.calidad) return sin(c, 'calidad');
  return { ...c, calidad: valor };
}

export function volverALaParroquia(c: AjustesCelular, campo: CampoCelular): AjustesCelular {
  return campo === 'clave' ? sin(c, 'clave', 'claveParroquiaVista') : sin(c, campo);
}

export function seguirConLaDelCelular(c: AjustesCelular, k: ClaveDeParroquia | null): AjustesCelular {
  return { ...c, claveParroquiaVista: k ? k.guardadaEn : null };
}

export function textoOrigen(campo: CampoAjuste, origen: Origen, deParroquia: boolean): { texto: string; volver: boolean } {
  if (campo === 'microfono') return { texto: 'Solo en este celular', volver: false };
  if (origen === 'parroquia') return { texto: 'Viene de la parroquia', volver: false };
  if (origen === 'celular') {
    return deParroquia
      ? { texto: 'Cambiado en este celular', volver: true }
      : { texto: 'Solo en este celular', volver: false };
  }
  if (campo === 'clave') {
    return { texto: 'La parroquia no tiene clave guardada. Pégala aquí: queda solo en este celular.', volver: false };
  }
  if (campo === 'estiloFinal') return { texto: 'La parroquia no la eligió todavía: se usa Azul.', volver: false };
  return { texto: 'La parroquia no lo puso todavía', volver: false };
}
