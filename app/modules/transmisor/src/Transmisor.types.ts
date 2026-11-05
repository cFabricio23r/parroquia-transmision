// Tipos del módulo Transmisor.
export type EventoEstado = {
  estado: string;
};

export type TransmisorModuleEvents = {
  onEstado: (evento: EventoEstado) => void;
};
