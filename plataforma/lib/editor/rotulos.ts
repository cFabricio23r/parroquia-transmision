// Rótulos y estilo (plan 4, Tarea 5; spec, secciones 5 y 6): opciones de los segmentados, los colores
// del rótulo elegidos entre los de la parroquia, la nota del acento y los cargos sugeridos. Sin React.
import { contraste, formatearRazon, MIN_CONTRASTE } from '../contraste';

type Objeto = Record<string, unknown>;
const objeto = (v: unknown): Objeto => (v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Objeto) : {});
const RE_HEX = /^#[0-9a-fA-F]{6}$/;
const hexDe = (v: unknown): string | null => (typeof v === 'string' && RE_HEX.test(v) ? v : null);

export const OPCIONES_DISENO = [
  { valor: 'clasico', texto: 'Clásico' },
  { valor: 'tarjeta', texto: 'Tarjeta' },
  { valor: 'minimal', texto: 'Minimal' },
  { valor: 'etiqueta', texto: 'Etiqueta' },
];
export const OPCIONES_TIPOGRAFIA = [
  { valor: 'montserrat', texto: 'Montserrat (la de hoy)' },
  { valor: 'lora', texto: 'Lora (clásica)' },
  { valor: 'source-sans', texto: 'Source Sans (sencilla)' },
  { valor: 'cinzel', texto: 'Cinzel (solemne)' },
  { valor: 'playfair', texto: 'Playfair Display (elegante)' },
  { valor: 'eb-garamond', texto: 'EB Garamond (de libro)' },
  { valor: 'merriweather', texto: 'Merriweather (firme)' },
  { valor: 'nunito', texto: 'Nunito (cercana)' },
  { valor: 'oswald', texto: 'Oswald (angosta)' },
];
/** La `font-family` de cada tipografía, para que la lista del editor muestre cada opción en su letra (estilos/fuentes.css). */
export const FAMILIA_TIPOGRAFIA: Record<string, string> = {
  montserrat: 'Montserrat',
  lora: 'Lora',
  'source-sans': 'SourceSans',
  cinzel: 'Cinzel',
  playfair: 'Playfair',
  'eb-garamond': 'EBGaramond',
  merriweather: 'Merriweather',
  nunito: 'Nunito',
  oswald: 'Oswald',
};
/** El nombre de una tipografía sin la explicación: «Playfair Display». Sin valor o uno desconocido, Montserrat. */
export const nombreTipografia = (clave: unknown): string =>
  (OPCIONES_TIPOGRAFIA.find((o) => o.valor === clave) ?? OPCIONES_TIPOGRAFIA[0]).texto.replace(/ \(.*\)$/, '');
/** El nombre de un diseño: «Tarjeta». Sin valor o uno desconocido, Clásico. */
export const nombreDiseno = (clave: unknown): string => (OPCIONES_DISENO.find((o) => o.valor === clave) ?? OPCIONES_DISENO[0]).texto;
export const NOTA_MINIMAL = 'El diseño Minimal no tiene caja';
export const OPCIONES_ESQUINAS = [
  { valor: 'rectas', texto: 'Rectas' },
  { valor: 'suaves', texto: 'Suaves' },
  { valor: 'redondas', texto: 'Redondas' },
];
export const OPCIONES_POSICION = [
  { valor: 'izquierda', texto: 'Abajo a la izquierda' },
  { valor: 'centro', texto: 'Abajo al centro' },
  { valor: 'derecha', texto: 'Abajo a la derecha' },
  { valor: 'arriba-derecha', texto: 'Arriba a la derecha' },
];

const valorDe = (r: unknown, clave: string, opciones: { valor: string }[], defecto: string) => {
  const v = objeto(r)[clave];
  return typeof v === 'string' && opciones.some((o) => o.valor === v) ? v : defecto;
};

/** Sin valor (o uno desconocido) se pinta Montserrat. */
export const tipografiaDe = (r: unknown): string => valorDe(r, 'tipografia', OPCIONES_TIPOGRAFIA, 'montserrat');
/** `redondeadas` (plan 1.1) se pinta como Suaves; sin valor, Suaves. */
export const esquinasDe = (r: unknown): string => (objeto(r).esquinas === 'redondeadas' ? 'suaves' : valorDe(r, 'esquinas', OPCIONES_ESQUINAS, 'suaves'));
export const posicionDe = (r: unknown): string => valorDe(r, 'posicion', OPCIONES_POSICION, 'izquierda');
/** Sin valor (o uno desconocido) se pinta el Clásico, como en vicaria (estiloRotulos). */
export const disenoDe = (r: unknown): string => valorDe(r, 'diseno', OPCIONES_DISENO, 'clasico');
/** Minimal no tiene caja: no usa las esquinas ni el «Fondo del rótulo». Los demás diseños usan los dos. */
export const usaCampo = (diseno: string, _campo: 'esquinas' | 'colorLado'): boolean => diseno !== 'minimal';

