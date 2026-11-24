// Arma el borrador que se manda a la vista previa: cambia cada `src: 'medios/x'` por su URL firmada
// (el iframe no tiene sesión para pedir al Storage privado) y quita los vacíos del formulario.
// Sin dependencias de React ni de Next: se prueba sola.
import { NOMBRES_VISTAS, type VistaPreviaSeccion } from './editor/secciones';

/** Copia el valor sin null ni undefined y con los `src` conocidos reemplazados por su URL firmada. */
export function prepararVistaPrevia(valor: unknown, urls: Record<string, string>): unknown {
  if (Array.isArray(valor)) return valor.map((v) => prepararVistaPrevia(v, urls)).filter((v) => v !== undefined);
  if (valor !== null && typeof valor === 'object') {
    const salida: Record<string, unknown> = {};
    for (const [clave, v] of Object.entries(valor)) {
      if (clave === 'src' && typeof v === 'string' && Object.hasOwn(urls, v)) {
        salida[clave] = urls[v];
        continue;
      }
      const limpio = prepararVistaPrevia(v, urls);
      if (limpio !== undefined) salida[clave] = limpio;
    }
    return salida;
  }
  return valor === null ? undefined : valor;
}

/** Todos los `src` que empiezan con `medios/`, a cualquier profundidad (galería, fondos, logos…), sin repetidos. */
export function recogerMedios(valor: unknown, encontrados = new Set<string>()): string[] {
  if (Array.isArray(valor)) valor.forEach((v) => recogerMedios(v, encontrados));
  else if (valor !== null && typeof valor === 'object') {
    for (const [clave, v] of Object.entries(valor)) {
      if (clave === 'src' && typeof v === 'string' && v.startsWith('medios/')) encontrados.add(v);
      else recogerMedios(v, encontrados);
    }
  }
  return [...encontrados];
}

// ---- Vista previa continua del editor (plan 3, Tarea 9) ----

/** Espera entre el último cambio y el mensaje al iframe: no se manda una letra por mensaje. */
export const ESPERA_VISTA_PREVIA_MS = 400;

/** La página de la parroquia que muestra la vista previa: `pantalla.html?tipo=…`, `rotulos.html` o `produccion.html`. */
export function srcVistaPrevia(slug: string, vp: VistaPreviaSeccion): string {
  if (vp.pagina === 'pantalla') return `/${slug}/pantalla.html?tipo=${encodeURIComponent(vp.vista)}&vista-previa=1`;
  if (vp.pagina === 'transicion') return `/${slug}/transicion.html?repetir=1&version=${encodeURIComponent(vp.vista)}&vista-previa=1`;
  return `/${slug}/${vp.pagina}.html?vista-previa=1`;
}

export interface TipoVistaPrevia {
  clave: string;
  nombre: string;
}

const objeto = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/** «Ver con el tipo»: los comunes encendidos (con su nombre del panel si lo cambiaron) y después los propios. */
export function tiposParaVistaPrevia(borrador: object, comunes: TipoVistaPrevia[]): TipoVistaPrevia[] {
  const tipos = objeto((borrador as Record<string, unknown>).tipos);
  const apagados = new Set(Array.isArray(tipos.apagados) ? tipos.apagados.filter((c) => typeof c === 'string') : []);
  const ajustes = objeto(tipos.ajustes);
  const salida: TipoVistaPrevia[] = [];
  for (const c of comunes) {
    if (apagados.has(c.clave)) continue;
    const nombrePanel = objeto(ajustes[c.clave]).nombrePanel;
    salida.push({ clave: c.clave, nombre: typeof nombrePanel === 'string' && nombrePanel.trim() ? nombrePanel : c.nombre });
  }
  for (const p of Array.isArray(tipos.propios) ? tipos.propios : []) {
    const o = objeto(p);
    if (typeof o.clave === 'string' && o.clave) salida.push({ clave: o.clave, nombre: typeof o.nombre === 'string' && o.nombre ? o.nombre : o.clave });
  }
  return salida;
}

export interface MensajeVistaPrevia {
  tipo: 'pev-vista-previa';
  config: unknown;
  estado?: Record<string, unknown>;
}

/**
 * El mensaje que entiende `parroquia.js` en modo vista previa. `estado` junta el estado extra de la
 * página (rótulo, celebrante, capas) con el `tipo`; sin ninguno de los dos, no va.
 */
export function mensajeVistaPrevia(
  borrador: object,
  urls: Record<string, string>,
  tipo: string | null,
  extra?: Record<string, unknown>,
): MensajeVistaPrevia {
  const m: MensajeVistaPrevia = { tipo: 'pev-vista-previa', config: prepararVistaPrevia(borrador, urls) };
  if (tipo || extra) m.estado = { ...extra, ...(tipo ? { tipo } : {}) };
  return m;
}

/**
 * Decisión 6: si la vista previa usa un tipo común que la parroquia tiene apagado (la portada con
 * `patronal`), lo saca de `tipos.apagados` solo en la copia que va al iframe. Si no, el mismo objeto.
 */
export function configParaVistaPrevia(borrador: object, tipoFijo: string | undefined, comunes: string[]): object {
  if (!tipoFijo || !comunes.includes(tipoFijo)) return borrador;
  const b = borrador as Record<string, unknown>;
  const tipos = objeto(b.tipos);
  if (!Array.isArray(tipos.apagados) || !tipos.apagados.includes(tipoFijo)) return borrador;
  return { ...b, tipos: { ...tipos, apagados: tipos.apagados.filter((k) => k !== tipoFijo) } };
}

/**
 * El nombre accesible del iframe: «Vista previa: Inicio», con el nombre de la pantalla que ve la
 * persona (NOMBRES_VISTAS), no la clave interna. La Portada de evento es la vista «portada» con el
 * tipo evento; la Capa EN VIVO, los rótulos sin ningún rótulo a la vista.
 */
export function tituloMarcoVistaPrevia(vp: VistaPreviaSeccion): string {
  let nombre: string;
  if (vp.pagina === 'produccion') nombre = NOMBRES_VISTAS.produccion;
  else if (vp.pagina === 'transicion') nombre = 'Transición';
  else if (vp.pagina === 'rotulos') nombre = vp.estado?.rotulo === 'ninguno' ? NOMBRES_VISTAS.envivo : 'Rótulos';
  else if (vp.vista === 'portada' && vp.tipoFijo === 'evento') nombre = NOMBRES_VISTAS.evento;
  else nombre = NOMBRES_VISTAS[vp.vista] ?? vp.vista;
  return `Vista previa: ${nombre}`;
}
