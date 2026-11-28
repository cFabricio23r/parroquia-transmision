// Un texto de una pantalla del editor: una línea (<input>) o varias (<textarea>, la oración de Comunión).
// Mismas etiqueta, ayuda y clases que CampoTexto; el tope es `maximo` o 200 (vicaria `MAX_TEXTO`).
import { CampoTexto, describirCon } from '../../../../../componentes/CampoTexto';
import type { CampoTextoPantalla } from '../../../../../../lib/editor/pantallas';

export function CampoTextoDePantalla({
  campo,
  valor,
  onCambiar,
}: {
  campo: CampoTextoPantalla;
  valor: string;
  onCambiar: (valor: string) => void;
}) {
  const id = `pantalla-${campo.clave}`;
  const maximo = campo.maximo ?? 200;
  if (!campo.multilinea) {
    return (
      <CampoTexto
        id={id}
        etiqueta={campo.etiqueta}
        ayuda={campo.ayuda}
        placeholder={campo.placeholder}
        maxLength={maximo}
        value={valor}
        onChange={(e) => onCambiar(e.target.value)}
      />
    );
  }
  return (
    <label className="pv-campo">
      <span id={`${id}-etiqueta`} className="pv-campo-etiqueta">
        {campo.etiqueta}
      </span>
      <textarea
        id={id}
        name={id}
        className="pv-campo-control"
        rows={6}
        aria-labelledby={`${id}-etiqueta`}
        aria-describedby={describirCon(id, campo.ayuda)}
        placeholder={campo.placeholder}
        maxLength={maximo}
        value={valor}
        onChange={(e) => onCambiar(e.target.value)}
      />
      {campo.ayuda && (
        <span id={`${id}-ayuda`} className="pv-campo-ayuda">
          {campo.ayuda}
        </span>
      )}
    </label>
  );
}
