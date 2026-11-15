// El panel de la parroquia en la vista nativa VistaPanel (VistaPanel.kt, etapa 3a).
// El nombre «VistaPanel» es el de Name() en TransmisorModule.kt; las funciones de vista
// (inyectar) quedan en el ref (expo-modules-core 58, NativeViewManagerAdapter, leído: no ejecutado).
import { requireNativeView } from 'expo';
import type * as React from 'react';
import type { NativeSyntheticEvent, StyleProp, ViewStyle } from 'react-native';

export type EventoMensaje = NativeSyntheticEvent<{ url: string; data: string }>;
export type EventoCargado = NativeSyntheticEvent<{ url: string }>;

export interface PropsVistaPanel {
  url: string;
  origen: string;
  scriptAlCargar: string;
  onMensaje?: (e: EventoMensaje) => void;
  onCargado?: (e: EventoCargado) => void;
  onProcesoCaido?: () => void;
  style?: StyleProp<ViewStyle>;
}

/** Lo que el ref de la vista nativa expone. */
export interface VistaPanelNativa {
  inyectar(script: string): Promise<void>;
}

const VistaPanel: React.ComponentType<PropsVistaPanel & { ref?: React.Ref<VistaPanelNativa> }> =
  requireNativeView('Transmisor', 'VistaPanel');

export default VistaPanel;
