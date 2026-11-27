'use client';
// Los campos de un tipo (SEMANA.camposDeTipo), con «Faltan N datos» en vivo (SEMANA.contarFaltas), y
// las piezas que comparten los diálogos de la semana.
import { Boton } from '../../../../componentes/Boton';
import { CampoSelect } from '../../../../componentes/CampoSelect';
import { CampoTexto } from '../../../../componentes/CampoTexto';
import {
  AVISO_TIPO_EDITOR,
  AYUDA_FB_DESCRIPCION,
  AYUDA_FB_TITULO,
  ETIQUETA_FB_DESCRIPCION,
  ETIQUETA_FB_TITULO,
} from '../../../../../lib/editor/semana-textos';
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
      <fieldset className="sem-facebook">
        <legend>Facebook</legend>
        <CampoTexto
          id="sem-fb-titulo"
          etiqueta={ETIQUETA_FB_TITULO}
          ayuda={AYUDA_FB_TITULO}
          maxLength={SEMANA.LIMITES_FACEBOOK.titulo}
          value={SEMANA.leerCampo(datos, 'facebook.titulo')}
          onChange={(e) => onCambiar(cambiarFacebook(datos, 'titulo', e.target.value))}
        />
        <label className="pv-campo">
          <span id="sem-fb-descripcion-etiqueta" className="pv-campo-etiqueta">
            {ETIQUETA_FB_DESCRIPCION}
          </span>
          <textarea
            id="sem-fb-descripcion"
            name="sem-fb-descripcion"
            className="pv-campo-control sem-facebook-descripcion"
            rows={4}
            aria-labelledby="sem-fb-descripcion-etiqueta"
            aria-describedby="sem-fb-descripcion-ayuda"
            maxLength={SEMANA.LIMITES_FACEBOOK.descripcion}
            value={SEMANA.leerCampo(datos, 'facebook.descripcion')}
            onChange={(e) => onCambiar(cambiarFacebook(datos, 'descripcion', e.target.value))}
          />
          <span id="sem-fb-descripcion-ayuda" className="pv-campo-ayuda">
            {AYUDA_FB_DESCRIPCION}
          </span>
        </label>
      </fieldset>
    </div>
  );
}

/** Una copia de `datos` con `facebook.<campo>` cambiado; lo demás queda igual. */
export function cambiarFacebook(
  datos: Record<string, unknown>,
  campo: 'titulo' | 'descripcion',
  valor: string,
): Record<string, unknown> {
  return SEMANA.escribirCampo(structuredClone(datos), `facebook.${campo}`, valor);
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
