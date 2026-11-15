'use client';
// F12 · Revisar y publicar (AB/VicEdPublicar): «Antes de publicar», «Qué cambia», el botón, los links
// para OBS y las versiones publicadas con «Volver a esta». Usa solo lo que está en el navegador: la
// lógica del servidor vive en lib/publicar.ts (no se importa aquí). Decisiones 20 a 25 del plan 5.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  LINKS_OBS_PUBLICAR,
  MENSAJE_DESACTIVADA_PUBLICAR,
  mensajeSinGuardar,
  NOTA_VERSIONES,
  revisarParaPublicar,
  textoBloqueo,
  type ItemRevision,
} from '../../../../../lib/editor/revision';
import { hrefSeccion } from '../../../../../lib/editor/secciones';
import { avisoDeHook, estadoDeLlegada } from '../../../../../lib/llegada';
import { Boton } from '../../../../componentes/Boton';
import { Chip } from '../../../../componentes/Chip';
import { Dialogo } from '../../../../componentes/Dialogo';
import { LinksObs } from '../LinksObs';
import { useBorrador } from '../ProveedorBorrador';

type Cuerpo = { numero?: number; hook?: string; errores?: string[]; error?: string };

const MENSAJE_SIN_CONEXION = 'No hay conexión con el servidor. Revisa tu internet e intenta de nuevo';
const TEXTO_PUNTO: Record<ItemRevision['tono'], string> = { rojo: 'Bloquea', ambar: 'Aviso', verde: 'Listo' };
const TODO_LISTO: ItemRevision = { titulo: 'Todo listo', detalle: 'No hay nada que corregir.', seccion: 'resumen', enlace: null, tono: 'verde' };

/**
 * Lo que dice la línea de estado sobre las pantallas (Decisión 22), sin repetir «Publicaste…»: la
 * parte de `estadoDeLlegada` que va después del «;», o nada si ya llegó.
 */
function llegada(enPantallas: number | null, ultima: number): string | null {
  if (enPantallas !== null && enPantallas >= ultima) return null;
  const t = estadoDeLlegada(enPantallas, ultima);
  const resto = t.includes('; ') ? t.slice(t.indexOf('; ') + 2) : t;
  return `${resto.charAt(0).toUpperCase()}${resto.slice(1)}.`;
}

function FilaRevision({ item, slug }: { item: ItemRevision; slug: string }) {
  return (
    <li className="pv-publicar-revision-fila">
      <span className={`pv-publicar-punto pv-publicar-punto--${item.tono}`}>
        <span className="pv-solo-lectores">{TEXTO_PUNTO[item.tono]}</span>
      </span>
      <span className="pv-publicar-revision-texto">
        <b>{item.titulo}</b>
        {item.detalle && <span className="pv-publicar-revision-detalle">{item.detalle}</span>}
      </span>
      {item.enlace && (
        <Link href={hrefSeccion(slug, item.seccion)} className="pv-publicar-enlace">
          {item.enlace}
        </Link>
      )}
    </li>
  );
}

