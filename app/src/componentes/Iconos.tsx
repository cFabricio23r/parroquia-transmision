// Íconos de los controles al aire, dibujados con View (la app no tiene librería de íconos ni SVG).
// Son decorativos: el nombre accesible lo lleva el botón que los contiene.
import { StyleSheet, View } from 'react-native';

const TRAZO = 2.5;

/** Las cuatro esquinas de un recuadro: hacia afuera (entrar) o hacia adentro (salir). */
export function IconoPantallaCompleta({ salir, color }: { salir: boolean; color: string }) {
  const lado = 7;
  const esquina = (v: 'top' | 'bottom', h: 'left' | 'right') => {
    // Al salir, el ángulo de cada esquina apunta al centro: se dibujan los bordes opuestos.
    const bv = salir ? (v === 'top' ? 'bottom' : 'top') : v;
    const bh = salir ? (h === 'left' ? 'right' : 'left') : h;
    return (
      <View
        key={v + h}
        style={{
          position: 'absolute',
          [v]: 0,
          [h]: 0,
          width: lado,
          height: lado,
          borderColor: color,
          [`border${bv === 'top' ? 'Top' : 'Bottom'}Width`]: TRAZO,
          [`border${bh === 'left' ? 'Left' : 'Right'}Width`]: TRAZO,
        }}
      />
    );
  };
  return (
    <View style={estilos.caja} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {esquina('top', 'left')}
      {esquina('top', 'right')}
      {esquina('bottom', 'left')}
      {esquina('bottom', 'right')}
    </View>
  );
}

/** Un micrófono; tachado cuando está silenciado. */
export function IconoMicrofono({ tachado, color }: { tachado: boolean; color: string }) {
  return (
    <View style={estilos.caja} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[estilos.capsula, { borderColor: color }]} />
      <View style={[estilos.soporte, { borderColor: color }]} />
      <View style={[estilos.pie, { backgroundColor: color }]} />
      {tachado ? <View style={[estilos.tachado, { backgroundColor: color }]} /> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  caja: { width: 20, height: 20 },
  capsula: { position: 'absolute', left: 6, top: 0, width: 8, height: 12, borderRadius: 4, borderWidth: TRAZO },
  soporte: {
    position: 'absolute',
    left: 2.5,
    top: 6,
    width: 15,
    height: 9,
    borderLeftWidth: TRAZO,
    borderRightWidth: TRAZO,
    borderBottomWidth: TRAZO,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  pie: { position: 'absolute', left: 8.75, top: 15, width: TRAZO, height: 5 },
  tachado: { position: 'absolute', left: -2, top: 8.75, width: 24, height: TRAZO, transform: [{ rotate: '-45deg' }] },
});
