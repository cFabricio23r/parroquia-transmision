'use client';
// «Administrar fijas» (etapa 3b, Decisión 15): una tabla de fijas (día, hora, tipo, datos y «Activa») y
// otra de series, con «Cambiar» y «Borrar». Se guarda al momento, como la sección.
import { useState } from 'react';
import { Boton } from '../../../../../componentes/Boton';
import { Dialogo } from '../../../../../componentes/Dialogo';
import { Interruptor } from '../../../../../componentes/Interruptor';
import { Tabla } from '../../../../../componentes/Tabla';
import { hoyIso } from '../../../../../../lib/fecha';
import { SEMANA, type FilaFija, type FilaSerie, type TipoCampos } from '../../../../../../lib/semana';
import { CabezaSeccion } from '../../CabezaSeccion';
import { Migas } from '../../Migas';
import { useBorrador } from '../../ProveedorBorrador';
import { DIAS_SEMANA, DialogoFija } from '../DialogoFija';
import { DialogoSerie } from '../DialogoSerie';
import { usarOperar, usarTiposDisponibles } from '../SeccionSemana';
import { usarSemana } from '../usarSemana';
import '../semana.css';

/** «Guía: Ana · Lectura: Juan 6»: los campos con algo escrito. */
function resumenDatos(tipo: TipoCampos | null, datos: Record<string, unknown>): string {
  if (!tipo) return '';
  return SEMANA.camposDeTipo(tipo)
    .map((c) => ({ c, v: SEMANA.leerCampo(datos, c.ruta).trim() }))
    .filter((x) => x.v)
    .map((x) => `${x.c.etiqueta}: ${x.v}`)
    .join(' · ');
}

