'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { chipParroquia, textoCoordinadores, type FilaParroquia } from '../../../lib/admin-textos';
import type { EstadoHook } from '../../../lib/despliegue';
import { Boton } from '../../componentes/Boton';
import { CajaInfo } from '../../componentes/CajaInfo';
import { Chip } from '../../componentes/Chip';
import { Dialogo } from '../../componentes/Dialogo';
import { Tabla } from '../../componentes/Tabla';
import { useEnvio } from '../../componentes/useEnvio';
import { desactivar, reactivar } from './acciones';
import { DialogoNuevaParroquia, MENSAJE_SIN_CONEXION } from './DialogoNuevaParroquia';

const COLUMNAS = [
  { titulo: 'Parroquia', ancho: '2.2fr' },
  { titulo: 'Link', ancho: '1.4fr' },
  { titulo: 'Estado', ancho: '1.1fr' },
  { titulo: 'Coordinadores', ancho: '1.5fr' },
  { titulo: '', ancho: '230px' },
];

/** Decisión 5 del plan 5: si el aviso a Vercel falla se dice en el anuncio, sin error rojo. */
function anuncioHook(hook: EstadoHook | undefined, desactivada: boolean): string | null {
  if (hook !== 'fallo') return null;
  return `${desactivada ? 'Quedó desactivada' : 'Quedó reactivada'}, pero no se pudo pedir el despliegue: las pantallas siguen hasta el próximo despliegue.`;
}

/** D1 · la cabeza, la tabla de parroquias, sus diálogos y los anuncios. */
export function TablaParroquias({ filas }: { filas: FilaParroquia[] }) {
  const router = useRouter();
  const [nuevaAbierta, setNuevaAbierta] = useState(false);
  const [aDesactivar, setADesactivar] = useState<FilaParroquia | null>(null);
  const [anuncio, setAnuncio] = useState<ReactNode>(null);
  const [error, setError] = useState<string | null>(null);
  // Ronda 2: al desactivar o reactivar, el botón que se usó desaparece (la fila cambia y se mueve).
  // El foco va al botón nuevo de esa fila en cuanto la tabla refrescada lo trae, en vez de caer al <body>.
  const [enfocar, setEnfocar] = useState<string | null>(null);
  const { ocupado, enviar } = useEnvio();

  useEffect(() => {
    if (!enfocar) return;
    const boton = [...document.querySelectorAll<HTMLElement>('main [aria-label]')].find((e) => e.getAttribute('aria-label') === enfocar);
    if (!boton) return;
    boton.focus();
    setEnfocar(null);
  }, [enfocar, filas]);

  async function cambiar(f: FilaParroquia, apagar: boolean) {
    setError(null);
    setAnuncio(null);
    const r = await enviar(() => (apagar ? desactivar(f.id) : reactivar(f.id)));
    if (r.tipo === 'ocupado') return;
    setADesactivar(null);
    if (r.tipo === 'fallo') return setError(MENSAJE_SIN_CONEXION);
    if (r.valor.error) return setError(r.valor.error);
    setAnuncio(
      anuncioHook(r.valor.hook, apagar) ??
        (apagar ? `${f.nombre} quedó desactivada.` : `${f.nombre} está activa otra vez. Vuelve a salir en OBS después del próximo despliegue.`),
    );
    setEnfocar(`${apagar ? 'Reactivar' : 'Desactivar'} ${f.nombre}`);
    router.refresh();
  }

  return (
    <>
      <div className="pv-admin-cabeza">
        <h1 className="pv-admin-titulo">Parroquias de la vicaría</h1>
        <Boton onClick={() => setNuevaAbierta(true)}>+ Nueva parroquia</Boton>
      </div>
      <p role="status" className="pv-admin-anuncio">
        {anuncio}
      </p>
      {error && (
        <p role="alert" className="pv-alerta pv-admin-alerta">
          {error}
        </p>
      )}
      <Tabla
        etiqueta="Parroquias de la vicaría"
        columnas={COLUMNAS}
        filas={filas.map((f) => {
          const chip = chipParroquia(f.estado);
          const apagada = f.estado.clave === 'desactivada';
          return {
            clave: f.id,
            celdas: [
              <span key="n" className={apagada ? 'pv-admin-nombre pv-admin-nombre--apagada' : 'pv-admin-nombre'}>
                <b>{f.nombre}</b>
                {f.lugar && <span className="pv-admin-sub">{f.lugar}</span>}
              </span>,
              <span key="s" className="pv-admin-slug">
                {f.slug}
              </span>,
              <Chip key="e" tono={chip.tono}>
                {chip.texto}
              </Chip>,
              <span key="c">{textoCoordinadores(f)}</span>,
              <span key="a" className="pv-admin-acciones">
                {apagada ? (
                  <Boton variante="secundario" compacto aria-label={`Reactivar ${f.nombre}`} ocupado={ocupado} onClick={() => cambiar(f, false)}>
                    Reactivar
                  </Boton>
                ) : (
                  <>
                    <Boton variante="secundario" compacto href={`/editor/p/${f.slug}`} aria-label={`Ver ${f.nombre}`}>
                      Ver
                    </Boton>
                    <Boton variante="peligro" compacto aria-label={`Desactivar ${f.nombre}`} onClick={() => setADesactivar(f)}>
                      Desactivar
                    </Boton>
                  </>
                )}
              </span>,
            ],
          };
        })}
      />
      {filas.length === 0 && <p className="pv-admin-nota">Todavía no hay parroquias.</p>}
      <CajaInfo>
        «Ver» abre el editor de esa parroquia, para que el admin pueda ayudar a configurarla. Desactivar no borra nada: el link deja de
        funcionar y sus coordinadores pierden el acceso. Se puede reactivar.
      </CajaInfo>

      <DialogoNuevaParroquia
        abierto={nuevaAbierta}
        onCerrar={() => setNuevaAbierta(false)}
        alCrear={(nombre, slug) => {
          setError(null);
          setAnuncio(
            <>
              Creaste {nombre}. Ahora puedes invitar a quien la va a configurar.
              <Link href={`/editor/admin/coordinadores?parroquia=${encodeURIComponent(slug)}`}>Invitar coordinador</Link>
            </>,
          );
          router.refresh();
        }}
      />
      <Dialogo abierto={aDesactivar !== null} titulo="Desactivar parroquia" onCerrar={() => setADesactivar(null)}>
        <p className="pv-dialogo-texto">
          ¿Desactivar «{aDesactivar?.nombre}»? Desactivar no borra nada: el link deja de funcionar y sus coordinadores pierden el acceso. Se
          puede reactivar.
        </p>
        <div className="pv-dialogo-acciones">
          <Boton variante="secundario" onClick={() => setADesactivar(null)}>
            Cancelar
          </Boton>
          <Boton variante="peligro" ocupado={ocupado} onClick={() => aDesactivar && cambiar(aDesactivar, true)}>
            Sí, desactivar
          </Boton>
        </div>
      </Dialogo>
    </>
  );
}
