// Batería leída del nativo cada 10 s (Tarea 9h). TypeScript puro, con tests.
//
// No se usa el aviso de nivel de expo-battery: en Android (58.0.3, BatteryModule.kt) solo escucha
// ACTION_BATTERY_LOW y ACTION_BATTERY_OKAY, cerca del 15 %, y en la misa del 2026-11-15 la batería
// quedó en 70 % durante 1 h 40 min. El nativo lee el ACTION_BATTERY_CHANGED fijo y manda los
// números crudos; acá se interpretan.

/** Lo que manda el nativo: EXTRA_LEVEL, EXTRA_SCALE, EXTRA_STATUS y EXTRA_PLUGGED. */
export type BateriaCruda = { nivel: number; escala: number; estado: number; enchufe: number };

export type Bateria = {
  /** De 0 a 1, o null si no se sabe. */
  nivel: number | null;
  /** true cargando o llena, false desenchufada, null si no se sabe. */
  cargando: boolean | null;
};

// android.os.BatteryManager (javap sobre android-36/android.jar).
const CARGANDO = 2;
const DESCARGANDO = 3;
const SIN_CARGAR = 4;
const LLENA = 5;

export function leerBateria(c: BateriaCruda | null | undefined): Bateria {
  if (!c) return { nivel: null, cargando: null };
  const nivel = c.nivel >= 0 && c.escala > 0 ? c.nivel / c.escala : null;
  let cargando: boolean | null = null;
  if (c.estado === CARGANDO || c.estado === LLENA) cargando = true;
  else if (c.estado === DESCARGANDO) cargando = false;
  // Sin cargar y enchufado es la carga pausada (protección de batería): no se sabe si sube o baja.
  else if (c.estado === SIN_CARGAR) cargando = c.enchufe === 0 ? false : null;
  return { nivel, cargando };
}
