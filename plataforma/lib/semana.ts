// El núcleo compartido de la semana (vicaria/semana.js), con tipos. Sin `server-only`: lo usa el cliente.
// lib/generado/semana.mjs lo genera herramientas/copiar-vicaria.mjs.
import nucleo from './generado/semana.mjs';

export type Uso = { id: string; base: string; nombre: string; ceja?: string; texto?: string; opcional?: boolean };
export type TipoCampos = { clave: string; nombre: string; datos: string[]; rotulos: Uso[] };
export type Campo = { ruta: string; etiqueta: string; opcional: boolean; entrada: 'texto' | 'fecha' };
export type Origen = 'fija' | 'serie' | 'unica';
export type FilaFija = {
  id: string; dia_semana: number; hora: string; tipo: string; datos: Record<string, unknown>; activa: boolean;
};
export type FilaSerie = {
  id: string; nombre: string; tipo: string; inicio: string; dias: number; hora: string; datos: Record<string, unknown>;
};
export type FilaTransmision = {
  id: string; clave: string; fecha: string; hora: string; tipo: string; datos: Record<string, unknown>;
  origen: Origen; fija_id: string | null; serie_id: string | null; saltada: boolean; editada: boolean;
  actualizado_en: string; actualizado_desde: 'web' | 'app';
};
export type ItemSemana = {
  clave: string; fecha: string; hora: string; tipo: string; datos: Record<string, unknown>;
  origen: Origen; fijaId: string | null; serieId: string | null;
  serie: { nombre: string; dias: number; dia: number } | null; diaSemanaFija: number | null;
  id: string | null; saltada: boolean; editada: boolean;
  actualizadoEn: string | null; actualizadoDesde: 'web' | 'app' | null;
};

export interface NucleoSemana {
  esFecha(s: unknown): boolean;
  sumarDias(fecha: string, n: number): string;
  diaSemana(fecha: string): number;
  lunesDe(fecha: string): string;
  claveFija(fijaId: string, fecha: string): string;
  claveSerie(serieId: string, fecha: string): string;
  claveUnica(id: string): string;
  armarSemana(e: { lunes: string; fijas: unknown[]; series: unknown[]; transmisiones: unknown[] }): ItemSemana[];
  tiposParaCampos(TIPOS: object, ORDEN_TIPOS: string[]): TipoCampos[];
  tiposDisponibles(comunes: TipoCampos[], tiposConfig: unknown): TipoCampos[];
  tipoDeClave(disponibles: TipoCampos[], clave: string): TipoCampos | null;
  camposDeTipo(tipo: TipoCampos): Campo[];
  leerCampo(datos: unknown, ruta: string): string;
  escribirCampo(datos: object, ruta: string, valor: string): Record<string, unknown>;
  limpiarDatos(datos: unknown): Record<string, unknown>;
  contarFaltas(tipo: TipoCampos | null, datos: unknown): number | null;
  datosDeEstado(estado: unknown, tipo: TipoCampos): Record<string, unknown>;
  parcheDePanel(item: { tipo: string; datos: unknown }, tipo: TipoCampos): { limpiar: string[]; poner: Record<string, unknown> };
  readonly CLAVES_DE_TRANSMISION: readonly string[];
  readonly LIMITES_FACEBOOK: { readonly titulo: number; readonly descripcion: number };
  textoDia(fecha: string): string;
  textoOrigen(item: ItemSemana): string;
  textoEstado(faltan: number | null): string;
}

export const SEMANA = nucleo as unknown as NucleoSemana;
