// Portada animada al abrir (Tarea 9f, lienzo «App Android»: «Splash animado» y «Guion del splash»).
// Va encima de la app ya montada y sigue el guion de src/portada/portada.ts (TRAMOS, ~1,6 s):
// 1. el cuadro de partida es igual al splash del sistema: el logo quieto sobre #0c3562, centrado y de
//    150 dp de ancho (el `imageWidth` de expo-splash-screen en app.json), para que no haya salto;
// 2. pasa el rayo de luz, entra el degradado y el logo sube a su lugar y crece un poco, con el brillo;
// 3. aparece el punto rojo en vivo y late con dos ondas;
// 4. suben «Parroquia en Vivo» y «COMUNICACIONES», y abajo, la Pastoral.
// Un toque la salta al cuadro 4. Con «reducir movimiento» se ve el cuadro 4 quieto. Cuándo se va lo
// decide App.tsx (fasePortada): la animación terminó o se tocó, y además el panel ya cargó. Al irse,
// se desvanece y la app queda a la vista.
// Todo se anima con Animated y el driver nativo (solo opacidad y transformaciones).
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { F } from '../componentes/tema';
import { DURACION_ANIMACION_MS, TRAMOS, animacionTerminada } from '../portada/portada';

const LOGO = require('../../assets/portada/logo-blanco.png');
// Proporción del logo (obs/img/logo-blanco.png, 225×141).
const LOGO_PROPORCION = 141 / 225;
/** Ancho del logo en el splash del sistema (app.json, expo-splash-screen `imageWidth`). */
const LOGO_SPLASH = 150;
const DESVANECER_MS = 250;

// Curvas del lienzo (AppSplash2: el cubic-bezier de cada keyframe).
const SUAVE = Easing.bezier(0.2, 0.8, 0.2, 1);
const REBOTE = Easing.bezier(0.3, 1.6, 0.5, 1);

interface Props {
  /** false: empieza a desvanecerse y, al terminar, deja de dibujarse. */
  visible: boolean;
  /** Barra de estado, recorte y navegación, en dp (los lee App). */
  zonas: { top: number; bottom: number; left: number; right: number };
  /** Se llama una sola vez, cuando ya no hay que esperar la animación (terminó, se tocó o no hay). */
  onTerminada: () => void;
}

/** Las piezas que se animan; cada una va de 0 (cuadro 1) a 1 (cuadro 4). */
const PIEZAS = ['fondo', 'rayo', 'logo', 'brillo', 'vivo', 'ondaA', 'ondaB', 'titulo', 'sub', 'pie'] as const;
type Pieza = (typeof PIEZAS)[number];

/** Cuándo corre cada pieza (ms desde el inicio) y con qué curva. Sale de TRAMOS y de los keyframes. */
function plan(): Record<Pieza, { desde: number; dura: number; curva: (t: number) => number }> {
  const { logo, vivo, textos } = TRAMOS;
  const tLogo = logo.hasta - logo.desde; // 500 ms
  const tTextos = textos.hasta - textos.desde; // 700 ms
  return {
    fondo: { desde: logo.desde, dura: 400, curva: Easing.out(Easing.quad) },
    rayo: { desde: logo.desde, dura: tLogo, curva: Easing.inOut(Easing.quad) },
    logo: { desde: logo.desde, dura: tLogo, curva: SUAVE },
    brillo: { desde: logo.desde + 120, dura: tLogo - 120, curva: Easing.out(Easing.quad) },
    vivo: { desde: vivo.desde, dura: 160, curva: REBOTE },
    ondaA: { desde: vivo.desde, dura: 300, curva: Easing.out(Easing.quad) },
    ondaB: { desde: vivo.desde + 100, dura: 300, curva: Easing.out(Easing.quad) },
    titulo: { desde: textos.desde, dura: Math.round(tTextos * 0.5), curva: SUAVE },
    sub: { desde: textos.desde + Math.round(tTextos * 0.2), dura: Math.round(tTextos * 0.5), curva: SUAVE },
    pie: { desde: textos.desde + Math.round(tTextos * 0.4), dura: Math.round(tTextos * 0.6), curva: Easing.out(Easing.quad) },
  };
}

