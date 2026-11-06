import { requireNativeView } from 'expo';
import * as React from 'react';
import { StyleProp, ViewStyle } from 'react-native';

const VistaNativa: React.ComponentType<{ style?: StyleProp<ViewStyle> }> = requireNativeView('Transmisor');

// Vista previa de la cámara. Empieza a mostrar imagen después de prepararVista().
export default function VistaTransmisor(props: { style?: StyleProp<ViewStyle> }) {
  return <VistaNativa {...props} />;
}
