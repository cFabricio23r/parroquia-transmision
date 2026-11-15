'use client';
// «+ Serie de días (novena)» y «Cambiar» de una serie: nombre, tipo, inicio, cantidad de días, hora y
// campos. El día de la serie (`dia`) no se pide: lo pone la serie.
import { useEffect, useState } from 'react';
import { CampoTexto } from '../../../../componentes/CampoTexto';
import { Dialogo } from '../../../../componentes/Dialogo';
import { SEMANA, type FilaSerie, type TipoCampos } from '../../../../../lib/semana';
import { CamposTransmision, PieDialogo, SelectTipo, type Guardar } from './CamposTransmision';

export function DialogoSerie({
  abierto,
  inicial,
  disponibles,
  ocupado,
  onCerrar,
  onGuardar,
}: {
  abierto: boolean;
  inicial: FilaSerie | null;
  disponibles: TipoCampos[];
  ocupado: boolean;
  onCerrar: () => void;
  onGuardar: Guardar;
}) {
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState('');
  const [inicio, setInicio] = useState('');
  const [dias, setDias] = useState('9');
  const [hora, setHora] = useState('');
  const [datos, setDatos] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!abierto) return;
    setNombre(inicial?.nombre ?? '');
    setTipo(inicial?.tipo ?? disponibles.find((t) => t.clave === 'novena')?.clave ?? disponibles[0]?.clave ?? '');
    setInicio(inicial?.inicio ?? '');
    setDias(String(inicial?.dias ?? 9));
    setHora(inicial?.hora ?? '');
    const d = SEMANA.limpiarDatos(inicial?.datos);
    delete d.dia;
    setDatos(d);
    setError(null);
    // Solo al abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, inicial]);

  const guardar = async () => {
    const base = { nombre, tipo, inicio, dias: Number(dias), hora, datos };
    const e = await onGuardar(inicial ? { op: 'cambiar-serie', id: inicial.id, ...base } : { op: 'crear-serie', ...base });
    setError(e ?? null);
  };

  return (
    <Dialogo abierto={abierto} titulo={inicial ? 'Cambiar la serie' : 'Nueva serie de días'} onCerrar={onCerrar} ancho={520}>
      <CampoTexto id="sem-serie-nombre" etiqueta="Nombre" maxLength={80} value={nombre} onChange={(e) => setNombre(e.target.value)} />
      <SelectTipo id="sem-serie-tipo" valor={tipo} disponibles={disponibles} onCambiar={setTipo} />
      <CampoTexto id="sem-serie-inicio" etiqueta="Empieza el" type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
      <CampoTexto
        id="sem-serie-dias"
        etiqueta="Cantidad de días"
        type="number"
        min={1}
        max={60}
        value={dias}
        onChange={(e) => setDias(e.target.value)}
      />
      <CampoTexto id="sem-serie-hora" etiqueta="Hora" type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
      <CamposTransmision tipo={SEMANA.tipoDeClave(disponibles, tipo)} datos={datos} onCambiar={setDatos} />
      <PieDialogo error={error} ocupado={ocupado} onCerrar={onCerrar} onGuardar={() => void guardar()} />
    </Dialogo>
  );
}
