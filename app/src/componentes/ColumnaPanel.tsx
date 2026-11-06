// Columna derecha: el panel 2.0 de obs/ en modo compacto, dentro de un WebView de 360 dp.
// Solo carga archivos de la app (file:///android_asset/); cualquier otra dirección se bloquea.
// El panel nunca recibe la clave: solo su propio estado (parroquia_obs_estado_v1).
import type { RefObject } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { SCRIPT_ANTES_DE_CARGAR, SCRIPT_PANEL, leerMensaje } from '../puente/puente';
import { C, M } from './tema';

const FUENTE = { uri: 'file:///android_asset/obs/panel.html?modo=app' };
const PERMITIDO = 'file:///android_asset/';

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
  function alMensaje(e: WebViewMessageEvent) {
    const m = leerMensaje(e.nativeEvent.data);
    if (m) onEstado(m.json);
  }

  return (
    <View style={estilos.columna}>
      <WebView
        ref={webviewRef}
        source={FUENTE}
        originWhitelist={['*']}
        onShouldStartLoadWithRequest={(r) => r.url.startsWith(PERMITIDO)}
        setSupportMultipleWindows={false}
        javaScriptEnabled
        domStorageEnabled
        injectedJavaScriptBeforeContentLoaded={SCRIPT_ANTES_DE_CARGAR}
        injectedJavaScript={SCRIPT_PANEL}
        onMessage={alMensaje}
        onLoadEnd={onCargado}
        // Si el proceso de la página se cae, se vuelve a cargar (el estado queda en localStorage).
        onRenderProcessGone={(): void => {
          webviewRef.current?.reload();
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
