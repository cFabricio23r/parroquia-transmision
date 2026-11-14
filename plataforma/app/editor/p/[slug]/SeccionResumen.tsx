'use client';
// F1 · Resumen (AB/VicEdResumen): una tarjeta por sección con su estado y su frase, los links para
// OBS con «Copiar», «Revisar y publicar» y la última versión publicada.
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { hrefSeccion, SECCIONES } from '../../../../lib/editor/secciones';
import { Boton } from '../../../componentes/Boton';
import { PuntoEstado, TEXTO_ESTADO } from '../../../componentes/PuntoEstado';
import { CabezaSeccion } from './CabezaSeccion';
import { DialogoVersionPublicada } from './DialogoVersionPublicada';
import { useBorrador } from './ProveedorBorrador';

export const TEXTO_RESUMEN = 'Así va la configuración. Cada parte se puede dejar como viene y cambiarla después.';
export const NOTA_LINKS = 'Se pegan una vez en OBS. Después, cada vez que publicas, OBS se actualiza solo en uno o dos minutos.';
export const LINKS_OBS = [
  { etiqueta: 'Pantallas', archivo: 'pantalla.html' },
  { etiqueta: 'Panel de control', archivo: 'panel.html' },
  { etiqueta: 'Rótulos', archivo: 'rotulos.html' },
] as const;

type EstadoCopia = 'listo' | 'copiado' | 'fallo';

function FilaLink({ slug, etiqueta, archivo, anunciar }: { slug: string; etiqueta: string; archivo: string; anunciar(t: string): void }) {
  const [copia, setCopia] = useState<EstadoCopia>('listo');
  const reloj = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(reloj.current), []);
  const copiar = async () => {
    let estado: EstadoCopia = 'copiado';
    try {
      await navigator.clipboard.writeText(`${location.origin}/${slug}/${archivo}`);
      anunciar('Link copiado.');
    } catch {
      estado = 'fallo';
      anunciar('No se pudo copiar');
    }
    setCopia(estado);
    window.clearTimeout(reloj.current);
    reloj.current = window.setTimeout(() => setCopia('listo'), 2000);
  };
  return (
    <div className="pv-resumen-link">
      <div className="pv-resumen-link-texto">
        <span className="pv-resumen-link-etiqueta">{etiqueta}</span>
        <code className="pv-resumen-link-ruta">{`…/${slug}/${archivo}`}</code>
      </div>
      <Boton variante="secundario" compacto className="pv-resumen-copiar" onClick={copiar}>
        {copia === 'copiado' ? 'Copiado' : copia === 'fallo' ? 'No se pudo copiar' : 'Copiar'}
      </Boton>
    </div>
  );
}

export function SeccionResumen() {
  const { borrador, datos, estados } = useBorrador();
  const nombre = (typeof borrador.nombre === 'string' && borrador.nombre.trim()) || datos.nombreParroquia;
  const [anuncio, setAnuncio] = useState('');
  const [verVersion, setVerVersion] = useState(false);
  const tarjetas = SECCIONES.filter((s) => s.conPunto && s.id !== 'resumen' && s.id !== 'publicar');

  return (
    <>
      <CabezaSeccion titulo={nombre} texto={TEXTO_RESUMEN} />
      <ul className="pv-resumen-grilla" aria-label="Partes de la configuración">
        {tarjetas.map((s) => {
          const e = estados[s.id as Exclude<typeof s.id, 'publicar'>];
          return (
            <li key={s.id} className="pv-resumen-tarjeta">
              <div className="pv-resumen-fila">
                <Link href={hrefSeccion(datos.slug, s.id)} className="pv-resumen-titulo">
                  {s.texto}
                </Link>
                <span className="pv-resumen-estado">
                  <PuntoEstado estado={e.estado} />
                  <span aria-hidden="true">{TEXTO_ESTADO[e.estado]}</span>
                </span>
              </div>
              <p className="pv-resumen-frase">{e.frase}</p>
            </li>
          );
        })}
      </ul>
      <section className="pv-resumen-links" aria-labelledby="pv-resumen-links-titulo">
        <h2 id="pv-resumen-links-titulo" className="pv-subtitulo">
          Links para OBS y la app
        </h2>
        <div className="pv-resumen-links-lista">
          {LINKS_OBS.map((l) => (
            <FilaLink key={l.archivo} slug={datos.slug} etiqueta={l.etiqueta} archivo={l.archivo} anunciar={setAnuncio} />
          ))}
        </div>
        <p className="pv-resumen-nota">{NOTA_LINKS}</p>
        <span className="pv-solo-lectores pv-resumen-anuncio" role="status">
          {anuncio}
        </span>
      </section>
      <div className="pv-resumen-botones">
        <Boton href={hrefSeccion(datos.slug, 'publicar')}>Revisar y publicar</Boton>
        {datos.publicada && (
          <Boton variante="secundario" onClick={() => setVerVersion(true)}>
            Ver la última versión publicada
          </Boton>
        )}
      </div>
      {datos.publicada && (
        <DialogoVersionPublicada
          abierto={verVersion}
          onCerrar={() => setVerVersion(false)}
          slug={datos.slug}
          numero={datos.publicada.numero}
          config={datos.publicada.config}
          urls={datos.publicada.urls}
        />
      )}
    </>
  );
}
