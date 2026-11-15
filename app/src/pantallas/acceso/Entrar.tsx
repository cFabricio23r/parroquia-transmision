// Fila E del lienzo: «Inicia sesión» (VicAppEntrar) y «Revisa tu correo» (VicAppOlvide), celular parado.
// Diferencia con el artboard: el degradado azul de arriba va en un color liso (#1155a4), porque la app
// no tiene una dependencia de degradados y no se agregan dependencias en 3a.
// La contraseña vive en un ref, nunca en un estado que se muestre o se registre; nada va a console.*.
import { useRef, useState, type ReactNode } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { C, F } from '../../componentes/tema';
import type { ClientePlataforma } from '../../plataforma/cliente';
import type { ControlSesion } from '../../sesion/control';
import { TEXTOS, mensajeEntrar, textoOlvide } from './textos';

const LOGO = require('../../../assets/portada/logo-blanco.png');
// Proporción del logo (obs/img/logo-blanco.png, 225×141).
const LOGO_PROPORCION = 141 / 225;

export const A = {
  enlace: '#7fc0f5',
  pie: '#6f8bb0',
  nota: '#0b1d36',
  rojoMarca: '#dd0300',
} as const;

/** La cabecera azul con el logo, el nombre y la etiqueta «TRANSMISIÓN EN VIVO». */
export function Cabecera(p: { alto: number; logo: number; children: ReactNode }) {
  return (
    <View style={estilos.raiz}>
      <View style={[estilos.cabecera, { height: p.alto }]}>
        <Image
          source={LOGO}
          accessibilityLabel={TEXTOS.marca.logo}
          accessibilityRole="image"
          style={{ width: p.logo, height: p.logo * LOGO_PROPORCION }}
          resizeMode="contain"
        />
        <Text style={estilos.marca}>{TEXTOS.marca.nombre}</Text>
        <View style={estilos.enVivo}>
          <View style={estilos.punto} />
          <Text style={estilos.enVivoTexto}>{TEXTOS.marca.enVivo}</Text>
        </View>
      </View>
      <ScrollView
        style={[estilos.hoja, { marginTop: -18 }]}
        contentContainerStyle={estilos.hojaContenido}
        keyboardShouldPersistTaps="handled"
      >
        {p.children}
      </ScrollView>
    </View>
  );
}

export function BotonPrimario(p: { texto: string; etiqueta?: string; ocupado?: boolean; deshabilitado?: boolean; onPress: () => void }) {
  const apagado = !!p.ocupado || !!p.deshabilitado;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={p.etiqueta ?? p.texto}
      accessibilityState={{ disabled: apagado, busy: !!p.ocupado }}
      disabled={apagado}
      onPress={p.onPress}
      style={({ pressed }) => [estilos.primario, apagado && estilos.apagado, pressed && estilos.presionado]}
    >
      <Text style={estilos.primarioTexto}>{p.texto}</Text>
    </Pressable>
  );
}

export function Enlace(p: { texto: string; onPress: () => void; deshabilitado?: boolean; alinear?: 'flex-end' | 'center' }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={p.texto}
      accessibilityState={{ disabled: !!p.deshabilitado }}
      disabled={p.deshabilitado}
      onPress={p.onPress}
      hitSlop={4}
      style={[estilos.enlace, { alignSelf: p.alinear ?? 'center' }]}
    >
      <Text style={estilos.enlaceTexto}>{p.texto}</Text>
    </Pressable>
  );
}

export function MensajeError(p: { texto: string | null }) {
  return (
    <Text accessibilityLiveRegion="polite" style={[estilos.error, !p.texto && estilos.oculto]}>
      {p.texto ?? ''}
    </Text>
  );
}

