'use client';
// «Transmisiones de la semana» (etapa 3b). Fuera del borrador: cada cambio se guarda al momento con
// POST /editor/api/[slug]/semana y la app lo baja. Los tipos que se ofrecen son los publicados
// (Decisión 8): es lo que el panel de la app va a tener.
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Boton, clasesBoton } from '../../../../componentes/Boton';
import { CajaInfo } from '../../../../componentes/CajaInfo';
import { Dialogo } from '../../../../componentes/Dialogo';
import { useEnvio } from '../../../../componentes/useEnvio';
import { hoyIso } from '../../../../../lib/fecha';
import {
  AVISO_TIPO_EDITOR,
  cambiadoDesdeApp,
  encabezadoDia,
  etiquetaAccion,
  etiquetaFila,
  rangoSemana,
} from '../../../../../lib/editor/semana-textos';
import type { OperacionSemana } from '../../../../../lib/semana-editor';
import { SEMANA, type ItemSemana, type TipoCampos } from '../../../../../lib/semana';
import { CabezaSeccion } from '../CabezaSeccion';
import { useBorrador } from '../ProveedorBorrador';
import { DialogoDia } from './DialogoDia';
import { DialogoFija } from './DialogoFija';
import { DialogoSerie } from './DialogoSerie';
import { DialogoUnica } from './DialogoUnica';
import { MENSAJE_SIN_CONEXION, usarSemana } from './usarSemana';
import './semana.css';

export const TEXTO_SEMANA = 'Las transmisiones que la app ofrece cada día: las fijas, las series de días y las que van una sola vez.';
export const TEXTO_SEMANA_VACIA = 'Todavía no hay transmisiones esta semana. Empieza con una fija, como la misa del domingo.';

/** Los tipos que se ofrecen: los publicados, o los comunes si no hay nada publicado (Decisión 8). */
export function usarTiposDisponibles(): TipoCampos[] {
  const { datos } = useBorrador();
  return useMemo(
    () =>
      SEMANA.tiposDisponibles(
        datos.tiposComunes.map((t) => ({ ...t, nombre: t.nombrePanel || t.nombre })),
        datos.publicada?.config?.tipos,
      ),
    [datos.tiposComunes, datos.publicada],
  );
}

/** El envío de una operación: `null` si salió bien, o el mensaje del servidor. */
export function usarOperar(operar: (op: OperacionSemana) => Promise<{ error?: string }>) {
  const envio = useEnvio();
  const [anuncio, setAnuncio] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hacer = async (op: OperacionSemana, alTerminar?: () => void): Promise<string | undefined> => {
    const r = await envio.enviar(() => operar(op));
    if (r.tipo === 'ocupado') return undefined;
    const mensaje = r.tipo === 'fallo' ? MENSAJE_SIN_CONEXION : r.valor.error;
    if (mensaje) {
      setError(mensaje);
      setAnuncio(null);
      return mensaje;
    }
    setError(null);
    setAnuncio('Guardado.');
    alTerminar?.();
    return undefined;
  };
  return { ocupado: envio.ocupado, anuncio, error, hacer };
}

type Abierto = 'fija' | 'serie' | 'unica' | null;

