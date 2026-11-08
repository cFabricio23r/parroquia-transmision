import { NativeModule, requireNativeModule } from 'expo';

import type { Calidad, EstiloFinal, Microfono } from '../../../src/ajustes/ajustes';
import type { Orientacion } from '../../../src/estado/orientacion';
import type { Escena } from '../../../src/estado/transmision';
import { TransmisorModuleEvents } from './Transmisor.types';

declare class TransmisorModule extends NativeModule<TransmisorModuleEvents> {
  version(): Promise<string>;
  prepararVista(calidad: Calidad, microfono: Microfono): Promise<void>;
  /** `url` es servidor + clave. La clave va aparte solo para taparla si aparece en un texto. */
  iniciar(url: string, clave: string): Promise<void>;
  terminar(): Promise<void>;
  /** Transición del logo a la escena; resuelve al terminar (unos 2 s). */
  cambiarEscena(escena: Escena): Promise<void>;
  /** Escribe el estado en las escenas cargadas (y en las que se carguen después). */
  actualizarEstado(json: string): Promise<void>;
  /** Datos del sistema para los avisos y el registro (Tarea 9). */
  medir(): Promise<MedidaNativa>;
  /** El estado térmico, la temperatura y los fps, sin leer la memoria (para los avisos, cada 10 s). */
  medirAvisos(): Promise<{ termico: number | null; temperatura: number | null; fpsVideo: number | null }>;
  /** Rango del zoom de la cámara; null si la cámara está apagada o no tiene zoom (Tarea 9g). */
  rangoZoom(): Promise<{ min: number; max: number } | null>;
  /** Pone el zoom; el nativo lo deja dentro del rango. */
  ponerZoom(nivel: number): Promise<void>;
  /** Archivo nuevo del registro (deja los últimos 10). */
  abrirRegistro(nombre: string, encabezado: string): Promise<void>;
  anotarRegistro(linea: string): Promise<void>;
  cerrarRegistro(): Promise<void>;
  /** Ruta absoluta del registro más nuevo, o null. */
  ultimoRegistro(): Promise<string | null>;
  /** true si No molestar está activo; null si no se sabe. */
  noMolestarActivo(): Promise<boolean | null>;
  /** Abre la pantalla de No molestar del sistema (o los Ajustes). false si no pudo. */
  abrirNoMolestar(): Promise<boolean>;
  /** Fija la orientación de la pantalla del operador (Tarea 9c). */
  fijarOrientacion(orientacion: Orientacion): Promise<void>;
  /** Zonas seguras del momento, en dp (Tarea 9c). */
  zonasSeguras(): Promise<ZonasSeguras>;
  /** Estilo de la escena Producción; la recarga si ya está cargada (Tarea 9d). */
  fijarEstiloFinal(estilo: EstiloFinal): Promise<void>;
}

export type ZonasSeguras = { top: number; bottom: number; left: number; right: number };

export type MedidaNativa = {
  /** PowerManager.getCurrentThermalStatus(), null antes de Android 10. */
  termico: number | null;
  /** Temperatura de la batería, °C. */
  temperatura: number | null;
  memoriaMb: number | null;
  fpsVideo: number | null;
  fpsCapa: number | null;
};

// Carga el módulo nativo «Transmisor» (solo Android).
export default requireNativeModule<TransmisorModule>('Transmisor');
