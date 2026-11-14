'use client';
// Los links para pegar en OBS, con «Copiar» y un anuncio para lectores de pantalla. Los usan F1
// (Resumen) y F12 (Revisar y publicar), cada una con sus etiquetas (Decisión 25 del plan 5).
import { useEffect, useRef, useState } from 'react';
import { Boton } from '../../../componentes/Boton';

type EstadoCopia = 'listo' | 'copiado' | 'fallo';

export interface LinkObs {
  etiqueta: string;
  archivo: string;
}

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

export function LinksObs({
  slug,
  links,
  titulo,
  nota,
  idTitulo,
  className = 'pv-resumen-links',
  claseTitulo = 'pv-subtitulo',
}: {
  slug: string;
  links: readonly LinkObs[];
  titulo: string;
  nota?: string;
  idTitulo: string;
  className?: string;
  claseTitulo?: string;
}) {
  const [anuncio, setAnuncio] = useState('');
  return (
    <section className={className} aria-labelledby={idTitulo}>
      <h2 id={idTitulo} className={claseTitulo}>
        {titulo}
      </h2>
      <div className="pv-resumen-links-lista">
        {links.map((l) => (
          <FilaLink key={l.archivo} slug={slug} etiqueta={l.etiqueta} archivo={l.archivo} anunciar={setAnuncio} />
        ))}
      </div>
      {nota && <p className="pv-resumen-nota">{nota}</p>}
      <span className="pv-solo-lectores pv-resumen-anuncio" role="status">
        {anuncio}
      </span>
    </section>
  );
}
