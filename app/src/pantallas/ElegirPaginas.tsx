// Hoja «Dónde sale en Facebook» (lienzo AppElegirPaginas): la página principal (la elige el
// coordinador, sin casilla) y una casilla por página extra. Nueva: zonas de 44 px o más y ancho máximo.
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { C, F } from '../componentes/tema';
import type { TextosVivo } from '../facebook/textos';

interface Props {
  visible: boolean;
  principal: { id: string; nombre: string };
  extras: { id: string; nombre: string; porDefecto: boolean }[];
  /** Ids de las extras marcadas ahora. */
  elegidas: string[];
  onCambiar: (ids: string[]) => void;
  onListo: () => void;
  /** Título y descripción que van a salir en Facebook. */
  textos: TextosVivo;
  /** Los textos tal cual se escribieron (sin recortar). */
  onCambiarTextos: (t: TextosVivo) => void;
  /** Botón Atrás del celular. */
  onCerrar: () => void;
}

/** Marca la que no estaba y desmarca la que estaba. No modifica la lista de entrada. */
export function alternar(elegidas: readonly string[], id: string): string[] {
  return elegidas.includes(id) ? elegidas.filter((x) => x !== id) : [...elegidas, id];
}

export default function ElegirPaginas(p: Props) {
  const [editando, setEditando] = useState(false);
  const [titulo, setTitulo] = useState(p.textos.titulo);
  const [descripcion, setDescripcion] = useState(p.textos.descripcion);
  useEffect(() => {
    if (!p.visible) setEditando(false);
  }, [p.visible]);
  const abrir = () => {
    setTitulo(p.textos.titulo);
    setDescripcion(p.textos.descripcion);
    setEditando(true);
  };
  const terminar = () => {
    p.onCambiarTextos({ titulo, descripcion });
    setEditando(false);
  };
  return (
    <Modal
      visible={p.visible}
      transparent
      animationType="fade"
      supportedOrientations={['landscape']}
      onRequestClose={p.onCerrar}
      statusBarTranslucent
    >
      <View style={estilos.fondo}>
        <View style={estilos.hoja} accessibilityViewIsModal>
          <Text style={estilos.titulo} accessibilityRole="header">
            Dónde sale en Facebook
          </Text>
          <View style={estilos.principal}>
            <Text style={estilos.etiqueta}>PÁGINA PRINCIPAL</Text>
            <Text style={estilos.nombrePrincipal}>{p.principal.nombre}</Text>
            <Text style={estilos.nota}>La elige el coordinador de la parroquia en la plataforma.</Text>
          </View>
          <View style={estilos.principal}>
            {editando ? (
              <>
                <Text style={estilos.etiqueta}>TÍTULO EN FACEBOOK</Text>
                <TextInput
                  accessibilityLabel="Título"
                  value={titulo}
                  onChangeText={setTitulo}
                  maxLength={254}
                  style={estilos.campo}
                  placeholder="Título"
                  placeholderTextColor={C.suave}
                />
                <Text style={[estilos.etiqueta, estilos.etiquetaExtras]}>DESCRIPCIÓN</Text>
                <TextInput
                  accessibilityLabel="Descripción"
                  value={descripcion}
                  onChangeText={setDescripcion}
                  maxLength={1000}
                  multiline
                  numberOfLines={3}
                  style={[estilos.campo, estilos.campoLargo]}
                  placeholder="Descripción"
                  placeholderTextColor={C.suave}
                />
                <View style={estilos.fila}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Listo con el título y la descripción"
                    onPress={terminar}
                    style={estilos.cambiar}
                  >
                    <Text style={estilos.cambiarTexto}>Listo</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                <Text style={estilos.etiqueta}>TÍTULO EN FACEBOOK</Text>
                <Text style={estilos.nombrePrincipal}>{p.textos.titulo}</Text>
                <Text style={[estilos.etiqueta, estilos.etiquetaExtras]}>DESCRIPCIÓN</Text>
                <Text style={estilos.descripcion} numberOfLines={3}>
                  {p.textos.descripcion.trim() === '' ? 'Sin descripción' : p.textos.descripcion}
                </Text>
                <View style={estilos.fila}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Cambiar el título y la descripción"
                    onPress={abrir}
                    style={estilos.cambiar}
                  >
                    <Text style={estilos.cambiarTexto}>Cambiar</Text>
                  </Pressable>
                </View>
              </>
            )}
            <Text style={estilos.nota}>Lo que cambies aquí vale solo para esta transmisión.</Text>
          </View>
          {p.extras.length > 0 ? (
            <>
              <Text style={[estilos.etiqueta, estilos.etiquetaExtras]}>TAMBIÉN MOSTRAR EN</Text>
              <ScrollView style={estilos.lista} contentContainerStyle={estilos.listaContenido}>
                {p.extras.map((e) => {
                  const marcada = p.elegidas.includes(e.id);
                  return (
                    <Pressable
                      key={e.id}
                      accessibilityRole="checkbox"
                      accessibilityLabel={e.nombre}
                      accessibilityState={{ checked: marcada }}
                      onPress={() => p.onCambiar(alternar(p.elegidas, e.id))}
                      style={[estilos.casilla, marcada && estilos.casillaMarcada]}
                    >
                      <View style={[estilos.cuadro, marcada && estilos.cuadroMarcado]}>
                        {marcada ? <Text style={estilos.tilde}>✓</Text> : null}
                      </View>
                      <Text style={estilos.nombre}>{e.nombre}</Text>
                      {e.porDefecto ? <Text style={estilos.defecto}>Marcada por defecto</Text> : null}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </>
          ) : null}
          <View style={estilos.fila}>
            <Pressable accessibilityRole="button" accessibilityLabel="Listo" onPress={p.onListo} style={estilos.listo}>
              <Text style={estilos.listoTexto}>Listo</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: 'rgba(6, 18, 36, 0.65)', alignItems: 'center', justifyContent: 'center', padding: 8 },
  // Ancho máximo, no fijo: en una ventana más angosta se encoge.
  hoja: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '100%',
    backgroundColor: C.caja,
    borderWidth: 1,
    borderColor: C.borde,
    borderRadius: 18,
    padding: 20,
    gap: 10,
  },
  titulo: { fontFamily: F.extra, fontSize: 22, lineHeight: 26, color: C.texto },
  principal: { padding: 10, borderRadius: 10, backgroundColor: C.fondo, borderWidth: 1, borderColor: C.borde },
  etiqueta: { fontFamily: F.extra, fontSize: 11, letterSpacing: 1.5, color: C.suave },
  etiquetaExtras: { marginTop: 2 },
  nombrePrincipal: { fontFamily: F.negrita, fontSize: 15, color: C.texto, marginTop: 2 },
  nota: { fontFamily: F.semi, fontSize: 12, color: C.suave, marginTop: 2 },
  lista: { flexGrow: 0 },
  listaContenido: { gap: 6 },
  casilla: {
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: C.boton,
    borderWidth: 2,
    borderColor: C.borde,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  casillaMarcada: { backgroundColor: C.seleccionFondo, borderColor: C.seleccion },
  cuadro: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: C.suave,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cuadroMarcado: { backgroundColor: C.seleccion, borderColor: C.seleccion },
  tilde: { fontFamily: F.extra, fontSize: 14, lineHeight: 16, color: C.fondo },
  nombre: { flex: 1, fontFamily: F.negrita, fontSize: 15, color: C.texto },
  defecto: { fontFamily: F.semi, fontSize: 12, color: C.suave },
  fila: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4 },
  listo: {
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: 10,
    backgroundColor: C.primario,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listoTexto: { fontFamily: F.extra, fontSize: 15, color: '#ffffff' },
  descripcion: { fontFamily: F.semi, fontSize: 13, color: C.texto, marginTop: 2 },
  campo: {
    minHeight: 44,
    marginTop: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.borde,
    backgroundColor: C.caja,
    color: C.texto,
    fontFamily: F.semi,
    fontSize: 14,
  },
  campoLargo: { minHeight: 66, textAlignVertical: 'top', paddingVertical: 8 },
  cambiar: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: C.boton,
    borderWidth: 2,
    borderColor: C.borde,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cambiarTexto: { fontFamily: F.extra, fontSize: 14, color: C.texto },
});
