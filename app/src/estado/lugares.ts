// Dónde va cada cosa de App, en dp (Tareas 9c y 9i). Sale de App.tsx para poder probarlo.
import type { ZonasSeguras } from '../../modules/transmisor/src/TransmisorModule';
import { M } from '../componentes/tema';
import { rectCompleta } from './zoom';

export type Rect = { left: number; top: number; width: number; height: number };

export type Lugares = {
  vertical: boolean;
  lienzo: Rect;
  barra: Rect;
  vista: Rect;
  capa: Rect;
  tira: Rect;
  listo: Rect;
  panel: Rect;
};

// Medidas de Preparar en vertical (lienzo, artboard 9: 390×844 dp).
// La tira va en dos filas de 4 (2026-11-27): con 8 escenas en una fila, a 360 dp cada botón quedaba de ~38 dp
// y «Comunión» o «Producción» se cortaban.
export const TIRA_VERTICAL = { columnas: 4, hueco: 5, filaAlto: 44 } as const;
const V = {
  borde: 12,
  tiraAlto: 2 * TIRA_VERTICAL.filaAlto + TIRA_VERTICAL.hueco,
  listoAlto: 60,
  abajo: 16,
  hueco: 8,
  huecoPanel: 12,
} as const;

// Acostado: lo que separa la vista previa del panel, y lo mínimo que puede quedar el panel.
const HUECO_PANEL = 12;
export const PANEL_MINIMO = 300;

/**
 * Dónde va cada cosa, en dp, dentro del lienzo de App. Sale del tamaño real de la ventana y de
 * las zonas seguras (barra de estado, recorte de la cámara, barra de navegación): nada queda
 * debajo de ellas.
 */
export function armarLugares(anchoVentana: number, altoVentana: number, z: ZonasSeguras): Lugares {
  const ancho = anchoVentana - z.left - z.right;
  const alto = altoVentana - z.top - z.bottom;
  if (altoVentana > anchoVentana) {
    const w = ancho - 2 * V.borde;
    const vistaAlto = Math.round((w * 9) / 16);
    const barra: Rect = { left: V.borde, top: V.borde, width: w, height: M.barraAlto };
    const vista: Rect = { left: V.borde, top: barra.top + M.barraAlto + 10, width: w, height: vistaAlto };
    const tira: Rect = { left: V.borde, top: vista.top + vistaAlto + V.hueco, width: w, height: V.tiraAlto };
    const listo: Rect = { left: V.borde, top: alto - V.abajo - V.listoAlto, width: w, height: V.listoAlto };
    const panelArriba = tira.top + V.tiraAlto + V.huecoPanel;
    const panel: Rect = { left: V.borde, top: panelArriba, width: w, height: Math.max(0, listo.top - V.huecoPanel - panelArriba) };
    const lienzo: Rect = { left: z.left, top: z.top, width: ancho, height: alto };
    return { vertical: true, lienzo, barra, vista, capa: vista, tira, listo, panel };
  }
  // Acostado: vista previa de 448×252 y panel de 360 a la derecha, centrados. Si con el recorte y la
  // barra de botones no entra (Tarea 9i: 803 dp libres en el SM-S948B contra 820), el panel cede lo
  // que falta, hasta PANEL_MINIMO; la vista previa no cambia.
  const falta = Math.max(0, M.vistaAncho + HUECO_PANEL + M.panelAncho - ancho);
  const panelAncho = Math.max(PANEL_MINIMO, M.panelAncho - falta);
  const w = M.vistaAncho + HUECO_PANEL + panelAncho;
  const abajo = M.vistaAlto + M.separacion + M.abajoAlto;
  const h = M.barraAlto + M.separacion + abajo;
  const lienzo: Rect = {
    left: z.left + Math.max(0, (ancho - w) / 2),
    top: z.top + Math.max(0, (alto - h) / 2),
    width: w,
    height: h,
  };
  const barra: Rect = { left: 0, top: 0, width: w, height: M.barraAlto };
  const arriba = M.barraAlto + M.separacion;
  const vista: Rect = { left: 0, top: arriba, width: M.vistaAncho, height: M.vistaAlto };
  const capa: Rect = { left: 0, top: arriba, width: M.vistaAncho, height: abajo };
  const panel: Rect = { left: M.vistaAncho + HUECO_PANEL, top: arriba, width: panelAncho, height: abajo };
  return { vertical: false, lienzo, barra, vista, capa, tira: capa, listo: capa, panel };
}

/** Los lugares en pantalla completa: la vista en 16:9 y el panel corrido fuera de la pantalla. */
export function lugaresCompletos(anchoVentana: number, altoVentana: number, z: ZonasSeguras, normales: Lugares): Lugares {
  const ancho = anchoVentana - z.left - z.right;
  const alto = altoVentana - z.top - z.bottom;
  const lienzo: Rect = { left: z.left, top: z.top, width: ancho, height: alto };
  const vista = rectCompleta(ancho, alto);
  const fuera: Rect = { left: anchoVentana + 100, top: 0, width: normales.panel.width, height: normales.panel.height };
  return { ...normales, lienzo, vista, capa: vista, tira: vista, listo: vista, panel: fuera, barra: { ...fuera, height: 0 } };
}
