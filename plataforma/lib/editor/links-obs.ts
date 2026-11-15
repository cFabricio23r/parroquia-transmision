// Los links para pegar en OBS: uno por escena, como en obs/LEEME (cada escena tiene su fuente de navegador),
// más el panel (dock) y los rótulos. Los usan Resumen (F1) y Revisar y publicar (F12). Puro.

export interface LinkObs {
  etiqueta: string;
  archivo: string;
}

export const LINKS_OBS: readonly LinkObs[] = [
  { etiqueta: 'Panel de control (dock de OBS)', archivo: 'panel.html' },
  { etiqueta: 'Inicio (en breve comenzamos)', archivo: 'pantalla.html?tipo=inicio' },
  { etiqueta: 'Portada', archivo: 'pantalla.html?tipo=portada' },
  { etiqueta: 'Avisos', archivo: 'pantalla.html?tipo=avisos' },
  { etiqueta: 'Horarios', archivo: 'pantalla.html?tipo=horarios' },
  { etiqueta: 'Gracias', archivo: 'pantalla.html?tipo=gracias' },
  { etiqueta: 'Producción (azul)', archivo: 'produccion.html?estilo=azul' },
  { etiqueta: 'Producción (claro)', archivo: 'produccion.html?estilo=claro' },
  { etiqueta: 'Rótulos (sobre la cámara)', archivo: 'rotulos.html' },
];

/** La dirección completa: el editor y las pantallas se sirven del mismo origen (local o publicado). */
export function urlObs(origen: string, slug: string, archivo: string): string {
  return `${origen.replace(/\/+$/, '')}/${slug}/${archivo}`;
}
