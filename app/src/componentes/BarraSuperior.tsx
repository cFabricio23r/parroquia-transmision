// Barra de arriba (pantallas 1, 2 y 3 del lienzo): el estado al aire, la conexión y el botón
// de la derecha (Ajustes fuera del aire, Cancelar al conectar y Terminar en vivo).
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Fase } from '../estado/transmision';
import { formatoMbps, formatoReloj } from '../estado/formato';
import { C, F, M } from './tema';

interface Props {
  fase: Fase;
  segundos: number;
  cuentaFinal: number | null;
  mbps: number | null;
  ajustesDisponible: boolean;
  onAjustes: () => void;
  onTerminar: () => void;
  onCancelar: () => void;
}

function Pastilla({ fondo, punto, texto }: { fondo: string; punto: string; texto: string }) {
  return (
    <View style={[estilos.pastilla, { backgroundColor: fondo }]}>
      <View style={[estilos.punto, { backgroundColor: punto }]} />
      <Text style={estilos.pastillaTexto} numberOfLines={1}>
        {texto}
      </Text>
    </View>
  );
}

export default function BarraSuperior(p: Props) {
  const reloj = formatoReloj(p.segundos);

  if (p.fase === 'preparando' || p.fase === 'terminado') {
    return (
      <View style={estilos.barra}>
        <Pastilla fondo={C.boton} punto={C.suave} texto="SIN TRANSMITIR" />
        <Text style={estilos.parroquia} numberOfLines={1}>
          Parroquia Inmaculada Concepción de María
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ajustes"
          accessibilityState={{ disabled: !p.ajustesDisponible }}
          disabled={!p.ajustesDisponible}
          onPress={p.onAjustes}
          style={[estilos.boton, { backgroundColor: C.boton }, !p.ajustesDisponible && estilos.apagado]}
        >
          <Text style={estilos.botonTexto}>Ajustes</Text>
        </Pressable>
      </View>
    );
  }

  if (p.fase === 'iniciando') {
    return (
      <View style={estilos.barra}>
        <Pastilla fondo={C.boton} punto={C.ambar} texto="CONECTANDO…" />
        <Text style={estilos.parroquia} numberOfLines={1}>
          Conectando con Facebook
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancelar el inicio"
          onPress={p.onCancelar}
          style={[estilos.boton, { backgroundColor: C.boton }]}
        >
          <Text style={estilos.botonTexto}>Cancelar</Text>
        </Pressable>
      </View>
    );
  }

  const reconectando = p.fase === 'reconectando';
  const terminando = p.fase === 'terminando';
  const textoPastilla = terminando
    ? p.cuentaFinal !== null && p.cuentaFinal > 0
      ? `TERMINA EN ${p.cuentaFinal} s`
      : 'TERMINANDO…'
    : reconectando
      ? `RECONECTANDO ${reloj}`
      : `EN VIVO ${reloj}`;

  return (
    <View style={estilos.barra} accessibilityLiveRegion="polite">
      <Pastilla fondo={reconectando ? C.ambarFondo : C.rojo} punto={reconectando ? C.ambar : '#ffffff'} texto={textoPastilla} />
      <View style={estilos.facebook}>
        <View style={[estilos.puntoChico, { backgroundColor: reconectando ? C.ambar : C.verde }]} />
        <Text style={estilos.facebookTexto}>Facebook</Text>
      </View>
      <View style={estilos.relleno} />
      <Text style={estilos.dato}>Subida {formatoMbps(reconectando ? null : p.mbps)}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Terminar la transmisión"
        onPress={p.onTerminar}
        style={[estilos.boton, { backgroundColor: C.rojo }]}
      >
        <View style={estilos.cuadro} />
        <Text style={[estilos.botonTexto, { color: '#ffffff' }]}>Terminar</Text>
      </Pressable>
    </View>
  );
}

const estilos = StyleSheet.create({
  barra: { height: M.barraAlto, flexDirection: 'row', alignItems: 'center', gap: 10 },
  pastilla: {
    height: 40,
    borderRadius: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  punto: { width: 10, height: 10, borderRadius: 5 },
  pastillaTexto: { fontFamily: F.extra, fontSize: 15, letterSpacing: 1, color: C.texto },
  parroquia: { flex: 1, fontFamily: F.negrita, fontSize: 14, color: C.suave },
  facebook: {
    height: 40,
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: C.caja,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  puntoChico: { width: 9, height: 9, borderRadius: 5 },
  facebookTexto: { fontFamily: F.negrita, fontSize: 13, color: C.texto },
  relleno: { flex: 1 },
  dato: { fontFamily: F.semi, fontSize: 12, color: C.suave },
  boton: {
    minHeight: 44,
    borderRadius: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cuadro: { width: 12, height: 12, borderRadius: 3, backgroundColor: '#ffffff' },
  botonTexto: { fontFamily: F.extra, fontSize: 14, color: C.texto },
  apagado: { opacity: 0.4 },
});
