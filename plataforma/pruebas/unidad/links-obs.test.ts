import { describe, expect, it } from 'vitest';
import { LINKS_OBS, urlObs } from '../../lib/editor/links-obs';

describe('links para OBS', () => {
  it('un link por escena, como en el LEEME de obs/, más el panel y los rótulos', () => {
    expect(LINKS_OBS.map((l) => [l.etiqueta, l.archivo])).toEqual([
      ['Panel de control (dock de OBS)', 'panel.html'],
      ['Inicio (en breve comenzamos)', 'pantalla.html?tipo=inicio'],
      ['Portada', 'pantalla.html?tipo=portada'],
      ['Avisos', 'pantalla.html?tipo=avisos'],
      ['Comunión espiritual', 'pantalla.html?tipo=comunion'],
      ['Horarios', 'pantalla.html?tipo=horarios'],
      ['Gracias', 'pantalla.html?tipo=gracias'],
      ['Producción (azul)', 'produccion.html?estilo=azul'],
      ['Producción (claro)', 'produccion.html?estilo=claro'],
      ['Rótulos (sobre la cámara)', 'rotulos.html'],
    ]);
  });

  it('arma la dirección completa con el origen donde corre el editor', () => {
    expect(urlObs('http://localhost:3100', 'ciudad-arce', 'pantalla.html?tipo=inicio')).toBe(
      'http://localhost:3100/ciudad-arce/pantalla.html?tipo=inicio',
    );
    expect(urlObs('https://plataforma-vicaria.vercel.app/', 'san-jose', 'panel.html')).toBe(
      'https://plataforma-vicaria.vercel.app/san-jose/panel.html',
    );
  });
});
