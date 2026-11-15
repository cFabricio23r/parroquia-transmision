// Pantalla 4 del diseño: Ajustes de transmisión (celular acostado, ~844x390 dp).
// Cambio respecto del lienzo (decisión 3): «Probar conexión» muestra el tipo de red,
// no Mbps, y no se mide el nivel del micrófono (no se halló cómo leerlo).
// La clave nunca se registra en consola ni se muestra en claro.
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Network from 'expo-network';
import * as Sharing from 'expo-sharing';

import { ultimoRegistro } from '../../modules/transmisor';
import { Calidad, Microfono, EstadoCarga, puedeGuardar, limpiarClave, validar } from '../ajustes/ajustes';
import { ajustesParroquia } from '../ajustes/ajustesParroquia';
import { AjustesEfectivos, CampoAjuste, CampoCelular, TEXTOS_AJUSTES, textoOrigen } from '../ajustes/origen';
import type { Cuenta, ParroquiaApp } from '../sesion/tipos';
import { confirmarCerrarSesion } from './acceso/Aviso';

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

/** La sección Cuenta (plan 3a, Tarea 16; lienzo VicAppCuenta y VicAppCuentaVertical). */
export interface DatosCuenta {
  cuenta: Cuenta | null;
  parroquia: ParroquiaApp;
  /** Hay más de una parroquia asignada. */
  puedeCambiar: boolean;
  /** «Pantallas guardadas hoy, 18:42» o «Sin pantallas guardadas: se usan las de la app.». */
  textoCopia: string;
  enVivo: boolean;
  onCambiarParroquia(): void;
  onCerrarSesion(): void;
}

interface Props {
  /** La parroquia elegida: sus ajustes bajados y los cambiados en este celular (plan 3c). */
  slug: string;
  onVolver: () => void;
  cuenta?: DatosCuenta;
}

const ROJO_BORDE = '#8f3b33';
const ROJO_TEXTO = '#ffb3aa';

