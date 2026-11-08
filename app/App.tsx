// La app de transmisión (Tarea 8): Antes de iniciar, En vivo, ¿Terminar? y Ajustes.
// Tarea 9c: abre en Preparar, en vertical; «Listo» pasa a Antes de iniciar, en horizontal, y la
// orientación queda fija en horizontal durante toda la transmisión (src/estado/orientacion.ts).
// La vista previa y el panel quedan montados siempre, en el mismo lugar del árbol: al girar solo
// cambian de lugar y tamaño, así el panel y la cámara no se recargan. Las pantallas cambian solo
// lo que va encima y alrededor de la vista previa.
// Iniciar, cancelar y terminar los maneja el orquestador (src/estado/orquestador.ts, con tests).
// La clave nunca se muestra ni se registra: solo pasa de Ajustes a iniciar().
import * as Battery from 'expo-battery';
import { useFonts } from 'expo-font';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as Network from 'expo-network';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AppState, PermissionsAndroid, Platform, StyleSheet, View, useWindowDimensions } from 'react-native';

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
  fijarEstiloFinal,
  fijarOrientacion,
  zonasSeguras,
  type ZonasSeguras,
  iniciar,
  ponerZoom,
  prepararVista,
  rangoZoom,
  terminar,
} from './modules/transmisor';
import BarraSuperior from './src/componentes/BarraSuperior';
import ColumnaPanel, { type PanelWeb } from './src/componentes/ColumnaPanel';
import ControlesCamara from './src/componentes/ControlesCamara';
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
import { ESPERA_GIRO_MS, listoTrasCambio, orientacionPara, pantallaPara, pantallaVisible } from './src/estado/orientacion';
import type { Escena, EstadoTransmision } from './src/estado/transmision';
import { limitarZoom, rangoValido, rectCompleta, type RangoZoom } from './src/estado/zoom';
import AntesDeIniciar, { type EstadoVista } from './src/pantallas/AntesDeIniciar';
import Ajustes from './src/pantallas/Ajustes';
import ConfirmarTerminar from './src/pantallas/ConfirmarTerminar';
import EnVivo from './src/pantallas/EnVivo';
import Portada from './src/pantallas/Portada';
import PrepararVertical, { type Rect } from './src/pantallas/PrepararVertical';
import { ESPERA_MAXIMA_MS, fasePortada } from './src/portada/portada';
import { SCRIPT_ESCENA, SCRIPT_IR_A_EN_VIVO, SCRIPT_IR_A_PREPARAR } from './src/puente/puente';

// El splash del sistema queda hasta que carguen las fuentes (Tarea 9b, src/portada/portada.ts).
// Se llama acá, fuera del componente, como pide expo-splash-screen.
SplashScreen.preventAutoHideAsync().catch(() => undefined);

const AVISO_ESCENA = 'No se pudo cambiar la escena.';
const AVISO_CAMARA_LISTA = 'La cámara se volvió a preparar. Ya puede transmitir.';

const enAire = (e: EstadoTransmision): boolean =>
  e.fase === 'iniciando' || e.fase === 'en_vivo' || e.fase === 'reconectando' || e.fase === 'terminando';

// Con la pantalla encendida mientras se transmite (Tarea 9).
const ETIQUETA_DESPIERTA = 'transmision';
// Cada cuánto se leen el estado térmico y la temperatura para los avisos.
const MEDIR_AVISOS_MS = 10_000;

// Medidas de Preparar en vertical (lienzo, artboard 9: 390×844 dp).
const V = { borde: 12, tiraAlto: 48, listoAlto: 60, abajo: 16, hueco: 8, huecoPanel: 12 } as const;

/**
 * Dónde va cada cosa, en dp, dentro del lienzo de App. Sale del tamaño real de la ventana y de
 * las zonas seguras (barra de estado, recorte de la cámara, barra de navegación): nada queda
 * debajo de ellas.
 */
