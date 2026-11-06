// La app de transmisión (Tarea 8): Antes de iniciar, En vivo, ¿Terminar? y Ajustes.
// La vista previa y el panel quedan montados siempre; las pantallas cambian solo lo que va
// encima y debajo de la vista previa, así el panel y la cámara no se recargan.
// Iniciar, cancelar y terminar los maneja el orquestador (src/estado/orquestador.ts, con tests).
// La clave nunca se muestra ni se registra: solo pasa de Ajustes a iniciar().
import * as Battery from 'expo-battery';
import { useFonts } from 'expo-font';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as Network from 'expo-network';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AppState, PermissionsAndroid, Platform, StyleSheet, View } from 'react-native';

import {
  VistaTransmisor,
  abrirNoMolestar,
  abrirRegistro,
  actualizarEstado,
  anotarRegistro,
  cerrarRegistro,
  addServicioListener,
  medir,
  medirAvisos,
  noMolestarActivo,
  addEstadoListener,
  cambiarEscena,
  iniciar,
  prepararVista,
  terminar,
} from './modules/transmisor';
import BarraSuperior from './src/componentes/BarraSuperior';
import ColumnaPanel, { type PanelWeb } from './src/componentes/ColumnaPanel';
import { C, FUENTES, M } from './src/componentes/tema';
import { leerAjustes, validar, type Calidad } from './src/ajustes/ajustes';
import { avisosActivos, conexionParaAvisos } from './src/avisos/avisos';
import {
  accionRegistro,
  crearRegistrador,
  medidaDesde,
  type Medida,
  type UltimoDePantalla,
} from './src/registro/registro';
import { crearOrquestador, type Orquestador } from './src/estado/orquestador';
import type { Escena, EstadoTransmision } from './src/estado/transmision';
import AntesDeIniciar, { type EstadoVista } from './src/pantallas/AntesDeIniciar';
import Ajustes from './src/pantallas/Ajustes';
import ConfirmarTerminar from './src/pantallas/ConfirmarTerminar';
import EnVivo from './src/pantallas/EnVivo';
import { SCRIPT_ESCENA, SCRIPT_IR_A_EN_VIVO, SCRIPT_IR_A_PREPARAR } from './src/puente/puente';

const AVISO_ESCENA = 'No se pudo cambiar la escena.';
const AVISO_CAMARA_LISTA = 'La cámara se volvió a preparar. Ya puede transmitir.';

const enAire = (e: EstadoTransmision): boolean =>
  e.fase === 'iniciando' || e.fase === 'en_vivo' || e.fase === 'reconectando' || e.fase === 'terminando';

// Con la pantalla encendida mientras se transmite (Tarea 9).
const ETIQUETA_DESPIERTA = 'transmision';
// Cada cuánto se leen el estado térmico y la temperatura para los avisos.
const MEDIR_AVISOS_MS = 10_000;

async function pedirPermisos(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  // Notificaciones (Android 13 o más): para la notificación fija del servicio en primer plano.
  // Si se niega, la transmisión sigue igual; solo no se ve la notificación.
  const conAviso = typeof Platform.Version === 'number' && Platform.Version >= 33;
  const r = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.CAMERA,
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    ...(conAviso ? [PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS] : []),
  ]);
  return (
    r[PermissionsAndroid.PERMISSIONS.CAMERA] === PermissionsAndroid.RESULTS.GRANTED &&
    r[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === PermissionsAndroid.RESULTS.GRANTED
  );
}

// Lo que el orquestador le pide a la pantalla. App lo vuelve a llenar en cada render.
const pantalla = {
  alArrancar: () => {},
  abrirAjustes: () => {},
  avisar: (_m: string | null) => {},
  volverAPreparar: () => {},
};

const orq: Orquestador = crearOrquestador({
  leerAjustes,
  cambiarEscena,
  iniciar,
  terminar,
  alArrancar: () => pantalla.alArrancar(),
  abrirAjustes: () => pantalla.abrirAjustes(),
  avisar: (m) => pantalla.avisar(m),
  volverAPreparar: () => pantalla.volverAPreparar(),
});
const tienda = orq.tienda;

