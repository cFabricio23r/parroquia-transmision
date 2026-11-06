// Tira de escenas debajo de la vista previa (pantallas 2 y 3 del lienzo).
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Escena } from '../estado/transmision';
import { C, F, M } from './tema';

export const ESCENAS: { id: Escena; nombre: string }[] = [
  { id: 'inicio', nombre: 'Inicio' },
  { id: 'camara', nombre: 'Cámara' },
  { id: 'portada', nombre: 'Portada' },
  { id: 'avisos', nombre: 'Avisos' },
  { id: 'gracias', nombre: 'Gracias' },
];

interface Props {
  escena: Escena;
  desactivada: boolean;
  onElegir: (escena: Escena) => void;
}

export default function TiraEscenas({ escena, desactivada, onElegir }: Props) {
  return (
    <View style={estilos.tira}>
      {ESCENAS.map((x) => {
        const elegida = escena === x.id;
        return (
          <Pressable
            key={x.id}
            accessibilityRole="button"
            accessibilityLabel={`Escena ${x.nombre}`}
            accessibilityState={{ selected: elegida, disabled: desactivada }}
            disabled={desactivada}
            onPress={() => onElegir(x.id)}
            style={[estilos.boton, elegida && estilos.elegida, desactivada && estilos.apagado]}
          >
            <Text style={estilos.texto} numberOfLines={1}>
              {x.nombre}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const estilos = StyleSheet.create({
  tira: { height: M.abajoAlto, flexDirection: 'row', gap: 6 },
  boton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: C.boton,
    alignItems: 'center',
    justifyContent: 'center',
  },
  elegida: { borderColor: C.seleccion, backgroundColor: C.seleccionFondo },
  texto: { fontFamily: F.extra, fontSize: 14, color: C.texto },
  apagado: { opacity: 0.5 },
});
