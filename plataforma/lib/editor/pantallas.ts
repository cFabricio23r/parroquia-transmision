// Pantallas de OBS personalizadas (plan 4, Tarea 2; spec, secciones 5 y 6): el catálogo de las 7
// vistas que el editor ofrece y las ayudas puras que escriben `pantallas.<vista>` sin perder lo que
// el editor no muestra (`chispas`, `rayos`, `imagen: 'santo'`, `pantallas.horarios`…). Sin React.
import { imagenesDe, nombreDeImagen } from './galeria';
import { NOMBRES_VISTAS } from './secciones';

export type Elemento = 'marca' | 'cuenta' | 'franja' | 'envivo' | 'redes' | 'horarios';

export interface InterruptorPantalla {
  elemento: Elemento;
  etiqueta: string;
  ayuda?: string;
}

export interface CampoTextoPantalla {
  clave: string;
  etiqueta: string;
  ayuda?: string;
  placeholder?: string;
}

export interface VistaEditor {
  vista: string;
  nombre: string;
  titulo: string;
  descripcion: string;
  interruptores: InterruptorPantalla[];
  textos: CampoTextoPantalla[];
  conFondoEImagen: boolean;
}

const LOGO: InterruptorPantalla = { elemento: 'marca', etiqueta: 'Logo' };
const CUENTA: InterruptorPantalla = { elemento: 'cuenta', etiqueta: 'Cuenta regresiva' };
const FRANJA: InterruptorPantalla = { elemento: 'franja', etiqueta: 'Franja del lema', ayuda: 'Solo en la novena y la fiesta.' };
const REDES: InterruptorPantalla = { elemento: 'redes', etiqueta: 'Redes sociales' };
const HORARIOS: InterruptorPantalla = { elemento: 'horarios', etiqueta: 'Horarios' };
const EN_VIVO: InterruptorPantalla = { elemento: 'envivo', etiqueta: 'EN VIVO' };

export const AYUDA_TEXTO_INICIO = 'Cada tipo de transmisión puede tener el suyo; este es el que se usa si no.';

/** Las 7 pantallas de F4, en su orden (Decisiones 1 y 5). */
export const VISTAS_PANTALLA: readonly VistaEditor[] = [
  {
    vista: 'inicio',
    nombre: NOMBRES_VISTAS.inicio,
    titulo: 'Pantalla de Inicio',
    descripcion: 'Antes de empezar: «En breve comenzamos», con cuenta regresiva.',
    interruptores: [LOGO, CUENTA, FRANJA, REDES],
    textos: [{ clave: 'inicio_titulo', etiqueta: 'Texto de arriba', ayuda: AYUDA_TEXTO_INICIO }],
    conFondoEImagen: true,
  },
  {
    vista: 'portada',
    nombre: NOMBRES_VISTAS.portada,
    titulo: 'Portada de la fiesta',
    descripcion: 'Para la fiesta patronal y la novena.',
    interruptores: [LOGO, CUENTA, FRANJA],
    textos: [{ clave: 'portada_titulo', etiqueta: 'Título de la portada' }],
    conFondoEImagen: true,
  },
  {
    vista: 'evento',
    nombre: NOMBRES_VISTAS.evento,
    titulo: 'Portada de evento',
    descripcion: 'Para un evento especial con fecha y lugar.',
    interruptores: [LOGO, FRANJA],
    textos: [],
    conFondoEImagen: true,
  },
  {
    vista: 'avisos',
    nombre: NOMBRES_VISTAS.avisos,
    titulo: 'Pantalla de Avisos',
    descripcion: 'Avisos fijos, horarios y redes.',
    interruptores: [LOGO, HORARIOS, REDES],
    textos: [{ clave: 'avisos_titulo', etiqueta: 'Título' }],
    conFondoEImagen: true,
  },
  {
    vista: 'gracias',
    nombre: NOMBRES_VISTAS.gracias,
    titulo: 'Pantalla de Gracias',
    descripcion: 'Al terminar la transmisión.',
    interruptores: [LOGO, HORARIOS, REDES, FRANJA],
    textos: [{ clave: 'gracias_titulo', etiqueta: 'Texto grande' }],
    conFondoEImagen: true,
  },
  {
    vista: 'produccion',
    nombre: NOMBRES_VISTAS.produccion,
    titulo: 'Producción',
    descripcion: 'Cierre: «Una producción de…».',
    interruptores: [LOGO],
    textos: [
      { clave: 'prod_ceja', etiqueta: 'Texto de arriba', placeholder: 'UNA PRODUCCIÓN DE' },
      { clave: 'prod_nombre', etiqueta: 'Nombre del equipo', placeholder: 'Comunicaciones' },
    ],
    conFondoEImagen: false,
  },
  {
    vista: 'envivo',
    nombre: NOMBRES_VISTAS.envivo,
    titulo: 'Capa EN VIVO',
    descripcion: 'Encima de la cámara: logo y barra.',
    interruptores: [LOGO, EN_VIVO],
    textos: [],
    conFondoEImagen: false,
  },
];

export function vistaEditor(vista: string): VistaEditor | null {
  return VISTAS_PANTALLA.find((v) => v.vista === vista) ?? null;
}

type Objeto = Record<string, unknown>;
const esObjeto = (v: unknown): v is Objeto => v !== null && typeof v === 'object' && !Array.isArray(v);
const objeto = (v: unknown): Objeto => (esObjeto(v) ? v : {});
const textos = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const MOSTRABLES: readonly Elemento[] = ['redes', 'horarios'];