// Lo último que se sabe de la batería y la subida, para el registro de rendimiento.
// App lo actualiza en cada render; el registrador lo lee cada 30 s. Nunca lleva la clave.
const ultimo: UltimoDePantalla = { bateria: null, cargando: null, mbps: null };

const registrador = crearRegistrador({
  // El armado de la muestra está en registro.ts, con tests (review M10).
  async medir(): Promise<Medida> {
    return medidaDesde(tienda.obtener(), await medir(), ultimo, new Date());
  },
  abrir: abrirRegistro,
  anotar: anotarRegistro,
  cerrar: cerrarRegistro,
  ahora: () => new Date(),
});

export default function App() {
  const [fuentesListas, errorFuentes] = useFonts(FUENTES);
  const listo = fuentesListas || errorFuentes !== null;
  const estado = useSyncExternalStore(tienda.suscribir, tienda.obtener);

  const [enAjustes, setEnAjustes] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [vista, setVista] = useState<EstadoVista>('preparando');
  const [claveLista, setClaveLista] = useState<boolean | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [avisoEscena, setAvisoEscena] = useState<string | null>(null);
  // El error del estado que ya quedó resuelto (la cámara se volvió a preparar sola): no se muestra.
  const [errorSuperado, setErrorSuperado] = useState<string | null>(null);
  const [mbps, setMbps] = useState<number | null>(null);
  // Para los avisos (Tarea 9).
  const [bateria, setBateria] = useState<number | null>(null);
  const [cargando, setCargando] = useState<boolean | null>(null);
  const [termico, setTermico] = useState<number | null>(null);
  const [temperatura, setTemperatura] = useState<number | null>(null);
  const [hayRed, setHayRed] = useState(true);
  const [noMolestar, setNoMolestar] = useState<boolean | null>(null);
  const [calidad, setCalidad] = useState<Calidad | undefined>(undefined);
  // Si el servicio en primer plano no arrancó (review M4): se muestra hasta el próximo arranque.
  const [avisoServicio, setAvisoServicio] = useState<string | null>(null);
  useEffect(() => {
    ultimo.bateria = bateria;
    ultimo.cargando = cargando;
    ultimo.mbps = mbps;
  }, [bateria, cargando, mbps]);

  const panelRef = useRef<PanelWeb | null>(null);
  // Calidad y micrófono con que se preparó la vista por última vez (null: hay que preparar).
  const preparadaCon = useRef<string | null>(null);
  const preparandoAhora = useRef(false);

  const alAire = enAire(estado);
  // Antes de salir al aire la capa muestra Cámara (para encuadrar) y el panel cree estar en
  // Inicio, así no queda ningún rótulo encendido. Al aire, las dos siguen la escena del estado.
  const escenaCapa: Escena = alAire ? estado.escena : 'camara';
  const escenaPanel: Escena = alAire ? estado.escena : 'inicio';
  const escenaPanelRef = useRef(escenaPanel);
  escenaPanelRef.current = escenaPanel;

  /** Prepara cámara y micrófono. Sin `forzar`, no hace nada si la calidad y el micrófono no cambiaron. Da true si quedó lista. */
  const preparar = useCallback(async (forzar: boolean): Promise<boolean> => {
    if (preparandoAhora.current) return false;
    preparandoAhora.current = true;
    try {
      if (!(await pedirPermisos())) {
        setVista('sin_permiso');
        return false;
      }
      const a = await leerAjustes();
      setClaveLista(validar(a).ok);
      setCalidad(a.calidad);
      const firma = `${a.calidad}|${a.microfono}`;
      if (!forzar && firma === preparadaCon.current) {
        setVista('lista');
        return true;
      }
      setVista('preparando');
      await prepararVista(a.calidad, a.microfono);
      preparadaCon.current = firma;
      setVista('lista');
      return true;
    } catch {
      preparadaCon.current = null;
      setVista('error');
      return false;
    } finally {
      preparandoAhora.current = false;
    }
  }, []);

  // Corte de tipo «preparar» (review N3 de la Tarea 6, M6 de la Tarea 8): se vuelve a preparar
  // la cámara sola y, si sale bien, el «Cierre la app…» se cambia por un aviso de que ya está lista.
  const volverAPreparar = useCallback(() => {
    preparadaCon.current = null;
    void preparar(true).then((bien) => {
      if (!bien) return;
      setErrorSuperado(tienda.obtener().error);
      setAviso(AVISO_CAMARA_LISTA);
    });
  }, [preparar]);

  pantalla.alArrancar = () => {
    // Un arranque cierra Ajustes aunque se haya abierto mientras se leían los Ajustes (review M4).
    setEnAjustes(false);
    setMbps(null);
    setErrorSuperado(null);
    setAvisoServicio(null);
    panelRef.current?.injectJavaScript(SCRIPT_IR_A_EN_VIVO);
  };
  pantalla.abrirAjustes = () => {
    setClaveLista(false);
    setEnAjustes(true);
  };
  pantalla.avisar = setAviso;
  pantalla.volverAPreparar = volverAPreparar;

  useEffect(() => {
    if (listo) void preparar(true);
  }, [listo, preparar]);

  // Eventos de la conexión: el estado lo maneja el orquestador; acá solo Mbps y el mensaje.
  useEffect(() => {
    const s = addEstadoListener((e) => {
      setMbps(e.conexion === 'conectado' ? e.mbps : null);
      if (e.termico !== undefined && e.termico !== null) setTermico(e.termico);
      orq.alEvento(e);
    });
    return () => s.remove();
  }, []);

  // Batería (expo-battery): nivel de 0 a 1 y si está cargando.
  useEffect(() => {
    const aCargando = (s: Battery.BatteryState): boolean | null =>
      s === Battery.BatteryState.CHARGING || s === Battery.BatteryState.FULL
        ? true
        : s === Battery.BatteryState.UNPLUGGED
          ? false
          : null;
    Battery.getBatteryLevelAsync().then(setBateria, () => undefined);
    Battery.getBatteryStateAsync().then((s) => setCargando(aCargando(s)), () => undefined);
    const n = Battery.addBatteryLevelListener((e) => setBateria(e.batteryLevel));
    const c = Battery.addBatteryStateListener((e) => setCargando(aCargando(e.batteryState)));
    return () => {
      n.remove();
      c.remove();
    };
  }, []);

  // Red (expo-network). Si no se sabe, se supone que hay: el aviso es solo para «sin internet» seguro.
  useEffect(() => {
    const aHayRed = (s: Network.NetworkState) =>
      !(s.isConnected === false || s.type === Network.NetworkStateType.NONE || s.isInternetReachable === false);
    Network.getNetworkStateAsync().then((s) => setHayRed(aHayRed(s)), () => undefined);
    const r = Network.addNetworkStateListener((s) => setHayRed(aHayRed(s)));
    return () => r.remove();
  }, []);

  // Estado térmico y temperatura de la batería, cada 10 s.
  useEffect(() => {
    const leer = () =>
      medirAvisos().then(
        (m) => {
          setTermico(m.termico);
          setTemperatura(m.temperatura);
        },
        () => undefined,
      );
    void leer();
    const t = setInterval(leer, MEDIR_AVISOS_MS);
    return () => clearInterval(t);
  }, []);

  // No molestar: se revisa al abrir y cada vez que la app vuelve al frente (p. ej. desde los ajustes).
  useEffect(() => {
    const revisar = () => noMolestarActivo().then(setNoMolestar, () => setNoMolestar(null));
    void revisar();
    const s = AppState.addEventListener('change', (e) => {
      if (e === 'active') void revisar();
    });
    return () => s.remove();
  }, []);

  // Pantalla encendida mientras la fase no sea preparando ni terminado.
  const despierta = estado.fase !== 'preparando' && estado.fase !== 'terminado';
  useEffect(() => {
    if (despierta) activateKeepAwakeAsync(ETIQUETA_DESPIERTA).catch(() => undefined);
    else deactivateKeepAwake(ETIQUETA_DESPIERTA).catch(() => undefined);
  }, [despierta]);

  // Registro de rendimiento: un archivo por transmisión, una línea cada 30 s mientras se está al aire.
  useEffect(() => {
    // El archivo se abre recién en en_vivo: un arranque fallido no deja archivo (review M2).
    const accion = accionRegistro(estado.fase);
    if (accion === 'empezar') registrador.empezar();
    else if (accion === 'parar') registrador.parar();
  }, [estado.fase]);

  useEffect(() => {
    const s = addServicioListener(setAvisoServicio);
    return () => s.remove();
  }, []);

  // Reloj: un tic por segundo (el reducer lo ignora fuera del aire).
  useEffect(() => {
    const t = setInterval(() => tienda.despachar({ tipo: 'tic' }), 1000);
    return () => clearInterval(t);
  }, []);

  // Escena de la capa: con la transición del logo, cada vez que cambia (y solo con la cámara lista).
  // Un cambio que sale bien borra el aviso de un cambio fallido anterior (review M5).
  const vistaLista = vista === 'lista';
  useEffect(() => {
    if (!vistaLista && !alAire) return;
    cambiarEscena(escenaCapa)
      .then(() => setAvisoEscena(null))
      .catch(() => setAvisoEscena(AVISO_ESCENA));
  }, [escenaCapa, vistaLista, alAire]);

  // Escena del panel: fuera de Cámara bloquea los rótulos (Tarea 2b).
  useEffect(() => {
    panelRef.current?.injectJavaScript(SCRIPT_ESCENA(escenaPanel));
  }, [escenaPanel]);

  // Al dejar el aire: se cierra el diálogo de terminar y el panel vuelve a Preparar (review M9).
  const estabaAlAire = useRef(false);
  useEffect(() => {
    if (!alAire) {
      setConfirmar(false);
      if (estabaAlAire.current) panelRef.current?.injectJavaScript(SCRIPT_IR_A_PREPARAR);
    }
    estabaAlAire.current = alAire;
  }, [alAire]);

  const alCargarPanel = useCallback(() => {
    panelRef.current?.injectJavaScript(SCRIPT_ESCENA(escenaPanelRef.current));
    if (enAire(tienda.obtener())) panelRef.current?.injectJavaScript(SCRIPT_IR_A_EN_VIVO);
  }, []);

  if (!listo) return <View style={estilos.raiz} />;

  const errorVisible = estado.error !== null && estado.error !== errorSuperado ? estado.error : null;
  const mensajeAntes = errorVisible ?? aviso ?? avisoEscena;
  // Al reconectar, el aviso «Señal débil» (avisosActivos) ocupa el lugar del mensaje de la conexión.
  const mensajeVivo = avisoServicio ?? avisoEscena ?? aviso;
  const avisos = avisosActivos({
    conexion: conexionParaAvisos(estado.fase),
    bateria,
    temperatura,
    termico,
    hayRed,
    calidad,
  });

  return (
    <View style={estilos.raiz}>
      <View style={estilos.marco}>
        <BarraSuperior
          fase={estado.fase}
          segundos={estado.segundos}
          cuentaFinal={estado.cuentaFinal}
          mbps={mbps}
          bateria={bateria}
          temperatura={temperatura}
          ajustesDisponible={!alAire}
          onAjustes={() => setEnAjustes(true)}
          onTerminar={() => setConfirmar(true)}
          onCancelar={orq.cancelar}
        />
        <View style={estilos.fila}>
          <View style={estilos.izquierda}>
            <VistaTransmisor style={estilos.vista} />
            {alAire ? (
              <EnVivo
                fase={estado.fase}
                escena={estado.escena}
                mensaje={mensajeVivo}
                avisos={avisos}
                onEscena={(escena) => tienda.despachar({ tipo: 'escena', escena })}
              />
            ) : (
              <AntesDeIniciar
                vista={vista}
                claveLista={claveLista}
                mensaje={mensajeAntes}
                terminada={estado.fase === 'terminado'}
                avisos={avisos}
                noMolestar={noMolestar}
                onActivarNoMolestar={() => void abrirNoMolestar().catch(() => undefined)}
                onIniciar={() => void orq.iniciar()}
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
          orq.terminarConGracias();
        }}
        onSeguir={() => {
          setConfirmar(false);
          orq.seguir();
        }}
        onAhora={() => {
          setConfirmar(false);
          orq.terminarAhora();
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
