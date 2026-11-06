// Avisos sobre la vista previa (pantalla 6 del lienzo, «Señal débil»): una caja por aviso, ámbar
// o roja, con el título y el detalle. Van arriba de la vista y nunca tapan la tira de escenas.
// Opcionalmente, una caja con botón (No molestar → «Activar»).
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Aviso } from '../avisos/avisos';
import { C, F } from './tema';

const ROJO_FONDO = '#3d0f0b';
const ROJO_TEXTO = '#ffd9d4';

export interface AvisoConBoton {
  titulo: string;
  detalle: string;
  boton: string;
  etiquetaBoton: string;
  onBoton: () => void;
}

interface Props {
  avisos: Aviso[];
  /** Una caja ámbar extra con un botón (por ejemplo, No molestar). */
  conBoton?: AvisoConBoton | null;
}

function Caja(p: { nivel: Aviso['nivel']; titulo: string; detalle: string; children?: ReactNode }) {
  const rojo = p.nivel === 'rojo';
  return (
    <View
      style={[estilos.caja, rojo ? estilos.cajaRoja : estilos.cajaAmbar]}
      accessibilityRole="alert"
      accessibilityLiveRegion={rojo ? 'assertive' : 'polite'}
    >
      <View style={[estilos.icono, { backgroundColor: rojo ? C.rojo : C.ambar }]}>
        <Text style={estilos.iconoTexto}>!</Text>
      </View>
      <View style={estilos.textos}>
        <Text style={[estilos.titulo, { color: rojo ? ROJO_TEXTO : C.ambarTexto }]}>{p.titulo}</Text>
        <Text style={[estilos.detalle, { color: rojo ? ROJO_TEXTO : C.ambarTexto }]}>{p.detalle}</Text>
      </View>
      {p.children}
    </View>
  );
}

export default function Avisos({ avisos, conBoton }: Props) {
  if (avisos.length === 0 && !conBoton) return null;
  return (
    <View style={estilos.lista} pointerEvents="box-none">
      {avisos.map((a) => (
        <Caja key={a.id} nivel={a.nivel} titulo={a.titulo} detalle={a.detalle} />
      ))}
      {conBoton ? (
        <Caja nivel="ambar" titulo={conBoton.titulo} detalle={conBoton.detalle}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={conBoton.etiquetaBoton}
            onPress={conBoton.onBoton}
            style={estilos.boton}
          >
            <Text style={estilos.botonTexto}>{conBoton.boton}</Text>
          </Pressable>
        </Caja>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  lista: { gap: 6, alignSelf: 'stretch' },
  caja: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  cajaAmbar: { backgroundColor: C.ambarFondo, borderColor: C.ambar },
  cajaRoja: { backgroundColor: ROJO_FONDO, borderColor: C.rojo },
  icono: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  iconoTexto: { fontFamily: F.negra, fontSize: 13, color: '#061224' },
  textos: { flex: 1, gap: 2 },
  titulo: { fontFamily: F.extra, fontSize: 14 },
  detalle: { fontFamily: F.semi, fontSize: 12 },
  boton: {
    minHeight: 44,
    borderRadius: 6,
    backgroundColor: C.ambar,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  botonTexto: { fontFamily: F.extra, fontSize: 13, color: '#2a1d00' },
});