function armarLugares(anchoVentana: number, altoVentana: number, z: ZonasSeguras) {
  const ancho = anchoVentana - z.left - z.right;
  const alto = altoVentana - z.top - z.bottom;
  if (altoVentana > anchoVentana) {
    const w = ancho - 2 * V.borde;
    const vistaAlto = Math.round((w * 9) / 16);
    const barra: Rect = { left: V.borde, top: V.borde, width: w, height: M.barraAlto };
    const vista: Rect = { left: V.borde, top: barra.top + M.barraAlto + 10, width: w, height: vistaAlto };
    const tira: Rect = { left: V.borde, top: vista.top + vistaAlto + V.hueco, width: w, height: V.tiraAlto };
    const listo: Rect = { left: V.borde, top: alto - V.abajo - V.listoAlto, width: w, height: V.listoAlto };
    const panelArriba = tira.top + V.tiraAlto + V.huecoPanel;
    const panel: Rect = { left: V.borde, top: panelArriba, width: w, height: Math.max(0, listo.top - V.huecoPanel - panelArriba) };
    const lienzo: Rect = { left: z.left, top: z.top, width: ancho, height: alto };
    return { vertical: true, lienzo, barra, vista, capa: vista, tira, listo, panel };
  }
  // Acostado, como hasta la Tarea 9: vista previa de 448×252 y panel de 360 a la derecha, centrados.
  const w = M.vistaAncho + 12 + M.panelAncho;
  const abajo = M.vistaAlto + M.separacion + M.abajoAlto;
  const h = M.barraAlto + M.separacion + abajo;
  const lienzo: Rect = {
    left: z.left + Math.max(0, (ancho - w) / 2),
    top: z.top + Math.max(0, (alto - h) / 2),
    width: w,
    height: h,
  };
  const barra: Rect = { left: 0, top: 0, width: w, height: M.barraAlto };
  const arriba = M.barraAlto + M.separacion;
  const vista: Rect = { left: 0, top: arriba, width: M.vistaAncho, height: M.vistaAlto };
  const capa: Rect = { left: 0, top: arriba, width: M.vistaAncho, height: abajo };
  const panel: Rect = { left: M.vistaAncho + 12, top: arriba, width: M.panelAncho, height: abajo };
  return { vertical: false, lienzo, barra, vista, capa, tira: capa, listo: capa, panel };
}

/** Los lugares en pantalla completa: la vista en 16:9 y el panel corrido fuera de la pantalla. */
function lugaresCompletos(
  anchoVentana: number,
  altoVentana: number,
  z: ZonasSeguras,
  normales: ReturnType<typeof armarLugares>,
): ReturnType<typeof armarLugares> {
  const ancho = anchoVentana - z.left - z.right;
  const alto = altoVentana - z.top - z.bottom;
  const lienzo: Rect = { left: z.left, top: z.top, width: ancho, height: alto };
  const vista = rectCompleta(ancho, alto);
  const fuera: Rect = { left: anchoVentana + 100, top: 0, width: normales.panel.width, height: normales.panel.height };
  return { ...normales, lienzo, vista, capa: vista, tira: vista, listo: vista, panel: fuera, barra: { ...fuera, height: 0 } };
}

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

const SIN_ZONAS: ZonasSeguras = { top: 0, bottom: 0, left: 0, right: 0 };