function Campo(p: {
  etiqueta: string;
  valorInicial?: string;
  tipo: 'email' | 'password';
  alCambiar: (t: string) => void;
  editable: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const esClave = p.tipo === 'password';
  return (
    <View style={estilos.campo}>
      <Text style={estilos.campoEtiqueta} nativeID={`etiqueta-${p.tipo}`}>
        {p.etiqueta}
      </Text>
      <View style={estilos.campoCaja}>
        <TextInput
          accessibilityLabel={p.etiqueta}
          accessibilityLabelledBy={`etiqueta-${p.tipo}`}
          defaultValue={p.valorInicial}
          onChangeText={p.alCambiar}
          editable={p.editable}
          autoComplete={p.tipo}
          textContentType={esClave ? 'password' : 'emailAddress'}
          keyboardType={esClave ? 'default' : 'email-address'}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry={esClave && !visible}
          style={estilos.campoTexto}
          placeholderTextColor={C.suave}
        />
        {esClave ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={visible ? TEXTOS.entrar.ocultar : TEXTOS.entrar.mostrar}
            onPress={() => setVisible((v) => !v)}
            style={estilos.ojo}
          >
            <Text style={estilos.ojoTexto}>{visible ? 'Ocultar' : 'Ver'}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export default function Entrar({
  control,
  plataforma,
  aviso,
}: {
  control: ControlSesion;
  plataforma: ClientePlataforma;
  aviso: string | null;
}) {
  const [vista, setVista] = useState<'entrar' | 'olvide'>('entrar');
  const [correo, setCorreo] = useState('');
  const clave = useRef('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [anuncio, setAnuncio] = useState<string | null>(null);

  const correoLimpio = correo.trim();

  async function entrar() {
    if (ocupado) return;
    setOcupado(true);
    setError(null);
    try {
      const r = await control.entrar(correoLimpio, clave.current);
      if (r.error) setError(mensajeEntrar(r.error));
      else clave.current = '';
    } catch {
      setError(mensajeEntrar({ tipo: 'servidor', estado: 0 }));
    } finally {
      setOcupado(false);
    }
  }

  async function pedirEnlace(reenviar: boolean) {
    if (ocupado) return;
    if (!correoLimpio) {
      setError(TEXTOS.entrar.correoVacio);
      return;
    }
    setOcupado(true);
    setError(null);
    setAnuncio(null);
    try {
      const r = await plataforma.pedirEnlaceContrasena(correoLimpio);
      if (!r.ok) {
        setError(mensajeEntrar(r.error));
        return;
      }
      if (reenviar) setAnuncio(TEXTOS.olvide.reenviado);
      else setVista('olvide');
    } catch {
      setError(mensajeEntrar({ tipo: 'servidor', estado: 0 }));
    } finally {
      setOcupado(false);
    }
  }

  if (vista === 'olvide') {
    return (
      <Cabecera alto={250} logo={72}>
        <View style={estilos.sobre} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden />
        <View style={estilos.centrado}>
          <Text accessibilityRole="header" style={[estilos.titulo, estilos.textoCentro]}>
            {TEXTOS.olvide.titulo}
          </Text>
          <Text style={[estilos.subtitulo, estilos.textoCentro]}>{textoOlvide(correoLimpio)}</Text>
        </View>
        <View style={estilos.cajaNota}>
          <Text style={estilos.cajaNotaTexto}>{TEXTOS.olvide.nota}</Text>
        </View>
        <MensajeError texto={error} />
        <Text accessibilityLiveRegion="polite" style={[estilos.anuncio, !anuncio && estilos.oculto]}>
          {anuncio ?? ''}
        </Text>
        <View style={estilos.abajo}>
          <BotonPrimario
            texto={TEXTOS.olvide.volver}
            onPress={() => {
              setError(null);
              setAnuncio(null);
              setVista('entrar');
            }}
          />
          <Enlace texto={TEXTOS.olvide.reenviar} deshabilitado={ocupado} onPress={() => void pedirEnlace(true)} />
        </View>
      </Cabecera>
    );
  }

  return (
    <Cabecera alto={318} logo={92}>
      <View style={estilos.grupoTitulo}>
        <Text accessibilityRole="header" style={estilos.titulo}>
          {TEXTOS.entrar.titulo}
        </Text>
        <Text style={estilos.subtitulo}>{TEXTOS.entrar.subtitulo}</Text>
      </View>
      {aviso ? (
        <Text accessibilityLiveRegion="polite" style={estilos.avisoSesion}>
          {aviso}
        </Text>
      ) : null}
      <Campo etiqueta={TEXTOS.entrar.correo} tipo="email" valorInicial={correo} alCambiar={setCorreo} editable={!ocupado} />
      <Campo
        etiqueta={TEXTOS.entrar.contrasena}
        tipo="password"
        alCambiar={(t) => {
          clave.current = t;
        }}
        editable={!ocupado}
      />
      <Enlace texto={TEXTOS.entrar.olvide} alinear="flex-end" deshabilitado={ocupado} onPress={() => void pedirEnlace(false)} />
      <MensajeError texto={error} />
      <BotonPrimario texto={ocupado ? TEXTOS.entrar.ocupado : TEXTOS.entrar.boton} etiqueta={TEXTOS.entrar.boton} ocupado={ocupado} onPress={() => void entrar()} />
      <View style={estilos.nota}>
        <Text style={estilos.notaTexto}>{TEXTOS.entrar.unaVez}</Text>
      </View>
      <Text style={estilos.sinClave}>
        {TEXTOS.entrar.sinContrasena} <Text style={{ color: C.texto }}>{TEXTOS.entrar.invitacion}</Text>
      </Text>
      <Text style={estilos.pie}>{TEXTOS.entrar.pie}</Text>
    </Cabecera>
  );
}

export const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: C.fondo },
  cabecera: {
    backgroundColor: C.primario,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingTop: 18,
  },
  marca: { fontFamily: F.negra, fontSize: 26, letterSpacing: -0.5, color: '#fff' },
  enVivo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: A.rojoMarca,
    borderRadius: 8,
    paddingVertical: 5,
    paddingLeft: 9,
    paddingRight: 11,
  },
  punto: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
  enVivoTexto: { fontFamily: F.extra, fontSize: 11, letterSpacing: 1.5, color: '#fff' },
  hoja: {
    flex: 1,
    backgroundColor: C.fondo,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  hojaContenido: { flexGrow: 1, paddingTop: 26, paddingHorizontal: 22, paddingBottom: 22, gap: 14 },
  grupoTitulo: { gap: 6 },
  titulo: { fontFamily: F.extra, fontSize: 24, letterSpacing: -0.3, color: C.texto },
  subtitulo: { fontFamily: F.medio, fontSize: 14, lineHeight: 21, color: C.suave },
  textoCentro: { textAlign: 'center' },
  centrado: { gap: 8 },
  avisoSesion: {
    fontFamily: F.semi,
    fontSize: 13,
    lineHeight: 19,
    color: C.ambarTexto,
    backgroundColor: C.ambarFondo,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  campo: { gap: 7 },
  campoEtiqueta: { fontFamily: F.negrita, fontSize: 13, color: C.textoClaro },
  campoCaja: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 54,
    paddingLeft: 14,
    paddingRight: 6,
    backgroundColor: C.caja,
    borderWidth: 1.5,
    borderColor: C.borde,
    borderRadius: 14,
  },
  campoTexto: { flex: 1, minWidth: 0, height: '100%', fontFamily: F.semi, fontSize: 16, color: C.texto, padding: 0 },
  ojo: { minWidth: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  ojoTexto: { fontFamily: F.negrita, fontSize: 12, color: C.suave },
  enlace: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  enlaceTexto: { fontFamily: F.negrita, fontSize: 13, color: A.enlace },
  error: { fontFamily: F.semi, fontSize: 13, lineHeight: 19, color: C.rojoSuave },
  anuncio: { fontFamily: F.semi, fontSize: 13, lineHeight: 19, color: C.textoClaro, textAlign: 'center' },
  oculto: { display: 'none' },
  primario: {
    width: '100%',
    height: 56,
    borderRadius: 14,
    backgroundColor: C.primario,
    alignItems: 'center',
    justifyContent: 'center',
  },
  apagado: { opacity: 0.6 },
  presionado: { opacity: 0.85 },
  primarioTexto: { fontFamily: F.extra, fontSize: 17, color: '#fff' },
  nota: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: A.nota,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  notaTexto: { flex: 1, fontFamily: F.semi, fontSize: 12, lineHeight: 17, color: C.textoClaro },
  sinClave: { textAlign: 'center', fontFamily: F.semi, fontSize: 12, lineHeight: 18, color: C.suave },
  pie: { marginTop: 'auto', textAlign: 'center', fontFamily: F.semi, fontSize: 11, lineHeight: 16, color: A.pie },
  sobre: {
    alignSelf: 'center',
    marginTop: 6,
    width: 76,
    height: 76,
    borderRadius: 22,
    backgroundColor: C.primario,
  },
  cajaNota: {
    backgroundColor: C.caja,
    borderWidth: 1,
    borderColor: C.borde,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  cajaNotaTexto: { fontFamily: F.semi, fontSize: 13, lineHeight: 20, color: C.textoClaro },
  abajo: { marginTop: 'auto', gap: 10 },
});
