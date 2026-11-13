// Avisos de la transmisión (Tarea 9): señal, batería, calor y red. TypeScript puro, con tests.
// Las reglas son las del plan; el calor se ajustó con la medición de la Tarea 1.
import type { Calidad } from '../ajustes/ajustes';
import type { Conexion } from '../../modules/transmisor/src/eventos';
import type { Fase } from '../estado/transmision';

export type Aviso = {
  id: 'senal' | 'bateria' | 'calor' | 'sin_red';
  nivel: 'ambar' | 'rojo';
  titulo: string;
  detalle: string;
};

export type EntradaAvisos = {
  conexion: Conexion;
  /** De 0 a 1 (expo-battery). null o negativo: no se sabe. */
  bateria: number | null;
  /** Temperatura de la batería en °C (el nativo no tiene otra). */
  temperatura: number | null;
  /** PowerManager.getCurrentThermalStatus(): solo cuenta 3 (severo) o más. null antes de Android 10. */
  termico: number | null;
  hayRed: boolean;
  /** Si es 1080p, el aviso rojo de calor sugiere bajar a 720p. */
  calidad?: Calidad;
};

const TERMICO_SEVERO = 3;
// El ámbar sale solo por los grados de la batería. El «moderado» de Android (2) mira el procesador
// y en la prueba del 2026-11-07 avisaba con la batería a 32–35 °C, sin problema real.
const TEMPERATURA_ALTA = 42;
const BATERIA_BAJA = 0.15;

const numero = (x: number | null): x is number => x !== null && Number.isFinite(x);

/** Los avisos que corresponden, en orden: sin_red, senal, bateria, calor. */
export function avisosActivos(e: EntradaAvisos): Aviso[] {
  const r: Aviso[] = [];
  if (!e.hayRed) {
    r.push({ id: 'sin_red', nivel: 'rojo', titulo: 'Sin internet', detalle: 'Revise el wifi o los datos.' });
  }
  if (e.conexion === 'reconectando') {
    r.push({
      id: 'senal',
      nivel: 'ambar',
      titulo: 'Señal débil: reconectando…',
      detalle: 'No cierre la app. La transmisión sigue en cuanto vuelva la señal.',
    });
  }
  if (numero(e.bateria) && e.bateria >= 0 && e.bateria <= BATERIA_BAJA) {
    r.push({
      id: 'bateria',
      nivel: 'ambar',
      titulo: `Batería ${Math.round(e.bateria * 100)} %`,
      detalle: 'Conecte el cargador.',
    });
  }
  if (numero(e.termico) && e.termico >= TERMICO_SEVERO) {
    const detalle = 'Póngalo a la sombra, sin funda y en un cargador de pared.';
    r.push({
      id: 'calor',
      nivel: 'rojo',
      titulo: 'El celular está muy caliente',
      detalle: e.calidad === '1080p' ? `${detalle} Pase a 720p en Ajustes.` : detalle,
    });
  } else if (numero(e.temperatura) && e.temperatura >= TEMPERATURA_ALTA) {
    r.push({ id: 'calor', nivel: 'ambar', titulo: 'El celular está caliente', detalle: 'Sáquelo del sol o quítele la funda.' });
  }
  return r;
}

/** La conexión para los avisos: solo «reconectando» da el aviso de señal (review M10). */
export function conexionParaAvisos(fase: Fase): Conexion {
  return fase === 'reconectando' ? 'reconectando' : 'conectado';
}
