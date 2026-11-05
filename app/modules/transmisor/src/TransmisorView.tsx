import { requireNativeView } from 'expo';
import * as React from 'react';
import { ViewProps } from 'react-native';

const VistaNativa: React.ComponentType<ViewProps> = requireNativeView('Transmisor');

// Vista de la vista previa de la cámara (vacía por ahora).
export default function TransmisorView(props: ViewProps) {
  return <VistaNativa {...props} />;
}
