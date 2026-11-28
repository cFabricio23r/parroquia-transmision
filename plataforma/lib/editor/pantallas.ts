// Pantallas de OBS personalizadas (plan 4, Tarea 2; spec, secciones 5 y 6): el catálogo de las 7
// vistas que el editor ofrece y las ayudas puras que escriben `pantallas.<vista>` sin perder lo que
// el editor no muestra (`chispas`, `rayos`, `imagen: 'santo'`, `pantallas.horarios`…). Sin React.
import { imagenesDe, nombreDeImagen } from './galeria';
import { FAMILIA_TIPOGRAFIA, OPCIONES_TIPOGRAFIA } from './rotulos';
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
  /** Varias líneas (un <textarea>): Enter hace un salto de línea. */
  multilinea?: boolean;
  /** Tope de caracteres; 200 si no se dice (vicaria `MAX_TEXTO`). */
  maximo?: number;
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

/** Las 8 pantallas de F4, en su orden (Decisiones 1 y 5). */
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
    vista: 'comunion',
    nombre: NOMBRES_VISTAS.comunion,
    titulo: 'Pantalla de Comunión',
    descripcion: 'La oración de comunión espiritual, para quienes no pueden comulgar.',
    interruptores: [LOGO, EN_VIVO, FRANJA],
    textos: [
      { clave: 'comunion_titulo', etiqueta: 'Título' },
      { clave: 'comunion_oracion', etiqueta: 'Oración', ayuda: 'Enter hace un salto de línea.', multilinea: true, maximo: 600 },
    ],
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
  if ('imagen' in cambio || 'fondo' in cambio) limpiarEncuadre(p, vista);
  p.modo = 'personalizada';
  todas[vista] = p;
  return todas;
}

