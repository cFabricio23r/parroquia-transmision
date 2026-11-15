'use client';
// Imagen de un tipo (plan 4, Decisión 19): una imagen de la galería (`galeria:<id>`) o una palabra
// (`patrono`, `fachada`…). Con `galeria:<id>` el alt es el de esa imagen de la galería y editarlo la
// edita ahí; con una palabra el alt va deshabilitado. «Cambiar» abre «Subir imagen» (el mismo diálogo
// de la Galería: la descripción es obligatoria y la escribe la persona, para esta imagen) y la agrega a
// la galería en ese momento; el tipo se queda con `galeria:<id>` y se guarda con «Guardar tipo».
import { useRef, useState } from 'react';
import { galeriaLlena, imagenesDe, MENSAJE_GALERIA_LLENA } from '../../../../lib/editor/galeria';
import { MENSAJE_ALT_VACIO } from '../../../../lib/editor/imagen';
import { CampoTexto } from '../../../componentes/CampoTexto';
import { ElegirDeGaleria } from './ElegirDeGaleria';
import { DialogoSubir } from './galeria/DialogoSubir';
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
export { MENSAJE_GALERIA_LLENA };

export function ImagenDeGaleria({
  id,
  etiqueta,
  valor,
  textoSinValor,
  onCambiar,
}: {
  id: string;
  etiqueta: string;
  valor: string | undefined;
  textoSinValor: string;
  onCambiar: (v: string | undefined) => void;
}) {
  const { borrador, cambiar, urls } = useBorrador();
  const [subir, setSubir] = useState(false);
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

  // La subida tarda: al terminar se usa el onCambiar de ese momento.
  const ultimoOnCambiar = useRef(onCambiar);
  ultimoOnCambiar.current = onCambiar;

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
    // Se mira antes de subir: con la galería llena no se sube nada (no queda un archivo suelto).
    if (galeriaLlena(borrador.galeria)) return setError(MENSAJE_GALERIA_LLENA);
    setError(undefined);
    setSubir(true);
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
          </div>
        </div>
        {error && (
          <span id={`${id}-error`} className="pv-campo-error" role="alert">
            {error}
          </span>
        )}
      </div>
      <DialogoSubir
        abierto={subir}
        onCerrar={() => setSubir(false)}
        etiquetaInicial="santos"
        alSubir={(nuevoId) => {
          setError(undefined);
          ultimoOnCambiar.current(`galeria:${nuevoId}`);
        }}
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
