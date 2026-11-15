// Fila E del lienzo: «Ya no tienes acceso a …» (VicAppSinAcceso), celular acostado. La misma tarjeta
// sirve para «Todavía no tienes una parroquia para transmitir» y para la app mal armada (Decisión 13).
// La nota de diseño «Aparece al abrir la app con internet, nunca durante una transmisión» no se dibuja.
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { C, F } from '../../componentes/tema';
import { TEXTOS, textoConfig, textoSinAcceso } from './textos';

/** La confirmación de la Decisión 12 del plan, antes de cerrar la sesión (Aviso y Ajustes). */
export function confirmarCerrarSesion(alConfirmar: () => void): void {
  const t = TEXTOS.cerrarSesion;
  Alert.alert(t.titulo, t.cuerpo, [
    { text: t.cancelar, style: 'cancel' },
    { text: t.cerrar, style: 'destructive', onPress: alConfirmar },
  ]);
}

export default function Aviso({
  tipo,
  nombre,
  hayOtras,
  onElegir,
  onCerrarSesion,
}: {
  tipo: 'sin-acceso' | 'sin-parroquias' | 'config';
  /** El nombre de la parroquia perdida, o la variable que falta con `tipo: 'config'`. */
  nombre?: string;
  hayOtras?: boolean;
  onElegir?: () => void;
  onCerrarSesion?: () => void;
}) {
  let titulo: string;
  let cuerpo: string | null;
  if (tipo === 'sin-acceso') {
    titulo = textoSinAcceso(nombre ?? '');
    cuerpo = TEXTOS.sinAcceso.cuerpo;
  } else if (tipo === 'sin-parroquias') {
    titulo = TEXTOS.sinParroquias.titulo;
    cuerpo = TEXTOS.sinParroquias.cuerpo;
  } else {
    titulo = textoConfig(nombre ?? '');
    cuerpo = null;
  }

  const botones: { texto: string; primario: boolean; onPress: () => void }[] = [];
  if (tipo === 'sin-acceso' && hayOtras && onElegir) botones.push({ texto: TEXTOS.sinAcceso.elegir, primario: true, onPress: onElegir });
  if (tipo !== 'config' && onCerrarSesion) {
    botones.push({ texto: TEXTOS.sinAcceso.cerrar, primario: botones.length === 0, onPress: onCerrarSesion });
  }

  return (
    <View style={estilos.raiz}>
      <View style={estilos.etiqueta}>
        <View style={estilos.punto} />
        <Text style={estilos.etiquetaTexto}>{TEXTOS.aviso.etiqueta}</Text>
      </View>
      <ScrollView contentContainerStyle={estilos.centro}>
        <View style={estilos.tarjeta} accessibilityLiveRegion="polite">
          <Text accessibilityRole="header" style={estilos.titulo}>
            {titulo}
          </Text>
          {cuerpo ? <Text style={estilos.cuerpo}>{cuerpo}</Text> : null}
          {botones.length > 0 ? (
            <View style={estilos.botones}>
              {botones.map((b) => (
                <Pressable
                  key={b.texto}
                  accessibilityRole="button"
                  accessibilityLabel={b.texto}
                  onPress={b.onPress}
                  style={({ pressed }) => [estilos.boton, b.primario ? estilos.botonPrimario : estilos.botonSecundario, pressed && { opacity: 0.85 }]}
                >
                  <Text style={[estilos.botonTexto, !b.primario && { color: C.texto }]}>{b.texto}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: C.fondo },
  etiqueta: {
    position: 'absolute',
    left: 12,
    top: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: C.boton,
    zIndex: 1,
  },
  punto: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.suave },
  etiquetaTexto: { fontFamily: F.extra, fontSize: 14, letterSpacing: 1, color: C.textoClaro },
  centro: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60, paddingBottom: 16, paddingHorizontal: 16 },
  tarjeta: {
    width: '100%',
    maxWidth: 540,
    gap: 14,
    paddingVertical: 22,
    paddingHorizontal: 24,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.borde,
    backgroundColor: C.caja,
  },
  titulo: { fontFamily: F.extra, fontSize: 22, color: C.texto },
  cuerpo: { fontFamily: F.medio, fontSize: 14, lineHeight: 22, color: C.textoClaro },
  botones: { flexDirection: 'row', gap: 10 },
  boton: { flex: 1, minHeight: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  botonPrimario: { backgroundColor: C.primario },
  botonSecundario: { backgroundColor: C.boton },
  botonTexto: { fontFamily: F.extra, fontSize: 15, color: '#fff', textAlign: 'center' },
});
