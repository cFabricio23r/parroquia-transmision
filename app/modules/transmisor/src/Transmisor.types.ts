// Tipos del módulo Transmisor.
import type { EventoNativo } from './eventos';

export type { Conexion, EventoEstado, EventoNativo } from './eventos';

export type TransmisorModuleEvents = {
  onEstado: (evento: EventoNativo) => void;
};
