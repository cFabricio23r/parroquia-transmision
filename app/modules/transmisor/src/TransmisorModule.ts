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
}

// Carga el módulo nativo «Transmisor» (solo Android).
export default requireNativeModule<TransmisorModule>('Transmisor');
