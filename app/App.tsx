// La app de transmisión (Tarea 8): Antes de iniciar, En vivo, ¿Terminar? y Ajustes.
// La vista previa y el panel quedan montados siempre; las pantallas cambian solo lo que va
// encima y debajo de la vista previa, así el panel y la cámara no se recargan.
// La clave nunca se muestra ni se registra: solo se lee de Ajustes para llamar a iniciar().
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { PermissionsAndroid, Platform, StyleSheet, View } from 'react-native';

import {
  ErrorTransmisor,
  VistaTransmisor,
  actualizarEstado,
  addEstadoListener,
  cambiarEscena,
  iniciar,
  pideVolverAPreparar,
  prepararVista,
  terminar,
  type Conexion,
} from './modules/transmisor';
import BarraSuperior from './src/componentes/BarraSuperior';
import ColumnaPanel, { type PanelWeb } from './src/componentes/ColumnaPanel';
import { C, FUENTES, M } from './src/componentes/tema';
import { leerAjustes, validar } from './src/ajustes/ajustes';
import { crearTienda } from './src/estado/tienda';
import type { Escena, EstadoTransmision } from './src/estado/transmision';
import AntesDeIniciar, { type EstadoVista } from './src/pantallas/AntesDeIniciar';
import Ajustes from './src/pantallas/Ajustes';
import ConfirmarTerminar from './src/pantallas/ConfirmarTerminar';
import EnVivo from './src/pantallas/EnVivo';
import { SCRIPT_ESCENA, SCRIPT_IR_A_EN_VIVO } from './src/puente/puente';

// El estado de la transmisión vive fuera de React (ver tienda.ts): debeCortar ve cada paso.
// Cuando hay que cortar se llama a terminar() una sola vez; si se estaba terminando, después
// se pasa a 'terminado'.
function alCortar(despues: EstadoTransmision) {
  void terminar()
    .catch(() => undefined)
    .then(() => {
      if (despues.fase === 'terminando') tienda.despachar({ tipo: 'terminado' });
    });
}
const tienda = crearTienda(alCortar);

const enAire = (e: EstadoTransmision): boolean =>
  e.fase === 'iniciando' || e.fase === 'en_vivo' || e.fase === 'reconectando' || e.fase === 'terminando';

async function pedirPermisos(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  const r = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.CAMERA,
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
  ]);
  return (
    r[PermissionsAndroid.PERMISSIONS.CAMERA] === PermissionsAndroid.RESULTS.GRANTED &&
    r[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === PermissionsAndroid.RESULTS.GRANTED
  );
}

