// Validación de la configuración de una parroquia: reutiliza `validarConfig` de vicaria/parroquia.js
// (ver validar-nucleo.mjs). Los tipos viven en validar-nucleo.d.mts.
export { validarConfig, validarBorrador, contraste } from './validar-nucleo.mjs';
export type { ResultadoValidacion } from './validar-nucleo.mjs';
