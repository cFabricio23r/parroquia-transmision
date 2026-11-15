'use client';
// «Editar este día» (y «Editar» de una suelta): hora, tipo y campos de ese día. La fecha va en el título.
// Editar un día no cambia la fija ni la serie: guarda la copia completa del día.
import { useEffect, useState } from 'react';
import { CampoTexto } from '../../../../componentes/CampoTexto';
import { Dialogo } from '../../../../componentes/Dialogo';
import { encabezadoDia } from '../../../../../lib/editor/semana-textos';
import type { OperacionSemana } from '../../../../../lib/semana-editor';
import { SEMANA, type ItemSemana, type TipoCampos } from '../../../../../lib/semana';
import { CamposTransmision, PieDialogo, SelectTipo, type Guardar } from './CamposTransmision';

export function DialogoDia({
  item,
  disponibles,
  ocupado,
  onCerrar,
  onGuardar,
}: {
  item: ItemSemana | null;
  disponibles: TipoCampos[];
  ocupado: boolean;
  onCerrar: () => void;
  onGuardar: Guardar;
}) {
  const [hora, setHora] = useState('');
  const [tipo, setTipo] = useState('');
  const [datos, setDatos] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!item) return;
    setHora(item.hora);
    setTipo(item.tipo);
    setDatos(SEMANA.limpiarDatos(item.datos));
    setError(null);
  }, [item]);

  const guardar = async () => {
    if (!item) return;
    // El servidor deriva el origen, el id y la fecha de la clave (leerOperacion).
    const op = { op: 'editar-dia', clave: item.clave, hora, tipo, datos } as unknown as OperacionSemana;
    setError((await onGuardar(op)) ?? null);
  };

  const titulo = item ? `Editar el ${encabezadoDia(item.fecha).toLowerCase()}` : 'Editar';
  return (
    <Dialogo abierto={item !== null} titulo={titulo} onCerrar={onCerrar} ancho={520}>
      <CampoTexto id="sem-dia-hora" etiqueta="Hora" type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
      <SelectTipo id="sem-dia-tipo" valor={tipo} disponibles={disponibles} onCambiar={setTipo} />
      <CamposTransmision tipo={SEMANA.tipoDeClave(disponibles, tipo)} datos={datos} onCambiar={setDatos} />
      <PieDialogo error={error} ocupado={ocupado} onCerrar={onCerrar} onGuardar={() => void guardar()} />
    </Dialogo>
  );
}
