// Catálogo de las secciones del editor (spec, secciones 3 y 5): orden del menú, ruta, bloques del
// borrador que edita cada una, vista previa y disposición. Puro: lo usan el servidor y el cliente.

export type IdSeccion =
  | 'resumen'
  | 'identidad'
  | 'patrono'
  | 'pantallas'
  | 'rotulos'
  | 'tipos'
  | 'galeria'
  | 'horarios-y-redes'
  | 'avisos'
  | 'app'
  | 'publicar';

export type Bloque =
  | 'nombre'
  | 'nombreCorto'
  | 'lugar'
  | 'colores'
  | 'logos'
  | 'fachada'
  | 'patrono'
  | 'fiesta'
  | 'galeria'
  | 'pantallas'
  | 'rotulos'
  | 'tipos'
  | 'horarios'
  | 'redes'
  | 'avisos';

/** Las claves del borrador que el editor puede cambiar, en este orden. */
export const BLOQUES: readonly Bloque[] = [
  'nombre',
  'nombreCorto',
  'lugar',
  'colores',
  'logos',
  'fachada',
  'patrono',
  'fiesta',
  'galeria',
  'pantallas',
  'rotulos',
  'tipos',
  'horarios',
  'redes',
  'avisos',
];

export interface VistaPreviaSeccion {
  pagina: 'pantalla' | 'rotulos' | 'produccion';
  vista: string;
  titulo: string;
  conSelectorTipo: boolean;
  tipoFijo?: string;
  /** Estado extra para la página (rótulo, celebrante, capas…), además del `tipo` (plan 4, Decisión 6). */
  estado?: Record<string, unknown>;
}

export type Disposicion = 'una-columna' | 'dos-columnas' | 'avisos';

export interface Seccion {
  id: IdSeccion;
  texto: string;
  ruta: string;
  bloques: Bloque[];
  conPunto: boolean;
  vistaPrevia: VistaPreviaSeccion | null;
  disposicion: Disposicion;
}

export const SECCIONES: readonly Seccion[] = [
  { id: 'resumen', texto: 'Resumen', ruta: '', bloques: [], conPunto: true, vistaPrevia: null, disposicion: 'una-columna' },
  {
    id: 'identidad',
    texto: 'Identidad',
    ruta: 'identidad',
    bloques: ['nombre', 'nombreCorto', 'lugar', 'colores', 'logos', 'fachada'],
    conPunto: true,
    vistaPrevia: { pagina: 'pantalla', vista: 'inicio', titulo: 'Vista previa', conSelectorTipo: true },
    disposicion: 'dos-columnas',
  },
  {
    id: 'patrono',
    texto: 'Patrono y fiesta',
    ruta: 'patrono',
    bloques: ['patrono', 'fiesta'],
    conPunto: true,
    vistaPrevia: {
      pagina: 'pantalla',
      vista: 'portada',
      titulo: 'Vista previa · Portada de la fiesta',
      conSelectorTipo: false,
      tipoFijo: 'patronal',
    },
    disposicion: 'dos-columnas',
  },
  { id: 'pantallas', texto: 'Pantallas', ruta: 'pantallas', bloques: ['pantallas'], conPunto: true, vistaPrevia: null, disposicion: 'una-columna' },
  { id: 'rotulos', texto: 'Rótulos y estilo', ruta: 'rotulos', bloques: ['rotulos'], conPunto: true, vistaPrevia: null, disposicion: 'una-columna' },
  { id: 'tipos', texto: 'Tipos de transmisión', ruta: 'tipos', bloques: ['tipos'], conPunto: true, vistaPrevia: null, disposicion: 'una-columna' },
  { id: 'galeria', texto: 'Galería', ruta: 'galeria', bloques: ['galeria'], conPunto: true, vistaPrevia: null, disposicion: 'una-columna' },
  {
    id: 'horarios-y-redes',
    texto: 'Horarios y redes',
    ruta: 'horarios-y-redes',
    bloques: ['horarios', 'redes'],
    conPunto: true,
    vistaPrevia: null,
    disposicion: 'una-columna',
  },
  {
    id: 'avisos',
    texto: 'Avisos fijos',
    ruta: 'avisos',
    bloques: ['avisos'],
    conPunto: true,
    vistaPrevia: { pagina: 'pantalla', vista: 'avisos', titulo: 'Vista previa · Avisos', conSelectorTipo: false },
    disposicion: 'avisos',
  },
  // 3c: fuera del borrador (Decisión 8): sin bloques, sin punto y sin tarjeta en el Resumen.
  { id: 'app', texto: 'App y transmisión', ruta: 'app-y-transmision', bloques: [], conPunto: false, vistaPrevia: null, disposicion: 'una-columna' },
  { id: 'publicar', texto: 'Publicar', ruta: 'publicar', bloques: [], conPunto: false, vistaPrevia: null, disposicion: 'una-columna' },
];

/** Secciones que no editan el borrador: no tienen estado ni punto. 3b suma aquí la suya. */
export const SECCIONES_SIN_BORRADOR = ['publicar', 'app'] as const;
export type IdSeccionBorrador = Exclude<IdSeccion, (typeof SECCIONES_SIN_BORRADOR)[number]>;
export function usaBorrador(id: IdSeccion): id is IdSeccionBorrador {
  return !(SECCIONES_SIN_BORRADOR as readonly IdSeccion[]).includes(id);
}

