// Pantalla 4 del diseño: Ajustes de transmisión (celular acostado, ~844x390 dp).
// Cambio respecto del lienzo (decisión 3): «Probar conexión» muestra el tipo de red,
// no Mbps, y no se mide el nivel del micrófono (no se halló cómo leerlo).
// La clave nunca se registra en consola ni se muestra en claro.
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Network from 'expo-network';
import * as Sharing from 'expo-sharing';

import { ultimoRegistro } from '../../modules/transmisor';
import {
  AJUSTES_INICIALES,
  Ajustes as TipoAjustes,
  Calidad,
  Microfono,
  guardarAjustes,
  EstadoCarga,
  leerAjustes,
  puedeGuardar,
  limpiarClave,
  validar,
} from '../ajustes/ajustes';

const C = {
  fondo: '#061224',
  caja: '#10284a',
  borde: '#24497a',
  boton: '#163560',
  primario: '#1155a4',
  seleccion: '#3d9be0',
  seleccionFondo: '#1a3f75',
  texto: '#eef5fc',
  suave: '#b4cbe8',
  verde: '#2fbf7a',
  ambar: '#f0b429',
  rojo: '#c8281e',
};

interface Props {
  onVolver: () => void;
}

function textoRed(estado: Network.NetworkState): { texto: string; color: string } {
  if (estado.isConnected === false || estado.type === Network.NetworkStateType.NONE) {
    return { texto: 'Sin internet', color: C.rojo };
  }
  if (estado.isInternetReachable === false) {
    return { texto: 'Conectado, pero sin salida a internet', color: C.ambar };
  }
  if (estado.type === Network.NetworkStateType.WIFI) return { texto: 'Wi-Fi', color: C.verde };
  if (estado.type === Network.NetworkStateType.CELLULAR) return { texto: 'Datos móviles', color: C.verde };
  return { texto: 'Conectado a internet', color: C.verde };
}

function Opcion(props: { etiqueta: string; activa: boolean; alPulsar: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: props.activa }}
      onPress={props.alPulsar}
      style={[estilos.opcion, props.activa && estilos.opcionActiva]}
    >
      <Text style={estilos.opcionTexto}>{props.etiqueta}</Text>
    </Pressable>
  );
}

const CALIDADES: [Calidad, string][] = [
  ['720p', '720p · recomendado'],
  ['1080p', '1080p'],
];
const MICROFONOS: [Microfono, string][] = [
  ['celular', 'Del celular'],
  ['externo', 'Externo (USB-C)'],
];