export function PaginaPublicar() {
  const { datos, guardado, formularios, estados, cambios } = useBorrador();
  const router = useRouter();
  const slug = datos.slug;
  const versiones = datos.versiones;
  const ultima = versiones.length ? Math.max(...versiones.map((v) => v.numero)) : null;

  // undefined: todavía comprobando; null: las pantallas no respondieron o dieron 404.
  const [enPantallas, setEnPantallas] = useState<number | null | undefined>(undefined);
  const [ocupado, setOcupado] = useState(false);
  const enCurso = useRef(false);
  const [publicada, setPublicada] = useState<number | null>(null);
  const [aviso, setAviso] = useState<string>();
  const [error, setError] = useState<{ texto: string; lista: string[] } | null>(null);
  const [restaurar, setRestaurar] = useState<number | null>(null);
  const alerta = useRef<HTMLDivElement>(null);

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
    if (error) alerta.current?.focus();
  }, [error]);

  const revision = revisarParaPublicar(estados, guardado.errores);
  const formularioSucio = Object.values(formularios).some((f) => f.sucio);
  const sinGuardar = guardado.estado !== 'guardado' || formularioSucio;
  const k = revision.errores.length;
  // Prioridad (Decisión 21): desactivada, después sin guardar, después errores.
  const bloqueo = datos.desactivada ? MENSAJE_DESACTIVADA_PUBLICAR : sinGuardar ? mensajeSinGuardar(guardado.estado, formularioSucio) : k > 0 ? textoBloqueo(k) : null;

  async function enviar(ruta: 'publicar' | 'restaurar', cuerpo?: object) {
    // aria-disabled no frena el clic: lo frena esto (y el botón no pierde el foco).
    if (enCurso.current) return;
    if (ruta === 'publicar' && bloqueo) return;
    if (ruta === 'restaurar' && datos.desactivada) return;
    enCurso.current = true;
    setOcupado(true);
    setError(null);
    setAviso(undefined);
    try {
      const r = await fetch(`/editor/api/${slug}/${ruta}`, {
        method: 'POST',
        headers: cuerpo ? { 'Content-Type': 'application/json' } : undefined,
        body: cuerpo ? JSON.stringify(cuerpo) : undefined,
      });
      const d = (await r.json().catch(() => ({}))) as Cuerpo;
      if (r.ok) {
        setPublicada(typeof d.numero === 'number' ? d.numero : null);
        setAviso(avisoDeHook(d.hook, process.env.NODE_ENV));
        router.refresh();
      } else if (d.errores?.length) {
        setError({
          texto: ruta === 'publicar' ? 'No se puede publicar todavía.' : 'No se puede volver a esa versión todavía.',
          lista: d.errores,
        });
      } else {
        setError({ texto: d.error ?? 'No se pudo completar. Intenta de nuevo', lista: [] });
      }
    } catch {
      setError({ texto: MENSAJE_SIN_CONEXION, lista: [] });
    } finally {
      enCurso.current = false;
      setOcupado(false);
    }
  }

  const noLlego = ultima !== null && enPantallas !== undefined && (enPantallas === null || enPantallas < ultima);
  const textoLlegada = ultima !== null && enPantallas !== undefined ? llegada(enPantallas, ultima) : null;
  const lineaEstado = [publicada !== null ? `Publicaste la versión ${publicada}.` : null, textoLlegada, aviso ?? null].filter(Boolean).join(' ');
  const frases = cambios.flatMap((c) => c.frases);
  const vacia = revision.errores.length === 0 && revision.avisos.length === 0;

  return (
    <div className="pv-publicar">
      <section className="pv-publicar-izquierda" aria-labelledby="pv-publicar-titulo">
        <div className="pv-seccion-cabeza">
          <h1 id="pv-publicar-titulo" className="pv-seccion-titulo">
            Revisar y publicar
          </h1>
        </div>

        <section className="pv-publicar-tarjeta pv-publicar-tarjeta--lista" aria-labelledby="pv-publicar-antes">
          <h2 id="pv-publicar-antes" className="pv-subtitulo">
            Antes de publicar
          </h2>
          <ul className="pv-publicar-revision">
            {revision.errores.map((it, i) => (
              <FilaRevision key={`e${i}`} item={it} slug={slug} />
            ))}
            {revision.avisos.map((it, i) => (
              <FilaRevision key={`a${i}`} item={it} slug={slug} />
            ))}
            {vacia && <FilaRevision item={TODO_LISTO} slug={slug} />}
          </ul>
        </section>

        <section className="pv-publicar-tarjeta pv-publicar-tarjeta--cambios" aria-labelledby="pv-publicar-cambia">
          <h2 id="pv-publicar-cambia" className="pv-subtitulo">
            {datos.publicada ? `Qué cambia respecto a la versión ${datos.publicada.numero}` : 'Qué se publica'}
          </h2>
          {!datos.publicada ? (
            <p className="pv-publicar-nada">Es la primera versión: se publica todo lo que configuraste.</p>
          ) : frases.length === 0 ? (
            <p className="pv-publicar-nada">No hay cambios respecto a la versión {datos.publicada.numero}.</p>
          ) : (
            <ul className="pv-publicar-cambios">
              {frases.map((f, i) => (
                <li key={i}>
                  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24">
                    <path d="M5 12l5 5 9-10" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>
          )}
        </section>

        {error && (
          <div ref={alerta} role="alert" tabIndex={-1} className="pv-publicar-error">
            <p>{error.texto}</p>
            {error.lista.length > 0 && (
              <ul>
                {error.lista.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="pv-publicar-boton">
          <Boton
            ocupado={ocupado}
            aria-disabled={ocupado || !!bloqueo}
            aria-describedby={bloqueo ? 'pv-publicar-bloqueo' : undefined}
            onClick={() => void enviar('publicar')}
          >
            {ocupado ? 'Publicando…' : `Publicar versión ${datos.siguienteVersion}`}
          </Boton>
          {bloqueo && (
            <span id="pv-publicar-bloqueo" className="pv-publicar-bloqueo">
              {bloqueo}
            </span>
          )}
        </div>
        <div className="pv-publicar-estado-fila">
          <p role="status" className="pv-publicar-estado">
            {lineaEstado}
          </p>
          {noLlego && (
            <Boton variante="secundario" compacto onClick={() => void comprobar()}>
              Comprobar de nuevo
            </Boton>
          )}
        </div>
      </section>

      <div className="pv-publicar-derecha">
        <LinksObs
          slug={slug}
          links={LINKS_OBS_PUBLICAR}
          titulo="Links para OBS"
          idTitulo="pv-publicar-links"
          className="pv-publicar-tarjeta pv-publicar-links"
          claseTitulo="pv-subtitulo"
        />
        <section className="pv-publicar-tarjeta pv-publicar-tarjeta--lista" aria-labelledby="pv-publicar-versiones">
          <h2 id="pv-publicar-versiones" className="pv-subtitulo">
            Versiones publicadas
          </h2>
          {versiones.length === 0 ? (
            <p className="pv-publicar-nada pv-publicar-nada--versiones">Todavía no has publicado ninguna versión.</p>
          ) : (
            <>
              <ul className="pv-publicar-versiones">
                {versiones.map((v) => (
                  <li key={v.numero} className="pv-publicar-version">
                    <b>v{v.numero}</b>
                    <span className="pv-publicar-version-texto">
                      {v.quien} · {v.fecha}
                      {v.origen !== null && ` · copia de la v${v.origen}`}
                    </span>
                    {enPantallas === v.numero ? (
                      <Chip tono="verde">En OBS ahora</Chip>
                    ) : (
                      <button
                        type="button"
                        className="pv-publicar-volver"
                        aria-label={`Volver a la versión ${v.numero}`}
                        aria-disabled={ocupado || datos.desactivada || undefined}
                        onClick={() => {
                          if (enCurso.current || datos.desactivada) return;
                          setRestaurar(v.numero);
                        }}
                      >
                        Volver a esta
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              <p className="pv-publicar-nota">{NOTA_VERSIONES}</p>
            </>
          )}
        </section>
      </div>

      <Dialogo abierto={restaurar !== null} titulo={`Volver a la versión ${restaurar ?? ''}`} onCerrar={() => setRestaurar(null)}>
        <p className="pv-dialogo-texto">Se publica de nuevo la versión {restaurar} como versión nueva. Tu borrador no cambia.</p>
        <div className="pv-dialogo-acciones">
          <Boton variante="secundario" onClick={() => setRestaurar(null)}>
            Cancelar
          </Boton>
          <Boton
            ocupado={ocupado}
            onClick={() => {
              const n = restaurar;
              setRestaurar(null);
              if (n !== null) void enviar('restaurar', { numero: n });
            }}
          >
            Sí, volver a esta
          </Boton>
        </div>
      </Dialogo>
    </div>
  );
}
