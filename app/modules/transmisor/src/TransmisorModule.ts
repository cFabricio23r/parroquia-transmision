import { NativeModule, requireNativeModule } from 'expo';

import type { Calidad, Microfono } from '../../../src/ajustes/ajustes';
import { TransmisorModuleEvents } from './Transmisor.types';

declare class TransmisorModule extends NativeModule<TransmisorModuleEvents> {
  version(): Promise<string>;
  prepararVista(calidad: Calidad, microfono: Microfono): Promise<void>;
  /** `url` es servidor + clave. La clave va aparte solo para taparla si aparece en un texto. */
  iniciar(url: string, clave: string): Promise<void>;
  terminar(): Promise<void>;
}

// Carga el módulo nativo «Transmisor» (solo Android).
export default requireNativeModule<TransmisorModule>('Transmisor');
