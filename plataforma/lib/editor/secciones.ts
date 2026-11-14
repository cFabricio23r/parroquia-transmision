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
  { id: 'publicar', texto: 'Publicar', ruta: 'publicar', bloques: [], conPunto: false, vistaPrevia: null, disposicion: 'una-columna' },
];

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
