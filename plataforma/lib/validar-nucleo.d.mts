export interface ResultadoValidacion { ok: boolean; errores: string[] }
export function validarConfig(config: unknown, slug: string): ResultadoValidacion;
export function validarBorrador(borrador: unknown, slug: string): ResultadoValidacion;
