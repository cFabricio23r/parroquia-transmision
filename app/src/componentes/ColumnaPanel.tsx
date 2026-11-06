// Columna derecha: el panel 2.0 de obs/ en modo compacto, dentro de un WebView de 360 dp.
// Solo carga archivos de la app (ORIGEN_PANEL, file:///android_asset/); cualquier otra dirección se bloquea.
// El panel nunca recibe la clave: solo su propio estado (parroquia_obs_estado_v1).
import { useState, type RefObject } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { ORIGEN_PANEL, SCRIPT_ANTES_DE_CARGAR, SCRIPT_PANEL, esDelPanel, leerMensaje } from '../puente/puente';
import { C, M } from './tema';

const FUENTE = { uri: `${ORIGEN_PANEL}obs/panel.html?modo=app` };

/** El tipo de WebView sin props extra (con el valor por defecto, sus props quedan en `never`). */
export type PanelWeb = WebView<{}>;

interface Props {
  webviewRef: RefObject<PanelWeb | null>;
  /** El JSON de parroquia_obs_estado_v1 cada vez que el panel lo cambia. */
  onEstado: (json: string) => void;
  /** La página terminó de cargar (también después de una recarga). */
  onCargado: () => void;
}

export default function ColumnaPanel({ webviewRef, onEstado, onCargado }: Props) {
  // Cada vez que se cae el proceso de la página se monta un WebView nuevo: una WebView cuyo
  // proceso murió no se puede volver a usar (review M1). El estado del panel queda en localStorage.
  const [montaje, setMontaje] = useState(0);

  function alMensaje(e: WebViewMessageEvent) {
    // Solo se escuchan las páginas de la app (review M2).
    if (!esDelPanel(e.nativeEvent.url)) return;
    const m = leerMensaje(e.nativeEvent.data);
    if (m) onEstado(m.json);
  }

  return (
    <View style={estilos.columna}>
      <WebView
        key={montaje}
        ref={webviewRef}
        source={FUENTE}
        originWhitelist={['*']}
        onShouldStartLoadWithRequest={(r) => esDelPanel(r.url)}
        setSupportMultipleWindows={false}
        javaScriptEnabled
        domStorageEnabled
        injectedJavaScriptBeforeContentLoaded={SCRIPT_ANTES_DE_CARGAR}
        injectedJavaScript={SCRIPT_PANEL}
        onMessage={alMensaje}
        onLoadEnd={onCargado}
        onRenderProcessGone={(): void => {
          setMontaje((n) => n + 1);
        }}
        style={estilos.web}
        containerStyle={estilos.web}
      />
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