export default function App() {
  const [fuentesListas, errorFuentes] = useFonts(FUENTES);
  const listo = fuentesListas || errorFuentes !== null;
  const estado = useSyncExternalStore(tienda.suscribir, tienda.obtener);

  // Apertura: splash del sistema, después la portada animada hasta que termine (o se toque) y el
  // panel haya cargado (Tareas 9b y 9f, src/portada/portada.ts).
  const [panelCargado, setPanelCargado] = useState(false);
  const [esperaVencida, setEsperaVencida] = useState(false);
  const [animacionLista, setAnimacionLista] = useState(false);
  const alTerminarPortada = useCallback(() => setAnimacionLista(true), []);
  const fase = fasePortada({
    fuentesListas: listo,
    panelCargado,
    animacionTerminada: animacionLista,
    vencida: esperaVencida,
  });
  useEffect(() => {
    const t = setTimeout(() => setEsperaVencida(true), ESPERA_MAXIMA_MS);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (fase !== 'nativo') SplashScreen.hideAsync().catch(() => undefined);
  }, [fase]);

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
  const [fpsVideo, setFpsVideo] = useState<number | null>(null);
  // Zoom y pantalla completa (Tarea 9g).
  const [rangoDeZoom, setRangoDeZoom] = useState<RangoZoom | null>(null);
  const [zoom, setZoom] = useState(1);
  const [completa, setCompleta] = useState(false);
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

  // Preparar (vertical) o Antes de iniciar (horizontal): «Listo» y «‹ Volver a preparar» (Tarea 9c).
  const [listoParaIniciar, setListoParaIniciar] = useState(false);
  const faseAnterior = useRef(estado.fase);
  useEffect(() => {
    const antes = faseAnterior.current;
    faseAnterior.current = estado.fase;
    setListoParaIniciar((l) => listoTrasCambio(l, antes, estado.fase));
  }, [estado.fase]);
  const pantallaActual = pantallaPara(estado.fase, listoParaIniciar);
  const orientacion = orientacionPara(pantallaActual);
  useEffect(() => {
    fijarOrientacion(orientacion).catch(() => undefined);
  }, [orientacion]);
  // La escena que se mira en Preparar. Empieza en Inicio, como el lienzo.
  const [escenaPrevia, setEscenaPrevia] = useState<Escena>('inicio');
  const ventana = useWindowDimensions();
  // Barra de estado, recorte y navegación (Tarea 9c). Se vuelven a leer cada vez que cambia la
  // ventana (al girar), y otra vez un poco después, porque los insets llegan después del giro.
  const [zonas, setZonas] = useState<ZonasSeguras>(SIN_ZONAS);
  useEffect(() => {
    let vigente = true;
    const leer = () =>
      zonasSeguras().then(
        (z) => {
          if (vigente) setZonas((v) => (v.top === z.top && v.bottom === z.bottom && v.left === z.left && v.right === z.right ? v : z));
        },
        () => undefined,
      );
    void leer();
    const t = setTimeout(leer, 400);
    return () => {
      vigente = false;
      clearTimeout(t);
    };
  }, [ventana.width, ventana.height]);
  const lugaresNormales = armarLugares(ventana.width, ventana.height, zonas);
  // Mientras gira, la ventana todavía tiene la forma vieja: las pantallas se ponen al terminar.
  const formaLista = lugaresNormales.vertical === (orientacion === 'vertical');
  // Si la ventana no gira en 1,5 s (fijarOrientacion falló o el sistema no hizo caso), la pantalla se
  // muestra igual, según la forma real de la ventana, en vez de quedar vacía (review m3 de la 9c).
  // Se anota para qué orientación venció la espera: un pedido nuevo vuelve a esperar.
  const [giroVencidoPara, setGiroVencidoPara] = useState<string | null>(null);
  useEffect(() => {
    if (formaLista) return;
    const t = setTimeout(() => setGiroVencidoPara(orientacion), ESPERA_GIRO_MS);
    return () => clearTimeout(t);
  }, [formaLista, orientacion]);
  const visible = pantallaVisible(pantallaActual, lugaresNormales.vertical, giroVencidoPara === orientacion);

  const panelRef = useRef<PanelWeb | null>(null);
  // Calidad y micrófono con que se preparó la vista por última vez (null: hay que preparar).
  const preparadaCon = useRef<string | null>(null);
  const preparandoAhora = useRef(false);

  const alAire = enAire(estado);

  // Pantalla completa (Tarea 9g): solo al aire y acostado. La vista previa ocupa la pantalla en
  // 16:9; el panel queda montado pero fuera de la pantalla, así no se recarga.
  const enCompleta = completa && visible === 'aire' && !lugaresNormales.vertical;
  const lugares = enCompleta ? lugaresCompletos(ventana.width, ventana.height, zonas, lugaresNormales) : lugaresNormales;

  // Al dejar el aire: el zoom vuelve a 1× (el nativo también lo hace) y se sale de pantalla completa.
  useEffect(() => {
    if (!alAire) {
      setCompleta(false);
      setZoom(1);
      return;
    }
    rangoZoom().then(
      (r) => {
        const v = rangoValido(r);
        setRangoDeZoom(v);
        if (v) setZoom(limitarZoom(1, v));
      },
      () => setRangoDeZoom(null),
    );
  }, [alAire]);

  const cambiarZoom = useCallback((z: number) => {
    setZoom(z);
    ponerZoom(z).catch(() => undefined);
  }, []);
  // En Preparar la capa muestra la escena elegida en la tira, solo para verla. En Antes de iniciar
  // muestra Cámara (para encuadrar). En los dos el panel cree estar en Inicio, así no queda ningún
  // rótulo encendido. Al aire, las dos siguen la escena del estado.
  const escenaCapa: Escena = alAire ? estado.escena : (visible ?? pantallaActual) === 'preparar' ? escenaPrevia : 'camara';
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
      // Estilo de la escena Producción (Tarea 9d). Si ya está cargada, el nativo la recarga.
      fijarEstiloFinal(a.estiloFinal).catch(() => undefined);
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

  // Estado térmico, temperatura de la batería y fps del video, cada 10 s.
  useEffect(() => {
    const leer = () =>
      medirAvisos().then(
        (m) => {
          setTermico(m.termico);
          setTemperatura(m.temperatura);
          setFpsVideo(m.fpsVideo ?? null);
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
    setPanelCargado(true);
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
      {/* El orden de estos hijos no cambia nunca: la vista previa y el panel siguen montados al girar. */}
      <View style={[estilos.lienzo, lugares.lienzo]}>
        <VistaTransmisor style={[estilos.vista, lugares.vista]} />
        <ColumnaPanel
          webviewRef={panelRef}
          onEstado={actualizarEstado}
          onCargado={alCargarPanel}
          estilo={[estilos.zona, lugares.panel]}
        />
        <View style={[estilos.zona, lugares.barra]}>
          {enCompleta ? null : (
            <BarraSuperior
              fase={estado.fase}
              segundos={estado.segundos}
              cuentaFinal={estado.cuentaFinal}
              mbps={mbps}
              bateria={bateria}
              temperatura={temperatura}
              fps={fpsVideo}
              ajustesDisponible={!alAire}
              onAjustes={() => setEnAjustes(true)}
              onTerminar={() => setConfirmar(true)}
              onCancelar={orq.cancelar}
            />
          )}
        </View>
        {visible === null ? null : visible === 'preparar' ? (
          <PrepararVertical
            vista={vista}
            mensaje={mensajeAntes}
            escena={escenaPrevia}
            onEscena={setEscenaPrevia}
            onListo={() => setListoParaIniciar(true)}
            onPrepararOtraVez={volverAPreparar}
            zonaVista={lugares.vista}
            zonaTira={lugares.tira}
            zonaListo={lugares.listo}
          />
        ) : (
          <View style={[estilos.zona, lugares.capa]} pointerEvents="box-none">
            {visible === 'aire' ? (
              <EnVivo
                fase={estado.fase}
                escena={estado.escena}
                mensaje={mensajeVivo}
                avisos={avisos}
                onEscena={(escena) => tienda.despachar({ tipo: 'escena', escena })}
                completa={enCompleta ? { ancho: lugares.vista.width, alto: lugares.vista.height } : null}
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
                onVolverAPreparar={() => setListoParaIniciar(false)}
              />
            )}
          </View>
        )}
        {visible === 'aire' ? (
          <View style={[estilos.zona, lugares.vista]} pointerEvents="box-none">
            <ControlesCamara
              rango={rangoDeZoom}
              zoom={zoom}
              onZoom={cambiarZoom}
              completa={enCompleta}
              onCompleta={setCompleta}
              fase={estado.fase}
              segundos={estado.segundos}
              fps={fpsVideo}
            />
          </View>
        ) : null}
      </View>

      {enAjustes && !alAire ? (
        <View
          style={[
            StyleSheet.absoluteFill,
            estilos.ajustes,
            { paddingTop: zonas.top, paddingBottom: zonas.bottom, paddingLeft: zonas.left, paddingRight: zonas.right },
          ]}
        >
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
      <Portada visible={fase === 'portada'} zonas={zonas} onTerminada={alTerminarPortada} />
      <StatusBar hidden />
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: C.fondo },
  lienzo: { position: 'absolute' },
  zona: { position: 'absolute' },
  vista: { position: 'absolute', backgroundColor: '#000' },
  ajustes: { backgroundColor: C.fondo },
});
