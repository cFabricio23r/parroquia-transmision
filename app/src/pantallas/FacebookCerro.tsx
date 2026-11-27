// Diálogo «Facebook cerró la transmisión» (lienzo AppFacebookCerro). Se muestra cuando la señal se dio
// por perdida y Facebook ya cerró el vivo. «Iniciar una nueva» es el único camino a un vivo nuevo.
// Nueva: botones de 44 px o más y ancho máximo (no fijo). Sin botón de cerrar: hay que elegir.
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { C, F } from '../componentes/tema';

interface Props {
  visible: boolean;
  onTerminar: () => void;
  onIniciarNueva: () => void;
}

export default function FacebookCerro(p: Props) {
  return (
    <Modal
      visible={p.visible}
      transparent
      animationType="fade"
      supportedOrientations={['landscape']}
      onRequestClose={p.onTerminar}
      statusBarTranslucent
    >
      <View style={estilos.fondo}>
        <View style={estilos.dialogo} accessibilityViewIsModal>
          <Text style={estilos.etiqueta}>DESPUÉS DE UN CORTE LARGO</Text>
          <Text style={estilos.titulo} accessibilityRole="header">
            Facebook cerró la transmisión
          </Text>
          <Text style={estilos.texto}>
            La señal estuvo caída mucho tiempo. Si sigues, sale una publicación nueva en la página.
          </Text>
          <View style={estilos.fila}>
            <Pressable accessibilityRole="button" accessibilityLabel="Terminar" onPress={p.onTerminar} style={[estilos.boton, estilos.terminar]}>
              <Text style={estilos.botonTexto}>Terminar</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Iniciar una nueva"
              onPress={p.onIniciarNueva}
              style={[estilos.boton, estilos.iniciar]}
            >
              <Text style={estilos.botonTexto}>Iniciar una nueva</Text>
            </Pressable>
          </View>
          <Text style={estilos.nota}>Nunca se crea una transmisión nueva sin este toque.</Text>
        </View>
      </View>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: 'rgba(6, 18, 36, 0.65)', alignItems: 'center', justifyContent: 'center', padding: 8 },
  dialogo: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: C.caja,
    borderWidth: 1,
    borderColor: C.borde,
    borderRadius: 18,
    padding: 22,
    gap: 12,
  },
  etiqueta: { fontFamily: F.extra, fontSize: 11, letterSpacing: 1.5, color: C.ambar },
  titulo: { fontFamily: F.extra, fontSize: 22, lineHeight: 26, color: C.texto },
  texto: { fontFamily: F.medio, fontSize: 14, lineHeight: 22, color: C.textoClaro },
  fila: { flexDirection: 'row', gap: 10 },
  boton: { flex: 1, minHeight: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  terminar: { backgroundColor: C.boton },
  iniciar: { backgroundColor: C.primario },
  botonTexto: { fontFamily: F.extra, fontSize: 15, color: '#ffffff' },
  nota: { fontFamily: F.semi, fontSize: 12, color: C.suave },
});
