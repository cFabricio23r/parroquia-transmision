'use client';
// «+ Una transmisión»: fecha, hora, tipo y campos.
import { useEffect, useState } from 'react';
import { CampoTexto } from '../../../../componentes/CampoTexto';
import { Dialogo } from '../../../../componentes/Dialogo';
import { SEMANA, type TipoCampos } from '../../../../../lib/semana';
import { CamposTransmision, PieDialogo, SelectTipo, type Guardar } from './CamposTransmision';

export function DialogoUnica({
  abierto,
  fechaInicial,
  disponibles,
  ocupado,
  onCerrar,
  onGuardar,
}: {
  abierto: boolean;
  fechaInicial: string;
  disponibles: TipoCampos[];
  ocupado: boolean;
  onCerrar: () => void;
  onGuardar: Guardar;
}) {
  const [fecha, setFecha] = useState('');
  const [hora, setHora] = useState('');
  const [tipo, setTipo] = useState('');
  const [datos, setDatos] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!abierto) return;
    setFecha(fechaInicial);
    setHora('');
    setTipo(disponibles[0]?.clave ?? '');
    setDatos({});
    setError(null);
    // Solo al abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);

  const guardar = async () => {
    setError((await onGuardar({ op: 'crear-unica', fecha, hora, tipo, datos })) ?? null);
  };

  return (
    <Dialogo abierto={abierto} titulo="Una transmisión (una sola vez)" onCerrar={onCerrar} ancho={520}>
      <CampoTexto id="sem-unica-fecha" etiqueta="Fecha de la transmisión" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
      <CampoTexto id="sem-unica-hora" etiqueta="Hora" type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
      <SelectTipo id="sem-unica-tipo" valor={tipo} disponibles={disponibles} onCambiar={setTipo} />
      <CamposTransmision tipo={SEMANA.tipoDeClave(disponibles, tipo)} datos={datos} onCambiar={setDatos} />
      <PieDialogo error={error} ocupado={ocupado} onCerrar={onCerrar} onGuardar={() => void guardar()} />
    </Dialogo>
  );
}
