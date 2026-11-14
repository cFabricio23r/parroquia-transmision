'use client';
// «Elegir de la galería» (plan 3, Tarea 12): grilla de 4 columnas con las imágenes del borrador.
// Elegir copia `src` y `alt` al campo (Decisión 4).
import Link from 'next/link';
import { imagenesDe, nombreDeImagen, type ImagenGaleria } from '../../../../lib/editor/galeria';
import { hrefSeccion } from '../../../../lib/editor/secciones';
import { Boton } from '../../../componentes/Boton';
import { Dialogo } from '../../../componentes/Dialogo';
import { useBorrador } from './ProveedorBorrador';

export function ElegirDeGaleria({
  abierto,
  onCerrar,
  onElegir,
}: {
  abierto: boolean;
  onCerrar: () => void;
  onElegir: (im: ImagenGaleria) => void;
}) {
  const { borrador, urls, datos } = useBorrador();
  const imagenes = imagenesDe(borrador.galeria);
  return (
    <Dialogo abierto={abierto} titulo="Elegir de la galería" onCerrar={onCerrar} ancho={520}>
      {imagenes.length === 0 ? (
        <p className="pv-elegir-vacia">
          Todavía no hay imágenes en la galería.{' '}
          <Link href={hrefSeccion(datos.slug, 'galeria')} className="pv-enlace" onClick={onCerrar}>
            Ir a Galería
          </Link>
        </p>
      ) : (
        <ul className="pv-elegir-grilla">
          {imagenes.map((im) => (
            <li key={im.id}>
              <button type="button" className="pv-elegir-imagen" onClick={() => onElegir(im)}>
                <span className="pv-elegir-miniatura">{urls[im.src] ? <img alt="" src={urls[im.src]} /> : null}</span>
                <span className="pv-elegir-nombre">{nombreDeImagen(im)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="pv-dialogo-acciones">
        <Boton variante="secundario" onClick={onCerrar}>
          Cancelar
        </Boton>
      </div>
    </Dialogo>
  );
}