export function AdministrarFijas() {
  const { datos: editor } = useBorrador();
  const [lunes] = useState(() => SEMANA.lunesDe(hoyIso()));
  const semana = usarSemana(editor.slug, lunes);
  const disponibles = usarTiposDisponibles();
  const { ocupado, anuncio, error, hacer } = usarOperar(semana.operar);
  const [fija, setFija] = useState<FilaFija | null>(null);
  const [serie, setSerie] = useState<FilaSerie | null>(null);
  const [borrarFija, setBorrarFija] = useState<FilaFija | null>(null);
  const [borrarSerie, setBorrarSerie] = useState<FilaSerie | null>(null);
  const nombreTipo = (c: string) => SEMANA.tipoDeClave(disponibles, c)?.nombre ?? c;
  const fijas = semana.datos?.fijas ?? [];
  const series = semana.datos?.series ?? [];

  return (
    <>
      <Migas items={[{ texto: 'Transmisiones de la semana', href: `/editor/p/${encodeURIComponent(editor.slug)}/semana` }, { texto: 'Administrar fijas' }]} />
      <CabezaSeccion titulo="Administrar fijas" texto="Un cambio en una fija vale para los días que vienen y no toca los días ya editados." />
      <p role="status" className="sem-anuncio">
        {anuncio ?? ''}
      </p>
      {(error || semana.error) && (
        <div className="pv-alerta" role="alert">
          {error ?? semana.error}
        </div>
      )}

      <h2 className="pv-subtitulo">Fijas</h2>
      {fijas.length === 0 ? (
        <p className="sem-sin">Todavía no hay fijas.</p>
      ) : (
        <Tabla
          etiqueta="Fijas"
          columnas={[
            { titulo: 'día', ancho: '110px' },
            { titulo: 'hora', ancho: '70px' },
            { titulo: 'tipo', ancho: '160px' },
            { titulo: 'datos', ancho: 'minmax(0,1fr)' },
            { titulo: 'activa', ancho: '70px' },
            { titulo: '', ancho: '190px' },
          ]}
          filas={fijas.map((f) => {
            const nombre = `${DIAS_SEMANA[f.dia_semana - 1]} ${f.hora}, ${nombreTipo(f.tipo)}`;
            return {
              clave: f.id,
              celdas: [
                DIAS_SEMANA[f.dia_semana - 1],
                f.hora,
                nombreTipo(f.tipo),
                resumenDatos(SEMANA.tipoDeClave(disponibles, f.tipo), f.datos ?? {}),
                <Interruptor
                  key="activa"
                  etiqueta={`Activa: ${nombre}`}
                  activo={f.activa}
                  onCambiar={(v) => void hacer({ op: 'cambiar-fija', id: f.id, dia_semana: f.dia_semana, hora: f.hora, tipo: f.tipo, datos: f.datos ?? {}, activa: v })}
                />,
                <span key="acciones" className="sem-item-acciones">
                  <Boton variante="secundario" compacto aria-label={`Cambiar la fija del ${nombre}`} onClick={() => setFija(f)}>
                    Cambiar
                  </Boton>
                  <Boton variante="peligro" compacto aria-label={`Borrar la fija del ${nombre}`} onClick={() => setBorrarFija(f)}>
                    Borrar
                  </Boton>
                </span>,
              ],
            };
          })}
        />
      )}

      <h2 className="pv-subtitulo">Series de días</h2>
      {series.length === 0 ? (
        <p className="sem-sin">Todavía no hay series.</p>
      ) : (
        <Tabla
          etiqueta="Series de días"
          columnas={[
            { titulo: 'nombre', ancho: 'minmax(0,1fr)' },
            { titulo: 'tipo', ancho: '160px' },
            { titulo: 'desde', ancho: '110px' },
            { titulo: 'días', ancho: '60px' },
            { titulo: 'hora', ancho: '70px' },
            { titulo: '', ancho: '190px' },
          ]}
          filas={series.map((s) => ({
            clave: s.id,
            celdas: [
              s.nombre,
              nombreTipo(s.tipo),
              s.inicio,
              String(s.dias),
              s.hora,
              <span key="acciones" className="sem-item-acciones">
                <Boton variante="secundario" compacto aria-label={`Cambiar la serie ${s.nombre}`} onClick={() => setSerie(s)}>
                  Cambiar
                </Boton>
                <Boton variante="peligro" compacto aria-label={`Borrar la serie ${s.nombre}`} onClick={() => setBorrarSerie(s)}>
                  Borrar
                </Boton>
              </span>,
            ],
          }))}
        />
      )}

      <DialogoFija
        abierto={fija !== null}
        inicial={fija}
        disponibles={disponibles}
        ocupado={ocupado}
        onCerrar={() => setFija(null)}
        onGuardar={(op) => hacer(op, () => setFija(null))}
      />
      <DialogoSerie
        abierto={serie !== null}
        inicial={serie}
        disponibles={disponibles}
        ocupado={ocupado}
        onCerrar={() => setSerie(null)}
        onGuardar={(op) => hacer(op, () => setSerie(null))}
      />
      <Dialogo abierto={borrarFija !== null} titulo="¿Borrar esta fija?" onCerrar={() => setBorrarFija(null)}>
        <p className="pv-dialogo-texto">Se quita de todas las semanas, también los días que editaste.</p>
        <div className="pv-dialogo-acciones">
          <Boton variante="secundario" onClick={() => setBorrarFija(null)}>
            Cancelar
          </Boton>
          <Boton
            variante="peligro"
            ocupado={ocupado}
            onClick={() => borrarFija && void hacer({ op: 'borrar-fija', id: borrarFija.id }, () => setBorrarFija(null))}
          >
            Borrar
          </Boton>
        </div>
      </Dialogo>
      <Dialogo abierto={borrarSerie !== null} titulo="¿Borrar esta serie?" onCerrar={() => setBorrarSerie(null)}>
        <p className="pv-dialogo-texto">Se quitan todos sus días, también los que editaste.</p>
        <div className="pv-dialogo-acciones">
          <Boton variante="secundario" onClick={() => setBorrarSerie(null)}>
            Cancelar
          </Boton>
          <Boton
            variante="peligro"
            ocupado={ocupado}
            onClick={() => borrarSerie && void hacer({ op: 'borrar-serie', id: borrarSerie.id }, () => setBorrarSerie(null))}
          >
            Borrar
          </Boton>
        </div>
      </Dialogo>
    </>
  );
}
