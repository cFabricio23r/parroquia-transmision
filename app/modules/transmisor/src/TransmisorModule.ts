import { NativeModule, requireNativeModule } from 'expo';

import type { Calidad, Microfono } from '../../../src/ajustes/ajustes';
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
  /** Solo el estado térmico y la temperatura, sin leer la memoria (para los avisos, cada 10 s). */
  medirAvisos(): Promise<{ termico: number | null; temperatura: number | null }>;
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
}

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
