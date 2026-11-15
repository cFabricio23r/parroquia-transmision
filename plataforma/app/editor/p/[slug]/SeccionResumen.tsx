'use client';
// F1 · Resumen (AB/VicEdResumen): una tarjeta por sección con su estado y su frase, los links para
// OBS con «Copiar», «Revisar y publicar» y la última versión publicada. Toda la tarjeta lleva a su
// sección: el enlace del título la cubre (CSS, ::after), así sigue habiendo un solo enlace por tarjeta.
import Link from 'next/link';
import { useState } from 'react';
import { hrefSeccion, SECCIONES, usaBorrador } from '../../../../lib/editor/secciones';
import { Boton } from '../../../componentes/Boton';
import { PuntoEstado, TEXTO_ESTADO } from '../../../componentes/PuntoEstado';
import { CabezaSeccion } from './CabezaSeccion';
import { DialogoVersionPublicada } from './DialogoVersionPublicada';
import { LinksObs } from './LinksObs';
import { useBorrador } from './ProveedorBorrador';

export const TEXTO_RESUMEN = 'Así va la configuración. Cada parte se puede dejar como viene y cambiarla después.';
export const NOTA_LINKS = 'Se pegan una vez en OBS. Después, cada vez que publicas, OBS se actualiza solo en uno o dos minutos.';
export { LINKS_OBS } from '../../../../lib/editor/links-obs';
import { LINKS_OBS } from '../../../../lib/editor/links-obs';

export function SeccionResumen() {
  const { borrador, datos, estados } = useBorrador();
  const nombre = (typeof borrador.nombre === 'string' && borrador.nombre.trim()) || datos.nombreParroquia;
  const [verVersion, setVerVersion] = useState(false);
  const tarjetas = SECCIONES.filter((s) => s.conPunto && s.id !== 'resumen' && usaBorrador(s.id));

  return (
    <>
      <CabezaSeccion titulo={nombre} texto={TEXTO_RESUMEN} />
      <ul className="pv-resumen-grilla" aria-label="Partes de la configuración">
        {tarjetas.map((s) => {
          const e = usaBorrador(s.id) ? estados[s.id] : null;
          if (!e) return null;
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
      <LinksObs slug={datos.slug} links={LINKS_OBS} titulo="Links para OBS y la app" nota={NOTA_LINKS} idTitulo="pv-resumen-links-titulo" />
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
