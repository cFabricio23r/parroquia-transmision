// Pantalla 5 del lienzo: «¿Terminar?». Despacha terminar_con_gracias, seguir o terminar_ahora.
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { C, F } from '../componentes/tema';
import { formatoDuracion } from '../estado/formato';

interface Props {
  visible: boolean;
  segundos: number;
  /** Segundos que faltan si ya corre la cuenta de Gracias; null si no. */
  cuentaFinal: number | null;
  onGracias: () => void;
  onSeguir: () => void;
  onAhora: () => void;
  /** Cerrar sin elegir (botón Atrás del celular). */
  onCerrar: () => void;
}

export default function ConfirmarTerminar(p: Props) {
  const enCuenta = p.cuentaFinal !== null && p.cuentaFinal > 0;
  return (
    <Modal
      visible={p.visible}
      transparent
      animationType="fade"
      supportedOrientations={['landscape']}
      onRequestClose={p.onCerrar}
      statusBarTranslucent
    >
      <View style={estilos.fondo}>
        <View style={estilos.dialogo} accessibilityViewIsModal>
          <Text style={estilos.titulo} accessibilityRole="header">
            {enCuenta ? `Termina en ${p.cuentaFinal} s` : '¿Terminar la transmisión?'}
          </Text>
          <Text style={estilos.texto}>
            {enCuenta
              ? 'Se está mostrando Gracias. Puede seguir transmitiendo o cortar ya.'
              : `Se cortará en Facebook. Lleva ${formatoDuracion(p.segundos)} al aire. Conviene mostrar antes la pantalla `}
            {enCuenta ? null : <Text style={estilos.fuerte}>Gracias</Text>}
            {enCuenta ? null : ' unos segundos.'}
          </Text>
          {enCuenta ? null : (
            <Pressable accessibilityRole="button" onPress={p.onGracias} style={[estilos.boton, estilos.principal]}>
              <Text style={estilos.botonTextoGrande}>Mostrar «Gracias» y terminar en 10 s</Text>
            </Pressable>
          )}
          <View style={estilos.fila}>
            <Pressable accessibilityRole="button" onPress={p.onSeguir} style={[estilos.boton, estilos.seguir]}>
              <Text style={estilos.botonTexto}>Seguir transmitiendo</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={p.onAhora} style={[estilos.boton, estilos.ahora]}>
              <Text style={estilos.botonTexto}>Terminar ahora</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  fondo: {
    flex: 1,
    backgroundColor: 'rgba(6, 18, 36, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogo: {
    width: 540,
    backgroundColor: C.caja,
    borderWidth: 1,
    borderColor: C.borde,
    borderRadius: 18,
    paddingVertical: 22,
    paddingHorizontal: 24,
    gap: 14,
  },
  titulo: { fontFamily: F.extra, fontSize: 22, color: C.texto },
  texto: { fontFamily: F.medio, fontSize: 14, lineHeight: 22, color: C.textoClaro },
  fuerte: { fontFamily: F.extra, color: '#ffffff' },
  fila: { flexDirection: 'row', gap: 10 },
  boton: { flex: 1, minHeight: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  principal: { flex: 0, minHeight: 56, backgroundColor: C.primario },
  seguir: { backgroundColor: C.boton },
  ahora: { backgroundColor: C.rojo },
  botonTextoGrande: { fontFamily: F.extra, fontSize: 16, color: '#ffffff' },
  botonTexto: { fontFamily: F.extra, fontSize: 15, color: '#ffffff' },
});
