// Zoom y pantalla completa, encima de la vista previa al aire (Tarea 9g).
// Pellizcar la vista hace zoom; los botones − y + van de a 0,5× y «1×» vuelve al inicio.
// En pantalla completa también muestra una barra mínima: EN VIVO con el reloj y los fps.
import { useMemo, useRef } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';

import type { Fase } from '../estado/transmision';
import { formatoFps, formatoReloj, fpsBajo } from '../estado/formato';
import { etiquetaZoom, limitarZoom, zoomPellizco, zoomSiguiente, type RangoZoom } from '../estado/zoom';
import { C, F } from './tema';

interface Props {
  /** null: el celular no informó zoom; no se muestran los botones ni se puede pellizcar. */
  rango: RangoZoom | null;
  zoom: number;
  onZoom: (zoom: number) => void;
  completa: boolean;
  onCompleta: (completa: boolean) => void;
  fase: Fase;
  segundos: number;
  fps: number | null;
}

function distancia(e: GestureResponderEvent): number {
  const [a, b] = e.nativeEvent.touches;
  if (!a || !b) return Number.NaN;
  return Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
}

const dosDedos = (e: GestureResponderEvent) => e.nativeEvent.touches.length >= 2;

export default function ControlesCamara(p: Props) {
  // El responder se arma una vez; lee lo actual por ref.
  const actual = useRef(p);
  actual.current = p;
  const inicio = useRef({ dist: Number.NaN, zoom: 1 });

  const pellizco = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: dosDedos,
        onMoveShouldSetPanResponder: dosDedos,
        onPanResponderGrant: (e) => {
          inicio.current = { dist: distancia(e), zoom: actual.current.zoom };
        },
        onPanResponderMove: (e) => {
          const { rango, onZoom } = actual.current;
          if (!rango || !dosDedos(e)) return;
          // Si el segundo dedo llegó después, la distancia de inicio se toma ahora.
          if (!Number.isFinite(inicio.current.dist)) {
            inicio.current = { dist: distancia(e), zoom: actual.current.zoom };
            return;
          }
          onZoom(zoomPellizco(inicio.current.zoom, inicio.current.dist, distancia(e), rango));
        },
        onPanResponderRelease: () => {
          inicio.current = { dist: Number.NaN, zoom: actual.current.zoom };
        },
        onPanResponderTerminate: () => {
          inicio.current = { dist: Number.NaN, zoom: actual.current.zoom };
        },
      }),
    [],
  );

  const { rango, zoom } = p;
  const reconectando = p.fase === 'reconectando';
  const fps = reconectando ? null : p.fps;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {rango ? <View style={StyleSheet.absoluteFill} {...pellizco.panHandlers} /> : null}

      {p.completa ? (
        <View style={estilos.mini} pointerEvents="none">
          <View style={[estilos.pastilla, { backgroundColor: reconectando ? C.ambarFondo : C.rojo }]}>
            <View style={[estilos.punto, { backgroundColor: reconectando ? C.ambar : '#ffffff' }]} />
            <Text style={estilos.pastillaTexto} accessibilityLiveRegion="polite">
              {reconectando ? 'RECONECTANDO' : 'EN VIVO'}
            </Text>
            <Text style={estilos.pastillaTexto}>{formatoReloj(p.segundos)}</Text>
          </View>
          <Text style={[estilos.chip, !reconectando && fpsBajo(fps) && { color: C.ambar }]}>{formatoFps(fps)}</Text>
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={p.completa ? 'Salir de pantalla completa' : 'Pantalla completa'}
        onPress={() => p.onCompleta(!p.completa)}
        style={[estilos.boton, estilos.completa]}
      >
        <Text style={estilos.botonTexto}>{p.completa ? 'Salir' : 'Pantalla completa'}</Text>
      </Pressable>

      {rango ? (
        <View style={estilos.zoom}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Alejar"
            onPress={() => p.onZoom(zoomSiguiente(zoom, rango, -1))}
            style={[estilos.boton, estilos.cuadrado]}
          >
            <Text style={estilos.signo}>−</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Zoom ${etiquetaZoom(zoom)}. Tocar para volver a 1×`}
            onPress={() => p.onZoom(limitarZoom(1, rango))}
            style={[estilos.boton, estilos.nivel]}
          >
            <Text style={estilos.botonTexto}>{etiquetaZoom(zoom)}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Acercar"
            onPress={() => p.onZoom(zoomSiguiente(zoom, rango, 1))}
            style={[estilos.boton, estilos.cuadrado]}
          >
            <Text style={estilos.signo}>+</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  mini: { position: 'absolute', left: 10, top: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  pastilla: { height: 36, borderRadius: 9, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  punto: { width: 9, height: 9, borderRadius: 5 },
  pastillaTexto: { fontFamily: F.extra, fontSize: 13, letterSpacing: 1, color: C.texto },
  chip: {
    height: 36,
    lineHeight: 36,
    borderRadius: 9,
    paddingHorizontal: 10,
    overflow: 'hidden',
    backgroundColor: C.sobreVista,
    fontFamily: F.semi,
    fontSize: 12,
    color: C.suave,
  },
  boton: {
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: C.sobreVista,
    borderWidth: 1,
    borderColor: C.borde,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completa: { position: 'absolute', right: 10, top: 10, paddingHorizontal: 12 },
  zoom: { position: 'absolute', right: 10, bottom: 10, flexDirection: 'row', gap: 6 },
  cuadrado: { width: 48, height: 48 },
  nivel: { minWidth: 56, height: 48, paddingHorizontal: 8 },
  signo: { fontFamily: F.extra, fontSize: 22, color: C.texto },
  botonTexto: { fontFamily: F.extra, fontSize: 13, color: C.texto },
});
