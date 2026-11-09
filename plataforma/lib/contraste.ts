// Contraste del blanco sobre un color. Espejo exacto de `contraste` de vicaria/parroquia.js
// (una prueba compara ambos); vive aparte porque el formulario cliente no puede importar
// validar-nucleo.mjs (lee archivos con fs).
export const MIN_CONTRASTE = 4.5;

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

function luminancia(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Razón de contraste WCAG entre dos colores #rrggbb (de 1 a 21). */
export function contraste(hexA: string, hexB: string): number {
  const a = luminancia(hexA);
  const b = luminancia(hexB);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** «4.9:1, se lee bien» o «3.1:1, no se lee: elige uno más oscuro». Sin color válido: texto vacío. */
export function mensajeContraste(hex: string): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return '';
  const razon = contraste('#ffffff', hex);
  // Se trunca (no se redondea) a un decimal: 4.46 no puede mostrarse como «4.5:1, no se lee».
  const texto = `${(Math.floor(razon * 10) / 10).toFixed(1)}:1`;
  return razon >= MIN_CONTRASTE ? `${texto}, se lee bien` : `${texto}, no se lee: elige uno más oscuro`;
}
