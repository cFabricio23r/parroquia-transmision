// Títulos en cámara (2026-11-27): la lista de la parroquia para la parte blanca de la barra sobre la cámara.
// El panel los muestra como botones en En vivo; los topes (12 títulos, 40 caracteres) son los de vicaria
// (`validarConfig`, `_validarTitulosCamara`).
import { Boton } from '../../../../componentes/Boton';
import { CampoTexto } from '../../../../componentes/CampoTexto';

export const MAX_TITULOS_CAMARA = 12;
export const MAX_TITULO_CAMARA = 40;
export const AYUDA_TITULOS_CAMARA = 'Salen como botones en el panel, en En vivo. Quien transmite elige cuál se ve en la barra.';
export const SIN_TITULOS_CAMARA = 'Todavía no hay títulos. Si no agregás ninguno, la barra muestra el del tipo de transmisión.';

export function ListaTitulosCamara({ titulos, onCambiar }: { titulos: string[]; onCambiar: (t: string[]) => void }) {
  const cambiarUno = (i: number, v: string) => onCambiar(titulos.map((t, j) => (j === i ? v : t)));
  return (
    <div className="pv-titulos-camara">
      <h2 id="pv-titulos-camara-titulo" className="pv-subtitulo">
        Títulos en cámara
      </h2>
      <p className="pv-campo-ayuda">{AYUDA_TITULOS_CAMARA}</p>
      {titulos.length === 0 && <p>{SIN_TITULOS_CAMARA}</p>}
      {titulos.map((t, i) => (
        <div key={i} className="pv-opcion-fila">
          <CampoTexto
            id={`titulo-camara-${i}`}
            etiqueta={`Título ${i + 1}`}
            maxLength={MAX_TITULO_CAMARA}
            value={t}
            onChange={(e) => cambiarUno(i, e.target.value)}
          />
          <Boton variante="secundario" compacto aria-label={`Quitar el título ${i + 1}`} onClick={() => onCambiar(titulos.filter((_, j) => j !== i))}>
            Quitar
          </Boton>
        </div>
      ))}
      <Boton variante="secundario" disabled={titulos.length >= MAX_TITULOS_CAMARA} onClick={() => onCambiar([...titulos, ''])}>
        Agregar título
      </Boton>
    </div>
  );
}
