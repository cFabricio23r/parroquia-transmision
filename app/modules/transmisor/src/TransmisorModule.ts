import { NativeModule, requireNativeModule } from 'expo';

import { TransmisorModuleEvents } from './Transmisor.types';

declare class TransmisorModule extends NativeModule<TransmisorModuleEvents> {
  version(): Promise<string>;
}

// Carga el módulo nativo «Transmisor» (solo Android).
export default requireNativeModule<TransmisorModule>('Transmisor');
