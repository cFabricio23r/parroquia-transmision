// Redes y contacto (F10). Convierte lo que escribe la persona en una dirección https:// (Decisión 13).
// Sin React: se prueba sola.

export type Red = 'facebook' | 'youtube' | 'whatsapp' | 'web' | 'instagram';
export interface EntradaRed {
  red: string;
  url: string;
  texto: string;
}

export const CAMPOS_REDES: { red: Red; etiqueta: string; ayuda?: string }[] = [
  { red: 'facebook', etiqueta: 'Facebook' },
  { red: 'youtube', etiqueta: 'YouTube', ayuda: 'Opcional.' },
  { red: 'whatsapp', etiqueta: 'WhatsApp' },
  { red: 'web', etiqueta: 'Sitio web', ayuda: 'Opcional.' },
  { red: 'instagram', etiqueta: 'Instagram', ayuda: 'Opcional.' },
];

export const MENSAJE_WHATSAPP = 'Escribe el número con 8 dígitos, o con el código del país.';
export const MENSAJE_WEB = 'Escribe la dirección completa, por ejemplo parroquia.org.';
const MAX = 200;
const DOMINIOS: Record<'facebook' | 'instagram' | 'youtube', string> = {
  facebook: 'facebook.com',
  instagram: 'instagram.com',
  youtube: 'youtube.com',
};

/** Un punto antes de la primera `/`: «facebook.com/x», «parroquia.org». */
const conDominio = (s: string) => {
  const host = s.split('/')[0];
  return host.includes('.') && !/\s/.test(host);
};

/** La misma regla que vicaria/parroquia.js (RE_HTTPS): sin espacios y con algo después de `https://`. */
const RE_HTTPS = /^https:\/\/\S+$/i;

const mensajeDe = (red: Red) =>
  red === 'whatsapp'
    ? MENSAJE_WHATSAPP
    : red === 'web'
      ? MENSAJE_WEB
      : `No pudimos convertir esto en una dirección. Escríbelo como ${DOMINIOS[red]}/tu-pagina.`;

/**
 * `null` si está vacío; si no, la dirección y el texto que se muestra, o el error para el campo.
 * Nunca devuelve una dirección que el servidor rechazaría por su forma (eso frenaría todo el guardado).
 */
export function normalizarRed(red: Red, escrito: string): { url: string; texto: string } | { error: string } | null {
  const r = convertir(red, escrito);
  if (r && 'url' in r && !RE_HTTPS.test(r.url)) return { error: mensajeDe(red) };
  return r;
}

function convertir(red: Red, escrito: string): { url: string; texto: string } | { error: string } | null {
  const texto = escrito.trim();
  if (!texto) return null;
  if (texto.length > MAX) return { error: 'Hasta 200 caracteres.' };

  if (red === 'whatsapp') {
    if (/^https:\/\//i.test(texto)) return { url: texto, texto };
    const digitos = texto.replace(/[\s\-()+.]/g, '');
    if (!/^\d+$/.test(digitos)) return { error: MENSAJE_WHATSAPP };
    if (digitos.length === 8) return { url: `https://wa.me/503${digitos}`, texto };
    if (digitos.length >= 10 && digitos.length <= 15) return { url: `https://wa.me/${digitos}`, texto };
    return { error: MENSAJE_WHATSAPP };
  }

  if (/^https:\/\//i.test(texto)) return { url: texto, texto };
  if (/^http:\/\//i.test(texto)) return { url: `https://${texto.slice(7)}`, texto };
  if (conDominio(texto)) return { url: `https://${texto}`, texto };
  if (red === 'web') return { error: MENSAJE_WEB };

  const dominio = DOMINIOS[red];
  const usuario = texto.replace(/^@/, '');
  if (!usuario || /[\s/]/.test(usuario)) return { error: mensajeDe(red) };
  return { url: red === 'youtube' ? `https://${dominio}/@${usuario}` : `https://${dominio}/${usuario}`, texto };
}

/** Pone (o quita, con `null`) una red; las demás quedan en su orden; sin ninguna, `undefined`. */
export function ponerRed(redes: EntradaRed[] | undefined, red: Red, valor: { url: string; texto: string } | null): EntradaRed[] | undefined {
  const lista = Array.isArray(redes) ? redes : [];
  let resultado: EntradaRed[];
  if (valor === null) resultado = lista.filter((r) => r.red !== red);
  else if (lista.some((r) => r.red === red)) resultado = lista.map((r) => (r.red === red ? { red, url: valor.url, texto: valor.texto } : r));
  else resultado = [...lista, { red, url: valor.url, texto: valor.texto }];
  return resultado.length ? resultado : undefined;
}