export const NOMBRES_VISTAS: Record<string, string> = {
  inicio: 'Inicio',
  portada: 'Portada de la fiesta',
  evento: 'Portada de evento',
  avisos: 'Avisos',
  gracias: 'Gracias',
  produccion: 'Producción',
  envivo: 'Capa EN VIVO',
  horarios: 'Horarios',
};

export function seccion(id: IdSeccion): Seccion {
  return SECCIONES.find((s) => s.id === id) as Seccion;
}

/** La sección de una ruta del editor; una ruta desconocida cae en Resumen. */
export function seccionDeRuta(pathname: string, slug: string): Seccion {
  const base = `/editor/p/${slug}`;
  const resto = pathname.startsWith(base) ? pathname.slice(base.length).replace(/^\/+/, '') : '';
  const primero = resto.split('/')[0] ?? '';
  return SECCIONES.find((s) => s.ruta !== '' && s.ruta === primero) ?? SECCIONES[0];
}

export function seccionDeBloque(b: Bloque): IdSeccion {
  return (SECCIONES.find((s) => s.bloques.includes(b)) as Seccion).id;
}

export function hrefSeccion(slug: string, id: IdSeccion): string {
  const r = seccion(id).ruta;
  return r ? `/editor/p/${slug}/${r}` : `/editor/p/${slug}`;
}

// ---- Vista previa por ruta (plan 4, Tarea 1) ----

/** Las 7 pantallas que el editor deja personalizar, en el orden de F4. */
export const VISTAS_EDITOR: readonly string[] = ['inicio', 'portada', 'evento', 'avisos', 'gracias', 'produccion', 'envivo'];

export interface VistaDeRuta {
  vistaPrevia: VistaPreviaSeccion | null;
  disposicion: Disposicion;
  /** Ancho de la columna del formulario en `dos-columnas`. */
  anchoFormulario: number;
}

const CAPAS_VISIBLES = { mostrarLogo: true, mostrarEnVivo: true, mostrarBarra: true };

/** Decisión 6: la vista previa de cada pantalla de F5 (y de su miniatura en F4). */
function vistaPreviaDePantalla(vista: string): VistaPreviaSeccion | null {
  const titulo = 'Vista previa';
  switch (vista) {
    case 'inicio':
    case 'avisos':
    case 'gracias':
      return { pagina: 'pantalla', vista, titulo, conSelectorTipo: true };
    case 'portada':
      return { pagina: 'pantalla', vista: 'portada', titulo, conSelectorTipo: false, tipoFijo: 'patronal' };
    case 'evento':
      return { pagina: 'pantalla', vista: 'portada', titulo, conSelectorTipo: false, tipoFijo: 'evento' };
    case 'produccion':
      return { pagina: 'produccion', vista: '', titulo, conSelectorTipo: false };
    case 'envivo':
      return {
        pagina: 'rotulos',
        vista: '',
        titulo,
        conSelectorTipo: false,
        tipoFijo: 'dominical',
        estado: { rotulo: 'ninguno', ...CAPAS_VISIBLES },
      };
    default:
      return null;
  }
}

/** Decisión 7: el rótulo de persona con un celebrante de ejemplo. */
const VISTA_ROTULOS: VistaPreviaSeccion = {
  pagina: 'rotulos',
  vista: '',
  titulo: 'Vista previa · Rótulo de persona',
  conSelectorTipo: false,
  tipoFijo: 'dominical',
  estado: { rotulo: 'persona', celebrante: 'P. Juan Pérez', celebranteRol: 'CELEBRANTE', ...CAPAS_VISIBLES },
};

const VISTA_TIPO: VistaPreviaSeccion = { pagina: 'pantalla', vista: 'inicio', titulo: 'Vista previa · Inicio', conSelectorTipo: false };

const SIN_VISTA_PREVIA = (): VistaDeRuta => ({ vistaPrevia: null, disposicion: 'una-columna', anchoFormulario: 560 });

/**
 * La vista previa, la disposición y el ancho del formulario según la ruta completa: `/pantallas` no
 * tiene vista previa, `/pantallas/gracias` muestra Gracias, `/tipos/<x>` muestra Inicio con ese tipo.
 */
export function vistaPreviaDeRuta(pathname: string, slug: string): VistaDeRuta {
  const base = `/editor/p/${slug}`;
  const resto = pathname.startsWith(base) ? pathname.slice(base.length).replace(/^\/+/, '').replace(/\/+$/, '') : '';
  const [primero = '', segundo] = resto.split('/');
  if (primero === 'pantallas') {
    if (segundo === undefined) return SIN_VISTA_PREVIA();
    const vp = VISTAS_EDITOR.includes(segundo) ? vistaPreviaDePantalla(segundo) : null;
    return vp ? { vistaPrevia: vp, disposicion: 'dos-columnas', anchoFormulario: 520 } : SIN_VISTA_PREVIA();
  }
  if (primero === 'rotulos') return { vistaPrevia: VISTA_ROTULOS, disposicion: 'dos-columnas', anchoFormulario: 540 };
  if (primero === 'tipos') {
    if (segundo === undefined) return SIN_VISTA_PREVIA();
    return { vistaPrevia: VISTA_TIPO, disposicion: 'dos-columnas', anchoFormulario: 560 };
  }
  const s = seccionDeRuta(pathname, slug);
  return { vistaPrevia: s.vistaPrevia, disposicion: s.disposicion, anchoFormulario: 560 };
}

/** La vista previa de la miniatura de una pantalla en F4 (la misma de F5). */
export function vistaPreviaDeVista(vista: string): VistaPreviaSeccion | null {
  return VISTAS_EDITOR.includes(vista) ? vistaPreviaDePantalla(vista) : null;
}
