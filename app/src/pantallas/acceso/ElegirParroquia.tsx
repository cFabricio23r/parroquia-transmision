// Fila E del lienzo: «¿Desde qué parroquia vas a transmitir?» (VicAppElegirLugar), celular parado.
// Diferencia esperada (Decisión 9 del plan): cada opción muestra solo el nombre, sin el lugar, porque
// `parroquias` no tiene lugar. La nota «Si tienes una sola parroquia…» es de diseño y no se dibuja.
import { useState, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { C, F } from '../../componentes/tema';
import type { ControlSesion } from '../../sesion/control';
import { BotonPrimario, Cabecera, MensajeError, estilos as base } from './Entrar';
import { TEXTOS } from './textos';

export default function ElegirParroquia({ control }: { control: ControlSesion }) {
  const estado = useSyncExternalStore(control.tienda.suscribir, control.tienda.obtener);
  const [elegida, setElegida] = useState<string | null>(estado.parroquia?.id ?? null);
  const [ocupado, setOcupado] = useState(false);

  const lista = estado.parroquias;
  const seleccion = lista.find((p) => p.id === elegida) ?? null;

  async function continuar() {
    if (!seleccion || ocupado) return;
    setOcupado(true);
    try {
      await control.elegir(seleccion);
    } finally {
      setOcupado(false);
    }
  }

  async function reintentar() {
    if (ocupado) return;
    setOcupado(true);
    try {
      await control.revisar();
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Cabecera alto={250} logo={72}>
      <View style={base.grupoTitulo}>
        <Text accessibilityRole="header" style={base.titulo}>
          {TEXTOS.elegir.titulo}
        </Text>
        <Text style={base.subtitulo}>{TEXTOS.elegir.subtitulo}</Text>
      </View>

      {lista.length === 0 ? (
        <>
          <MensajeError texto={TEXTOS.elegir.sinRed} />
          <View style={base.abajo}>
            <BotonPrimario texto={TEXTOS.elegir.reintentar} ocupado={ocupado} onPress={() => void reintentar()} />
          </View>
        </>
      ) : (
        <>
          <View accessibilityRole="radiogroup" accessibilityLabel={TEXTOS.elegir.grupo} style={estilos.grupo}>
            {lista.map((p) => {
              const marcada = p.id === elegida;
              return (
                <Pressable
                  key={p.id}
                  accessibilityRole="radio"
                  accessibilityLabel={p.nombre}
                  accessibilityState={{ checked: marcada, disabled: ocupado }}
                  disabled={ocupado}
                  onPress={() => setElegida(p.id)}
                  style={[estilos.opcion, marcada && estilos.opcionMarcada]}
                >
                  <Text style={estilos.opcionTexto}>{p.nombre}</Text>
                  <View style={[estilos.radio, marcada && estilos.radioMarcado]}>
                    {marcada ? <View style={estilos.radioPunto} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
          <View style={base.abajo}>
            <BotonPrimario
              texto={TEXTOS.elegir.continuar}
              ocupado={ocupado}
              deshabilitado={!seleccion}
              onPress={() => void continuar()}
            />
          </View>
        </>
      )}
    </Cabecera>
  );
}

const estilos = StyleSheet.create({
  grupo: { gap: 8 },
  opcion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 64,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: C.boton,
  },
  opcionMarcada: { borderColor: C.seleccion, backgroundColor: C.seleccionFondo },
  opcionTexto: { flex: 1, fontFamily: F.extra, fontSize: 15, color: C.texto },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: C.suave,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioMarcado: { borderColor: C.seleccion },
  radioPunto: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.seleccion },
});
