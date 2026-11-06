// Pantalla 9 del lienzo: «Preparar en vertical» (Tarea 9c).
// Arriba la vista previa 16:9 de la escena que se elija, debajo la tira de escenas, después el
// panel en Preparar y al final «Listo · girar para transmitir».
// La vista previa y el panel los pone App (no se recargan al girar); esta pantalla solo pone lo
// que va encima de la vista previa, la tira y el botón. La tira solo cambia la escena de la capa
// para ver cómo queda: no transmite nada.
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import TiraEscenas, { ESCENAS_PREPARAR } from '../componentes/TiraEscenas';
import { C, F } from '../componentes/tema';
import type { Escena } from '../estado/transmision';
import type { EstadoVista } from './AntesDeIniciar';

/** Un rectángulo en dp, relativo al lienzo de App. */
export type Rect = { left: number; top: number; width: number; height: number };

interface Props {
  vista: EstadoVista;
  /** Mensaje del último corte o error (en español, sin datos de la clave). */
  mensaje: string | null;
  escena: Escena;
  onEscena: (escena: Escena) => void;
  onListo: () => void;
  onPrepararOtraVez: () => void;
  /** Dónde está la vista previa, la tira y el botón (los calcula App). */
  zonaVista: Rect;
  zonaTira: Rect;
  zonaListo: Rect;
}

export default function PrepararVertical(p: Props) {
  const sinCamara = p.vista === 'sin_permiso' || p.vista === 'error';
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <View style={[estilos.sobreVista, p.zonaVista as ViewStyle]} pointerEvents="box-none">
        <Text style={estilos.etiqueta}>VISTA PREVIA · NADIE LO VE TODAVÍA</Text>
        <View style={estilos.avisos} pointerEvents="box-none">
          {p.vista === 'preparando' ? <Text style={[estilos.aviso, estilos.avisoOscuro]}>Preparando la cámara…</Text> : null}
          {p.mensaje ? (
            <Text style={[estilos.aviso, estilos.avisoAmbar]} accessibilityLiveRegion="polite">
              {p.mensaje}
            </Text>
          ) : null}
          {sinCamara ? (
            <View style={[estilos.aviso, estilos.avisoAmbar, estilos.avisoConBoton]}>
              <Text style={estilos.avisoAmbarTexto}>
                {p.vista === 'sin_permiso' ? 'Falta permiso de cámara y micrófono' : 'La cámara no está lista'}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Preparar la cámara otra vez"
                onPress={p.onPrepararOtraVez}
                style={estilos.avisoBoton}
              >
                <Text style={estilos.avisoBotonTexto}>Reintentar</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </View>

      <TiraEscenas
        escena={p.escena}
        escenas={ESCENAS_PREPARAR}
        prefijo="Ver escena"
        // Sin cámara lista la capa no puede cambiar de escena.
        desactivada={p.vista !== 'lista'}
        onElegir={p.onEscena}
        estilo={[estilos.tira, p.zonaTira as ViewStyle]}
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Listo, girar para transmitir"
        accessibilityHint="Pasa la pantalla a horizontal, donde está Iniciar transmisión"
        onPress={p.onListo}
        style={[estilos.listo, p.zonaListo as ViewStyle]}
      >
        <Text style={estilos.listoTexto}>Listo · girar para transmitir</Text>
      </Pressable>
    </View>
  );
}

const estilos = StyleSheet.create({
  sobreVista: { position: 'absolute', padding: 8, justifyContent: 'space-between' },
  etiqueta: {
    alignSelf: 'flex-start',
    backgroundColor: C.sobreVista,
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 9,
    fontFamily: F.extra,
    fontSize: 10,
    letterSpacing: 1.2,
    color: C.texto,
    overflow: 'hidden',
  },
  avisos: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  aviso: { borderRadius: 8, paddingVertical: 5, paddingHorizontal: 9, fontFamily: F.negrita, fontSize: 12, overflow: 'hidden' },
  avisoOscuro: { backgroundColor: C.sobreVista, color: C.texto },
  avisoAmbar: { backgroundColor: C.ambarFondo, borderWidth: 1, borderColor: C.ambar, color: C.ambarTexto },
  avisoConBoton: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 2, paddingRight: 4 },
  avisoAmbarTexto: { fontFamily: F.negrita, fontSize: 12, color: C.ambarTexto },
  avisoBoton: { minHeight: 44, borderRadius: 6, backgroundColor: C.ambar, paddingHorizontal: 10, justifyContent: 'center' },
  avisoBotonTexto: { fontFamily: F.extra, fontSize: 12, color: '#2a1d00' },
  tira: { position: 'absolute', gap: 5 },
  listo: {
    position: 'absolute',
    borderRadius: 14,
    backgroundColor: C.primario,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listoTexto: { fontFamily: F.extra, fontSize: 17, color: '#ffffff' },
});