/** Encendido: el elemento no está en `ocultar` o, para redes y horarios, sí está en `mostrar`. */
export function encendido(p: object | undefined, e: Elemento): boolean {
  const o = objeto(p);
  return MOSTRABLES.includes(e) ? textos(o.mostrar).includes(e) : !textos(o.ocultar).includes(e);
}

/** El bloque de la pantalla con el interruptor cambiado; conserva lo demás y quita una lista vacía. */
export function conInterruptor(p: object | undefined, e: Elemento, valor: boolean): Objeto {
  const o: Objeto = { ...objeto(p) };
  const campo = MOSTRABLES.includes(e) ? 'mostrar' : 'ocultar';
  const meter = campo === 'mostrar' ? valor : !valor;
  const actual = Array.isArray(o[campo]) ? (o[campo] as unknown[]) : [];
  const sin = actual.filter((x) => x !== e);
  const nueva = meter ? [...sin, e] : sin;
  if (nueva.length) o[campo] = nueva;
  else delete o[campo];
  return o;
}

/** Aplica `cambio` a `pantallas.<vista>` (`undefined` quita la clave) y pone `modo: 'personalizada'`. */
export function ponerEnPantalla(pantallas: unknown, vista: string, cambio: Objeto): Objeto {
  const todas: Objeto = { ...objeto(pantallas) };
  const p: Objeto = { ...objeto(todas[vista]) };
  for (const [k, v] of Object.entries(cambio)) {
    if (v === undefined) delete p[k];
    else p[k] = v;
  }
  p.modo = 'personalizada';
  todas[vista] = p;
  return todas;
}

/** «Volver a como venía»: quita la vista; sin ninguna vista, `undefined` (se quita el bloque). */
export function volverComoVenia(pantallas: unknown, vista: string): Objeto | undefined {
  const todas: Objeto = { ...objeto(pantallas) };
  delete todas[vista];
  return Object.keys(todas).length ? todas : undefined;
}

export type OpcionFondo = 'parroquia' | 'galeria' | 'color';
export type OpcionImagen = 'tipo' | 'fija' | 'ninguna';

/** Decisión 3: `degradado` o sin fondo se pintan «Colores de la parroquia». */
export function opcionFondo(p: object | undefined): OpcionFondo {
  const t = objeto(objeto(p).fondo).tipo;
  return t === 'color' ? 'color' : t === 'imagen' ? 'galeria' : 'parroquia';
}

/** Decisión 3: `automatica` o sin imagen se pintan «La del tipo». */
export function opcionImagen(p: object | undefined): OpcionImagen {
  const im = objeto(p).imagen;
  if (im === undefined || im === 'automatica') return 'tipo';
  if (im === 'ninguna') return 'ninguna';
  return 'fija';
}

/** Decisión 2: «Siempre la misma» empieza con el patrono si tiene imagen; si no, la fachada. */
export function imagenFijaInicial(borrador: object): 'patrono' | 'fachada' {
  const src = objeto(objeto(objeto(borrador).patrono).imagen).src;
  return typeof src === 'string' && src ? 'patrono' : 'fachada';
}

/** Decisión 2: la primera imagen con la etiqueta «fondos», o la primera; sin galería, null. */
export function fondoGaleriaInicial(borrador: object): string | null {
  const imagenes = imagenesDe(objeto(borrador).galeria);
  const conFondos = imagenes.find((im) => Array.isArray(im.etiquetas) && im.etiquetas.includes('fondos'));
  return (conFondos ?? imagenes[0])?.id ?? null;
}

const FIJAS = [
  { valor: 'patrono', texto: 'Imagen del patrono' },
  { valor: 'fachada', texto: 'Fachada' },
  { valor: 'logo', texto: 'Logo' },
  { valor: 'custodia', texto: 'Custodia' },
];

/** Opciones de «¿Cuál imagen?»: las cuatro fijas, la galería y, si ya está, la del santo (Decisión 2). */
export function opcionesImagenFija(borrador: object, actual?: string): { valor: string; texto: string }[] {
  const salida = [...FIJAS];
  for (const im of imagenesDe(objeto(borrador).galeria)) salida.push({ valor: `galeria:${im.id}`, texto: nombreDeImagen(im) });
  if (actual === 'santo') salida.push({ valor: 'santo', texto: 'La del santo del día (se elige en el panel)' });
  return salida;
}

/** Decisión 27: un texto vacío quita la clave, y `textos` si queda vacío. */
export function ponerTexto(p: object | undefined, clave: string, texto: string): Objeto {
  const o: Objeto = { ...objeto(p) };
  const t: Objeto = { ...objeto(o.textos) };
  if (texto.trim() === '') delete t[clave];
  else t[clave] = texto;
  if (Object.keys(t).length) o.textos = t;
  else delete o.textos;
  return o;
}

/** Decisión 2: las pantallas personalizadas con `imagen: 'patrono'` y sin `patrono.imagen.src`. */
export function avisoImagenPatrono(borrador: object): { vista: string; nombre: string }[] {
  const b = objeto(borrador);
  const src = objeto(objeto(b.patrono).imagen).src;
  if (typeof src === 'string' && src) return [];
  return Object.entries(objeto(b.pantallas))
    .filter(([, p]) => esObjeto(p) && p.modo === 'personalizada' && p.imagen === 'patrono')
    .map(([vista]) => ({ vista, nombre: NOMBRES_VISTAS[vista] ?? vista }));
}

/** Opciones de «¿Cuál foto?»: las imágenes de la galería, por id. */
export function opcionesFondoGaleria(borrador: object): { valor: string; texto: string }[] {
  return imagenesDe(objeto(borrador).galeria).map((im) => ({ valor: im.id, texto: nombreDeImagen(im) }));
}
