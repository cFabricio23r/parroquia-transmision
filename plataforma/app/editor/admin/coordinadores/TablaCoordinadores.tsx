'use client';
import Link from 'next/link';
import { unstable_rethrow, useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { chipCoordinador, type FilaCoordinador } from '../../../../lib/admin-textos';
import { ultimaEntrada } from '../../../../lib/fecha';
import { Boton } from '../../../componentes/Boton';
import { Chip } from '../../../componentes/Chip';
import { Dialogo } from '../../../componentes/Dialogo';
import { Tabla } from '../../../componentes/Tabla';
import { useEnvio } from '../../../componentes/useEnvio';
import { anular, asignarParroquia, quitarAcceso, reenviar } from '../acciones';
import { MENSAJE_SIN_CONEXION } from '../DialogoNuevaParroquia';
import { DialogoAsignar } from './DialogoAsignar';
import { DialogoInvitar, type OpcionParroquia } from './DialogoInvitar';

const COLUMNAS = [
  { titulo: 'Persona', ancho: '2.2fr' },
  { titulo: 'Asignado a', ancho: '1.4fr' },
  { titulo: 'Estado', ancho: '1.1fr' },
  { titulo: 'Última entrada', ancho: '1.5fr' },
  { titulo: '', ancho: '230px' },
];

const persona = (f: FilaCoordinador) => f.nombre ?? f.correo;

/**
 * D2 · la cabeza, la tabla de coordinadores (miembros e invitaciones pendientes), sus diálogos y los
 * anuncios. `membresias` son las parroquias de cada usuario en toda la vicaría (no solo las del filtro),
 * para que «Asignar» ofrezca únicamente las activas que le faltan.
 */
export function TablaCoordinadores({
  filas,
  activas,
  membresias,
  filtro,
}: {
  filas: FilaCoordinador[];
  activas: OpcionParroquia[];
  membresias: Record<string, string[]>;
  filtro: { id: string; nombre: string } | null;
}) {
  const router = useRouter();
  const [invitarAbierto, setInvitarAbierto] = useState(false);
  const [aAsignar, setAAsignar] = useState<FilaCoordinador | null>(null);
  const [aQuitar, setAQuitar] = useState<FilaCoordinador | null>(null);
  const [aAnular, setAAnular] = useState<FilaCoordinador | null>(null);
  const [anuncio, setAnuncio] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorAsignar, setErrorAsignar] = useState<string | null>(null);
  const { ocupado, enviar } = useEnvio();
  // «Reenviar» va por invitación (revisión fix2): reenviar una no deja ocupados los botones de las demás.
  const [reenviando, setReenviando] = useState<ReadonlySet<string>>(new Set());
  const enCurso = useRef(new Set<string>());

  async function reenviarFila(f: FilaCoordinador) {
    const id = f.invitacionId;
    if (!id || enCurso.current.has(id)) return;
    enCurso.current.add(id);
    setReenviando(new Set(enCurso.current));
    setError(null);
    setAnuncio(null);
    try {
      const r = await reenviar(id);
      if (r.error) return setError(r.error);
      setAnuncio(`Le enviamos una invitación nueva a ${r.correo ?? f.correo}.`);
      router.refresh();
    } catch (e) {
      unstable_rethrow(e);
      setError(MENSAJE_SIN_CONEXION);
    } finally {
      enCurso.current.delete(id);
      setReenviando(new Set(enCurso.current));
    }
  }

  async function ejecutar(accion: () => Promise<{ error?: string; correo?: string }>, exito: (correo?: string) => string | null, cerrar: () => void) {
    setError(null);
    setAnuncio(null);
    const r = await enviar(accion);
    if (r.tipo === 'ocupado') return;
    cerrar();
    if (r.tipo === 'fallo') return setError(MENSAJE_SIN_CONEXION);
    if (r.valor.error) return setError(r.valor.error);
    setAnuncio(exito(r.valor.correo));
    router.refresh();
  }

  async function asignarA(parroquiaId: string) {
    if (!aAsignar?.usuarioId) return;
    setErrorAsignar(null);
    const usuarioId = aAsignar.usuarioId;
    const r = await enviar(() => asignarParroquia(usuarioId, parroquiaId));
    if (r.tipo === 'ocupado') return;
    if (r.tipo === 'fallo') return setErrorAsignar(MENSAJE_SIN_CONEXION);
    if (r.valor.error) return setErrorAsignar(r.valor.error);
    const nombre = activas.find((p) => p.id === parroquiaId)?.nombre;
    setAAsignar(null);
    setError(null);
    setAnuncio(`${persona(aAsignar)} ahora también coordina ${nombre ?? 'esa parroquia'}.`);
    router.refresh();
  }

  const opcionesAsignar = aAsignar?.usuarioId
    ? activas.filter((p) => !(membresias[aAsignar.usuarioId as string] ?? []).includes(p.id))
    : [];

  return (
    <>
      <div className="pv-admin-cabeza">
        <h1 className="pv-admin-titulo">Coordinadores</h1>
        <Boton onClick={() => setInvitarAbierto(true)}>+ Invitar coordinador</Boton>
      </div>
      {filtro && (
        <p className="pv-admin-filtro">
          Solo {filtro.nombre}. <Link href="/editor/admin/coordinadores">Ver todas</Link>
        </p>
      )}
      <p role="status" className="pv-admin-anuncio">
        {anuncio}
      </p>
      {error && (
        <p role="alert" className="pv-alerta pv-admin-alerta">
          {error}
        </p>
      )}
      <Tabla
        etiqueta="Coordinadores"
        columnas={COLUMNAS}
        filas={filas.map((f) => {
          const chip = chipCoordinador(f.estado);
          return {
            clave: f.clave,
            celdas: [
              <span key="n" className="pv-admin-nombre">
                <b>{f.nombre ?? f.correo}</b>
                {f.nombre && <span className="pv-admin-sub">{f.correo}</span>}
              </span>,
              <span key="p">{f.parroquiaNombre}</span>,
              <Chip key="e" tono={chip.tono}>
                {chip.texto}
              </Chip>,
              <span key="u" className="pv-admin-cuando">
                {f.tipo === 'miembro' ? ultimaEntrada(f.ultimaEntrada) : '—'}
              </span>,
              <span key="a" className="pv-admin-acciones">
                {f.tipo === 'miembro' ? (
                  <>
                    <Boton variante="secundario" compacto aria-label={`Asignar a ${persona(f)}`} onClick={() => setAAsignar(f)}>
                      Asignar
                    </Boton>
                    <Boton variante="peligro" compacto aria-label={`Quitar a ${persona(f)} de ${f.parroquiaNombre}`} onClick={() => setAQuitar(f)}>
                      Quitar
                    </Boton>
                  </>
                ) : (
                  <>
                    {/* Con la parroquia desactivada, reenviar fallaría: no se ofrece (revisión fix2). Quitar sí sirve. */}
                    {f.estado !== 'parroquia-desactivada' && (
                      <Boton
                        variante="secundario"
                        compacto
                        ocupado={reenviando.has(f.invitacionId as string)}
                        aria-label={`Reenviar la invitación de ${f.correo} a ${f.parroquiaNombre}`}
                        onClick={() => void reenviarFila(f)}
                      >
                        Reenviar
                      </Boton>
                    )}
                    <Boton
                      variante="peligro"
                      compacto
                      aria-label={`Quitar la invitación de ${f.correo} a ${f.parroquiaNombre}`}
                      onClick={() => setAAnular(f)}
                    >
                      Quitar
                    </Boton>
                  </>
                )}
              </span>,
            ],
          };
        })}
      />
      {filas.length === 0 && <p className="pv-admin-nota">Todavía no hay coordinadores.</p>}

      <DialogoInvitar
        abierto={invitarAbierto}
        onCerrar={() => setInvitarAbierto(false)}
        parroquias={activas}
        elegida={filtro && activas.some((p) => p.id === filtro.id) ? filtro.id : undefined}
        alInvitar={(correo) => {
          setError(null);
          setAnuncio(`Le enviamos la invitación a ${correo}.`);
          router.refresh();
        }}
      />
      <DialogoAsignar
        persona={aAsignar ? persona(aAsignar) : null}
        opciones={opcionesAsignar}
        ocupado={ocupado}
        error={errorAsignar}
        onCerrar={() => {
          setAAsignar(null);
          setErrorAsignar(null);
        }}
        onAsignar={asignarA}
      />
      <Dialogo abierto={aQuitar !== null} titulo="Quitar acceso" onCerrar={() => setAQuitar(null)}>
        <p className="pv-dialogo-texto">
          ¿Quitar a {aQuitar ? persona(aQuitar) : ''} de {aQuitar?.parroquiaNombre}? Deja de poder editar y publicar esa parroquia.
        </p>
        <div className="pv-dialogo-acciones">
          <Boton variante="secundario" onClick={() => setAQuitar(null)}>
            Cancelar
          </Boton>
          <Boton
            variante="peligro"
            ocupado={ocupado}
            onClick={() => {
              const f = aQuitar;
              if (!f?.usuarioId) return;
              ejecutar(
                () => quitarAcceso(f.parroquiaId, f.usuarioId as string),
                () => `${persona(f)} ya no coordina ${f.parroquiaNombre}.`,
                () => setAQuitar(null),
              );
            }}
          >
            Sí, quitar
          </Boton>
        </div>
      </Dialogo>
      <Dialogo abierto={aAnular !== null} titulo="Anular invitación" onCerrar={() => setAAnular(null)}>
        <p className="pv-dialogo-texto">
          ¿Anular la invitación de {aAnular?.correo} a {aAnular?.parroquiaNombre}? El enlace deja de servir.
        </p>
        <div className="pv-dialogo-acciones">
          <Boton variante="secundario" onClick={() => setAAnular(null)}>
            Cancelar
          </Boton>
          <Boton
            variante="peligro"
            ocupado={ocupado}
            onClick={() => {
              const f = aAnular;
              if (!f?.invitacionId) return;
              ejecutar(
                () => anular(f.invitacionId as string),
                () => `Anulaste la invitación de ${f.correo}.`,
                () => setAAnular(null),
              );
            }}
          >
            Sí, anular
          </Boton>
        </div>
      </Dialogo>
    </>
  );
}
