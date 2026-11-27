// El panel de la parroquia en modo compacto: `https://<plataforma>/<slug>/panel.html?modo=app`,
// bajado de la plataforma y servido desde la copia guardada o el respaldo de la app por
// Interceptor.kt (etapa 3a). Va en la vista nativa VistaPanel, no en react-native-webview, porque
// esa no puede interceptar los subrecursos. Columna de 360 dp a la derecha en horizontal, o debajo
// de la tira en Preparar (vertical). El tamaño lo da App con `estilo`: la vista es siempre la misma
// y no se recarga al girar (Tarea 9c).
// Solo carga el origen exacto de la plataforma; cualquier otra dirección se bloquea.
// El panel nunca recibe la clave: solo su propio estado (pev_<slug>_estado_v1) y, de las misas listas
// (Tarea 6), su lista y su cola (pev_<slug>_guardadas_v1 y _guardadas_pendientes_v1), por canalGuardadas.
import { memo, useEffect, useImperativeHandle, useRef, useState, type RefObject } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { VistaPanel, type EventoMensaje, type VistaPanelNativa } from '../../modules/transmisor';
import { canalGuardadas, scriptGuardadas } from '../guardadas/puente';
import { esMensajeDelPanel, leerMensaje, scriptPanel, urlPanelSiLista } from '../puente/puente';
import { C, M } from './tema';

/** Lo que App usa del panel: correr un script (la escena, ir a En vivo o a Preparar, 3b «Usar esta»). */
export interface PanelRef {
  inyectar(script: string): void;
}

interface Props {
  panelRef: RefObject<PanelRef | null>;
  /** El origen normalizado de la plataforma (`https://host[:puerto]`). */
  origen: string;
  /** La parroquia elegida. */
  slug: string;
  /** true cuando lo nativo ya tiene la parroquia (fijarParroquia terminó); antes no se carga nada. */
  lista: boolean;
  /** El JSON de pev_<slug>_estado_v1 cada vez que el panel lo cambia. */
  onEstado: (json: string) => void;
  /** La página terminó de cargar (también después de una recarga). */
  onCargado: () => void;
  /** Lugar y tamaño de la columna (cambia al girar; la vista sigue montada). */
  estilo?: StyleProp<ViewStyle>;
}

function ColumnaPanelBase({ panelRef, origen, slug, lista, onEstado, onCargado, estilo }: Props) {
  // Cada vez que se cae el proceso de la página se monta una vista nueva: un WebView cuyo
  // proceso murió no se puede volver a usar (review M1). El estado del panel queda en localStorage.
  const [montaje, setMontaje] = useState(0);
  const nativa = useRef<VistaPanelNativa | null>(null);

  useImperativeHandle(
    panelRef,
    () => ({
      inyectar(script: string) {
        // Un error de lo nativo (la vista se está desmontando) no corta nada.
        nativa.current?.inyectar(script)?.catch?.(() => undefined);
      },
    }),
    [],
  );

  // La tarea 'guardadas' le devuelve al panel su lista y su cola por acá.
  useEffect(
    () =>
      canalGuardadas.conectar(slug, (script) => {
        nativa.current?.inyectar(script)?.catch?.(() => undefined);
      }),
    [slug],
  );

  function alMensaje(e: EventoMensaje) {
    // Solo se escucha el origen exacto de la plataforma (review M2).
    if (!esMensajeDelPanel(e.nativeEvent.url, origen)) return;
    const m = leerMensaje(e.nativeEvent.data);
    if (!m) return;
    if (m.tipo === 'estado') onEstado(m.json);
    else canalGuardadas.recibir(slug, m);
  }

  const url = urlPanelSiLista(origen, slug, lista);

  return (
    <View style={[estilos.columna, estilo]}>
      {url === null ? null : (
        <VistaPanel
          key={montaje}
          ref={nativa}
          url={url}
          origen={origen}
          scriptAlCargar={scriptPanel(slug) + '\n' + scriptGuardadas(slug)}
          onMensaje={alMensaje}
          onCargado={onCargado}
          onProcesoCaido={(): void => {
            setMontaje((n) => n + 1);
          }}
          style={estilos.web}
        />
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  columna: {
    width: M.panelAncho,
    alignSelf: 'stretch',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.borde,
    backgroundColor: C.fondo2,
  },
  web: { flex: 1, backgroundColor: C.fondo2 },
});

// Memoizado: App se redibuja cada segundo con el reloj y el panel no debe seguirla (props estables desde App).
export default memo(ColumnaPanelBase);
