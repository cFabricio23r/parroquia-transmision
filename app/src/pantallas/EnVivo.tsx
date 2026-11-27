// Pantallas 2 y 3 del lienzo: «En vivo». Va encima de la vista previa (avisos) y debajo de ella
// (tira de escenas). La vista previa y el panel los pone App.
import { StyleSheet, Text, View } from 'react-native';

import type { Aviso } from '../avisos/avisos';
import Avisos from '../componentes/Avisos';
import TiraEscenas from '../componentes/TiraEscenas';
import { C, F, M } from '../componentes/tema';
import type { Escena, Fase } from '../estado/transmision';

interface Props {
  fase: Fase;
  escena: Escena;
  /** Mensaje de la conexión (p. ej. «Se cortó la señal. Reconectando…»). */
  mensaje: string | null;
  /** Señal, batería, calor y red (Tarea 9). */
  avisos: Aviso[];
  /** Facebook directo (Tarea 10): una chip verde con dónde sale y una ámbar por cada extra que no salió. */
  facebook?: { verde: string | null; ambar: string[] };
  onEscena: (escena: Escena) => void;
  /** Pantalla completa (Tarea 9g): los avisos siguen el tamaño de la vista y no hay tira. */
  completa?: { ancho: number; alto: number } | null;
}

export default function EnVivo({ fase, escena, mensaje, avisos, facebook, onEscena, completa }: Props) {
  // El reducer solo cambia la escena estando al aire; en el resto la tira queda apagada.
  const tiraActiva = fase === 'en_vivo' || fase === 'reconectando';
  return (
    <View style={estilos.capa} pointerEvents="box-none">
      <View
        style={[estilos.sobreVista, completa && { width: completa.ancho, height: completa.alto, paddingTop: 56 }]}
        pointerEvents="none"
      >
        <View style={estilos.arriba}>
          <Avisos avisos={avisos} />
          {mensaje ? (
            <Text style={[estilos.aviso, estilos.avisoAmbar]} accessibilityLiveRegion="polite">
              {mensaje}
            </Text>
          ) : null}
          {facebook?.verde ? (
            <Text style={[estilos.aviso, estilos.avisoVerde]} accessibilityLiveRegion="polite">
              {facebook.verde}
            </Text>
          ) : null}
          {(facebook?.ambar ?? []).map((t) => (
            <Text key={t} style={[estilos.aviso, estilos.avisoAmbar]} accessibilityLiveRegion="polite">
              {t}
            </Text>
          ))}
        </View>
        {escena !== 'camara' ? (
          <Text style={[estilos.aviso, estilos.avisoOscuro]}>Cámara oculta · los rótulos se ven solo en «Cámara»</Text>
        ) : null}
      </View>
      {completa ? null : (
        <View style={estilos.abajo}>
          <TiraEscenas escena={escena} desactivada={!tiraActiva} onElegir={onEscena} />
        </View>
      )}
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
    alignItems: 'flex-start',
  },
  arriba: { alignSelf: 'stretch', alignItems: 'flex-start', gap: 6 },
  aviso: {
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 10,
    fontFamily: F.negrita,
    fontSize: 12,
    overflow: 'hidden',
  },
  avisoOscuro: { backgroundColor: 'rgba(6, 18, 36, 0.88)', color: C.texto },
  avisoVerde: { backgroundColor: 'rgba(14, 51, 36, 0.92)', borderWidth: 1, borderColor: C.verde, color: '#8fe3b8' },
  avisoAmbar: { backgroundColor: C.ambarFondo, borderWidth: 1, borderColor: C.ambar, color: C.ambarTexto },
  abajo: { position: 'absolute', left: 0, bottom: 0, width: M.vistaAncho },
});
