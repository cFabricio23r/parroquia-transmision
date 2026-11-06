// PANTALLA DE PRUEBA TEMPORAL (Tarea 6): vista previa + Iniciar/Terminar + Ajustes.
// La reemplaza la pantalla real de transmisión en tareas siguientes.
// La clave nunca se muestra ni se registra en consola.
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { PermissionsAndroid, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  ErrorTransmisor,
  EventoEstado,
  VistaTransmisor,
  addEstadoListener,
  iniciar,
  prepararVista,
  terminar,
} from './modules/transmisor';
import { leerAjustes, validar } from './src/ajustes/ajustes';
import Ajustes from './src/pantallas/Ajustes';

const C = {
  fondo: '#061224',
  caja: '#10284a',
  boton: '#163560',
  primario: '#1155a4',
  texto: '#eef5fc',
  suave: '#b4cbe8',
  rojo: '#c8281e',
  verde: '#2fbf7a',
  ambar: '#f0b429',
};

type Fase = 'sin_permiso' | 'preparando' | 'lista' | 'iniciando' | 'al_aire';

// Solo para la comprobación automática del log: si Metro arranca con
// EXPO_PUBLIC_PRUEBA_MARCA=<clave falsa>, aparece un botón que transmite con esa clave
// falsa (sin guardarla en Ajustes). Nunca poner acá una clave real.
const MARCA_FALSA = __DEV__ ? process.env.EXPO_PUBLIC_PRUEBA_MARCA : undefined;
const SERVIDOR_FACEBOOK = 'rtmps://live-api-s.facebook.com:443/rtmp/';

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
  const [pantalla, setPantalla] = useState<'prueba' | 'ajustes'>('prueba');
  const [fase, setFase] = useState<Fase>('preparando');
  const [estado, setEstado] = useState<EventoEstado | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const faseRef = useRef(fase);
  faseRef.current = fase;

  const preparar = useCallback(async () => {
    setAviso(null);
    if (!(await pedirPermisos())) {
      setFase('sin_permiso');
      setAviso('Hace falta permiso de cámara y micrófono.');
      return;
    }
    setFase('preparando');
    try {
      const a = await leerAjustes();
      await prepararVista(a.calidad, a.microfono);
      setFase('lista');
    } catch {
      setFase('sin_permiso');
      setAviso('No se pudo preparar la cámara.');
    }
  }, []);

  useEffect(() => {
    const s = addEstadoListener((e) => {
      setEstado(e);
      if (e.conexion === 'cortado') setFase('lista');
      else if (faseRef.current === 'iniciando' || faseRef.current === 'al_aire') setFase('al_aire');
    });
    return () => s.remove();
  }, []);

  // Al volver de Ajustes se vuelve a preparar (la calidad pudo cambiar).
  useEffect(() => {
    if (pantalla === 'prueba') void preparar();
  }, [pantalla, preparar]);

  async function alIniciar() {
    setAviso(null);
    setEstado(null);
    try {
      const a = await leerAjustes();
      const v = validar(a);
      if (!v.ok) {
        setAviso(v.mensaje + ' (Abra Ajustes.)');
        return;
      }
      setFase('iniciando');
      await iniciar(a.servidor, a.clave);
    } catch (e) {
      setFase('lista');
      // ErrorTransmisor trae un mensaje en español sin datos; otro error, texto genérico.
      setAviso(e instanceof ErrorTransmisor ? e.message : 'No se pudo iniciar la transmisión.');
    }
  }

  async function alTerminar() {
    try {
      await terminar();
    } finally {
      setFase('lista');
      setEstado(null);
    }
  }

  if (pantalla === 'ajustes') {
    return (
      <>
        <Ajustes onVolver={() => setPantalla('prueba')} />
        <StatusBar hidden />
      </>
    );
  }

  const alAire = fase === 'iniciando' || fase === 'al_aire';
  const textoConexion =
    fase === 'iniciando' && !estado
      ? 'Conectando…'
      : estado?.conexion === 'conectado'
        ? 'EN VIVO'
        : estado?.conexion === 'reconectando'
          ? 'Reconectando…'
          : estado?.conexion === 'cortado'
            ? 'Cortado'
            : 'Fuera del aire';
  const colorConexion =
    estado?.conexion === 'conectado' ? C.rojo : estado?.conexion === 'reconectando' ? C.ambar : C.suave;

  return (
    <View style={estilos.raiz}>
      <VistaTransmisor style={estilos.vista} />
      <View style={estilos.panel}>
        <Text style={estilos.titulo}>Prueba de transmisión</Text>
        <View style={estilos.caja} accessibilityLiveRegion="polite">
          <Text style={[estilos.estado, { color: colorConexion }]}>{textoConexion}</Text>
          <Text style={estilos.dato}>
            {estado?.mbps != null ? `${estado.mbps.toFixed(1)} Mbps` : '— Mbps'}
          </Text>
          {estado?.mensaje ? <Text style={estilos.mensaje}>{estado.mensaje}</Text> : null}
          {aviso ? <Text style={estilos.mensaje}>{aviso}</Text> : null}
          {fase === 'preparando' ? <Text style={estilos.dato}>Preparando cámara…</Text> : null}
        </View>
        <View style={estilos.fila}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Iniciar"
            disabled={fase !== 'lista'}
            onPress={alIniciar}
            style={[estilos.boton, estilos.primario, fase !== 'lista' && estilos.apagado]}
          >
            <Text style={estilos.botonTexto}>Iniciar</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Terminar"
            disabled={!alAire}
            onPress={alTerminar}
            style={[estilos.boton, { backgroundColor: C.rojo }, !alAire && estilos.apagado]}
          >
            <Text style={estilos.botonTexto}>Terminar</Text>
          </Pressable>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ajustes"
          disabled={alAire}
          onPress={() => setPantalla('ajustes')}
          style={[estilos.boton, alAire && estilos.apagado]}
        >
          <Text style={estilos.botonTexto}>Ajustes</Text>
        </Pressable>
        {MARCA_FALSA && fase === 'lista' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Probar clave falsa"
            onPress={() => {
              setEstado(null);
              setFase('iniciando');
              iniciar(SERVIDOR_FACEBOOK, MARCA_FALSA).catch((e) => {
                setFase('lista');
                setAviso(e instanceof ErrorTransmisor ? e.message : 'No se pudo iniciar la transmisión.');
              });
            }}
            style={estilos.boton}
          >
            <Text style={estilos.botonTexto}>Probar clave falsa</Text>
          </Pressable>
        ) : null}
        {fase === 'sin_permiso' ? (
          <Pressable accessibilityRole="button" onPress={preparar} style={estilos.boton}>
            <Text style={estilos.botonTexto}>Reintentar permisos</Text>
          </Pressable>
        ) : null}
      </View>
      <StatusBar hidden />
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: C.fondo, flexDirection: 'row', padding: 12, gap: 12, alignItems: 'center' },
  vista: { width: 448, height: 252, backgroundColor: '#000' },
  panel: { flex: 1, gap: 10 },
  titulo: { color: C.texto, fontSize: 18, fontWeight: '800' },
  caja: { backgroundColor: C.caja, borderRadius: 12, padding: 12, gap: 4 },
  estado: { fontSize: 20, fontWeight: '900' },
  dato: { color: C.suave, fontSize: 14, fontWeight: '700' },
  mensaje: { color: C.ambar, fontSize: 13, fontWeight: '700' },
  fila: { flexDirection: 'row', gap: 10 },
  boton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 10,
    backgroundColor: C.boton,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  primario: { backgroundColor: C.primario },
  apagado: { opacity: 0.4 },
  botonTexto: { color: C.texto, fontSize: 15, fontWeight: '800' },
});
