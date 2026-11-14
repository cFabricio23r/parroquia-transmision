'use client';
import { useEffect, useState } from 'react';
import { Boton } from '../../../componentes/Boton';
import { CampoSelect } from '../../../componentes/CampoSelect';
import { Dialogo } from '../../../componentes/Dialogo';
import type { OpcionParroquia } from './DialogoInvitar';

/**
 * «Asignar a otra parroquia» (Decisión 13 del plan 5): las parroquias activas de las que la persona no
 * es miembro. Sin ninguna, el texto lo dice y queda un solo botón «Cerrar».
 */
export function DialogoAsignar({
  persona,
  opciones,
  ocupado,
  error,
  onCerrar,
  onAsignar,
}: {
  persona: string | null;
  opciones: OpcionParroquia[];
  ocupado: boolean;
  error: string | null;
  onCerrar: () => void;
  onAsignar: (parroquiaId: string) => void;
}) {
  const [elegida, setElegida] = useState('');
  useEffect(() => {
    setElegida(opciones[0]?.id ?? '');
  }, [persona, opciones]);
  return (
    <Dialogo abierto={persona !== null} titulo="Asignar a otra parroquia" onCerrar={onCerrar}>
      {opciones.length ? (
        <>
          <p className="pv-dialogo-texto">{persona} ya tiene cuenta. Elige otra parroquia que también va a coordinar.</p>
          {error && (
            <p role="alert" className="pv-alerta">
              {error}
            </p>
          )}
          <CampoSelect id="asignar-parroquia" etiqueta="Parroquia" value={elegida} onChange={(e) => setElegida(e.target.value)}>
            {opciones.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </CampoSelect>
          <div className="pv-dialogo-acciones">
            <Boton variante="secundario" onClick={onCerrar}>
              Cancelar
            </Boton>
            <Boton ocupado={ocupado} onClick={() => elegida && onAsignar(elegida)}>
              Asignar
            </Boton>
          </div>
        </>
      ) : (
        <>
          <p className="pv-dialogo-texto">Ya coordina todas las parroquias activas.</p>
          <div className="pv-dialogo-acciones">
            <Boton variante="secundario" onClick={onCerrar}>
              Cerrar
            </Boton>
          </div>
        </>
      )}
    </Dialogo>
  );
}
