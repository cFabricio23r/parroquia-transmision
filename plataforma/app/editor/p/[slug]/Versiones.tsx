'use client';
// Publicar, ver las versiones publicadas y volver a una anterior. Usa solo lo que está en el
// navegador: la lógica del servidor vive en lib/publicar.ts (no se importa aquí).
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { estadoDeLlegada } from '../../../../lib/llegada';
import { Resumen } from '../../formularios';

export interface VersionPublicada {
  numero: number;
  /** Ya formateada en el servidor (hora de El Salvador): así no hay diferencias al hidratar. */
  fecha: string;
  quien: string;
  origen: number | null;
}

type Cuerpo = { numero?: number; hook?: string; errores?: string[]; error?: string };

const AVISO_HOOK =
  'La versión quedó publicada, pero no se pudo avisar para que las pantallas se actualicen. Avisa al administrador.';

export function Versiones({ slug, versiones }: { slug: string; versiones: VersionPublicada[] }) {
  const router = useRouter();
  const ultima = versiones.length ? Math.max(...versiones.map((v) => v.numero)) : null;
  // undefined: todavía comprobando; null: las pantallas no respondieron o dieron 404.
  const [enPantallas, setEnPantallas] = useState<number | null | undefined>(undefined);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string>();
  const [aviso, setAviso] = useState<string>();
  const [restaurando, setRestaurando] = useState<number | null>(null);
  const dialogo = useRef<HTMLDialogElement>(null);
  const disparador = useRef<HTMLElement | null>(null);
  const cancelar = useRef<HTMLButtonElement>(null);

  const comprobar = useCallback(async () => {
    setEnPantallas(undefined);
    try {
      const r = await fetch(`/${slug}/config.json`, { cache: 'no-store' });
      if (!r.ok) return setEnPantallas(null);
      const cuerpo = (await r.json()) as { version?: unknown };
      setEnPantallas(Number.isInteger(cuerpo.version) ? (cuerpo.version as number) : null);
    } catch {
      setEnPantallas(null);
    }
  }, [slug]);
  // Al abrir la página y cada vez que cambia la última versión (después de publicar o restaurar).
  useEffect(() => {
    void comprobar();
  }, [comprobar, ultima]);

  useEffect(() => {
    if (restaurando === null) return;
    dialogo.current?.showModal();
    cancelar.current?.focus(); // el foco empieza en lo que no publica nada
  }, [restaurando]);

  async function enviar(ruta: 'publicar' | 'restaurar', cuerpo?: object) {
    setError(undefined);
    setAviso(undefined);
    setOcupado(true);
    try {
      const r = await fetch(`/editor/api/${slug}/${ruta}`, {
        method: 'POST',
        headers: cuerpo ? { 'Content-Type': 'application/json' } : undefined,
        body: cuerpo ? JSON.stringify(cuerpo) : undefined,
      });
      const datos = (await r.json().catch(() => ({}))) as Cuerpo;
      if (r.ok) {
        if (datos.hook === 'fallo') setAviso(AVISO_HOOK);
        router.refresh();
      } else if (datos.errores?.length) {
        setError(`No se puede ${ruta === 'publicar' ? 'publicar' : 'volver a esa versión'} todavía. ${datos.errores.join(' ')}`);
      } else {
        setError(datos.error ?? 'No se pudo completar. Intenta de nuevo');
      }
    } catch {
      setError('No hay conexión con el servidor. Revisa tu internet e intenta de nuevo');
    } finally {
      setOcupado(false);
    }
  }

  const pedirRestaurar = (numero: number, el: HTMLElement) => {
    disparador.current = el;
    setRestaurando(numero);
  };
  function confirmarRestaurar() {
    const numero = restaurando;
    dialogo.current?.close();
    if (numero !== null) void enviar('restaurar', { numero });
  }

  const estado =
    ultima !== null && enPantallas === undefined
      ? 'Comprobando si ya llegó a las pantallas…'
      : estadoDeLlegada(enPantallas ?? null, ultima);

  return (
    <section aria-labelledby="publicar-titulo" className="publicar">
      <h2 id="publicar-titulo">Publicar</h2>
      <p className="ayuda">Se publica lo último que guardaste como borrador. Si escribiste algo y no lo guardaste, guárdalo antes.</p>
      <Resumen mensaje={error} />
      <button className="boton" type="button" onClick={() => void enviar('publicar')} disabled={ocupado}>
        {ocupado ? 'Publicando…' : 'Publicar'}
      </button>

      <div role="status" className="aviso estado-llegada">
        <p>{estado}</p>
        {aviso && <p>{aviso}</p>}
      </div>
      {ultima !== null && (
        <button className="boton boton-corto boton-neutro" type="button" onClick={() => void comprobar()}>
          Comprobar de nuevo
        </button>
      )}

      <h2 id="versiones-titulo">Versiones publicadas</h2>
      {versiones.length === 0 ? (
        <p>Todavía no has publicado ninguna versión.</p>
      ) : (
        <table className="versiones" aria-labelledby="versiones-titulo">
          <thead>
            <tr>
              <th scope="col">Versión</th>
              <th scope="col">Fecha</th>
              <th scope="col">Quién</th>
              <th scope="col">
                <span className="solo-lectores">Acción</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {versiones.map((v) => (
              <tr key={v.numero}>
                <th scope="row">
                  {v.numero}
                  {v.origen !== null && <span className="ayuda"> (copia de la versión {v.origen})</span>}
                </th>
                <td>{v.fecha}</td>
                <td>{v.quien}</td>
                <td>
                  <button
                    type="button"
                    className="boton boton-corto boton-neutro"
                    aria-label={`Volver a esta versión: la ${v.numero}`}
                    disabled={ocupado}
                    onClick={(e) => pedirRestaurar(v.numero, e.currentTarget)}
                  >
                    Volver a esta versión
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <dialog
        ref={dialogo}
        className="dialogo"
        aria-labelledby="dialogo-titulo"
        aria-describedby="dialogo-texto"
        onClose={() => {
          setRestaurando(null);
          disparador.current?.focus();
        }}
      >
        <h2 id="dialogo-titulo">Volver a la versión {restaurando}</h2>
        <p id="dialogo-texto">Se publica de nuevo la versión {restaurando} como versión nueva. Tu borrador no cambia</p>
        <div className="acciones-dialogo">
          <button type="button" className="boton boton-corto" onClick={confirmarRestaurar}>
            Sí, volver a esta versión
          </button>
          <button ref={cancelar} type="button" className="boton boton-corto boton-neutro" onClick={() => dialogo.current?.close()}>
            Cancelar
          </button>
        </div>
      </dialog>
    </section>
  );
}
