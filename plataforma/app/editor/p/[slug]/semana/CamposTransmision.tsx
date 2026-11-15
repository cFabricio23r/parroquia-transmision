'use client';
// Los campos de un tipo (SEMANA.camposDeTipo), con «Faltan N datos» en vivo (SEMANA.contarFaltas), y
// las piezas que comparten los diálogos de la semana.
import { Boton } from '../../../../componentes/Boton';
import { CampoSelect } from '../../../../componentes/CampoSelect';
import { CampoTexto } from '../../../../componentes/CampoTexto';
import { AVISO_TIPO_EDITOR } from '../../../../../lib/editor/semana-textos';
import type { OperacionSemana } from '../../../../../lib/semana-editor';
import { SEMANA, type TipoCampos } from '../../../../../lib/semana';

export type Guardar = (op: OperacionSemana) => Promise<string | undefined>;

export function CamposTransmision({
  tipo,
  datos,
  onCambiar,
}: {
  tipo: TipoCampos | null;
  datos: Record<string, unknown>;
  onCambiar: (d: Record<string, unknown>) => void;
}) {
  const faltan = SEMANA.contarFaltas(tipo, datos);
  return (
    <div className="sem-campos">
      <p role="status" className={`sem-estado ${faltan === 0 ? 'sem-estado--listo' : 'sem-estado--falta'}`}>
        {SEMANA.textoEstado(faltan)}
      </p>
      {!tipo && <p className="sem-aviso">{AVISO_TIPO_EDITOR}</p>}
      {tipo &&
        SEMANA.camposDeTipo(tipo).map((c) => (
          <CampoTexto
            key={c.ruta}
            id={`sem-campo-${c.ruta.replace(/\./g, '-')}`}
            etiqueta={c.opcional ? `${c.etiqueta} (opcional)` : c.etiqueta}
            type={c.entrada === 'fecha' ? 'date' : 'text'}
            value={SEMANA.leerCampo(datos, c.ruta)}
            onChange={(e) => onCambiar(SEMANA.escribirCampo(structuredClone(datos), c.ruta, e.target.value))}
          />
        ))}
    </div>
  );
}

/** El selector de tipo: los tipos publicados y, si el guardado ya no está, ese también (marcado). */
export function SelectTipo({
  id,
  valor,
  disponibles,
  onCambiar,
}: {
  id: string;
  valor: string;
  disponibles: TipoCampos[];
  onCambiar: (v: string) => void;
}) {
  const falta = valor !== '' && !disponibles.some((t) => t.clave === valor);
  return (
    <CampoSelect id={id} etiqueta="Tipo" value={valor} onChange={(e) => onCambiar(e.target.value)}>
      {falta && <option value={valor}>{`${valor} (ya no está)`}</option>}
      {disponibles.map((t) => (
        <option key={t.clave} value={t.clave}>
          {t.nombre}
        </option>
      ))}
    </CampoSelect>
  );
}

/** Error en role="alert" y los botones Cancelar / Guardar de los diálogos de la semana. */
export function PieDialogo({
  error,
  ocupado,
  onCerrar,
  onGuardar,
}: {
  error: string | null;
  ocupado: boolean;
  onCerrar: () => void;
  onGuardar: () => void;
}) {
  return (
    <>
      {error && (
        <div className="pv-alerta" role="alert">
          {error}
        </div>
      )}
      <div className="pv-dialogo-acciones">
        <Boton variante="secundario" onClick={onCerrar}>
          Cancelar
        </Boton>
        <Boton ocupado={ocupado} onClick={onGuardar}>
          Guardar
        </Boton>
      </div>
    </>
  );
}
