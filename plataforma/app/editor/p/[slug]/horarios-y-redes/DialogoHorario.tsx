'use client';
// «Agregar horario» / «Editar horario» (F10, Decisión 14): día, horas con nota, lugar. Guarda la lista
// entera en la forma nueva y la manda enseguida (guardado explícito, no espera los 800 ms).
import { useEffect, useState } from 'react';
import { aFormaNueva, erroresHorario, limpiarHorario, MAX_HORAS, type Horario } from '../../../../../lib/editor/horarios';
import { Boton } from '../../../../componentes/Boton';
import { CampoTexto } from '../../../../componentes/CampoTexto';
import { Dialogo } from '../../../../componentes/Dialogo';
import { useBorrador } from '../ProveedorBorrador';

export const AYUDA_DIA = 'Por ejemplo: Domingo, o Lunes a viernes.';
export const AYUDA_HORA = 'Como quieres que se vea, por ejemplo 7:00 a. m.';

/** `indice` null = agregar; un número = editar ese horario. `abierto` false = cerrado. */
export function DialogoHorario({ abierto, indice, onCerrar }: { abierto: boolean; indice: number | null; onCerrar: () => void }) {
  const { borrador, cambiar, guardarYa } = useBorrador();
  const lista = Array.isArray(borrador.horarios) ? borrador.horarios : [];
  const [h, setH] = useState<Horario>({ dia: '', horas: [{ hora: '' }] });
  const [errores, setErrores] = useState<ReturnType<typeof erroresHorario>>({});
  const [intentado, setIntentado] = useState(false);
  // Después del primer «Guardar horario», los errores se recalculan con cada cambio (y se van al corregir).
  useEffect(() => {
    if (intentado) setErrores(erroresHorario(h));
  }, [h, intentado]);

  useEffect(() => {
    if (!abierto) return;
    const inicial = indice !== null ? aFormaNueva(lista[indice]) : { dia: '', horas: [] };
    setH({ ...inicial, horas: inicial.horas.length ? inicial.horas.map((x) => ({ ...x })) : [{ hora: '' }] });
    setErrores({});
    setIntentado(false);
    // Solo al abrir: lo que llega del borrador mientras se edita no pisa lo escrito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, indice]);

  const ponerHora = (i: number, c: Partial<{ hora: string; nota: string }>) =>
    setH((x) => ({ ...x, horas: x.horas.map((o, j) => (j === i ? { ...o, ...c } : o)) }));

  const escribir = (nueva: unknown[]) => {
    // El editor guarda siempre la forma nueva (spec, sección 6).
    cambiar('horarios', nueva.length ? nueva.map((x) => aFormaNueva(x)) : undefined);
    void guardarYa();
    onCerrar();
  };

  const guardar = () => {
    const e = erroresHorario(h);
    setErrores(e);
    setIntentado(true);
    if (Object.keys(e).length) return;
    const limpio = limpiarHorario(h);
    if (indice === null) escribir([...lista, limpio]);
    else escribir(lista.map((x, i) => (i === indice ? limpio : x)));
  };

  return (
    <Dialogo abierto={abierto} titulo={indice === null ? 'Agregar horario' : 'Editar horario'} onCerrar={onCerrar} ancho={520}>
      <CampoTexto id="horario-dia" etiqueta="Día" ayuda={AYUDA_DIA} value={h.dia} error={errores.dia} onChange={(e) => setH({ ...h, dia: e.target.value })} />
      <fieldset className="pv-horario-horas" aria-describedby={errores.horas ? 'horario-horas-error' : undefined}>
        <legend className="pv-campo-etiqueta">Horas</legend>
        {h.horas.map((o, i) => (
          <div key={i} className="pv-horario-hora">
            <CampoTexto
              id={`horario-hora-${i}`}
              etiqueta={h.horas.length > 1 ? `Hora ${i + 1}` : 'Hora'}
              ayuda={i === 0 ? AYUDA_HORA : undefined}
              value={o.hora}
              onChange={(e) => ponerHora(i, { hora: e.target.value })}
            />
            <CampoTexto id={`horario-nota-${i}`} etiqueta="Nota (opcional)" value={o.nota ?? ''} onChange={(e) => ponerHora(i, { nota: e.target.value })} />
            {h.horas.length > 1 && (
              <button
                type="button"
                className="pv-enlace pv-horario-quitar"
                aria-label={`Quitar la hora ${i + 1}`}
                onClick={() => setH({ ...h, horas: h.horas.filter((_, j) => j !== i) })}
              >
                Quitar
              </button>
            )}
          </div>
        ))}
        {errores.horas && (
          <span id="horario-horas-error" className="pv-campo-error">
            {errores.horas}
          </span>
        )}
        {h.horas.length < MAX_HORAS && (
          <button type="button" className="pv-enlace pv-horario-otra" onClick={() => setH({ ...h, horas: [...h.horas, { hora: '' }] })}>
            + Agregar otra hora
          </button>
        )}
      </fieldset>
      <CampoTexto
        id="horario-lugar"
        etiqueta="Lugar (opcional)"
        value={h.lugar ?? ''}
        error={errores.lugar}
        onChange={(e) => setH({ ...h, lugar: e.target.value })}
      />
      <div className={indice !== null ? 'pv-dialogo-acciones pv-dialogo-acciones--separadas' : 'pv-dialogo-acciones'}>
        {indice !== null && (
          <Boton variante="peligro" onClick={() => escribir(lista.filter((_, i) => i !== indice))}>
            Borrar horario
          </Boton>
        )}
        <span className="pv-dialogo-acciones">
          <Boton variante="secundario" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton onClick={guardar}>Guardar horario</Boton>
        </span>
      </div>
    </Dialogo>
  );
}
