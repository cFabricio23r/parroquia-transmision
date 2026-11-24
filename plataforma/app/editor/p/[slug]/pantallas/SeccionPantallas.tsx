'use client';
// F4 · Pantallas de OBS (AB/VicEdPantallas): las 7 pantallas con su miniatura real, si están
// personalizadas o como vienen, y el botón para editar cada una.
import {
  conEstiloPantallas,
  FAMILIA_LETRA_FRASE,
  OPCIONES_LETRA_FRASE,
  OPCIONES_TAMANO,
  VISTAS_PANTALLA,
  type ClaveEstilo,
} from '../../../../../lib/editor/pantallas';
import { FAMILIA_TIPOGRAFIA, OPCIONES_TIPOGRAFIA } from '../../../../../lib/editor/rotulos';
import { Boton } from '../../../../componentes/Boton';
import { CajaRevisar } from '../../../../componentes/CajaRevisar';
import { Chip } from '../../../../componentes/Chip';
import { ListaTipografias } from '../../../../componentes/ListaTipografias';
import { Segmentado } from '../../../../componentes/Segmentado';
import { CabezaSeccion } from '../CabezaSeccion';
import { useBorrador } from '../ProveedorBorrador';
import { MiniaturaPantalla } from './MiniaturaPantalla';

export const TEXTO_PANTALLAS = 'Cada una viene lista con tu identidad. Personaliza solo las que quieras.';
export const ALCANCE_ESTILO =
  'La letra del título cambia Inicio, Portada, Evento, Gracias, Avisos y Horarios; el tamaño del logo, las que llevan el logo arriba a la izquierda (Inicio, Portada, Evento y Gracias). Producción y la capa EN VIVO no cambian. Cada pantalla puede tener su propia letra y tamaño en su editor.';

const objeto = (v: unknown): Record<string, unknown> => (v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

export function SeccionPantallas() {
  const { datos, borrador, estados, cambiar } = useBorrador();
  const pantallas = objeto(borrador.pantallas);
  const estilo = objeto(borrador.estiloPantallas);
  const valorEstilo = (clave: ClaveEstilo, siempre: string) => (typeof estilo[clave] === 'string' ? (estilo[clave] as string) : siempre);
  const ponerEstilo = (clave: ClaveEstilo) => (v: string) => cambiar('estiloPantallas', conEstiloPantallas(borrador.estiloPantallas, clave, v));
  return (
    <>
      <CabezaSeccion titulo="Pantallas de OBS" texto={TEXTO_PANTALLAS} />
      <CajaRevisar problemas={estados.pantallas.avisos} />
      <section className="pv-tarjeta-opciones pv-estilo-pantallas" aria-labelledby="pv-estilo-pantallas">
        <h2 id="pv-estilo-pantallas" className="pv-subtitulo">
          Estilo de todas las pantallas
        </h2>
        <ListaTipografias
          etiqueta="Letra del título"
          nombre="pantallas-letra-titulo"
          opciones={OPCIONES_TIPOGRAFIA}
          familias={FAMILIA_TIPOGRAFIA}
          valor={valorEstilo('letraTitulo', 'montserrat')}
          onCambiar={ponerEstilo('letraTitulo')}
        />
        <ListaTipografias
          etiqueta="Letra de la frase"
          nombre="pantallas-letra-frase"
          opciones={OPCIONES_LETRA_FRASE}
          familias={FAMILIA_LETRA_FRASE}
          valor={valorEstilo('letraFrase', 'vibes')}
          onCambiar={ponerEstilo('letraFrase')}
        />
        <Segmentado etiqueta="Tamaño del logo" opciones={OPCIONES_TAMANO} valor={valorEstilo('logo', 'normal')} onCambiar={ponerEstilo('logo')} />
        <p className="pv-nota-campo">{ALCANCE_ESTILO}</p>
      </section>
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
