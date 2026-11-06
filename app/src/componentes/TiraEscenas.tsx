// Tira de escenas debajo de la vista previa (pantallas 2 y 3 del lienzo).
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import type { Escena } from '../estado/transmision';
import { C, F, M } from './tema';

export const ESCENAS: { id: Escena; nombre: string }[] = [
  { id: 'inicio', nombre: 'Inicio' },
  { id: 'camara', nombre: 'Cámara' },
  { id: 'portada', nombre: 'Portada' },
  { id: 'avisos', nombre: 'Avisos' },
  { id: 'gracias', nombre: 'Gracias' },
  // Pantalla final (Tarea 9d): solo sale cuando se toca; al terminar se sigue pasando a Gracias.
  { id: 'produccion', nombre: 'Producción' },
];

/** Orden de la tira en Preparar (vertical). Es el mismo que En vivo, para que los botones no cambien de
 *  lugar entre las dos pantallas (decisión del 2026-11-06; el plan de la 9c ponía Cámara primero). */
export const ESCENAS_PREPARAR: { id: Escena; nombre: string }[] = ESCENAS;

interface Props {
  escena: Escena;
  desactivada: boolean;
  onElegir: (escena: Escena) => void;
  /** Por defecto, el orden de En vivo. */
  escenas?: { id: Escena; nombre: string }[];
  estilo?: StyleProp<ViewStyle>;
  /** Etiqueta para lectores de pantalla, delante del nombre (por defecto «Escena»). */
  prefijo?: string;
}

export default function TiraEscenas({ escena, desactivada, onElegir, escenas = ESCENAS, estilo, prefijo = 'Escena' }: Props) {
  return (
    <View style={[estilos.tira, estilo]}>
      {escenas.map((x) => {
        const elegida = escena === x.id;
        return (
          <Pressable
            key={x.id}
            accessibilityRole="button"
            accessibilityLabel={`${prefijo} ${x.nombre}`}
            accessibilityState={{ selected: elegida, disabled: desactivada }}
            disabled={desactivada}
            onPress={() => onElegir(x.id)}
            style={[estilos.boton, elegida && estilos.elegida, desactivada && estilos.apagado]}
          >
            {/* Con seis botones, «Producción» no entra a 14 en vertical: se achica hasta 75 % (Tarea 9d). */}
            <Text style={estilos.texto} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
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
    paddingHorizontal: 3,
  },
  elegida: { borderColor: C.seleccion, backgroundColor: C.seleccionFondo },
  texto: { fontFamily: F.extra, fontSize: 14, color: C.texto },
  apagado: { opacity: 0.5 },
});
