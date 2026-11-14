'use client';
// Imagen de un tipo (plan 4, Decisión 19): una imagen de la galería (`galeria:<id>`) o una palabra
// (`patrono`, `fachada`…). Con `galeria:<id>` el alt es el de esa imagen de la galería y editarlo la
// edita ahí; con una palabra el alt va deshabilitado. «Cambiar» sube el archivo y lo agrega a la
// galería en ese momento; el tipo se queda con `galeria:<id>` y se guarda con «Guardar tipo».
import { useRef, useState } from 'react';
import { imagenesDe, MAX_GALERIA, nuevoIdGaleria } from '../../../../lib/editor/galeria';
import { MENSAJE_ALT_VACIO, subirImagen, TIPOS_IMAGEN } from '../../../../lib/editor/imagen';
import { CampoTexto } from '../../../componentes/CampoTexto';
import { ElegirDeGaleria } from './ElegirDeGaleria';
import { useBorrador } from './ProveedorBorrador';

export const NOMBRES_IMAGEN: Record<string, string> = {
  patrono: 'Imagen del patrono',
  fachada: 'Fachada',
  logo: 'Logo',
  custodia: 'Custodia',
  santo: 'Imagen del santo',
  ninguna: 'Sin imagen',
};
export const AYUDA_ALT_GALERIA = 'La descripción es la de la imagen en la Galería.';
export const AYUDA_ALT_PALABRA = 'Se usa la descripción que ya tiene esa imagen.';
export const MENSAJE_GALERIA_LLENA = `La galería ya tiene ${MAX_GALERIA} imágenes. Borra una en Galería para subir otra.`;

export function ImagenDeGaleria({
  id,
  etiqueta,
  valor,
  textoSinValor,
  onCambiar,
  altAlSubir,
}: {
  id: string;
  etiqueta: string;
  valor: string | undefined;
  textoSinValor: string;
  onCambiar: (v: string | undefined) => void;
  /** El alt de una imagen subida con «Cambiar» cuando no hay uno escrito (la galería lo exige). */
  altAlSubir?: string;
}) {
  const { datos, borrador, cambiar, guardarYa, urls, agregarUrl } = useBorrador();
  const entrada = useRef<HTMLInputElement>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [elegir, setElegir] = useState(false);
  const [altEscrito, setAltEscrito] = useState<{ id: string; texto: string } | null>(null);

  const imagenes = imagenesDe(borrador.galeria);
  const idGaleria = valor?.startsWith('galeria:') ? valor.slice(8) : null;
  const im = idGaleria ? imagenes.find((x) => x.id === idGaleria) : undefined;
  const altGuardado = im?.alt ?? '';
  const alt = im && altEscrito?.id === im.id ? altEscrito.texto : altGuardado;
  const src = im ? (urls[im.src] ?? null) : null;
  const nombreSinImagen = idGaleria ? 'Imagen que ya no está en la galería' : valor ? (NOMBRES_IMAGEN[valor] ?? valor) : textoSinValor;

  // La subida tarda: al terminar se usa la galería y el onCambiar de ese momento.
  const ultimo = useRef({ galeria: borrador.galeria, onCambiar, alt: im ? alt : '' });
  ultimo.current = { galeria: borrador.galeria, onCambiar, alt: im ? alt : '' };

  const escribirAlt = (t: string) => {
    if (!im) return;
    setAltEscrito({ id: im.id, texto: t });
    // Un alt vacío dejaría la galería inválida: se muestra el error y no se escribe.
    if (!t.trim()) return;
    const lista = Array.isArray(borrador.galeria) ? borrador.galeria : [];
    cambiar(
      'galeria',
      lista.map((x) => (x && typeof x === 'object' && (x as { id?: unknown }).id === im.id ? { ...x, alt: t } : x)),
    );
  };

  const pedirArchivo = () => {
    if (imagenes.length >= MAX_GALERIA) return setError(MENSAJE_GALERIA_LLENA);
    setError(undefined);
    entrada.current?.click();
  };

  const subir = async (archivo: File | undefined) => {
    if (!archivo) return;
    setOcupado(true);
    setError(undefined);
    const r = await subirImagen(datos.slug, 'galeria', archivo);
    setOcupado(false);
    if (entrada.current) entrada.current.value = '';
    if ('error' in r) return setError(r.error);
    agregarUrl(r.src, r.url);
    const actual = Array.isArray(ultimo.current.galeria) ? ultimo.current.galeria : [];
    if (imagenesDe(actual).length >= MAX_GALERIA) return setError(MENSAJE_GALERIA_LLENA);
    const nuevoId = nuevoIdGaleria(imagenesDe(actual).map((x) => x.id));
    const texto = ultimo.current.alt.trim() || altAlSubir?.trim() || etiqueta;
    cambiar('galeria', [...actual, { id: nuevoId, src: r.src, alt: texto, etiquetas: ['santos'] }]);
    void guardarYa();
    ultimo.current.onCambiar(`galeria:${nuevoId}`);
  };

  return (
    <>
      <div className="pv-imagen" role="group" aria-labelledby={`${id}-etiqueta`}>
        <span id={`${id}-etiqueta`} className="pv-campo-etiqueta">
          {etiqueta}
        </span>
        <div className="pv-imagen-fila">
          <div className="pv-miniatura">{src ? <img alt="" src={src} /> : nombreSinImagen}</div>
          <div className="pv-imagen-columna">
            <CampoTexto
              id={`${id}-alt`}
              etiqueta="Descripción para lectores de pantalla (alt)"
              compacto
              disabled={!im}
              ayuda={im ? AYUDA_ALT_GALERIA : AYUDA_ALT_PALABRA}
              value={im ? alt : ''}
              onChange={(e) => escribirAlt(e.target.value)}
              error={im && !alt.trim() ? MENSAJE_ALT_VACIO : undefined}
            />
            {ocupado ? (
              <span className="pv-imagen-acciones pv-imagen-subiendo" role="status">
                Subiendo…
              </span>
            ) : (
              <span className="pv-imagen-acciones">
                <button type="button" className="pv-enlace" onClick={pedirArchivo}>
                  Cambiar
                </button>
                <button type="button" className="pv-enlace" onClick={() => setElegir(true)}>
                  Elegir de la galería
                </button>
                {valor !== undefined && (
                  <button type="button" className="pv-enlace" onClick={() => onCambiar(undefined)}>
                    Usar la de siempre
                  </button>
                )}
              </span>
            )}
          </div>
        </div>
        {error && (
          <span id={`${id}-error`} className="pv-campo-error" role="alert">
            {error}
          </span>
        )}
      </div>
      <input
        ref={entrada}
        type="file"
        accept={TIPOS_IMAGEN}
        hidden
        data-campo="galeria"
        aria-label={`Archivo de ${etiqueta}`}
        onChange={(e) => void subir(e.target.files?.[0])}
      />
      <ElegirDeGaleria
        abierto={elegir}
        onCerrar={() => setElegir(false)}
        onElegir={(x) => {
          setElegir(false);
          setError(undefined);
          onCambiar(`galeria:${x.id}`);
        }}
      />
    </>
  );
}
