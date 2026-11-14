'use client';
// «Editar imagen» (Decisión 3): descripción, nombre y etiqueta; «Borrar imagen» pide confirmación y
// dice dónde se usa. Borrar no deja ninguna referencia `galeria:<id>` colgando (Review Focus 5).
import { useEffect, useState } from 'react';
import { ETIQUETAS_GALERIA, imagenesDe, quitarImagen, usosDeImagen, type ImagenGaleria } from '../../../../../lib/editor/galeria';
import { MENSAJE_ALT_VACIO } from '../../../../../lib/editor/imagen';
import { Boton } from '../../../../componentes/Boton';
import { CampoSelect } from '../../../../componentes/CampoSelect';
import { CampoTexto } from '../../../../componentes/CampoTexto';
import { Dialogo } from '../../../../componentes/Dialogo';
import { useBorrador } from '../ProveedorBorrador';
import { AYUDA_ALT, AYUDA_NOMBRE } from './DialogoSubir';

/** El texto de la confirmación de borrar (Decisión 3). */
export function textoBorrar(usos: string[]): string {
  if (!usos.length) return '¿Borrar esta imagen de la galería?';
  return `Esta imagen se usa en: ${usos.join(', ')}. Si la borras, esos lugares vuelven a como vienen.`;
}

const esConocida = (e: string) => ETIQUETAS_GALERIA.some((x) => x.valor === e);

export function DialogoEditarImagen({ imagen, onCerrar }: { imagen: ImagenGaleria | null; onCerrar: () => void }) {
  const { datos, borrador, urls, cambiar, cambiarVarios, guardarYa } = useBorrador();
  const [alt, setAlt] = useState('');
  const [nombre, setNombre] = useState('');
  const [etiqueta, setEtiqueta] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [confirmar, setConfirmar] = useState(false);

  useEffect(() => {
    if (!imagen) return;
    setAlt(imagen.alt ?? '');
    setNombre(imagen.nombre ?? '');
    setEtiqueta((imagen.etiquetas ?? []).find(esConocida) ?? '');
    setError(undefined);
    setConfirmar(false);
  }, [imagen]);

  const nombresTipos = Object.fromEntries(datos.tiposComunes.map((t) => [t.clave, t.nombre]));
  const usos = imagen ? usosDeImagen(borrador, imagen.id, nombresTipos) : [];
  const existe = !!imagen && imagenesDe(borrador.galeria).some((i) => i.id === imagen.id);

  const guardar = () => {
    if (!imagen) return;
    if (!alt.trim()) return setError(MENSAJE_ALT_VACIO);
    const lista = Array.isArray(borrador.galeria) ? borrador.galeria : [];
    cambiar(
      'galeria',
      lista.map((im) => {
        if (!im || typeof im !== 'object' || (im as ImagenGaleria).id !== imagen.id) return im;
        const copia: Record<string, unknown> = { ...(im as ImagenGaleria), alt: alt.trim() };
        if (nombre.trim()) copia.nombre = nombre.trim();
        else delete copia.nombre;
        // La etiqueta elegida va primero; las que el editor no conoce se conservan detrás.
        const otras = ((im as ImagenGaleria).etiquetas ?? []).filter((e) => !esConocida(e));
        if (etiqueta) copia.etiquetas = [etiqueta, ...otras];
        return copia;
      }),
    );
    void guardarYa();
    onCerrar();
  };

  const borrar = () => {
    if (!imagen) return;
    cambiarVarios(quitarImagen(borrador, imagen.id));
    void guardarYa();
    setConfirmar(false);
    onCerrar();
  };

  return (
    <>
      <Dialogo abierto={existe && !confirmar} titulo="Editar imagen" onCerrar={onCerrar} ancho={520}>
        {imagen && (
          <>
            <div className="pv-editar-miniatura">{urls[imagen.src] ? <img alt="" src={urls[imagen.src]} /> : null}</div>
            <CampoTexto id="editar-alt" etiqueta="Descripción (alt)" ayuda={AYUDA_ALT} value={alt} error={error}
              onChange={(e) => {
                setAlt(e.target.value);
                if (e.target.value.trim()) setError(undefined);
              }}
            />
            <CampoTexto id="editar-nombre" etiqueta="Nombre (opcional)" ayuda={AYUDA_NOMBRE} value={nombre} onChange={(e) => setNombre(e.target.value)} />
            <CampoSelect id="editar-etiqueta" etiqueta="Etiqueta" value={etiqueta} onChange={(e) => setEtiqueta(e.target.value)}>
              {!etiqueta && <option value="">Sin etiqueta</option>}
              {ETIQUETAS_GALERIA.map((e) => (
                <option key={e.valor} value={e.valor}>
                  {e.texto}
                </option>
              ))}
            </CampoSelect>
            <div className="pv-dialogo-acciones pv-dialogo-acciones--separadas">
              <Boton variante="peligro" onClick={() => setConfirmar(true)}>
                Borrar imagen
              </Boton>
              <span className="pv-dialogo-acciones">
                <Boton variante="secundario" onClick={onCerrar}>
                  Cancelar
                </Boton>
                <Boton onClick={guardar}>Guardar</Boton>
              </span>
            </div>
          </>
        )}
      </Dialogo>
      <Dialogo abierto={existe && confirmar} titulo="Borrar imagen" onCerrar={() => setConfirmar(false)}>
        <p className="pv-dialogo-texto">{textoBorrar(usos)}</p>
        <div className="pv-dialogo-acciones">
          <Boton variante="secundario" onClick={() => setConfirmar(false)}>
            Cancelar
          </Boton>
          <Boton variante="peligro" onClick={borrar}>
            Sí, borrar
          </Boton>
        </div>
      </Dialogo>
    </>
  );
}
