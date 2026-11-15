// «Elegir transmisión» (plan 3b, Tarea 14): una capa sobre Antes de iniciar (vista previa y botón
// Iniciar). El panel queda a la vista, a la derecha, porque «Editar» lleva a sus campos.
// Vista «hoy»: la próxima destacada con «Usar esta» y «Editar», las demás con «Usar esta».
// Vista «semana»: de lunes a domingo.
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { C, F } from '../../componentes/tema';
import { SEMANA, type TipoCampos } from '../../semana/nucleo';
import type { ItemApp } from '../../semana/pendientes';
import { proximaDeHoy, TEXTOS_SEMANA as T, textoActualizado } from '../../semana/textos';

export interface PropsElegir {
  /** Los ítems de la semana de hoy, ya combinados con los pendientes. */
  items: ItemApp[];
  /** Hoy, 'AAAA-MM-DD'. */
  hoy: string;
  tipos: TipoCampos[];
  hayRed: boolean;
  /** Cuándo se bajó la semana; null si nunca se bajó. */
  bajadaEn: string | null;
  onUsar(item: ItemApp): void;
  onEditar(item: ItemApp): void;
  onSinPreparar(): void;
  onCerrar(): void;
}

function linea(item: ItemApp, tipo: TipoCampos | null): string {
  return SEMANA.textoDia(item.fecha) + ', ' + item.hora + ', ' + (tipo ? tipo.nombre : item.tipo);
}

function Boton(p: { texto: string; etiqueta: string; deshabilitado?: boolean; primario?: boolean; onPress(): void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={p.etiqueta}
      accessibilityState={{ disabled: !!p.deshabilitado }}
      disabled={p.deshabilitado}
      onPress={p.onPress}
      style={[estilos.boton, p.primario && estilos.botonPrimario, p.deshabilitado && estilos.botonApagado]}
    >
      <Text style={estilos.botonTexto}>{p.texto}</Text>
    </Pressable>
  );
}

function Fila(p: {
  item: ItemApp;
  tipos: TipoCampos[];
  destacada?: boolean;
  onUsar(item: ItemApp): void;
  onEditar?(item: ItemApp): void;
}) {
  const tipo = SEMANA.tipoDeClave(p.tipos, p.item.tipo);
  const l = linea(p.item, tipo);
  const faltan = tipo ? SEMANA.contarFaltas(tipo, p.item.datos) : null;
  return (
    <View style={[estilos.fila, p.destacada && estilos.filaDestacada]}>
      <Text style={estilos.filaTitulo}>{l.split(', ').join(' · ')}</Text>
      <Text style={estilos.filaDetalle}>{SEMANA.textoOrigen(p.item)}</Text>
      <Text style={estilos.filaDetalle}>{SEMANA.textoEstado(faltan)}</Text>
      {!tipo ? (
        <Text style={estilos.aviso} accessibilityLiveRegion="polite">{T.tipoNoDisponible}</Text>
      ) : null}
      {p.item.pendiente ? <Text style={estilos.aviso}>{T.pendiente}</Text> : null}
      {p.item.rechazado ? <Text style={estilos.aviso}>{T.rechazado}</Text> : null}
      <View style={estilos.botones}>
        <Boton
          texto={T.usar}
          etiqueta={T.usar + ': ' + l}
          deshabilitado={!tipo}
          primario
          onPress={() => p.onUsar(p.item)}
        />
        {p.onEditar ? (
          <Boton
            texto={T.editar}
            etiqueta={T.editar + ': ' + l}
            deshabilitado={!tipo}
            onPress={() => p.onEditar?.(p.item)}
          />
        ) : null}
      </View>
    </View>
  );
}