export default function Portada({ visible, zonas: z, onTerminada }: Props) {
  const { width, height } = useWindowDimensions();

  const opacidad = useRef(new Animated.Value(1)).current;
  const [montada, setMontada] = useState(true);
  const valores = useRef(
    Object.fromEntries(PIEZAS.map((p) => [p, new Animated.Value(0)])) as Record<Pieza, Animated.Value>,
  ).current;
  const animacion = useRef<Animated.CompositeAnimation | null>(null);
  const avisada = useRef(false);
  const alTerminar = useRef(onTerminada);
  alTerminar.current = onTerminada;

  const avisar = useCallback((e: { transcurridoMs: number; tocada: boolean; reducirMovimiento: boolean }) => {
    if (avisada.current || !animacionTerminada(e)) return;
    avisada.current = true;
    alTerminar.current();
  }, []);

  /** Deja todo en el cuadro 4, sin animar. */
  const alFinal = useCallback(() => {
    animacion.current?.stop();
    for (const p of PIEZAS) valores[p].setValue(1);
  }, [valores]);

  // Arranca al montarse, que es cuando App esconde el splash del sistema (ya cargaron las fuentes).
  useEffect(() => {
    let vigente = true;
    let reloj: ReturnType<typeof setTimeout> | undefined;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reducir) => {
        if (!vigente || avisada.current) return;
        if (reducir) {
          alFinal();
          avisar({ transcurridoMs: 0, tocada: false, reducirMovimiento: true });
          return;
        }
        const p = plan();
        animacion.current = Animated.parallel(
          PIEZAS.map((pieza) =>
            Animated.timing(valores[pieza], {
              toValue: 1,
              delay: p[pieza].desde,
              duration: p[pieza].dura,
              easing: p[pieza].curva,
              useNativeDriver: true,
            }),
          ),
        );
        animacion.current.start();
        // El reloj de la regla es este, no el final de Animated (que no avisa si se detiene).
        reloj = setTimeout(
          () => avisar({ transcurridoMs: DURACION_ANIMACION_MS, tocada: false, reducirMovimiento: false }),
          DURACION_ANIMACION_MS,
        );
      });
    return () => {
      vigente = false;
      if (reloj) clearTimeout(reloj);
      animacion.current?.stop();
    };
  }, [alFinal, avisar, valores]);

  useEffect(() => {
    if (visible) return;
    Animated.timing(opacidad, { toValue: 0, duration: DESVANECER_MS, useNativeDriver: true }).start(() =>
      setMontada(false),
    );
  }, [visible, opacidad]);

  const saltar = useCallback(() => {
    alFinal();
    avisar({ transcurridoMs: 0, tocada: true, reducirMovimiento: false });
  }, [alFinal, avisar]);

  if (!montada) return null;

  // Medidas del lienzo (390×844). Acostado (~390 dp de alto) todo se achica para que entre el pie.
  const baja = height < 600;
  const anchoLogo = baja ? 120 : 190;
  const altoLogo = anchoLogo * LOGO_PROPORCION;
  const logoTop = baja ? Math.round(height * 0.13) : Math.round((height * 250) / 844);
  const textosTop = baja ? logoTop + altoLogo + 26 : logoTop + 170;
  const brilloLado = baja ? 210 : 300;
  // Cuadro 1: el logo donde y como lo deja el splash del sistema (centrado, 150 dp de ancho).
  const desdeY = height / 2 - (logoTop + altoLogo / 2);
  const desdeEscala = LOGO_SPLASH / anchoLogo;
  const anchoRayo = width * 0.45;

  const v = valores;
  const entre = (a: number, b: number) => ({ inputRange: [0, 1], outputRange: [a, b] });

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, estilos.base, { opacity: opacidad }]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={saltar}
        accessibilityLabel="Parroquia en Vivo. Cargando."
        accessibilityHint="Toque para saltar la presentación."
      >
        <Animated.View style={[StyleSheet.absoluteFill, estilos.degradado, { opacity: v.fondo }]} />
        <Animated.View
          style={[
            estilos.rayo,
            {
              width: anchoRayo,
              height: height * 1.4,
              top: -height * 0.2,
              opacity: v.rayo.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.55, 0] }),
              // Como el keyframe «rayo»: de -120 % a 140 % de su propio ancho, inclinado 18°.
              transform: [
                { translateX: v.rayo.interpolate(entre(-1.2 * anchoRayo, 1.4 * anchoRayo)) },
                { rotate: '18deg' },
              ],
            },
          ]}
        />
        <Animated.View
          style={[
            estilos.brillo,
            {
              width: brilloLado,
              height: brilloLado,
              borderRadius: brilloLado / 2,
              left: (width - brilloLado) / 2,
              top: logoTop + altoLogo / 2 - brilloLado / 2 + 20,
              opacity: v.brillo,
              transform: [{ scale: v.brillo.interpolate(entre(0.6, 1)) }],
            },
          ]}
        />
        <Animated.View
          style={{
            position: 'absolute',
            top: logoTop,
            left: (width - anchoLogo) / 2,
            width: anchoLogo,
            height: altoLogo,
            transform: [
              { translateY: v.logo.interpolate(entre(desdeY, 0)) },
              { scale: v.logo.interpolate(entre(desdeEscala, 1)) },
            ],
          }}
        >
          <Image
            source={LOGO}
            style={[estilos.logo, { width: anchoLogo, height: altoLogo }]}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
          {/* El punto en vivo, arriba a la derecha de la cruz (22 dp con aro blanco de 4). */}
          <View style={estilos.vivoCaja}>
            {[v.ondaA, v.ondaB].map((onda, i) => (
              <Animated.View
                key={i}
                style={[
                  estilos.onda,
                  {
                    opacity: onda.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.9, 0] }),
                    transform: [{ scale: onda.interpolate(entre(0.4, 2.6)) }],
                  },
                ]}
              />
            ))}
            <Animated.View style={[estilos.vivo, { opacity: v.vivo, transform: [{ scale: v.vivo }] }]} />
          </View>
        </Animated.View>
        <View style={[estilos.textos, { top: textosTop, left: z.left, right: z.right }]}>
          <Animated.Text
            style={[
              estilos.titulo,
              baja && estilos.tituloBajo,
              { opacity: v.titulo, transform: [{ translateY: v.titulo.interpolate(entre(14, 0)) }] },
            ]}
          >
            Parroquia en Vivo
          </Animated.Text>
          <Animated.View
            style={[estilos.sub, { opacity: v.sub, transform: [{ translateY: v.sub.interpolate(entre(10, 0)) }] }]}
          >
            <View style={estilos.raya} />
            <Text style={estilos.subTexto}>COMUNICACIONES</Text>
            <View style={estilos.raya} />
          </Animated.View>
        </View>
        <Animated.Text
          style={[estilos.pie, { bottom: (baja ? 16 : 56) + z.bottom, left: z.left, right: z.right, opacity: v.pie }]}
        >
          Pastoral de Comunicaciones{'\n'}
          <Text style={estilos.pieFuerte}>PARROQUIA DE CIUDAD ARCE</Text>
        </Animated.Text>
      </Pressable>
    </Animated.View>
  );
}

