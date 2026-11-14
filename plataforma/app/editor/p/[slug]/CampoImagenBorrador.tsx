'use client';
// Une `CampoImagen` con la subida al borrador y la galería (plan 3, Tareas 12 y 13).
// «Cambiar» abre el selector de archivos; mientras sube, «Subiendo…». Al terminar, la URL firmada
// entra al contexto (miniatura y vista previa) y el campo pasa a `{ src, alt }`.
import { useRef, useState } from 'react';
import { MENSAJE_ALT_VACIO, subirImagen, TIPOS_IMAGEN } from '../../../../lib/editor/imagen';
import { CampoImagen } from '../../../componentes/CampoImagen';
import { ElegirDeGaleria } from './ElegirDeGaleria';
import { useBorrador } from './ProveedorBorrador';

export type ValorImagen = { src: string; alt: string };

export function CampoImagenBorrador({
  id,
  etiqueta,
  opcional,
  campo,
  valor,
  textoVacio,
  onCambiar,
}: {
  id: string;
  etiqueta: string;
  opcional?: boolean;
  campo: string;
  valor: ValorImagen | undefined;
  textoVacio: string;
  onCambiar: (v: ValorImagen | undefined) => void;
}) {
  const { datos, urls, agregarUrl } = useBorrador();
  const entrada = useRef<HTMLInputElement>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [elegir, setElegir] = useState(false);
  // El alt escrito antes de tener imagen se guarda aquí y se usa al subir o elegir una.
  const [altSinImagen, setAltSinImagen] = useState('');
  const src = valor?.src ?? '';
  const alt = src ? (valor?.alt ?? '') : altSinImagen;

  const subir = async (archivo: File | undefined) => {
    if (!archivo) return;
    setOcupado(true);
    setError(undefined);
    const r = await subirImagen(datos.slug, campo, archivo);
    setOcupado(false);
    if (entrada.current) entrada.current.value = '';
    if ('error' in r) return setError(r.error);
    agregarUrl(r.src, r.url);
    onCambiar({ src: r.src, alt });
  };

  return (
    <>
      <CampoImagen
        id={id}
        etiqueta={etiqueta}
        opcional={opcional}
        src={src ? (urls[src] ?? null) : null}
        textoVacio={textoVacio}
        alt={alt}
        onAlt={(v) => (src ? onCambiar({ src, alt: v }) : setAltSinImagen(v))}
        onCambiar={() => entrada.current?.click()}
        onElegir={() => setElegir(true)}
        errorAlt={src && !alt.trim() ? MENSAJE_ALT_VACIO : undefined}
        error={error}
        ocupado={ocupado}
      />
      <input
        ref={entrada}
        type="file"
        accept={TIPOS_IMAGEN}
        hidden
        data-campo={campo}
        aria-label={`Archivo de ${etiqueta}`}
        onChange={(e) => void subir(e.target.files?.[0])}
      />
      <ElegirDeGaleria
        abierto={elegir}
        onCerrar={() => setElegir(false)}
        onElegir={(im) => {
          setElegir(false);
          setError(undefined);
          onCambiar({ src: im.src, alt: im.alt ?? '' });
        }}
      />
    </>
  );
}