/* Review Focus 4: el encuadre se hizo para una foto; si la pantalla ya muestra otra (o ninguna), se borra. */
function limpiarEncuadre(p: Objeto, vista: string): void {
  if (!esObjeto(p.encuadre)) return;
  const e: Objeto = { ...p.encuadre };
  for (const cual of ['imagen', 'fondo'] as const) {
    if (e[cual] !== undefined && objeto(e[cual]).de !== fotoEncuadrable(p, cual, vista)) delete e[cual];
  }
  if (Object.keys(e).length) p.encuadre = e;
  else delete p.encuadre;
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

/* ---- Pantallas más opciones (spec 2026-11-24): letras, tamaños y encuadre de la foto ---- */

export const OPCIONES_TAMANO = [
  { valor: 'chico', texto: 'Chico' },
  { valor: 'normal', texto: 'Normal' },
  { valor: 'grande', texto: 'Grande' },
];
/** La letra de la frase: la cursiva de hoy (Great Vibes) y las mismas tipografías de los rótulos. */
export const OPCIONES_LETRA_FRASE = [{ valor: 'vibes', texto: 'Great Vibes (la de hoy)' }, ...OPCIONES_TIPOGRAFIA];
export const FAMILIA_LETRA_FRASE: Record<string, string> = { vibes: 'Vibes', ...FAMILIA_TIPOGRAFIA };

export type ClaveEstilo = 'letraTitulo' | 'letraFrase' | 'logo';
const ESTILO_DE_SIEMPRE: Record<ClaveEstilo, string> = { letraTitulo: 'montserrat', letraFrase: 'vibes', logo: 'normal' };

/** `estiloPantallas` con `clave` cambiada; el valor de siempre quita la clave y, sin claves, `undefined` (se quita el bloque). */
export function conEstiloPantallas(estilo: unknown, clave: ClaveEstilo, valor: string): Objeto | undefined {
  const o: Objeto = { ...objeto(estilo) };
  if (valor === ESTILO_DE_SIEMPRE[clave]) delete o[clave];
  else o[clave] = valor;
  return Object.keys(o).length ? o : undefined;
}

export type CualTamano = 'titulo' | 'frase';

/** Los tamaños de los textos de cada pantalla: además «Muy chico» (70 %). El logo sigue con OPCIONES_TAMANO. */
export const OPCIONES_TAMANO_TEXTO = [{ valor: 'muy-chico', texto: 'Muy chico' }, ...OPCIONES_TAMANO];

/* ---- Letra por pantalla (spec 2026-11-24 letra-por-pantalla): pantallas.<vista>.letras ---- */

export type CualLetra = 'titulo' | 'frase';
/** Qué letras puede cambiar cada pantalla. Avisos no tiene frase; Producción, solo el nombre. Horarios no está en el editor. */
export const LETRAS_DE_VISTA: Record<string, CualLetra[]> = {
  inicio: ['titulo', 'frase'],
  portada: ['titulo', 'frase'],
  evento: ['titulo', 'frase'],
  gracias: ['titulo', 'frase'],
  avisos: ['titulo'],
  comunion: ['titulo'],
  produccion: ['titulo'],
};
const COMO_LAS_DEMAS = { valor: '', texto: 'Como las demás pantallas' };
/** Las letras de una pantalla: «Como las demás pantallas» (el estilo de todas) o una propia. */
export const OPCIONES_LETRA_TITULO_VISTA = [COMO_LAS_DEMAS, ...OPCIONES_TIPOGRAFIA];
export const OPCIONES_LETRA_FRASE_VISTA = [COMO_LAS_DEMAS, ...OPCIONES_LETRA_FRASE];

/** La letra `cual` del bloque, o `deSiempre` ('' = como las demás; 'montserrat' en Producción). */
export function letraDe(p: object | undefined, cual: CualLetra, deSiempre: string): string {
  const l = objeto(objeto(p).letras)[cual];
  return typeof l === 'string' ? l : deSiempre;
}

/** El bloque con `letras.<cual>` cambiada; `deSiempre` quita la clave y `letras` si queda vacío. */
export function conLetra(p: object | undefined, cual: CualLetra, valor: string, deSiempre: string): Objeto {
  const o: Objeto = { ...objeto(p) };
  const l: Objeto = { ...objeto(o.letras) };
  if (valor === deSiempre) delete l[cual];
  else l[cual] = valor;
  if (Object.keys(l).length) o.letras = l;
  else delete o.letras;
  return o;
}

export function tamanoDe(p: object | undefined, cual: CualTamano): string {
  const t = objeto(objeto(p).tamanos)[cual];
  return typeof t === 'string' ? t : 'normal';
}

/** El bloque con `tamanos.<cual>` cambiado; `normal` quita la clave y `tamanos` si queda vacío. */
export function conTamano(p: object | undefined, cual: CualTamano, valor: string): Objeto {
  const o: Objeto = { ...objeto(p) };
  const t: Objeto = { ...objeto(o.tamanos) };
  if (valor === 'normal') delete t[cual];
  else t[cual] = valor;
  if (Object.keys(t).length) o.tamanos = t;
  else delete o.tamanos;
  return o;
}

export type CualFoto = 'imagen' | 'fondo';
export interface Encuadre {
  x: number;
  y: number;
  zoom: number;
}
const ENCUADRE_DE_SIEMPRE: Record<CualFoto, Encuadre> = { imagen: { x: 50, y: 20, zoom: 100 }, fondo: { x: 50, y: 50, zoom: 100 } };
const SIN_FOTO_FIJA = [undefined, 'automatica', 'logo', 'ninguna'];

/**
 * La foto que se puede mover, como la nombra el encuadre (`patrono`, `galeria:taller`), o null: la imagen es la del
 * tipo, el logo o ninguna, el fondo no es una foto, o es el arco de Evento (lleva siempre el logo).
 */
export function fotoEncuadrable(p: object | undefined, cual: CualFoto, vista: string, conPatrono = true): string | null {
  const o = objeto(p);
  if (cual === 'fondo') {
    const f = objeto(o.fondo);
    return f.tipo === 'imagen' && typeof f.imagen === 'string' && f.imagen ? `galeria:${f.imagen}` : null;
  }
  if (vista === 'evento') return null;
  const im = o.imagen;
  // Sin imagen del patrono la pantalla muestra la fachada: no hay foto del patrono que mover.
  if (im === 'patrono' && !conPatrono) return null;
  return typeof im === 'string' && !SIN_FOTO_FIJA.includes(im) ? im : null;
}

/** El encuadre guardado si es de la foto que se ve; si no, el de siempre (arco 50/20/100, fondo 50/50/100). */
export function encuadreDe(p: object | undefined, cual: CualFoto, vista: string): Encuadre {
  const de = fotoEncuadrable(p, cual, vista);
  const e = objeto(objeto(objeto(p).encuadre)[cual]);
  if (de === null || e.de !== de) return { ...ENCUADRE_DE_SIEMPRE[cual] };
  const n = (v: unknown, d: number) => (typeof v === 'number' ? v : d);
  const s = ENCUADRE_DE_SIEMPRE[cual];
  return { x: n(e.x, s.x), y: n(e.y, s.y), zoom: n(e.zoom, s.zoom) };
}

/** El bloque con el encuadre de `cual` guardado para la foto que se ve; `null` («Volver a como venía») lo quita. */
export function conEncuadre(p: object | undefined, cual: CualFoto, valores: Encuadre | null, vista: string): Objeto {
  const o: Objeto = { ...objeto(p) };
  const e: Objeto = { ...objeto(o.encuadre) };
  const de = fotoEncuadrable(o, cual, vista);
  if (valores === null || de === null) delete e[cual];
  else e[cual] = { de, x: valores.x, y: valores.y, zoom: valores.zoom };
  if (Object.keys(e).length) o.encuadre = e;
  else delete o.encuadre;
  return o;
}
