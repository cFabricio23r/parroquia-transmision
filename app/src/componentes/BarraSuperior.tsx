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
  /** De 0 a 1 (expo-battery); null o negativo si no se sabe. */
  bateria?: number | null;
  /** Temperatura de la batería, °C. */
  temperatura?: number | null;
  ajustesDisponible: boolean;
  onAjustes: () => void;
  onTerminar: () => void;
  onCancelar: () => void;
}

// La etiqueta (EN VIVO, RECONECTANDO…) es una región en vivo: TalkBack anuncia solo los cambios
// de estado. El detalle (el reloj o la cuenta) cambia cada segundo y queda afuera (review M3).
function Pastilla(p: { fondo: string; punto: string; etiqueta: string; detalle?: string }) {
  return (
    <View style={[estilos.pastilla, { backgroundColor: p.fondo }]}>
      <View style={[estilos.punto, { backgroundColor: p.punto }]} />
      <Text style={estilos.pastillaTexto} numberOfLines={1} accessibilityLiveRegion="polite">
        {p.etiqueta}
      </Text>
      {p.detalle ? (
        <Text style={estilos.pastillaTexto} numberOfLines={1}>
          {p.detalle}
        </Text>
      ) : null}
    </View>
  );
}

// «Batería 78 % · 38 °C», como la pantalla 6 del lienzo. Sin datos, nada.
function textoBateria(bateria?: number | null, temperatura?: number | null): string | null {
  const partes: string[] = [];
  if (typeof bateria === 'number' && Number.isFinite(bateria) && bateria >= 0) partes.push(`Batería ${Math.round(bateria * 100)} %`);
  if (typeof temperatura === 'number' && Number.isFinite(temperatura)) partes.push(`${Math.round(temperatura)} °C`);
  return partes.length > 0 ? partes.join(' · ') : null;
}

export default function BarraSuperior(p: Props) {
  const reloj = formatoReloj(p.segundos);

  if (p.fase === 'preparando' || p.fase === 'terminado') {
    return (
      <View style={estilos.barra}>
        <Pastilla fondo={C.boton} punto={C.suave} etiqueta="SIN TRANSMITIR" />
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
        <Pastilla fondo={C.boton} punto={C.ambar} etiqueta="CONECTANDO…" />
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
  const enCuenta = terminando && p.cuentaFinal !== null && p.cuentaFinal > 0;
  const etiqueta = terminando ? (enCuenta ? 'TERMINA EN' : 'TERMINANDO…') : reconectando ? 'RECONECTANDO' : 'EN VIVO';
  const detalle = terminando ? (enCuenta ? `${p.cuentaFinal} s` : undefined) : reloj;

  return (
    <View style={estilos.barra}>
      <Pastilla
        fondo={reconectando ? C.ambarFondo : C.rojo}
        punto={reconectando ? C.ambar : '#ffffff'}
        etiqueta={etiqueta}
        detalle={detalle}
      />
      <View style={estilos.facebook}>
        <View style={[estilos.puntoChico, { backgroundColor: reconectando ? C.ambar : C.verde }]} />
        <Text style={estilos.facebookTexto}>Facebook</Text>
      </View>
      <View style={estilos.relleno} />
      <Text style={estilos.dato}>Subida {formatoMbps(reconectando ? null : p.mbps)}</Text>
      {textoBateria(p.bateria, p.temperatura) ? (
        <Text style={estilos.dato}>{textoBateria(p.bateria, p.temperatura)}</Text>
      ) : null}
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
