// Portada al abrir (Tarea 9b, lienzo «App Android», artboard 8): el logo de la parroquia sobre el
// azul, «Parroquia en vivo» y la etiqueta roja. Va encima de la app mientras carga el panel y se
// desvanece al terminar (App.tsx decide cuándo, con src/portada/portada.ts).
// El diseño es vertical (390×844); acostado se achica el logo para que entre el pie.
import { useEffect, useRef, useState } from 'react';
import { Animated, Image, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { F } from '../componentes/tema';

const LOGO = require('../../assets/portada/logo-blanco.png');
// Proporción del logo (obs/img/logo-blanco.png, 225×141).
const LOGO_PROPORCION = 141 / 225;
const DESVANECER_MS = 250;

interface Props {
  /** false: empieza a desvanecerse y, al terminar, deja de dibujarse. */
  visible: boolean;
  /** Barra de estado, recorte y navegación, en dp (los lee App). */
  zonas: { top: number; bottom: number; left: number; right: number };
}

export default function Portada({ visible, zonas: z }: Props) {
  const { width, height } = useWindowDimensions();
  // El azul llega hasta los bordes; el logo y los textos, no (Tarea 9c: zonas seguras).
  const opacidad = useRef(new Animated.Value(1)).current;
  const [montada, setMontada] = useState(true);

  useEffect(() => {
    if (visible) return;
    Animated.timing(opacidad, { toValue: 0, duration: DESVANECER_MS, useNativeDriver: true }).start(() =>
      setMontada(false),
    );
  }, [visible, opacidad]);

  if (!montada) return null;

  // Acostado (~390 dp de alto) el logo de 150 dp no deja lugar al pie.
  const baja = height < 600;
  const anchoLogo = baja ? 110 : 150;
  const brillo = Math.min(630, 1.6 * Math.max(width, height));

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        estilos.fondo,
        { opacity: opacidad, paddingTop: z.top, paddingBottom: z.bottom, paddingLeft: z.left, paddingRight: z.right },
      ]}
      accessible
      accessibilityLabel="Parroquia en vivo. Cargando."
    >
      <View
        style={[
          estilos.brillo,
          {
            width: brillo,
            height: brillo,
            borderRadius: brillo / 2,
            left: (width - brillo) / 2,
            top: (height - brillo) / 2 + (baja ? 0 : 20),
          },
        ]}
      />
      <View style={[estilos.centro, { gap: baja ? 16 : 22 }]}>
        <View style={estilos.sombraLogo}>
          <Image
            source={LOGO}
            style={{ width: anchoLogo, height: anchoLogo * LOGO_PROPORCION }}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
        </View>
        <View style={estilos.textos}>
          <Text style={estilos.titulo}>Parroquia en vivo</Text>
          <View style={estilos.etiqueta}>
            <View style={estilos.punto} />
            <Text style={estilos.etiquetaTexto}>TRANSMISIÓN DE LA MISA</Text>
          </View>
        </View>
      </View>
      <Text style={[estilos.pie, { bottom: (baja ? 20 : 56) + z.bottom, left: z.left, right: z.right }]}>
        Parroquia Inmaculada Concepción de María{'\n'}Ciudad Arce
      </Text>
    </Animated.View>
  );
}

const estilos = StyleSheet.create({
  fondo: {
    backgroundColor: '#0c3562',
    backgroundImage: 'linear-gradient(180deg, #0c3562 0%, #1155a4 70%, #1f6fc4 100%)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  brillo: {
    position: 'absolute',
    backgroundImage: 'radial-gradient(circle, rgba(255, 255, 255, 0.22) 0%, rgba(255, 255, 255, 0) 62%)',
  },
  centro: { alignItems: 'center' },
  // La sombra del logo del diseño (drop-shadow). Que se vea en el celular no está verificado.
  sombraLogo: { filter: 'drop-shadow(0px 12px 24px rgba(5, 20, 50, 0.45))' },
  textos: { alignItems: 'center', gap: 10 },
  titulo: { fontFamily: F.negra, fontSize: 30, letterSpacing: -0.5, color: '#ffffff' },
  etiqueta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#dd0300',
    borderRadius: 8,
    paddingVertical: 6,
    paddingLeft: 10,
    paddingRight: 12,
  },
  punto: { width: 9, height: 9, borderRadius: 4.5, backgroundColor: '#ffffff' },
  etiquetaTexto: { fontFamily: F.extra, fontSize: 13, letterSpacing: 1.5, color: '#ffffff' },
  pie: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontFamily: F.semi,
    fontSize: 13,
    lineHeight: 19.5,
    color: '#d6e6f8',
  },
});
