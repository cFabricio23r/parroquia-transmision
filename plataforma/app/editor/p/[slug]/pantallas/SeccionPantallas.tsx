'use client';
// F4 · Pantallas de OBS (AB/VicEdPantallas): las 7 pantallas con su miniatura real, si están
// personalizadas o como vienen, y el botón para editar cada una.
import { VISTAS_PANTALLA } from '../../../../../lib/editor/pantallas';
import { Boton } from '../../../../componentes/Boton';
import { Chip } from '../../../../componentes/Chip';
import { CabezaSeccion } from '../CabezaSeccion';
import { useBorrador } from '../ProveedorBorrador';
import { MiniaturaPantalla } from './MiniaturaPantalla';

export const TEXTO_PANTALLAS = 'Cada una viene lista con tu identidad. Personaliza solo las que quieras.';

const objeto = (v: unknown): Record<string, unknown> => (v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

export function SeccionPantallas() {
  const { datos, borrador } = useBorrador();
  const pantallas = objeto(borrador.pantallas);
  return (
    <>
      <CabezaSeccion titulo="Pantallas de OBS" texto={TEXTO_PANTALLAS} />
      <div className="pv-pantallas-grilla">
        {VISTAS_PANTALLA.map((v) => {
          const personalizada = objeto(pantallas[v.vista]).modo === 'personalizada';
          return (
            <article key={v.vista} className="pv-pantalla-tarjeta">
              <div className={v.vista === 'envivo' ? 'pv-pantalla-marco pv-pantalla-marco--envivo' : 'pv-pantalla-marco'}>
                <MiniaturaPantalla vista={v.vista} />
              </div>
              <div className="pv-pantalla-cuerpo">
                <div className="pv-pantalla-fila">
                  <h2 className="pv-pantalla-nombre">{v.nombre}</h2>
                  {personalizada ? <Chip tono="azul">Personalizada</Chip> : <Chip tono="gris">Como viene</Chip>}
                </div>
                <p className="pv-pantalla-descripcion">{v.descripcion}</p>
                <Boton
                  variante="secundario"
                  compacto
                  anchoCompleto
                  href={`/editor/p/${datos.slug}/pantallas/${v.vista}`}
                  aria-label={`Editar ${v.nombre}`}
                >
                  Editar
                </Boton>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