export default function Ajustes({ onVolver }: Props) {
  const [a, setA] = useState<TipoAjustes>(AJUSTES_INICIALES);
  const [error, setError] = useState<{ campo: 'servidor' | 'clave'; mensaje: string } | null>(null);
  const [red, setRed] = useState<{ texto: string; color: string } | null>(null);
  const [probando, setProbando] = useState(false);
  const [carga, setCarga] = useState<EstadoCarga>('cargando');
  const [fallaGuardar, setFallaGuardar] = useState(false);
  const [intento, setIntento] = useState(0);
  const [compartiendo, setCompartiendo] = useState(false);
  const [avisoRegistro, setAvisoRegistro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    setCarga('cargando');
    leerAjustes().then(
      (x) => {
        if (!vivo) return;
        setA(x);
        setCarga('listo');
      },
      () => {
        if (vivo) setCarga('error');
      },
    );
    return () => {
      vivo = false;
    };
  }, [intento]);

  const editable = puedeGuardar(carga);

  // Nunca se guarda antes de que la lectura inicial termine bien; el error no incluye datos.
  function persistir(nuevo: TipoAjustes) {
    if (!puedeGuardar(carga)) return;
    guardarAjustes(nuevo).then(
      () => setFallaGuardar(false),
      () => setFallaGuardar(true),
    );
  }

  // Cada cambio se guarda tal cual; la validación solo avisa debajo del campo.
  function cambiar(parcial: Partial<TipoAjustes>) {
    const nuevo = { ...a, ...parcial };
    setA(nuevo);
    setError(null);
    persistir(nuevo);
  }

  function revisar(actual: TipoAjustes) {
    const r = validar(actual);
    setError(r.ok ? null : { campo: r.campo, mensaje: r.mensaje });
  }

  async function pegar() {
    if (!editable) return;
    const texto = limpiarClave(await Clipboard.getStringAsync());
    const nuevo = { ...a, clave: texto };
    setA(nuevo);
    persistir(nuevo);
    revisar(nuevo);
  }

  // Registro de rendimiento (Tarea 9): abre la hoja de compartir de Android con el más nuevo.
  // El archivo solo tiene números, la conexión y la escena: nunca la clave ni el servidor.
  async function compartirRegistro() {
    setCompartiendo(true);
    setAvisoRegistro(null);
    try {
      const ruta = await ultimoRegistro();
      if (!ruta) {
        setAvisoRegistro('Todavía no hay registros. Se crea uno en cada transmisión.');
        return;
      }
      if (!(await Sharing.isAvailableAsync())) {
        setAvisoRegistro('Este celular no permite compartir archivos.');
        return;
      }
      await Sharing.shareAsync(`file://${ruta}`, { mimeType: 'text/csv', dialogTitle: 'Compartir registro' });
    } catch {
      setAvisoRegistro('No se pudo compartir el registro.');
    } finally {
      setCompartiendo(false);
    }
  }

  async function probar() {
    setProbando(true);
    try {
      setRed(textoRed(await Network.getNetworkStateAsync()));
    } catch {
      setRed({ texto: 'No se pudo revisar la red', color: C.ambar });
    } finally {
      setProbando(false);
    }
  }

  return (
    <View style={estilos.raiz}>
      <View style={estilos.cabecera}>
        <Pressable accessibilityRole="button" accessibilityLabel="Volver" onPress={onVolver} style={estilos.volver}>
          <Text style={estilos.volverTexto}>‹</Text>
        </Pressable>
        <Text accessibilityRole="header" style={estilos.titulo}>
          Ajustes de transmisión
        </Text>
        <Text style={estilos.nota}>Se guardan solo en este celular</Text>
      </View>

      {carga === 'cargando' && <Text style={estilos.aviso}>Cargando…</Text>}
      {carga === 'error' && (
        <View style={estilos.fila}>
          <Text style={estilos.error}>No se pudieron leer los ajustes guardados.</Text>
          <Pressable accessibilityRole="button" onPress={() => setIntento(intento + 1)} style={estilos.boton}>
            <Text style={estilos.botonTexto}>Reintentar</Text>
          </Pressable>
        </View>
      )}
      {fallaGuardar && <Text style={estilos.error}>No se pudo guardar. Intente de nuevo.</Text>}
      <ScrollView contentContainerStyle={estilos.cuerpo}>
        <View style={estilos.columna}>
          <Text style={estilos.seccion}>DESTINO</Text>
          <View style={estilos.caja}>
            <Text style={estilos.cajaTitulo}>Facebook Live</Text>
            <Text style={estilos.etiqueta}>Clave de transmisión de la página</Text>
            <View style={estilos.fila}>
              <TextInput
                accessibilityLabel="Clave de transmisión de la página"
                secureTextEntry
                editable={editable}
                autoCapitalize="none"
                autoCorrect={false}
                value={a.clave}
                onChangeText={(t) => cambiar({ clave: t })}
                onBlur={() => revisar({ ...a, clave: limpiarClave(a.clave) })}
                style={[estilos.campo, { flexGrow: 1 }]}
              />
              <Pressable accessibilityRole="button" disabled={!editable} onPress={pegar} style={estilos.boton}>
                <Text style={estilos.botonTexto}>Pegar</Text>
              </Pressable>
            </View>
            {error?.campo === 'clave' && <Text style={estilos.error}>{error.mensaje}</Text>}
            <Text style={estilos.etiqueta}>Servidor (lo muestra Facebook)</Text>
            <TextInput
              accessibilityLabel="Servidor"
              editable={editable}
              placeholder="rtmps://…"
              placeholderTextColor={C.suave}
              autoCapitalize="none"
              autoCorrect={false}
              value={a.servidor}
              onChangeText={(t) => cambiar({ servidor: t })}
              onBlur={() => revisar(a)}
              style={estilos.campo}
            />
            {error?.campo === 'servidor' && <Text style={estilos.error}>{error.mensaje}</Text>}
          </View>
          <View style={estilos.youtube}>
            <Text style={estilos.youtubeTitulo}>YouTube Live</Text>
            <Text style={estilos.etiqueta}>En una etapa siguiente</Text>
          </View>
        </View>

        <View style={estilos.columna}>
          <Text style={estilos.seccion}>VIDEO Y AUDIO</Text>
          <View style={estilos.caja}>
            <Text style={estilos.etiqueta}>Calidad</Text>
            <View accessibilityRole="radiogroup" accessibilityLabel="Calidad" style={estilos.fila}>
              {CALIDADES.map(([v, t]) => (
                <Opcion key={v} etiqueta={t} activa={a.calidad === v} alPulsar={() => editable && cambiar({ calidad: v })} />
              ))}
            </View>
            <Text style={estilos.etiqueta}>Micrófono</Text>
            <View accessibilityRole="radiogroup" accessibilityLabel="Micrófono" style={estilos.fila}>
              {MICROFONOS.map(([v, t]) => (
                <Opcion key={v} etiqueta={t} activa={a.microfono === v} alPulsar={() => editable && cambiar({ microfono: v })} />
              ))}
            </View>
          </View>
          <View style={[estilos.caja, estilos.fila, { alignItems: 'center' }]}>
            <Pressable
              accessibilityRole="button"
              disabled={probando}
              onPress={probar}
              style={[estilos.boton, estilos.primario]}
            >
              <Text style={estilos.botonTexto}>Probar conexión</Text>
            </Pressable>
            <View style={{ flex: 1 }} accessibilityLiveRegion="polite">
              {red && <Text style={[estilos.cajaTitulo, { fontSize: 14, color: red.color }]}>{red.texto}</Text>}
              <Text style={estilos.nota}>Solo revisa la red; no sale al aire.</Text>
            </View>
          </View>
          <View style={[estilos.caja, estilos.fila, { alignItems: 'center' }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Compartir registro"
              accessibilityHint="Abre la hoja de compartir con el registro de la última transmisión"
              disabled={compartiendo}
              onPress={compartirRegistro}
              style={estilos.boton}
            >
              <Text style={estilos.botonTexto}>Compartir registro</Text>
            </Pressable>
            <View style={{ flex: 1 }} accessibilityLiveRegion="polite">
              {avisoRegistro && <Text style={estilos.error}>{avisoRegistro}</Text>}
              <Text style={estilos.nota}>Temperatura, batería y señal de la última transmisión.</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: C.fondo },
  cabecera: {
    height: 60,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.borde,
  },
  volver: { width: 44, height: 44, borderRadius: 10, backgroundColor: C.boton, alignItems: 'center', justifyContent: 'center' },
  volverTexto: { color: C.texto, fontSize: 28, fontWeight: '700', lineHeight: 32 },
  titulo: { color: C.texto, fontSize: 20, fontWeight: '800', flex: 1 },
  nota: { color: C.suave, fontSize: 12, fontWeight: '600' },
  cuerpo: { flexDirection: 'row', gap: 12, padding: 12, alignItems: 'flex-start' },
  columna: { flex: 1, gap: 10 },
  seccion: { color: C.suave, fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  caja: { backgroundColor: C.caja, borderWidth: 1, borderColor: C.borde, borderRadius: 12, padding: 12, gap: 8 },
  cajaTitulo: { color: C.texto, fontSize: 16, fontWeight: '800' },
  etiqueta: { color: C.suave, fontSize: 12, fontWeight: '700' },
  fila: { flexDirection: 'row', gap: 8 },
  campo: {
    color: C.texto,
    backgroundColor: C.fondo,
    borderWidth: 1,
    borderColor: C.borde,
    borderRadius: 10,
    minHeight: 44,
    paddingHorizontal: 10,
    fontSize: 14,
    fontWeight: '600',
  },
  boton: { backgroundColor: C.boton, borderRadius: 10, minHeight: 44, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  primario: { backgroundColor: C.primario, minHeight: 48, paddingHorizontal: 16 },
  botonTexto: { color: C.texto, fontSize: 13, fontWeight: '800' },
  opcion: { flex: 1, minHeight: 44, borderRadius: 10, borderWidth: 2, borderColor: 'transparent', backgroundColor: C.boton, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  opcionActiva: { borderColor: C.seleccion, backgroundColor: C.seleccionFondo },
  opcionTexto: { color: C.texto, fontSize: 13, fontWeight: '800', textAlign: 'center' },
  aviso: { color: C.suave, fontSize: 12, fontWeight: '700', paddingHorizontal: 12, paddingTop: 6 },
  error: { color: C.ambar, fontSize: 12, fontWeight: '700' },
  youtube: {
    backgroundColor: '#0a1a30',
    borderWidth: 1,
    borderColor: C.borde,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  youtubeTitulo: { color: C.suave, fontSize: 14, fontWeight: '800' },
});
