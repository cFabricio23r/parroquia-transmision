'use client';
// F6 · Rótulos y estilo (AB/VicEdRotulos): diseño, tipografía, esquinas, los colores del rótulo (de la
// paleta de la parroquia), la nota del acento, la posición, el logo en la esquina y los cargos
// sugeridos. Se escribe al apretar (plan 4, Decisiones 8–12); abrir la página no escribe nada.
import { useState } from 'react';
import {
  conValor,
  disenoDe,
  errorColorRotulo,
  esquinasDe,
  FAMILIA_TIPOGRAFIA,
  leerCargos,
  NOTA_MINIMAL,
  notaAcento,
  OPCIONES_DISENO,
  OPCIONES_ESQUINAS,
  OPCIONES_POSICION,
  OPCIONES_TIPOGRAFIA,
  opcionesColorRotulo,
  posicionDe,
  textoCargos,
  tipografiaDe,
  usaCampo,
} from '../../../../../lib/editor/rotulos';
import { CajaRevisar } from '../../../../componentes/CajaRevisar';
import { CampoTexto } from '../../../../componentes/CampoTexto';
import { Interruptor } from '../../../../componentes/Interruptor';
import { ListaTipografias } from '../../../../componentes/ListaTipografias';
import { Segmentado } from '../../../../componentes/Segmentado';
import { CabezaSeccion } from '../CabezaSeccion';
import { useBorrador, useNotaVistaPrevia } from '../ProveedorBorrador';
import { CampoColorParroquia } from './CampoColorParroquia';

export const TEXTO_ROTULOS = 'Cómo se ven los rótulos encima de la cámara: celebrante, lecturas, salmo, oración y los demás.';
export const NOTA_ROTULOS = 'Los textos de cada rótulo se siguen escribiendo en el panel, el día de la transmisión.';
export const ETIQUETA_LOGO = 'Logo pequeño en la esquina mientras hay rótulo';

type Objeto = Record<string, unknown>;
const objeto = (v: unknown): Objeto => (v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Objeto) : {});
const texto = (v: unknown) => (typeof v === 'string' ? v : '');
const RE_HEX = /^#[0-9a-fA-F]{6}$/;

export function SeccionRotulos() {
  const { borrador, cambiar, estados } = useBorrador();
  useNotaVistaPrevia(NOTA_ROTULOS, 'rotulos');
  const r = objeto(borrador.rotulos);
  const colores = borrador.colores;
  const acento = texto(objeto(colores).acento);
  const diseno = disenoDe(r);
  const nota = notaAcento(colores, diseno);
  // Minimal no usa esquinas ni fondo: se deshabilitan, pero lo guardado no se borra (si se vuelve a otro diseño, sigue ahí).
  const conEsquinas = usaCampo(diseno, 'esquinas');
  const conFondo = usaCampo(diseno, 'colorLado');
  const [cargos, setCargos] = useState<string | null>(null);
  const [errorCargos, setErrorCargos] = useState<string | undefined>();

  const poner = (clave: string, valor: unknown) => cambiar('rotulos', conValor(borrador.rotulos, clave, valor));
  const escribirCargos = (t: string) => {
    setCargos(t);
    const l = leerCargos(t);
    if ('error' in l) return setErrorCargos(l.error);
    setErrorCargos(undefined);
    poner('cargos', l.cargos);
  };

  return (
    <section className="pv-seccion-form" aria-labelledby="pv-titulo-rotulos">
      <CabezaSeccion titulo={<span id="pv-titulo-rotulos">Rótulos y estilo</span>} texto={TEXTO_ROTULOS} />
      <Segmentado etiqueta="Diseño" opciones={OPCIONES_DISENO} valor={diseno} onCambiar={(v) => poner('diseno', v)} />
      <ListaTipografias
        etiqueta="Tipografía"
        opciones={OPCIONES_TIPOGRAFIA}
        familias={FAMILIA_TIPOGRAFIA}
        valor={tipografiaDe(r)}
        onCambiar={(v) => poner('tipografia', v)}
      />
      <Segmentado
        etiqueta="Esquinas"
        opciones={OPCIONES_ESQUINAS}
        valor={esquinasDe(r)}
        onCambiar={(v) => poner('esquinas', v)}
        deshabilitado={!conEsquinas}
        nota={conEsquinas ? undefined : NOTA_MINIMAL}
      />
      <div className="pv-fila-campos">
        <CampoColorParroquia
          id="rotulos-lado"
          etiqueta="Fondo del rótulo"
          opciones={opcionesColorRotulo(colores, 'colorLado', r.colorLado)}
          valor={texto(r.colorLado)}
          error={conFondo ? errorColorRotulo(colores, r.colorLado) : null}
          deshabilitado={!conFondo}
          nota={conFondo ? undefined : NOTA_MINIMAL}
          onCambiar={(v) => poner('colorLado', v || undefined)}
        />
        <CampoColorParroquia
          id="rotulos-linea"
          etiqueta="Línea de acento"
          opciones={opcionesColorRotulo(colores, 'colorLinea', r.colorLinea)}
          valor={texto(r.colorLinea)}
          error={errorColorRotulo(colores, r.colorLinea)}
          muestraSinValor={RE_HEX.test(acento) ? acento : null}
          onCambiar={(v) => poner('colorLinea', v || undefined)}
        />
      </div>
      {nota && (
        <p className="pv-nota-acento">
          El texto claro sobre <b>{nota.hex}</b> tiene {nota.razon}:1. {nota.frase}
        </p>
      )}
      <CajaRevisar problemas={estados.rotulos.avisos} />
      <Segmentado etiqueta="Posición" opciones={OPCIONES_POSICION} valor={posicionDe(r)} onCambiar={(v) => poner('posicion', v)} />
      <div className="pv-opcion-fila">
        <span className="pv-opcion-etiqueta" aria-hidden="true">
          {ETIQUETA_LOGO}
        </span>
        <Interruptor etiqueta={ETIQUETA_LOGO} activo={r.logoEsquina !== false} onCambiar={(v) => poner('logoEsquina', v ? undefined : false)} />
      </div>
      <CampoTexto
        id="rotulos-cargos"
        etiqueta="Cargos sugeridos para «Persona»"
        ayuda="Aparecen como opciones en el panel; igual se puede escribir otro."
        placeholder="Si lo dejas vacío, el panel sugiere los de siempre."
        error={errorCargos}
        value={cargos ?? textoCargos(r.cargos)}
        onChange={(e) => escribirCargos(e.target.value)}
      />
    </section>
  );
}