function SeccionCuenta({ d }: { d: DatosCuenta }) {
  const nombre = d.cuenta?.nombre?.trim() || d.cuenta?.correo || '';
  const rol = d.cuenta?.esAdmin ? 'Admin de vicaría' : 'Coordinador';
  const linea = d.cuenta ? `${d.cuenta.correo} · ${rol}` : rol;
  return (
    <>
      <Text style={estilos.seccion}>CUENTA</Text>
      <View style={estilos.caja}>
        {nombre ? (
          <View style={{ gap: 2 }}>
            <Text style={[estilos.cajaTitulo, { fontSize: 15 }]}>{nombre}</Text>
            <Text style={estilos.etiqueta}>{linea}</Text>
          </View>
        ) : null}
        <View style={estilos.desde}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={estilos.etiqueta}>Transmites desde</Text>
            <Text style={[estilos.cajaTitulo, { fontSize: 14 }]}>{d.parroquia.nombre}</Text>
          </View>
          {d.puedeCambiar && !d.enVivo ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cambiar la parroquia"
              onPress={d.onCambiarParroquia}
              style={[estilos.boton, estilos.botonFijo]}
            >
              <Text style={estilos.botonTexto}>Cambiar</Text>
            </Pressable>
          ) : null}
        </View>
        <Text style={estilos.nota}>{d.textoCopia}</Text>
        <View style={[estilos.fila, { alignItems: 'center' }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cerrar sesión"
            accessibilityState={{ disabled: d.enVivo }}
            disabled={d.enVivo}
            onPress={() => confirmarCerrarSesion(d.onCerrarSesion)}
            style={[estilos.boton, estilos.botonFijo, estilos.cerrarSesion, d.enVivo && { opacity: 0.5 }]}
          >
            <Text style={[estilos.botonTexto, { color: ROJO_TEXTO }]}>Cerrar sesión</Text>
          </Pressable>
          <Text style={[estilos.nota, { flex: 1, fontSize: 11, lineHeight: 16 }]}>
            No se puede durante una transmisión. La clave de Facebook se queda en el celular.
          </Text>
        </View>
      </View>
    </>
  );
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
const NOMBRE_CAMPO: Record<CampoCelular, string> = { servidor: 'Servidor', clave: 'Clave', calidad: 'Calidad' };

/** La línea del origen de un ajuste y, si corresponde, «Volver a la de la parroquia». */
function LineaOrigen(props: { e: AjustesEfectivos; campo: CampoAjuste; onVolver?: () => void }) {
  const deParroquia = props.campo === 'estiloFinal' || props.campo === 'microfono' ? false : props.e.deParroquia[props.campo];
  const o = textoOrigen(props.campo, props.e.origen[props.campo], deParroquia);
  const campo = props.campo as CampoCelular;
  return (
    <View style={[estilos.fila, { alignItems: 'center', flexWrap: 'wrap' }]}>
      <Text style={[estilos.nota, { flex: 1 }]}>{o.texto}</Text>
      {o.volver && props.onVolver ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={TEXTOS_AJUSTES.volver + ': ' + NOMBRE_CAMPO[campo]}
          onPress={props.onVolver}
          style={[estilos.boton, estilos.botonFijo]}
        >
          <Text style={estilos.botonTexto}>{TEXTOS_AJUSTES.volver}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export default function Ajustes({ slug, onVolver, cuenta }: Props) {
  // En vertical (Preparar, Tarea 9c) las dos columnas van una debajo de la otra.
  const { width, height } = useWindowDimensions();
  const vertical = height > width;
  const [e, setE] = useState<AjustesEfectivos | null>(null);
  // Lo que se ve en los campos mientras se escribe. La clave de la parroquia nunca entra acá.
  const [textoServidor, setTextoServidor] = useState('');
  const [textoClave, setTextoClave] = useState('');
  const [error, setError] = useState<{ campo: 'servidor' | 'clave'; mensaje: string } | null>(null);
  const [red, setRed] = useState<{ texto: string; color: string } | null>(null);
  const [probando, setProbando] = useState(false);
  const [carga, setCarga] = useState<EstadoCarga>('cargando');
  const [fallaGuardar, setFallaGuardar] = useState(false);
  const [intento, setIntento] = useState(0);
  const [compartiendo, setCompartiendo] = useState(false);
  const [avisoRegistro, setAvisoRegistro] = useState<string | null>(null);
  // Los cambios van en fila, así uno viejo nunca pisa a uno nuevo.
  const cola = useRef<Promise<unknown>>(Promise.resolve());
  const vivo = useRef(true);
  useEffect(
    () => () => {
      vivo.current = false;
    },
    [],
  );

  function mostrar(x: AjustesEfectivos) {
    setE(x);
    setTextoServidor(x.ajustes.servidor);
    setTextoClave(x.origen.clave === 'celular' ? x.ajustes.clave : '');
  }

  useEffect(() => {
    let vigente = true;
    setCarga('cargando');
    ajustesParroquia.leerEfectivos(slug).then(
      (x) => {
        if (!vigente) return;
        mostrar(x);
        setCarga('listo');
      },
      () => {
        if (vigente) setCarga('error');
      },
    );
    return () => {
      vigente = false;
    };
  }, [intento, slug]);

  const editable = puedeGuardar(carga);

  // Nunca se guarda antes de que la lectura inicial termine bien; el error no incluye datos.
  function aplicar(op: () => Promise<AjustesEfectivos>, alTerminar?: (x: AjustesEfectivos) => void) {
    if (!puedeGuardar(carga)) return;
    const p = cola.current.then(op).then(
      (x) => {
        if (!vivo.current) return;
        setFallaGuardar(false);
        setE(x);
        alTerminar?.(x);
      },
      () => {
        if (vivo.current) setFallaGuardar(true);
      },
    );
    cola.current = p;
  }

  function revisar(x: AjustesEfectivos) {
    const r = validar(x.ajustes);
    if (r.ok || (r.campo === 'clave' && x.origen.clave === 'parroquia')) setError(null);
    else setError({ campo: r.campo, mensaje: r.mensaje });
  }

  function cambiarTexto(campo: 'servidor' | 'clave', t: string) {
    if (campo === 'servidor') setTextoServidor(t);
    else setTextoClave(t);
    setError(null);
    aplicar(() => ajustesParroquia.cambiarEnCelular(slug, campo, t));
  }

  function volver(campo: CampoCelular) {
    setError(null);
    aplicar(() => ajustesParroquia.volver(slug, campo), mostrar);
  }

  async function pegar() {
    if (!editable) return;
    const texto = limpiarClave(await Clipboard.getStringAsync());
    setTextoClave(texto);
    aplicar(() => ajustesParroquia.cambiarEnCelular(slug, 'clave', texto), revisar);
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
        <Text style={estilos.nota}>{TEXTOS_AJUSTES.cabecera}</Text>
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
      <ScrollView contentContainerStyle={[estilos.cuerpo, vertical && estilos.cuerpoVertical]}>
        <View style={[estilos.columna, vertical && estilos.columnaVertical]}>
          {cuenta ? <SeccionCuenta d={cuenta} /> : null}
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
                placeholder={e?.origen.clave === 'parroquia' ? TEXTOS_AJUSTES.placeholderClave : undefined}
                placeholderTextColor={C.suave}
                value={textoClave}
                onChangeText={(t) => cambiarTexto('clave', t)}
                onBlur={() =>
                  aplicar(
                    () => ajustesParroquia.leerEfectivos(slug),
                    (x) => {
                      if (x.origen.clave !== 'celular') setTextoClave('');
                      revisar(x);
                    },
                  )
                }
                style={[estilos.campo, estilos.campoAchicable]}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Pegar la clave"
                disabled={!editable}
                onPress={pegar}
                style={[estilos.boton, estilos.botonFijo]}
              >
                <Text style={estilos.botonTexto}>Pegar</Text>
              </Pressable>
            </View>
            {error?.campo === 'clave' && <Text style={estilos.error}>{error.mensaje}</Text>}
            {e ? <LineaOrigen e={e} campo="clave" onVolver={() => volver('clave')} /> : null}
            {e?.claveNueva ? (
              <View style={estilos.claveNueva} accessibilityLiveRegion="polite">
                <Text style={[estilos.cajaTitulo, { fontSize: 14, color: C.ambar }]}>{TEXTOS_AJUSTES.claveNueva}</Text>
                <View style={[estilos.fila, { flexWrap: 'wrap' }]}>
                  <Pressable accessibilityRole="button" onPress={() => volver('clave')} style={[estilos.boton, estilos.primario]}>
                    <Text style={estilos.botonTexto}>{TEXTOS_AJUSTES.usarParroquia}</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => aplicar(() => ajustesParroquia.seguirConLaDelCelular(slug))}
                    style={estilos.boton}
                  >
                    <Text style={estilos.botonTexto}>{TEXTOS_AJUSTES.seguirCelular}</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
            <Text style={estilos.etiqueta}>Servidor (lo muestra Facebook)</Text>
            <TextInput
              accessibilityLabel="Servidor"
              editable={editable}
              placeholder="rtmps://…"
              placeholderTextColor={C.suave}
              autoCapitalize="none"
              autoCorrect={false}
              value={textoServidor}
              onChangeText={(t) => cambiarTexto('servidor', t)}
              onBlur={() =>
                aplicar(
                  () => ajustesParroquia.leerEfectivos(slug),
                  (x) => {
                    setTextoServidor(x.ajustes.servidor);
                    revisar(x);
                  },
                )
              }
              style={estilos.campo}
            />
            {error?.campo === 'servidor' && <Text style={estilos.error}>{error.mensaje}</Text>}
            {e ? <LineaOrigen e={e} campo="servidor" onVolver={() => volver('servidor')} /> : null}
          </View>
          <View style={estilos.youtube}>
            <Text style={estilos.youtubeTitulo}>YouTube Live</Text>
            <Text style={estilos.etiqueta}>En una etapa siguiente</Text>
          </View>
        </View>

        <View style={[estilos.columna, vertical && estilos.columnaVertical]}>
          <Text style={estilos.seccion}>VIDEO Y AUDIO</Text>
          <View style={estilos.caja}>
            <Text style={estilos.etiqueta}>Calidad</Text>
            <View accessibilityRole="radiogroup" accessibilityLabel="Calidad" style={estilos.fila}>
              {CALIDADES.map(([v, t]) => (
                <Opcion
                  key={v}
                  etiqueta={t}
                  activa={e?.ajustes.calidad === v}
                  alPulsar={() => aplicar(() => ajustesParroquia.cambiarEnCelular(slug, 'calidad', v))}
                />
              ))}
            </View>
            {e ? <LineaOrigen e={e} campo="calidad" onVolver={() => volver('calidad')} /> : null}
            <Text style={estilos.etiqueta}>Micrófono</Text>
            <View accessibilityRole="radiogroup" accessibilityLabel="Micrófono" style={estilos.fila}>
              {MICROFONOS.map(([v, t]) => (
                <Opcion
                  key={v}
                  etiqueta={t}
                  activa={e?.ajustes.microfono === v}
                  alPulsar={() => aplicar(() => ajustesParroquia.cambiarMicrofono(slug, v))}
                />
              ))}
            </View>
            {e ? <LineaOrigen e={e} campo="microfono" /> : null}
            {/* La pantalla final la elige la parroquia: acá se muestra, no se elige (plan 3c, Decisión 12). */}
            <Text style={[estilos.cajaTitulo, { fontSize: 14 }]}>
              Pantalla final: {e?.ajustes.estiloFinal === 'claro' ? 'Claro' : 'Azul'}
            </Text>
            {e ? <LineaOrigen e={e} campo="estiloFinal" /> : null}
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
  cuerpoVertical: { flexDirection: 'column', alignItems: 'stretch' },
  columna: { flex: 1, gap: 10 },
  // Dentro del ScrollView, en columna, flex: 1 no tiene alto del que crecer: tamaño propio.
  columnaVertical: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto' },
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
  // Campo + botón en una fila: el campo se achica y el botón «Pegar» queda entero, sin salirse
  // del recuadro, en vertical y en horizontal (Tarea 9c).
  campoAchicable: { flex: 1, minWidth: 0 },
  botonFijo: { flexShrink: 0, minWidth: 44 },
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
  desde: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.fondo, borderRadius: 10, paddingVertical: 8, paddingLeft: 12, paddingRight: 8 },
  claveNueva: { borderWidth: 1, borderColor: C.ambar, borderRadius: 10, padding: 10, gap: 8 },
  cerrarSesion: { backgroundColor: 'transparent', borderWidth: 1, borderColor: ROJO_BORDE },
});