const estilos = StyleSheet.create({
  // El color del splash del sistema; el degradado del lienzo entra encima en el cuadro 2.
  base: { backgroundColor: '#0c3562', overflow: 'hidden' },
  degradado: { backgroundImage: 'linear-gradient(180deg, #0c3562 0%, #1155a4 68%, #1f6fc4 100%)' },
  rayo: {
    position: 'absolute',
    left: 0,
    backgroundImage:
      'linear-gradient(90deg, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 0.22) 50%, rgba(255, 255, 255, 0) 100%)',
  },
  brillo: {
    position: 'absolute',
    backgroundImage: 'radial-gradient(circle, rgba(255, 255, 255, 0.3) 0%, rgba(255, 255, 255, 0) 65%)',
  },
  // La sombra del logo del lienzo (drop-shadow). Que se vea en el celular no está verificado.
  logo: { filter: 'drop-shadow(0px 14px 26px rgba(5, 20, 50, 0.45))' },
  vivoCaja: { position: 'absolute', right: -16, top: -14, width: 22, height: 22 },
  onda: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#ff6b5e',
  },
  // El aro blanco de 4 dp del lienzo (box-shadow) va como borde: 22 + 2 × 4 = 30 dp.
  vivo: {
    position: 'absolute',
    left: -4,
    top: -4,
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 4,
    borderColor: '#ffffff',
    backgroundColor: '#dd0300',
  },
  textos: { position: 'absolute', alignItems: 'center', gap: 12 },
  titulo: { fontFamily: F.negra, fontSize: 34, letterSpacing: -0.5, color: '#ffffff' },
  tituloBajo: { fontSize: 28 },
  sub: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  raya: { width: 26, height: 2, backgroundColor: '#8cc0ef' },
  subTexto: { fontFamily: F.negrita, fontSize: 13, letterSpacing: 3, color: '#d6e6f8' },
  pie: {
    position: 'absolute',
    textAlign: 'center',
    fontFamily: F.semi,
    fontSize: 12.5,
    lineHeight: 20,
    color: '#d6e6f8',
  },
  pieFuerte: { fontFamily: F.extra, letterSpacing: 1, color: '#ffffff' },
});
