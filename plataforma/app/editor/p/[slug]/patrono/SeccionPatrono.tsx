'use client';
// F3 · Patrono y fiesta (AB/VicEdPatrono): el patrono con su imagen, el día y el mes de la fiesta
// (el día respeta el mes), el lema y desde cuándo corre la cuenta regresiva.
import { faltaCampo } from '../../../../../lib/editor/errores';
import { cambiarMes, CUENTA_POR_DEFECTO, diasDelMes, opcionesCuenta } from '../../../../../lib/editor/fiesta';
import { MESES } from '../../../../../lib/fecha';
import { CampoSelect } from '../../../../componentes/CampoSelect';
import { CampoTexto } from '../../../../componentes/CampoTexto';
import { CabezaSeccion } from '../CabezaSeccion';
import { CampoImagenBorrador, type ValorImagen } from '../CampoImagenBorrador';
import { useBorrador, useNotaVistaPrevia } from '../ProveedorBorrador';

export const TEXTO_PATRONO = 'Para la portada de la fiesta, la novena y la cuenta regresiva.';
export const NOTA_GALERIA_PATRONO = 'Puedes sumar más imágenes del patrono en la Galería y elegir cuál usa cada tipo de transmisión.';
export const AYUDA_LEMA = 'Opcional. Si lo dejas vacío, no aparece la franja del lema.';
export const AYUDA_CUENTA = 'En la pantalla de Inicio, antes de la fiesta.';

type Patrono = { nombre?: string; corto?: string; imagen?: ValorImagen };
type Fiesta = { dia?: number; mes?: number; lema?: string; cuentaDesdeDias?: number };

const texto = (v: unknown) => (typeof v === 'string' ? v : '');
const objeto = <T,>(v: unknown): T => (v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as T) : ({} as T));
const entero = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) ? v : undefined);

/** Decisión 19: la nota con el lema real. */
export function notaPatrono(lema: string): string {
  return lema.trim() ? `«${lema.trim()}» aparece como franja abajo, con el color de acento.` : 'Sin lema no aparece la franja de abajo.';
}

export function SeccionPatrono() {
  const { borrador, cambiar } = useBorrador();
  const patrono = objeto<Patrono>(borrador.patrono);
  const fiesta = objeto<Fiesta>(borrador.fiesta);
  const dia = entero(fiesta.dia);
  const mes = entero(fiesta.mes);
  const cuenta = entero(fiesta.cuentaDesdeDias);
  useNotaVistaPrevia(notaPatrono(texto(fiesta.lema)), `patrono:${texto(fiesta.lema)}`);

  const ponerPatrono = (c: Partial<Patrono>) => {
    const nuevo: Record<string, unknown> = { ...objeto<Patrono>(borrador.patrono), ...c };
    for (const [k, v] of Object.entries(c)) if (v === undefined) delete nuevo[k];
    cambiar('patrono', nuevo);
  };
  const ponerFiesta = (f: Record<string, unknown>) => {
    for (const k of Object.keys(f)) if (f[k] === undefined) delete f[k];
    cambiar('fiesta', f);
  };
  const actual = () => ({ ...objeto<Fiesta>(borrador.fiesta) }) as Record<string, unknown>;
  const maxDia = mes ? diasDelMes(mes) : 31;

  return (
    <section className="pv-seccion-form" aria-labelledby="pv-titulo-patrono">
      <CabezaSeccion titulo={<span id="pv-titulo-patrono">Patrono y fiesta</span>} texto={TEXTO_PATRONO} />
      <div className="pv-fila-campos">
        <CampoTexto id="patrono-nombre" etiqueta="Nombre del patrono" error={faltaCampo('patrono.nombre', patrono.nombre)} value={texto(patrono.nombre)} onChange={(e) => ponerPatrono({ nombre: e.target.value })} />
        <CampoTexto id="patrono-corto" etiqueta="Título corto" error={faltaCampo('patrono.corto', patrono.corto)} value={texto(patrono.corto)} onChange={(e) => ponerPatrono({ corto: e.target.value })} />
      </div>
      <div className="pv-patrono-imagen">
        <CampoImagenBorrador
          id="patrono-imagen"
          etiqueta="Imagen principal del patrono"
          campo="patrono"
          valor={typeof patrono.imagen?.src === 'string' ? { src: patrono.imagen.src, alt: texto(patrono.imagen.alt) } : undefined}
          textoVacio="patrono"
          onCambiar={(v) => ponerPatrono({ imagen: v })}
        />
        <p className="pv-nota-campo">{NOTA_GALERIA_PATRONO}</p>
      </div>
      <div className="pv-fila-campos">
        <CampoSelect
          id="fiesta-dia"
          etiqueta="Día de la fiesta"
          error={faltaCampo('fiesta.dia', dia)}
          value={dia ?? ''}
          onChange={(e) => ponerFiesta({ ...actual(), dia: Number(e.target.value) })}
        >
          {dia === undefined && <option value="">Elige</option>}
          {Array.from({ length: maxDia }, (_, i) => i + 1).map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
          {dia !== undefined && dia > maxDia && <option value={dia}>{dia}</option>}
        </CampoSelect>
        <CampoSelect id="fiesta-mes" etiqueta="Mes" error={faltaCampo('fiesta.mes', mes)} value={mes ?? ''} onChange={(e) => ponerFiesta(cambiarMes(actual(), Number(e.target.value)))}>
          {mes === undefined && <option value="">Elige</option>}
          {MESES.map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </CampoSelect>
      </div>
      <CampoTexto
        id="fiesta-lema"
        etiqueta="Lema de la fiesta"
        ayuda={AYUDA_LEMA}
        value={texto(fiesta.lema)}
        onChange={(e) => ponerFiesta({ ...actual(), lema: e.target.value === '' ? undefined : e.target.value })}
      />
      <CampoSelect
        id="fiesta-cuenta"
        etiqueta="Cuenta regresiva"
        ayuda={AYUDA_CUENTA}
        value={cuenta ?? CUENTA_POR_DEFECTO}
        onChange={(e) => ponerFiesta({ ...actual(), cuentaDesdeDias: Number(e.target.value) })}
      >
        {opcionesCuenta(cuenta).map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.texto}
          </option>
        ))}
      </CampoSelect>
    </section>
  );
}
