// Tipos del módulo Transmisor.
import type { EventoNativo } from './eventos';

export type { Conexion, EventoEstado, EventoNativo } from './eventos';

export type TransmisorModuleEvents = {
  onEstado: (evento: EventoNativo) => void;
  /** El servicio en primer plano arrancó (ok) o no (review M4 de la Tarea 9). */
  onServicio: (evento: { ok: boolean }) => void;
  /** Cambiaron las barras del sistema o el recorte (Tarea 9i): { top, bottom, left, right } en dp. */
  onZonas: (evento: { top: number; bottom: number; left: number; right: number }) => void;
};
