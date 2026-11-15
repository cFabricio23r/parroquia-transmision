// La raíz de la app (plan 3a, Tarea 16): decide qué se muestra según la fase de la sesión.
// - `cargando`: el fondo; `entrar`, `elegir`, `sin-parroquias`, `sin-acceso` y `error-almacen`: las
//   pantallas de acceso; `lista`: la app de transmisión, con la parroquia elegida.
// - Corre los momentos del sincronizador: 'abrir' una vez por proceso (con la parroquia lista y con
//   red, o cuando vuelve la red), y los que pide App ('antes-de-iniciar' y 'al-terminar').
// Nada de acá escribe en console.* ni toca la contraseña o los tokens.
import { useFonts } from 'expo-font';
import * as Network from 'expo-network';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import App from '../App';
import { borrarCopia, borrarCopias, descargarCopia, fijarOrientacion } from '../modules/transmisor';
import { C, FUENTES } from './componentes/tema';
import { obtenerConfig } from './config/compilacion';
import { avisarCambioDePaginas, registrarCopias } from './copias/copias';
import { aHayRed } from './estado/red';
import Aviso, { confirmarCerrarSesion } from './pantallas/acceso/Aviso';
import ElegirParroquia from './pantallas/acceso/ElegirParroquia';
import Entrar from './pantallas/acceso/Entrar';
import { crearClientePlataforma, type ClientePlataforma } from './plataforma/cliente';
import { controlSesion } from './sesion/control';
import { guardiaEnVivo } from './sesion/guardia';
import { limpiezas, sincronizador, type Momento } from './sincronizar/sincronizar';

// El splash del sistema queda hasta que carguen las fuentes (antes estaba en App.tsx).
// Se llama acá, fuera del componente, como pide expo-splash-screen.
SplashScreen.preventAutoHideAsync().catch(() => undefined);

const config = obtenerConfig();

// Una sola vez por proceso: la tarea 'paginas' (después de 'acceso', que registra el control) y la
// limpieza de las copias.
const plataforma: ClientePlataforma | null = config.ok ? crearClientePlataforma({ origen: config.config.origenPlataforma }) : null;
if (config.ok) {
  registrarCopias(sincronizador, limpiezas, {
    origen: config.config.origenPlataforma,
    fetch: (...a: Parameters<typeof fetch>) => fetch(...a),
    nativo: { descargarCopia, borrarCopia, borrarCopias },
    alCambiarPaginas: avisarCambioDePaginas,
  });
}

/** Lo que se sabe de la red: si no se sabe, se supone que hay (como el aviso de App). */
let hayRed = true;
let abrirCorrio = false;

function correrMomento(m: Momento): void {
  if (!hayRed) return;
  const parroquia = controlSesion.tienda.obtener().parroquia;
  if (!parroquia) return;
  if (m === 'abrir') abrirCorrio = true;
  void sincronizador.sincronizar(m, {
    parroquia,
    sesion: controlSesion.sesion,
    cliente: controlSesion.cliente,
    enVivo: guardiaEnVivo.enVivo,
    sigueElegida: () => controlSesion.tienda.obtener().parroquia?.id === parroquia.id,
  });
}

export default function Raiz() {
  const [fuentesListas, errorFuentes] = useFonts(FUENTES);
  const fuentes = fuentesListas || errorFuentes !== null;
  const estado = useSyncExternalStore(controlSesion.tienda.suscribir, controlSesion.tienda.obtener);
  const enLista = estado.fase === 'lista' && estado.parroquia !== null;

  useEffect(() => {
    void controlSesion.cargar();
  }, []);

  // Fuera de `lista` el splash se va cuando están las fuentes; en `lista` lo maneja App (la portada).
  useEffect(() => {
    if (fuentes && !enLista) SplashScreen.hideAsync().catch(() => undefined);
  }, [fuentes, enLista]);

  // Entrar y Elegir son de celular parado (fila E); Sin acceso, acostado (VicAppSinAcceso). Al volver de
  // App puede haber quedado acostado.
  // `cargando` no gira nada (abre parado, como app.json).
  const orientacionAcceso =
    estado.fase === 'entrar' || estado.fase === 'elegir'
      ? 'vertical'
      : estado.fase === 'sin-acceso' || estado.fase === 'sin-parroquias' || estado.fase === 'error-almacen'
        ? 'horizontal'
        : null;
  useEffect(() => {
    if (!enLista && orientacionAcceso) fijarOrientacion(orientacionAcceso).catch(() => undefined);
  }, [enLista, orientacionAcceso]);

  // 'abrir': una vez por proceso, con la parroquia lista y con red.
  const enListaRef = useRef(enLista);
  enListaRef.current = enLista;
  useEffect(() => {
    if (enLista && !abrirCorrio) correrMomento('abrir');
  }, [enLista]);

  // La red: si vuelve y 'abrir' todavía no corrió, corre ahora.
  useEffect(() => {
    let vigente = true;
    const alCambiar = (s: Network.NetworkState) => {
      hayRed = aHayRed(s);
      if (vigente && hayRed && enListaRef.current && !abrirCorrio) correrMomento('abrir');
    };
    Network.getNetworkStateAsync().then(alCambiar, () => undefined);
    const r = Network.addNetworkStateListener(alCambiar);
    return () => {
      vigente = false;
      r.remove();
    };
  }, []);

  const onMomento = useCallback((m: Momento) => correrMomento(m), []);
  const onCambiarParroquia = useCallback(() => controlSesion.cambiarParroquia(), []);
  const onCerrarSesion = useCallback(() => controlSesion.cerrarSesion(), []);
  const cerrarConConfirmacion = useCallback(() => confirmarCerrarSesion(() => void controlSesion.cerrarSesion()), []);

  if (!fuentes) return <View style={estilos.raiz} />;

  if (enLista && estado.parroquia && config.ok) {
    return (
      <App
        parroquia={estado.parroquia}
        cuenta={estado.cuenta}
        cantidadParroquias={estado.parroquias.length}
        origen={config.config.origenPlataforma}
        onMomento={onMomento}
        onCambiarParroquia={onCambiarParroquia}
        onCerrarSesion={onCerrarSesion}
      />
    );
  }

  let contenido: ReactNode;
  if (!config.ok) {
    contenido = <Aviso tipo="config" nombre={config.falta} />;
  } else {
    switch (estado.fase) {
      case 'entrar':
        contenido = <Entrar control={controlSesion} plataforma={plataforma!} aviso={estado.aviso} />;
        break;
      case 'elegir':
        contenido = <ElegirParroquia control={controlSesion} />;
        break;
      case 'sin-parroquias':
        contenido = <Aviso tipo="sin-parroquias" onCerrarSesion={cerrarConConfirmacion} />;
        break;
      case 'sin-acceso':
        contenido = (
          <Aviso
            tipo="sin-acceso"
            nombre={estado.perdida?.nombre}
            hayOtras={estado.parroquias.length > 0}
            onElegir={onCambiarParroquia}
            onCerrarSesion={cerrarConConfirmacion}
          />
        );
        break;
      case 'error-almacen':
        // Con la configuración bien, lo que falla es el almacén seguro del celular.
        contenido = <Aviso tipo="config" nombre="el almacén seguro del celular" />;
        break;
      default:
        // `cargando` (y `lista` sin parroquia, que el reductor no produce): el fondo.
        contenido = null;
    }
  }

  return (
    <View style={estilos.raiz}>
      {contenido}
      <StatusBar style="light" />
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: C.fondo },
});
