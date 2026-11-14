'use client';
// F2 · Identidad (AB/VicEdIdentidad): nombre, lugar, logos, colores con sus pastillas de contraste y
// la fachada. Cada cambio va al borrador (guardado automático); un color a medio escribir no.
import { useEffect, useRef, useState } from 'react';
import { contraste } from '../../../../../lib/contraste';
import { MENSAJE_HEX, RE_HEX, textoSobreAcento } from '../../../../../lib/editor/imagen';
import { CampoColor } from '../../../../componentes/CampoColor';
import { CampoTexto } from '../../../../componentes/CampoTexto';
import { PastillaContraste } from '../../../../componentes/PastillaContraste';
import { CabezaSeccion } from '../CabezaSeccion';
import { CampoImagenBorrador, type ValorImagen } from '../CampoImagenBorrador';
import { useBorrador, useNotaVistaPrevia } from '../ProveedorBorrador';

export const TEXTO_IDENTIDAD = 'Lo que aparece en todas las pantallas y rótulos.';
export const NOTA_VISTA_PREVIA_IDENTIDAD = 'La vista previa usa las pantallas de verdad, con el borrador.';

type Colores = { principal?: string; oscuro?: string; acento?: string };
type Logos = { blanco?: ValorImagen; color?: ValorImagen };

const texto = (v: unknown) => (typeof v === 'string' ? v : '');
const objeto = <T,>(v: unknown): T => (v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as T) : ({} as T));
const imagen = (v: unknown): ValorImagen | undefined => {
  const o = objeto<Partial<ValorImagen>>(v);
  return typeof o.src === 'string' ? { src: o.src, alt: texto(o.alt) } : undefined;
};

/**
 * Un color del borrador con su texto local: solo un `#rrggbb` llega al borrador; si el borrador
 * cambia desde afuera (por ejemplo «Ver lo suyo»), el texto lo sigue.
 */
function useColor(enBorrador: string, escribir: (v: string) => void, vacioPermitido: boolean) {
  const [valor, setValor] = useState(enBorrador);
  const ultimo = useRef(enBorrador);
  useEffect(() => {
    if (enBorrador !== ultimo.current) {
      ultimo.current = enBorrador;
      setValor(enBorrador);
    }
  }, [enBorrador]);
  const cambiar = (v: string) => {
    setValor(v);
    if (RE_HEX.test(v) || (vacioPermitido && v === '')) {
      ultimo.current = v;
      escribir(v);
    }
  };
  const error = valor === '' ? (vacioPermitido ? undefined : MENSAJE_HEX) : RE_HEX.test(valor) ? undefined : MENSAJE_HEX;
  return { valor, cambiar, error };
}

export function SeccionIdentidad() {
  const { borrador, cambiar } = useBorrador();
  useNotaVistaPrevia(NOTA_VISTA_PREVIA_IDENTIDAD, 'identidad');

  const colores = objeto<Colores>(borrador.colores);
  const logos = objeto<Logos>(borrador.logos);
  const ponerColor = (clave: keyof Colores) => (v: string) => {
    const actuales = { ...objeto<Colores>(borrador.colores) };
    if (v === '') delete actuales[clave];
    else actuales[clave] = v;
    cambiar('colores', actuales);
  };
  const principal = useColor(texto(colores.principal), ponerColor('principal'), false);
  const oscuro = useColor(texto(colores.oscuro), ponerColor('oscuro'), false);
  const acento = useColor(texto(colores.acento), ponerColor('acento'), true);

  const ponerLogo = (clave: keyof Logos) => (v: ValorImagen | undefined) => {
    const actuales = { ...objeto<Logos>(borrador.logos) };
    if (v) actuales[clave] = v;
    else delete actuales[clave];
    cambiar('logos', actuales);
  };
  const ponerTexto = (bloque: 'nombre' | 'nombreCorto' | 'lugar', quitarVacio: boolean) => (v: string) =>
    cambiar(bloque, quitarVacio && v === '' ? undefined : v);

  const acentoValido = RE_HEX.test(texto(colores.acento));
  const sobreAcento = acentoValido ? textoSobreAcento(texto(colores.acento)) : null;

  return (
    <section className="pv-seccion-form" aria-labelledby="pv-titulo-identidad">
      <CabezaSeccion titulo={<span id="pv-titulo-identidad">Identidad</span>} texto={TEXTO_IDENTIDAD} />
      <div className="pv-fila-campos">
        <CampoTexto
          id="identidad-nombre"
          etiqueta="Nombre completo"
          value={texto(borrador.nombre)}
          onChange={(e) => ponerTexto('nombre', false)(e.target.value)}
        />
        <CampoTexto
          id="identidad-nombre-corto"
          etiqueta="Nombre corto"
          ayuda="Para el panel y la app."
          value={texto(borrador.nombreCorto)}
          onChange={(e) => ponerTexto('nombreCorto', true)(e.target.value)}
        />
      </div>
      <CampoTexto id="identidad-lugar" etiqueta="Lugar" value={texto(borrador.lugar)} onChange={(e) => ponerTexto('lugar', false)(e.target.value)} />
      <CampoImagenBorrador
        id="identidad-logo-blanco"
        etiqueta="Logo blanco (PNG o SVG)"
        campo="logo-blanco"
        valor={imagen(logos.blanco)}
        textoVacio="logo blanco"
        onCambiar={ponerLogo('blanco')}
      />
      <CampoImagenBorrador
        id="identidad-logo-color"
        etiqueta="Logo a color"
        opcional
        campo="logo-color"
        valor={imagen(logos.color)}
        textoVacio="logo a color"
        onCambiar={ponerLogo('color')}
      />
      <div className="pv-fila-campos pv-fila-campos--3">
        <CampoColor id="identidad-color-principal" etiqueta="Color principal" valor={principal.valor} onCambiar={principal.cambiar} error={principal.error} />
        <CampoColor id="identidad-color-oscuro" etiqueta="Color oscuro" valor={oscuro.valor} onCambiar={oscuro.cambiar} error={oscuro.error} />
        <CampoColor id="identidad-color-acento" etiqueta="Color de acento" valor={acento.valor} onCambiar={acento.cambiar} error={acento.error} />
      </div>
      <div className="pv-pastillas">
        {RE_HEX.test(texto(colores.principal)) && (
          <PastillaContraste etiqueta="Texto blanco sobre principal" razon={contraste('#ffffff', texto(colores.principal))} bloquea />
        )}
        {RE_HEX.test(texto(colores.oscuro)) && <PastillaContraste etiqueta="Sobre oscuro" razon={contraste('#ffffff', texto(colores.oscuro))} bloquea />}
        {sobreAcento && <PastillaContraste etiqueta={sobreAcento.etiqueta} razon={sobreAcento.razon} bloquea={false} />}
      </div>
      <CampoImagenBorrador
        id="identidad-fachada"
        etiqueta="Foto de la fachada"
        campo="fachada"
        valor={imagen(borrador.fachada)}
        textoVacio="fachada"
        onCambiar={(v) => cambiar('fachada', v)}
      />
    </section>
  );
}