export default function ElegirTransmision(p: PropsElegir) {
  const [vista, setVista] = useState<'hoy' | 'semana'>('hoy');
  const visibles = p.items.filter((i) => !i.saltada);
  const deHoy = visibles.filter((i) => i.fecha === p.hoy);
  const proxima = proximaDeHoy(deHoy, new Date());

  const pie = (
    <View style={estilos.pie}>
      <Text style={estilos.pieTexto}>{T.pie}</Text>
      {!p.hayRed && p.bajadaEn ? <Text style={estilos.pieTexto}>{textoActualizado(p.bajadaEn, new Date())}</Text> : null}
    </View>
  );
  const sinPreparar = <Boton texto={T.sinPreparar} etiqueta={T.sinPreparar} onPress={p.onSinPreparar} />;

  if (p.bajadaEn === null) {
    return (
      <View style={estilos.capa} accessibilityViewIsModal>
        <Text style={estilos.titulo} accessibilityRole="header">{T.titulo}</Text>
        <Text style={estilos.texto} accessibilityLiveRegion="polite">{T.sinCache}</Text>
        <View style={estilos.botones}>{sinPreparar}</View>
      </View>
    );
  }

  if (vista === 'semana') {
    const lunes = SEMANA.lunesDe(p.hoy);
    const dias = Array.from({ length: 7 }, (_, i) => SEMANA.sumarDias(lunes, i));
    return (
      <View style={estilos.capa} accessibilityViewIsModal>
        <View style={estilos.encabezado}>
          <Text style={estilos.titulo} accessibilityRole="header">{T.semana}</Text>
          <Boton texto={T.volver} etiqueta="Volver a hoy" onPress={() => setVista('hoy')} />
        </View>
        <ScrollView contentContainerStyle={estilos.lista}>
          {dias.map((dia) => {
            const delDia = visibles.filter((i) => i.fecha === dia);
            return (
              <View key={dia} style={estilos.dia}>
                <Text style={estilos.diaTitulo} accessibilityRole="header">{SEMANA.textoDia(dia)}</Text>
                {delDia.length === 0 ? <Text style={estilos.filaDetalle}>{T.sinTransmisiones}</Text> : null}
                {delDia.map((i) => (
                  <Fila key={i.clave} item={i} tipos={p.tipos} onUsar={p.onUsar} />
                ))}
              </View>
            );
          })}
          {pie}
        </ScrollView>
      </View>
    );
  }

  const destacada = deHoy.find((i) => i.clave === proxima) ?? null;
  const demas = deHoy.filter((i) => i.clave !== proxima);
  return (
    <View style={estilos.capa} accessibilityViewIsModal>
      <Text style={estilos.titulo} accessibilityRole="header">{T.titulo}</Text>
      <ScrollView contentContainerStyle={estilos.lista}>
        {deHoy.length === 0 ? <Text style={estilos.texto}>{T.vacioHoy}</Text> : null}
        {destacada ? (
          <Fila item={destacada} tipos={p.tipos} destacada onUsar={p.onUsar} onEditar={p.onEditar} />
        ) : null}
        {demas.map((i) => (
          <Fila key={i.clave} item={i} tipos={p.tipos} onUsar={p.onUsar} />
        ))}
        <View style={estilos.botones}>
          <Boton texto={T.verSemana} etiqueta={T.verSemana} onPress={() => setVista('semana')} />
          {sinPreparar}
        </View>
        {pie}
      </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  capa: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    backgroundColor: C.fondo,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.borde,
    padding: 12,
    gap: 8,
  },
  encabezado: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  titulo: { fontFamily: F.extra, fontSize: 18, color: C.texto },
  texto: { fontFamily: F.semi, fontSize: 14, color: C.textoClaro },
  lista: { gap: 8, paddingBottom: 12 },
  dia: { gap: 6 },
  diaTitulo: { fontFamily: F.extra, fontSize: 14, color: C.suave },
  fila: { backgroundColor: C.caja, borderRadius: 10, borderWidth: 1, borderColor: C.borde, padding: 10, gap: 4 },
  filaDestacada: { borderColor: C.seleccion, backgroundColor: C.seleccionFondo },
  filaTitulo: { fontFamily: F.extra, fontSize: 15, color: C.texto },
  filaDetalle: { fontFamily: F.semi, fontSize: 12, color: C.suave },
  aviso: { fontFamily: F.negrita, fontSize: 12, color: C.ambarTexto },
  botones: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  boton: {
    minHeight: 44,
    minWidth: 44,
    borderRadius: 10,
    backgroundColor: C.boton,
    borderWidth: 1,
    borderColor: C.borde,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  botonPrimario: { backgroundColor: C.primario, borderColor: C.seleccion },
  botonApagado: { opacity: 0.5 },
  botonTexto: { fontFamily: F.extra, fontSize: 13, color: C.texto },
  pie: { gap: 4, marginTop: 4 },
  pieTexto: { fontFamily: F.medio, fontSize: 12, color: C.suave },
});
