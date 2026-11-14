export interface ResultadoValidacion { ok: boolean; errores: string[] }
export function validarConfig(config: unknown, slug: string): ResultadoValidacion;
export function validarBorrador(borrador: unknown, slug: string): ResultadoValidacion;
export function contraste(hexA: string, hexB: string): number;
export interface TipoComun {
  clave: string;
  nombre: string;
  nombrePanel: string;
  rotulos: { id: string; nombre: string }[];
}
export function tiposComunes(): TipoComun[];
