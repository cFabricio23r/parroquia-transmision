'use client';
// «Subir imagen» (AB/VicEdGaleria): archivo, descripción, nombre (Decisión 2) y etiqueta. También lo
// abre «Cambiar» en la imagen de un tipo (F8): la descripción es obligatoria igual.
import { useId, useRef, useState } from 'react';
import {
  agregarImagenSubida,
  erroresTextosImagen,
  ETIQUETAS_GALERIA,
  galeriaLlena,
  MAX_TEXTO_IMAGEN,
  MENSAJE_GALERIA_LLENA,
} from '../../../../../lib/editor/galeria';
import { subirImagen, TIPOS_IMAGEN } from '../../../../../lib/editor/imagen';
import { Boton } from '../../../../componentes/Boton';
import { CajaInfo } from '../../../../componentes/CajaInfo';
import { CampoSelect } from '../../../../componentes/CampoSelect';
import { CampoTexto } from '../../../../componentes/CampoTexto';
import { Dialogo } from '../../../../componentes/Dialogo';
import { useBorrador } from '../ProveedorBorrador';

export const AYUDA_ALT = 'Obligatoria. Describe lo que se ve, para quien usa lector de pantalla.';
export const AYUDA_NOMBRE = 'Para reconocerla en las listas. Si lo dejas vacío, se usa la descripción.';
export const NOTA_EXIF = 'Al subirla se le quitan los datos ocultos de la foto, como la ubicación (GPS).';
export const MENSAJE_SIN_ARCHIVO = 'Elige un archivo.';

export function DialogoSubir({
  abierto,
  onCerrar,
  etiquetaInicial = 'patrono',
  alSubir,
}: {
  abierto: boolean;
  onCerrar: () => void;
  etiquetaInicial?: string;
  /** Después de agregarla a la galería, con su id (por ejemplo, para que el tipo la use). */
  alSubir?: (id: string) => void;
}) {
  const { datos, borrador, cambiar, agregarUrl, guardarYa } = useBorrador();
  // La subida tarda: al terminar se agrega a la galería de ese momento, no a la de antes de subir.
  const galeria = useRef(borrador.galeria);
  galeria.current = borrador.galeria;
  const idArchivo = useId();
  const [archivo, setArchivo] = useState<File | null>(null);
  const [alt, setAlt] = useState('');
  const [nombre, setNombre] = useState('');
  const [etiqueta, setEtiqueta] = useState<string>(etiquetaInicial);
  const [errores, setErrores] = useState<{ archivo?: string; alt?: string; nombre?: string; servidor?: string }>({});
  const [ocupado, setOcupado] = useState(false);

  const limpiar = () => {
    setArchivo(null);
    setAlt('');
    setNombre('');
    setEtiqueta(etiquetaInicial);
    setErrores({});
  };
  const cerrar = () => {
    if (ocupado) return;
    limpiar();
    onCerrar();
  };

  const subir = async () => {
    if (ocupado) return;
    const nuevos = { archivo: archivo ? undefined : MENSAJE_SIN_ARCHIVO, ...erroresTextosImagen({ alt, nombre }) };
    setErrores(nuevos);
    if (nuevos.archivo || nuevos.alt || nuevos.nombre || !archivo) return;
    // Con la galería llena no se sube: el archivo quedaría suelto en Storage.
    if (galeriaLlena(galeria.current)) return setErrores({ servidor: MENSAJE_GALERIA_LLENA });
    setOcupado(true);
    const r = await subirImagen(datos.slug, 'galeria', archivo);
    setOcupado(false);
    if ('error' in r) {
      setErrores({ servidor: r.error });
      return;
    }
    agregarUrl(r.src, r.url);
    const nueva = agregarImagenSubida(galeria.current, { src: r.src, alt, nombre, etiqueta });
    if ('error' in nueva) {
      setErrores({ servidor: nueva.error });
      return;
    }
    cambiar('galeria', nueva.galeria);
    void guardarYa();
    alSubir?.(nueva.id);
    limpiar();
    onCerrar();
  };

  return (
    <Dialogo abierto={abierto} titulo="Subir imagen" onCerrar={cerrar} ancho={520}>
      <label className={errores.archivo ? 'pv-zona-archivo pv-zona-archivo--error' : 'pv-zona-archivo'} htmlFor={idArchivo}>
        <input
          id={idArchivo}
          type="file"
          accept={TIPOS_IMAGEN}
          className="pv-zona-archivo-input"
          aria-describedby={errores.archivo ? `${idArchivo}-error` : undefined}
          aria-invalid={errores.archivo ? true : undefined}
          onChange={(e) => {
            setArchivo(e.target.files?.[0] ?? null);
            setErrores((x) => ({ ...x, archivo: undefined }));
          }}
        />
        <strong className="pv-zona-archivo-nombre">{archivo ? archivo.name : 'Elegir archivo'}</strong>
        <span>PNG, JPG, WebP o SVG</span>
      </label>
      {errores.archivo && (
        <span id={`${idArchivo}-error`} className="pv-campo-error pv-zona-archivo-error">
          {errores.archivo}
        </span>
      )}
      <CampoTexto id="subir-alt" etiqueta="Descripción (alt)" ayuda={AYUDA_ALT} value={alt} error={errores.alt} maxLength={MAX_TEXTO_IMAGEN}
        onChange={(e) => {
          setAlt(e.target.value);
          if (!erroresTextosImagen({ alt: e.target.value, nombre: '' }).alt) setErrores((x) => ({ ...x, alt: undefined }));
        }}
      />
      <CampoTexto id="subir-nombre" etiqueta="Nombre (opcional)" ayuda={AYUDA_NOMBRE} value={nombre} error={errores.nombre} maxLength={MAX_TEXTO_IMAGEN}
        onChange={(e) => {
          setNombre(e.target.value);
          if (!erroresTextosImagen({ alt: 'x', nombre: e.target.value }).nombre) setErrores((x) => ({ ...x, nombre: undefined }));
        }}
      />
      <CampoSelect id="subir-etiqueta" etiqueta="Etiqueta" value={etiqueta} onChange={(e) => setEtiqueta(e.target.value)}>
        {ETIQUETAS_GALERIA.map((e) => (
          <option key={e.valor} value={e.valor}>
            {e.texto}
          </option>
        ))}
      </CampoSelect>
      <CajaInfo>{NOTA_EXIF}</CajaInfo>
      {errores.servidor && (
        <div className="pv-alerta" role="alert">
          {errores.servidor}
        </div>
      )}
      <div className="pv-dialogo-acciones">
        <Boton variante="secundario" onClick={cerrar}>
          Cancelar
        </Boton>
        <Boton ocupado={ocupado} onClick={() => void subir()}>
          {ocupado ? 'Subiendo…' : 'Subir'}
        </Boton>
      </div>
    </Dialogo>
  );
}
