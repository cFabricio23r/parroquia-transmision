// Pantalla 1 del lienzo: «Antes de iniciar». Va encima de la vista previa y debajo de ella;
// la vista previa y el panel los pone App, para que no se recarguen al cambiar de pantalla.
// Avisos de la Tarea 9: red, batería y calor (avisosActivos) y No molestar con «Activar».
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Aviso } from '../avisos/avisos';
import Avisos from '../componentes/Avisos';
import { C, F, M } from '../componentes/tema';

export type EstadoVista = 'sin_permiso' | 'preparando' | 'lista' | 'error';

interface Props {
  vista: EstadoVista;
  /** null mientras se leen los Ajustes. */
  claveLista: boolean | null;
  /** Mensaje del último corte o error (en español, sin datos de la clave). */
  mensaje: string | null;
  terminada: boolean;
  /** Red, batería y calor. */
  avisos: Aviso[];
  /** false: No molestar está apagado y se muestra el aviso con «Activar». null o true: no se muestra. */
  noMolestar: boolean | null;
  onActivarNoMolestar: () => void;
  onIniciar: () => void;
  onAjustes: () => void;
  onPrepararOtraVez: () => void;
}

export default function AntesDeIniciar(p: Props) {
  const puede = p.vista === 'lista' && p.claveLista === true;
  const motivo =
    p.vista === 'sin_permiso'
      ? 'falta permiso de cámara y micrófono'
      : p.vista === 'preparando'
        ? 'preparando la cámara…'
        : p.vista === 'error'
          ? 'la cámara no está lista'
          : p.claveLista === false
            ? 'primero complete Ajustes'
            : 'empieza con Inicio';

  return (
    <View style={estilos.capa} pointerEvents="box-none">
      <View style={estilos.sobreVista} pointerEvents="box-none">
        <View style={estilos.arriba} pointerEvents="box-none">
          <Text style={estilos.etiqueta}>VISTA PREVIA · NADIE LO VE TODAVÍA</Text>
          <Avisos
            avisos={p.avisos}
            conBoton={
              p.noMolestar === false
                ? {
                    titulo: 'Active No molestar',
                    detalle: 'Así una llamada no corta la transmisión. También: deslice desde arriba y toque «No molestar».',
                    boton: 'Activar',
                    etiquetaBoton: 'Abrir los ajustes de No molestar',
                    onBoton: p.onActivarNoMolestar,
                  }
                : null
            }
          />
        </View>
        <View style={estilos.avisos} pointerEvents="box-none">
          {p.terminada ? <Text style={[estilos.aviso, estilos.avisoBien]}>La transmisión terminó.</Text> : null}
          {p.mensaje ? (
            <Text style={[estilos.aviso, estilos.avisoAmbar]} accessibilityLiveRegion="polite">
              {p.mensaje}
            </Text>
          ) : null}
          {p.claveLista === true ? (
            <Text style={[estilos.aviso, estilos.avisoBien]}>✓ Facebook: clave guardada</Text>
          ) : null}
          {p.claveLista === false ? (
            <View style={[estilos.aviso, estilos.avisoAmbar, estilos.avisoConBoton]}>
              <Text style={estilos.avisoAmbarTexto}>Falta la clave de Facebook</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Abrir Ajustes" onPress={p.onAjustes} style={estilos.avisoBoton}>
                <Text style={estilos.avisoBotonTexto}>Abrir Ajustes</Text>
              </Pressable>
            </View>
          ) : null}
          {p.vista === 'sin_permiso' || p.vista === 'error' ? (
            <View style={[estilos.aviso, estilos.avisoAmbar, estilos.avisoConBoton]}>
              <Text style={estilos.avisoAmbarTexto}>
                {p.vista === 'sin_permiso' ? 'Hace falta permiso de cámara y micrófono' : 'La cámara no está lista'}
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

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Iniciar transmisión"
        accessibilityHint={puede ? 'Empieza con la escena Inicio' : motivo}
        accessibilityState={{ disabled: !puede }}
        disabled={!puede}
        onPress={p.onIniciar}
        style={[estilos.iniciar, !puede && estilos.iniciarApagado]}
      >
        <View style={estilos.circulo} />
        <Text style={estilos.iniciarTexto}>Iniciar transmisión</Text>
        <Text style={estilos.iniciarSub}>{motivo}</Text>
      </Pressable>
    </View>
  );
}

const estilos = StyleSheet.create({
  capa: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 },
  sobreVista: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: M.vistaAncho,
    height: M.vistaAlto,
    padding: 10,
    justifyContent: 'space-between',
  },
  arriba: { gap: 6 },
  etiqueta: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(6, 18, 36, 0.82)',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    fontFamily: F.extra,
    fontSize: 11,
    letterSpacing: 1.5,
    color: C.texto,
    overflow: 'hidden',
  },
  avisos: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  aviso: {
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    fontFamily: F.negrita,
    fontSize: 12,
    overflow: 'hidden',
  },
  avisoBien: { backgroundColor: C.sobreVista, color: C.texto },
  avisoAmbar: { backgroundColor: C.ambarFondo, borderWidth: 1, borderColor: C.ambar, color: C.ambarTexto },
  avisoConBoton: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 2, paddingRight: 4 },
  avisoAmbarTexto: { fontFamily: F.negrita, fontSize: 12, color: C.ambarTexto },
  avisoBoton: {
    minHeight: 44,
    borderRadius: 6,
    backgroundColor: C.ambar,
    paddingHorizontal: 10,
    justifyContent: 'center',
  },
  avisoBotonTexto: { fontFamily: F.extra, fontSize: 12, color: '#2a1d00' },
  iniciar: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    width: M.vistaAncho,
    height: M.abajoAlto,
    borderRadius: 14,
    backgroundColor: C.rojo,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  iniciarApagado: { backgroundColor: C.boton, opacity: 0.6 },
  circulo: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#ffffff' },
  iniciarTexto: { fontFamily: F.extra, fontSize: 18, color: '#ffffff' },
  iniciarSub: { fontFamily: F.semi, fontSize: 12, color: C.rojoSuave },
});