export type CampoColorRotulo = 'colorLado' | 'colorLinea';
export interface OpcionColor {
  valor: string;
  texto: string;
  hex: string | null;
}

export const MENSAJE_FALTA_ACENTO = 'Falta el color de acento en Identidad. Elige otro color.';

/**
 * Decisión 8: «Como viene» (valor ''), principal, oscuro, acento (si es hex) y, solo en el fondo,
 * blanco. Un hex propio o un `acento` que ya no existe se agregan al final para no perderlos.
 */
export function opcionesColorRotulo(colores: unknown, campo: CampoColorRotulo, actual: unknown): OpcionColor[] {
  const c = objeto(colores);
  const acento = hexDe(c.acento);
  const nombrada = (nombre: string): OpcionColor => {
    const hex = nombre === 'blanco' ? '#ffffff' : hexDe(c[nombre]);
    return { valor: nombre, texto: hex ? `${hex} (${nombre})` : nombre, hex };
  };
  const primera: OpcionColor =
    campo === 'colorLado'
      ? { valor: '', texto: 'Como viene (degradado)', hex: null }
      : { valor: '', texto: acento ? 'Como viene (acento)' : 'Como viene', hex: null };
  const salida = [primera, nombrada('principal'), nombrada('oscuro')];
  if (acento) salida.push(nombrada('acento'));
  if (campo === 'colorLado') salida.push(nombrada('blanco'));
  if (typeof actual === 'string' && actual && !salida.some((o) => o.valor === actual)) {
    if (RE_HEX.test(actual)) salida.push({ valor: actual, texto: `${actual} (otro color)`, hex: actual });
    else if (actual === 'acento') salida.push({ valor: 'acento', texto: 'acento (falta en Identidad)', hex: null });
    else salida.push({ valor: actual, texto: actual, hex: null });
  }
  return salida;
}

/** El error del campo cuando usa el acento y la parroquia ya no lo tiene (el mismo que al publicar). */
export function errorColorRotulo(colores: unknown, actual: unknown): string | null {
  return actual === 'acento' && !hexDe(objeto(colores).acento) ? MENSAJE_FALTA_ACENTO : null;
}

const FRASE_ACENTO = 'Si usas el acento como fondo, el texto va oscuro; como línea, está bien.';
/** En Tarjeta y Etiqueta la «Línea de acento» es el fondo de la ceja, con texto encima. */
const FRASE_ACENTO_CEJA: Record<string, string> = {
  tarjeta: 'En la píldora de la ceja, el texto sobre el acento se pone oscuro solo para que se lea.',
  etiqueta: 'En la pestaña de la ceja, el texto sobre el acento se pone oscuro solo para que se lea.',
};

/** Decisión 9a: si el texto claro no se lee sobre el acento, su hex, la razón («2,2») y la frase según el diseño. */
export function notaAcento(colores: unknown, diseno = 'clasico'): { hex: string; razon: string; frase: string } | null {
  const acento = hexDe(objeto(colores).acento);
  if (!acento) return null;
  const r = contraste('#ffffff', acento);
  if (r >= MIN_CONTRASTE) return null;
  return { hex: acento, razon: formatearRazon(r).replace(/:1$/, ''), frase: FRASE_ACENTO_CEJA[diseno] ?? FRASE_ACENTO };
}

export const MAX_CARGOS = 12;
export const MAX_CARGO = 200;

/** Los cargos como se muestran en el campo: «Párroco · Vicario». */
export function textoCargos(cargos: unknown): string {
  return Array.isArray(cargos) ? cargos.filter((c) => typeof c === 'string').join(' · ') : '';
}

/** Decisión 10: se corta por «·», se recorta y se quitan los vacíos. Sin cargos, `undefined`. */
export function leerCargos(texto: string): { cargos: string[] | undefined } | { error: string } {
  const cargos = texto
    .split('·')
    .map((c) => c.trim())
    .filter(Boolean);
  if (cargos.length > MAX_CARGOS) return { error: 'Hasta 12 cargos.' };
  if (cargos.some((c) => c.length > MAX_CARGO)) return { error: 'Cada cargo, hasta 200 caracteres.' };
  return { cargos: cargos.length ? cargos : undefined };
}

/** `rotulos` con la clave cambiada (`undefined` la quita); si queda vacío, `undefined`. */
export function conValor(rotulos: unknown, clave: string, valor: unknown): Objeto | undefined {
  const r: Objeto = { ...objeto(rotulos) };
  if (valor === undefined) delete r[clave];
  else r[clave] = valor;
  return Object.keys(r).length ? r : undefined;
}