export function SeccionSemana() {
  const { datos: editor } = useBorrador();
  const [lunes, setLunes] = useState(() => SEMANA.lunesDe(hoyIso()));
  const semana = usarSemana(editor.slug, lunes);
  const disponibles = usarTiposDisponibles();
  const { ocupado, anuncio, error, hacer } = usarOperar(semana.operar);
  const [abierto, setAbierto] = useState<Abierto>(null);
  const [dia, setDia] = useState<ItemSemana | null>(null);
  const [borrar, setBorrar] = useState<ItemSemana | null>(null);

  const items = useMemo(
    () =>
      semana.datos
        ? SEMANA.armarSemana({ lunes, fijas: semana.datos.fijas, series: semana.datos.series, transmisiones: semana.datos.transmisiones })
        : [],
    [semana.datos, lunes],
  );
  const fechas = Array.from({ length: 7 }, (_, i) => SEMANA.sumarDias(lunes, i));
  const nombreTipo = (clave: string) => SEMANA.tipoDeClave(disponibles, clave)?.nombre ?? clave;
  const cerrar = () => setAbierto(null);

  return (
    <>
      <CabezaSeccion titulo="Transmisiones de la semana" texto={TEXTO_SEMANA}>
        <CajaInfo>Esto se guarda al momento y la app lo baja. No hace falta publicar. Los tipos propios aparecen aquí cuando se publican.</CajaInfo>
      </CabezaSeccion>

      <div className="sem-barra">
        <div className="sem-navegar">
          <Boton variante="secundario" compacto aria-label="Semana anterior" onClick={() => setLunes(SEMANA.sumarDias(lunes, -7))}>
            ‹ Anterior
          </Boton>
          <span className="sem-rango">{rangoSemana(lunes)}</span>
          <Boton variante="secundario" compacto aria-label="Semana siguiente" onClick={() => setLunes(SEMANA.sumarDias(lunes, 7))}>
            Siguiente ›
          </Boton>
        </div>
        <div className="sem-crear">
          <Boton compacto onClick={() => setAbierto('fija')}>
            + Fija (todas las semanas)
          </Boton>
          <Boton variante="secundario" compacto onClick={() => setAbierto('serie')}>
            + Serie de días (novena)
          </Boton>
          <Boton variante="secundario" compacto onClick={() => setAbierto('unica')}>
            + Una transmisión
          </Boton>
          <Link href={`/editor/p/${encodeURIComponent(editor.slug)}/semana/fijas`} className={clasesBoton('secundario', true)}>
            Administrar fijas
          </Link>
        </div>
      </div>

      <p role="status" className="sem-anuncio">
        {anuncio ?? ''}
      </p>
      {(error || semana.error) && (
        <div className="pv-alerta" role="alert">
          {error ?? semana.error}
        </div>
      )}

      {semana.datos && items.length === 0 && <p className="sem-vacia">{TEXTO_SEMANA_VACIA}</p>}

      <div className="sem-lista" aria-busy={semana.cargando || undefined}>
        {fechas.map((f) => {
          const delDia = items.filter((it) => it.fecha === f);
          return (
            <section key={f} className="sem-dia" aria-labelledby={`sem-dia-${f}`}>
              <h2 id={`sem-dia-${f}`} className="sem-dia-titulo">
                {encabezadoDia(f)}
              </h2>
              {delDia.length === 0 && <p className="sem-sin">Sin transmisiones</p>}
              {delDia.map((it) => {
                const tipo = SEMANA.tipoDeClave(disponibles, it.tipo);
                const nombre = nombreTipo(it.tipo);
                const faltan = SEMANA.contarFaltas(tipo, it.datos);
                const desdeApp = cambiadoDesdeApp(it);
                const datosBase = { clave: it.clave, hora: it.hora, tipo: it.tipo, datos: it.datos };
                return (
                  <div key={it.clave} className={it.saltada ? 'sem-item sem-item--saltada' : 'sem-item'}>
                    <div className="sem-item-texto">
                      <span className="sem-item-linea">{etiquetaFila(it, nombre)}</span>
                      <span className="sem-item-origen">{SEMANA.textoOrigen(it)}</span>
                      {it.saltada ? (
                        <span className="sem-item-saltada">saltada esta semana</span>
                      ) : (
                        <span className={`sem-estado ${faltan === 0 ? 'sem-estado--listo' : 'sem-estado--falta'}`}>{SEMANA.textoEstado(faltan)}</span>
                      )}
                      {!tipo && <span className="sem-aviso">{AVISO_TIPO_EDITOR}</span>}
                      {desdeApp && <span className="sem-item-app">{desdeApp}</span>}
                    </div>
                    <div className="sem-item-acciones">
                      {it.saltada ? (
                        <Boton
                          variante="secundario"
                          compacto
                          ocupado={ocupado}
                          aria-label={etiquetaAccion('Volver a ponerla', it, nombre)}
                          onClick={() => void hacer({ op: 'restaurar-dia', clave: it.clave } as unknown as OperacionSemana)}
                        >
                          Volver a ponerla
                        </Boton>
                      ) : (
                        <>
                          <Boton variante="secundario" compacto aria-label={etiquetaAccion('Editar', it, nombre)} onClick={() => setDia(it)}>
                            {it.origen === 'unica' ? 'Editar' : 'Editar este día'}
                          </Boton>
                          {it.origen === 'unica' ? (
                            <Boton variante="peligro" compacto aria-label={etiquetaAccion('Borrar', it, nombre)} onClick={() => setBorrar(it)}>
                              Borrar
                            </Boton>
                          ) : (
                            <Boton
                              variante="secundario"
                              compacto
                              ocupado={ocupado}
                              aria-label={etiquetaAccion('Saltar', it, nombre)}
                              onClick={() => void hacer({ op: 'saltar-dia', ...datosBase } as unknown as OperacionSemana)}
                            >
                              Saltar esta semana
                            </Boton>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </section>
          );
        })}
      </div>

      <DialogoFija
        abierto={abierto === 'fija'}
        inicial={null}
        disponibles={disponibles}
        ocupado={ocupado}
        onCerrar={cerrar}
        onGuardar={(op) => hacer(op, cerrar)}
      />
      <DialogoSerie
        abierto={abierto === 'serie'}
        inicial={null}
        disponibles={disponibles}
        ocupado={ocupado}
        onCerrar={cerrar}
        onGuardar={(op) => hacer(op, cerrar)}
      />
      <DialogoUnica
        abierto={abierto === 'unica'}
        fechaInicial={lunes}
        disponibles={disponibles}
        ocupado={ocupado}
        onCerrar={cerrar}
        onGuardar={(op) => hacer(op, cerrar)}
      />
      <DialogoDia item={dia} disponibles={disponibles} ocupado={ocupado} onCerrar={() => setDia(null)} onGuardar={(op) => hacer(op, () => setDia(null))} />
      <Dialogo abierto={borrar !== null} titulo="¿Borrar esta transmisión?" onCerrar={() => setBorrar(null)}>
        <div className="pv-dialogo-acciones">
          <Boton variante="secundario" onClick={() => setBorrar(null)}>
            Cancelar
          </Boton>
          <Boton
            variante="peligro"
            ocupado={ocupado}
            onClick={() => borrar?.id && void hacer({ op: 'borrar-unica', id: borrar.id }, () => setBorrar(null))}
          >
            Borrar
          </Boton>
        </div>
      </Dialogo>
    </>
  );
}
