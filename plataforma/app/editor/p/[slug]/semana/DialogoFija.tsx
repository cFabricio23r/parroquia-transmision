'use client';
// «+ Fija (todas las semanas)» y «Cambiar» en Administrar fijas: día de la semana, hora, tipo y campos.
import { useEffect, useState } from 'react';
import { CampoSelect } from '../../../../componentes/CampoSelect';
import { CampoTexto } from '../../../../componentes/CampoTexto';
import { Dialogo } from '../../../../componentes/Dialogo';
import { SEMANA, type FilaFija, type TipoCampos } from '../../../../../lib/semana';
import { CamposTransmision, PieDialogo, SelectTipo, type Guardar } from './CamposTransmision';

export const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export function DialogoFija({
  abierto,
  inicial,
  disponibles,
  ocupado,
  onCerrar,
  onGuardar,
}: {
  abierto: boolean;
  inicial: FilaFija | null;
  disponibles: TipoCampos[];
  ocupado: boolean;
  onCerrar: () => void;
  onGuardar: Guardar;
}) {
  const [dia, setDia] = useState(1);
  const [hora, setHora] = useState('');
  const [tipo, setTipo] = useState('');
  const [datos, setDatos] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!abierto) return;
    setDia(inicial?.dia_semana ?? 1);
    setHora(inicial?.hora ?? '');
    setTipo(inicial?.tipo ?? disponibles[0]?.clave ?? '');
    setDatos(SEMANA.limpiarDatos(inicial?.datos));
    setError(null);
    // Solo al abrir: lo que llega mientras se edita no pisa lo escrito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, inicial]);

  const guardar = async () => {
    const base = { dia_semana: dia, hora, tipo, datos };
    const e = await onGuardar(
      inicial ? { op: 'cambiar-fija', id: inicial.id, activa: inicial.activa, ...base } : { op: 'crear-fija', ...base },
    );
    setError(e ?? null);
  };

  return (
    <Dialogo abierto={abierto} titulo={inicial ? 'Cambiar la fija' : 'Nueva fija (todas las semanas)'} onCerrar={onCerrar} ancho={520}>
      <CampoSelect id="sem-fija-dia" etiqueta="Día de la semana" value={String(dia)} onChange={(e) => setDia(Number(e.target.value))}>
        {DIAS_SEMANA.map((d, i) => (
          <option key={d} value={String(i + 1)}>
            {d}
          </option>
        ))}
      </CampoSelect>
      <CampoTexto id="sem-fija-hora" etiqueta="Hora" type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
      <SelectTipo id="sem-fija-tipo" valor={tipo} disponibles={disponibles} onCambiar={setTipo} />
      <CamposTransmision tipo={SEMANA.tipoDeClave(disponibles, tipo)} datos={datos} onCambiar={setDatos} />
      <PieDialogo error={error} ocupado={ocupado} onCerrar={onCerrar} onGuardar={() => void guardar()} />
    </Dialogo>
  );
}
