'use client';
// F9 · Galería (AB/VicEdGaleria): filtros por etiqueta, grilla de 6 columnas (cada tarjeta abre
// «Editar imagen») y «+ Subir imagen».
import { useState } from 'react';
import { ETIQUETAS_GALERIA, etiquetaDe, filtrar, imagenesDe, MAX_GALERIA, nombreDeImagen, type ImagenGaleria } from '../../../../../lib/editor/galeria';
import { Boton } from '../../../../componentes/Boton';
import { Chip } from '../../../../componentes/Chip';
import { useBorrador } from '../ProveedorBorrador';
import { DialogoEditarImagen } from './DialogoEditarImagen';
import { DialogoSubir } from './DialogoSubir';

export const TEXTO_GALERIA = 'Las imágenes que usan las pantallas y los tipos de transmisión.';
export const NOTA_CUSTODIA = 'La custodia común de la Pastoral está siempre disponible, aunque no subas una propia.';
export const TEXTO_VACIA = 'Todavía no hay imágenes. Sube la primera con «+ Subir imagen».';

const FILTROS: { valor: string | null; texto: string }[] = [{ valor: null, texto: 'Todas' }, ...ETIQUETAS_GALERIA];

export function SeccionGaleria() {
  const { borrador, urls } = useBorrador();
  const imagenes = imagenesDe(borrador.galeria);
  const [filtro, setFiltro] = useState<string | null>(null);
  const [subir, setSubir] = useState(false);
  const [editar, setEditar] = useState<ImagenGaleria | null>(null);
  const lleno = imagenes.length >= MAX_GALERIA;
  const visibles = filtrar(imagenes, filtro);

  return (
    <>
      <div className="pv-galeria-cabeza">
        <div className="pv-seccion-cabeza">
          <h1 className="pv-seccion-titulo">Galería</h1>
          <p className="pv-seccion-texto">{TEXTO_GALERIA}</p>
        </div>
        <div className="pv-galeria-subir">
          <Boton ocupado={lleno} aria-describedby={lleno ? 'pv-galeria-lleno' : undefined} onClick={() => !lleno && setSubir(true)}>
            + Subir imagen
          </Boton>
          {lleno && (
            <span id="pv-galeria-lleno" className="pv-nota-campo">
              Hasta 30 imágenes.
            </span>
          )}
        </div>
      </div>
      <div className="pv-filtros" role="group" aria-label="Filtrar por etiqueta">
        {FILTROS.map((e) => (
          <button
            key={e.texto}
            type="button"
            className={filtro === e.valor ? 'pv-filtro pv-filtro--activo' : 'pv-filtro'}
            aria-pressed={filtro === e.valor}
            onClick={() => setFiltro(e.valor)}
          >
            {e.texto}
          </button>
        ))}
      </div>
      {visibles.length > 0 && (
        <ul className="pv-galeria-grilla">
          {visibles.map((im) => {
            const sinAlt = !(typeof im.alt === 'string' && im.alt.trim());
            const etiqueta = etiquetaDe(im);
            return (
              <li key={im.id}>
                <button
                  type="button"
                  className={sinAlt ? 'pv-galeria-tarjeta pv-galeria-tarjeta--sin-alt' : 'pv-galeria-tarjeta'}
                  aria-label={`Editar ${nombreDeImagen(im)}`}
                  onClick={() => setEditar(im)}
                >
                  <span className="pv-galeria-imagen">
                    {urls[im.src] ? <img alt="" src={urls[im.src]} /> : <span className="pv-galeria-sin-url">{nombreDeImagen(im)}</span>}
                  </span>
                  <span className="pv-galeria-pie">
                    {etiqueta && <Chip tono="gris">{etiqueta}</Chip>}
                    {sinAlt ? <span className="pv-galeria-sin-alt">Sin descripción</span> : <span className="pv-galeria-alt">{im.alt}</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {imagenes.length === 0 && <p className="pv-galeria-nota">{TEXTO_VACIA}</p>}
      <p className="pv-galeria-nota">{NOTA_CUSTODIA}</p>
      <DialogoSubir abierto={subir} onCerrar={() => setSubir(false)} />
      <DialogoEditarImagen imagen={editar} onCerrar={() => setEditar(null)} />
    </>
  );
}
