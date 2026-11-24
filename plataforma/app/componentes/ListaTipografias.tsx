'use client';
// Lista de tipografías del rótulo (diseños de rótulo): radios nativos dentro de un fieldset, cada
// opción escrita en su propia letra. Las flechas del teclado vienen del radio nativo.
export function ListaTipografias({
  etiqueta,
  opciones,
  familias,
  valor,
  onCambiar,
  nombre = 'rotulos-tipografia',
}: {
  etiqueta: string;
  opciones: { valor: string; texto: string }[];
  /** La `font-family` de cada valor (estilos/fuentes.css). */
  familias: Record<string, string>;
  valor: string;
  onCambiar: (v: string) => void;
  /** El `name` de los radios: dos listas en la misma página necesitan nombres distintos. */
  nombre?: string;
}) {
  return (
    <fieldset className="pv-tipografias">
      <legend className="pv-segmentado-etiqueta">{etiqueta}</legend>
      <div className="pv-tipografias-lista">
        {opciones.map((o) => (
          <label key={o.valor} className="pv-tipografia" style={{ fontFamily: familias[o.valor] }}>
            <input
              type="radio"
              name={nombre}
              value={o.valor}
              checked={o.valor === valor}
              onChange={() => onCambiar(o.valor)}
            />
            {o.texto}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