export default function App() {
  const [fuentesListas, errorFuentes] = useFonts(FUENTES);
  const listo = fuentesListas || errorFuentes !== null;
  const estado = useSyncExternalStore(tienda.suscribir, tienda.obtener);

  const [enAjustes, setEnAjustes] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [vista, setVista] = useState<EstadoVista>('preparando');
  const [claveLista, setClaveLista] = useState<boolean | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [mbps, setMbps] = useState<number | null>(null);
  const [mensajeConexion, setMensajeConexion] = useState<string | null>(null);

  const panelRef = useRef<PanelWeb | null>(null);
  // Calidad y micrófono con que se preparó la vista por última vez (null: hay que preparar).
  const preparadaCon = useRef<string | null>(null);
  const preparandoAhora = useRef(false);
  const ultimaConexion = useRef<Conexion | null>(null);

  const alAire = enAire(estado);
  // Antes de salir al aire la capa muestra Cámara (para encuadrar) y el panel cree estar en
  // Inicio, así no queda ningún rótulo encendido. Al aire, las dos siguen la escena del estado.
  const escenaCapa: Escena = alAire ? estado.escena : 'camara';
  const escenaPanel: Escena = alAire ? estado.escena : 'inicio';
  const escenaPanelRef = useRef(escenaPanel);
  escenaPanelRef.current = escenaPanel;

  /** Prepara cámara y micrófono. Sin `forzar`, no hace nada si la calidad y el micrófono no cambiaron. */
  const preparar = useCallback(async (forzar: boolean) => {
    if (preparandoAhora.current) return;
    preparandoAhora.current = true;
    try {
      if (!(await pedirPermisos())) {
        setVista('sin_permiso');
        return;
      }
      const a = await leerAjustes();
      setClaveLista(validar(a).ok);
      const firma = `${a.calidad}|${a.microfono}`;
      if (!forzar && firma === preparadaCon.current) {
        setVista('lista');
        return;
      }
      setVista('preparando');
      await prepararVista(a.calidad, a.microfono);
      preparadaCon.current = firma;
      setVista('lista');
    } catch {
      preparadaCon.current = null;
      setVista('error');
    } finally {
      preparandoAhora.current = false;
    }
  }, []);

  // Corte de tipo «preparar» (review N3 de la Tarea 6): se vuelve a preparar la cámara sola.
  const volverAPreparar = useCallback(() => {
    preparadaCon.current = null;
    void preparar(true);
  }, [preparar]);

  useEffect(() => {
    if (listo) void preparar(true);
  }, [listo, preparar]);

  // Eventos de la conexión → eventos del estado.
  useEffect(() => {
    const s = addEstadoListener((e) => {
      ultimaConexion.current = e.conexion;
      if (e.conexion === 'conectado') {
        setMbps(e.mbps);
        setMensajeConexion(null);
        tienda.despachar({ tipo: 'conectado' });
      } else if (e.conexion === 'reconectando') {
        setMbps(null);
        setMensajeConexion(e.mensaje);
        tienda.despachar({ tipo: 'reconectando' });
      } else {
        setMbps(null);
        setMensajeConexion(null);
        tienda.despachar({ tipo: 'cortado', mensaje: e.mensaje ?? 'Se cortó la transmisión.' });
        if (pideVolverAPreparar(e)) volverAPreparar();
      }
    });
    return () => s.remove();
  }, [volverAPreparar]);

  // Reloj: un tic por segundo (el reducer lo ignora fuera del aire).
  useEffect(() => {
    const t = setInterval(() => tienda.despachar({ tipo: 'tic' }), 1000);
    return () => clearInterval(t);
  }, []);

  // Escena de la capa: con la transición del logo, cada vez que cambia (y solo con la cámara lista).
  const vistaLista = vista === 'lista';
  useEffect(() => {
    if (!vistaLista && !alAire) return;
    cambiarEscena(escenaCapa).catch(() => setAviso('No se pudo cambiar la escena.'));
  }, [escenaCapa, vistaLista, alAire]);

  // Escena del panel: fuera de Cámara bloquea los rótulos (Tarea 2b).
  useEffect(() => {
    panelRef.current?.injectJavaScript(SCRIPT_ESCENA(escenaPanel));
  }, [escenaPanel]);

  // Si el diálogo de terminar queda abierto y ya no se está al aire, se cierra.
  useEffect(() => {
    if (!alAire) setConfirmar(false);
  }, [alAire]);

  const alCargarPanel = useCallback(() => {
    panelRef.current?.injectJavaScript(SCRIPT_ESCENA(escenaPanelRef.current));
    if (enAire(tienda.obtener())) panelRef.current?.injectJavaScript(SCRIPT_IR_A_EN_VIVO);
  }, []);

  async function alIniciar() {
    setAviso(null);
    let a;
    try {
      a = await leerAjustes();
    } catch {
      setAviso('No se pudieron leer los Ajustes. Ábralos y vuelva a guardar.');
      return;
    }
    if (!validar(a).ok) {
      setClaveLista(false);
      setEnAjustes(true);
      return;
    }
    const antes = tienda.obtener();
    tienda.despachar({ tipo: 'iniciar' });
    // Un segundo toque mientras arranca no hace nada.
    if (tienda.obtener() === antes) return;
    setMbps(null);
    setMensajeConexion(null);
    ultimaConexion.current = null;
    panelRef.current?.injectJavaScript(SCRIPT_IR_A_EN_VIVO);
    // Primero la escena Inicio, para que lo primero que salga al aire no sea la cámara.
    await cambiarEscena('inicio').catch(() => undefined);
    if (tienda.obtener().fase !== 'iniciando') return; // se canceló mientras tanto
    try {
      await iniciar(a.servidor, a.clave);
    } catch (e) {
      const err = e instanceof ErrorTransmisor ? e : null;
      tienda.despachar({ tipo: 'cortado', mensaje: err ? err.message : 'No se pudo iniciar la transmisión.' });
      if (err?.codigo === 'preparar') volverAPreparar();
    }
  }

  function alSeguir() {
    setConfirmar(false);
    tienda.despachar({ tipo: 'seguir' });
    // 'seguir' vuelve a en_vivo; si la señal sigue caída, se vuelve a reconectando (review de la Tarea 4).
    if (ultimaConexion.current === 'reconectando') tienda.despachar({ tipo: 'reconectando' });
  }

  if (!listo) return <View style={estilos.raiz} />;

  const mensajeAntes = estado.error ?? aviso;

  return (
    <View style={estilos.raiz}>
      <View style={estilos.marco}>
        <BarraSuperior
          fase={estado.fase}
          segundos={estado.segundos}
          cuentaFinal={estado.cuentaFinal}
          mbps={mbps}
          ajustesDisponible={!alAire}
          onAjustes={() => setEnAjustes(true)}
          onTerminar={() => setConfirmar(true)}
          onCancelar={() => tienda.despachar({ tipo: 'terminar_ahora' })}
        />
        <View style={estilos.fila}>
          <View style={estilos.izquierda}>
            <VistaTransmisor style={estilos.vista} />
            {alAire ? (
              <EnVivo
                fase={estado.fase}
                escena={estado.escena}
                mensaje={estado.fase === 'reconectando' ? mensajeConexion : aviso}
                onEscena={(escena) => tienda.despachar({ tipo: 'escena', escena })}
              />
            ) : (
              <AntesDeIniciar
                vista={vista}
                claveLista={claveLista}
                mensaje={mensajeAntes}
                terminada={estado.fase === 'terminado'}
                onIniciar={() => void alIniciar()}
                onAjustes={() => setEnAjustes(true)}
                onPrepararOtraVez={volverAPreparar}
              />
            )}
          </View>
          <ColumnaPanel webviewRef={panelRef} onEstado={actualizarEstado} onCargado={alCargarPanel} />
        </View>
      </View>

      {enAjustes && !alAire ? (
        <View style={StyleSheet.absoluteFill}>
          <Ajustes
            onVolver={() => {
              setEnAjustes(false);
              void preparar(false);
            }}
          />
        </View>
      ) : null}

      <ConfirmarTerminar
        visible={confirmar && alAire}
        segundos={estado.segundos}
        cuentaFinal={estado.fase === 'terminando' ? estado.cuentaFinal : null}
        onGracias={() => {
          setConfirmar(false);
          tienda.despachar({ tipo: 'terminar_con_gracias' });
        }}
        onSeguir={alSeguir}
        onAhora={() => {
          setConfirmar(false);
          tienda.despachar({ tipo: 'terminar_ahora' });
        }}
        onCerrar={() => setConfirmar(false)}
      />
      <StatusBar hidden />
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: C.fondo, alignItems: 'center', justifyContent: 'center' },
  marco: { width: M.vistaAncho + 12 + M.panelAncho, gap: M.separacion },
  fila: { flexDirection: 'row', gap: 12, height: M.vistaAlto + M.separacion + M.abajoAlto },
  izquierda: { width: M.vistaAncho, height: M.vistaAlto + M.separacion + M.abajoAlto },
  vista: { position: 'absolute', left: 0, top: 0, width: M.vistaAncho, height: M.vistaAlto, backgroundColor: '#000' },
});
