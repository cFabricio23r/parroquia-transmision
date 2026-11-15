export interface ResultadoValidacion { ok: boolean; errores: string[] }
export function validarConfig(config: unknown, slug: string): ResultadoValidacion;
export function validarBorrador(borrador: unknown, slug: string): ResultadoValidacion;
export function contraste(hexA: string, hexB: string): number;
import type { TipoCampos } from './semana';
export type TipoComun = TipoCampos & { nombrePanel: string };
export function tiposComunes(): TipoComun[];
