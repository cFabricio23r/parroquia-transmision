// Colores y letra de las pantallas: los del panel (Restricciones del plan) y la Montserrat del panel.
// En Android una familia propia no cambia de grosor con fontWeight: cada grosor es su propia familia.
export const C = {
  fondo: '#061224',
  fondo2: '#0a1a30',
  caja: '#10284a',
  borde: '#24497a',
  boton: '#163560',
  primario: '#1155a4',
  seleccion: '#3d9be0',
  seleccionFondo: '#1a3f75',
  texto: '#eef5fc',
  textoClaro: '#d6e6f8',
  suave: '#b4cbe8',
  rojo: '#c8281e',
  rojoSuave: '#ffd9d4',
  verde: '#2fbf7a',
  ambar: '#f0b429',
  ambarFondo: '#3a2c08',
  ambarTexto: '#ffe2a0',
  sobreVista: 'rgba(6, 18, 36, 0.86)',
} as const;

export const F = {
  medio: 'Montserrat_500Medium',
  semi: 'Montserrat_600SemiBold',
  negrita: 'Montserrat_700Bold',
  extra: 'Montserrat_800ExtraBold',
  negra: 'Montserrat_900Black',
} as const;

/** Archivos de la letra, para useFonts (solo los 5 grosores que usa el panel). */
export const FUENTES = {
  [F.medio]: require('@expo-google-fonts/montserrat/500Medium/Montserrat_500Medium.ttf'),
  [F.semi]: require('@expo-google-fonts/montserrat/600SemiBold/Montserrat_600SemiBold.ttf'),
  [F.negrita]: require('@expo-google-fonts/montserrat/700Bold/Montserrat_700Bold.ttf'),
  [F.extra]: require('@expo-google-fonts/montserrat/800ExtraBold/Montserrat_800ExtraBold.ttf'),
  [F.negra]: require('@expo-google-fonts/montserrat/900Black/Montserrat_900Black.ttf'),
};

/** Medidas del lienzo (celular acostado de ~844×390 dp). */
export const M = {
  vistaAncho: 448,
  vistaAlto: 252,
  panelAncho: 360,
  barraAlto: 44,
  abajoAlto: 58,
  separacion: 8,
} as const;
