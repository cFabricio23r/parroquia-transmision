'use client';
// Mover la foto (pantallas más opciones): tres deslizadores nativos por foto, con su etiqueta visible y
// el valor dicho en palabras para el lector de pantalla, más «Volver a como venía» (borra el encuadre).
// Las flechas del teclado vienen del input nativo.
import { useId } from 'react';
import { Boton } from './Boton';

export interface ValoresFoto {
  x: number;
  y: number;
  zoom: number;
}
type Eje = keyof ValoresFoto;

/** El valor de un deslizador en palabras: «Al centro», «Más a la izquierda (30 %)», «Más cerca (150 %)». */
export function textoDeslizador(eje: Eje, n: number): string {
  if (eje === 'zoom') return n <= 100 ? 'Sin acercar' : `Más cerca (${n} %)`;
  if (n === 50) return eje === 'x' ? 'Al centro' : 'Al medio';
  const lado = eje === 'x' ? (n < 50 ? 'Más a la izquierda' : 'Más a la derecha') : n < 50 ? 'Más arriba' : 'Más abajo';
  return `${lado} (${n} %)`;
}

const DESLIZADORES: { eje: Eje; etiqueta: string; min: number; max: number }[] = [
  { eje: 'x', etiqueta: 'Hacia los lados', min: 0, max: 100 },
  { eje: 'y', etiqueta: 'Arriba / abajo', min: 0, max: 100 },
  { eje: 'zoom', etiqueta: 'Acercar', min: 100, max: 200 },
];

export function DeslizadoresFoto({
  titulo,
  valores,
  onCambiar,
  onVolver,
}: {
  titulo: string;
  valores: ValoresFoto;
  onCambiar: (v: ValoresFoto) => void;
  onVolver: () => void;
}) {
  const id = useId();
  return (
    <fieldset className="pv-deslizadores">
      <legend className="pv-segmentado-etiqueta">{titulo}</legend>
      {DESLIZADORES.map((d) => (
        <div key={d.eje} className="pv-deslizador">
          <label htmlFor={`${id}-${d.eje}`} className="pv-deslizador-etiqueta">{d.etiqueta}</label>
          <input
            id={`${id}-${d.eje}`}
            type="range"
            min={d.min}
            max={d.max}
            step={1}
            value={valores[d.eje]}
            aria-valuetext={textoDeslizador(d.eje, valores[d.eje])}
            onChange={(e) => onCambiar({ ...valores, [d.eje]: Number(e.target.value) })}
          />
        </div>
      ))}
      <div>
        <Boton variante="secundario" compacto onClick={onVolver}>
          Volver a como venía
        </Boton>
      </div>
    </fieldset>
  );
}
