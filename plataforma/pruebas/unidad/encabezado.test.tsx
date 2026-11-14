// Encabezado y marcos (plan 2, tarea 4).
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Encabezado } from '../../app/componentes/Encabezado';
import { MarcoAcceso } from '../../app/componentes/MarcoAcceso';
import { MarcoPagina } from '../../app/componentes/MarcoPagina';
import { TarjetaAcceso } from '../../app/componentes/TarjetaAcceso';

const html = (e: ReactElement) => renderToStaticMarkup(e);

describe('Encabezado', () => {
  it('Encabezado de acceso: logo con alt, título y subtítulo; sin usuario', () => {
    const h = html(<Encabezado />);
    expect(h).toContain('alt="Logo de la Pastoral de Comunicaciones"');
    expect(h).toContain('src="data:image/png;base64,');
    expect(h).toContain('Parroquia en Vivo');
    expect(h).toContain('Pastoral de Comunicaciones · Ciudad Arce');
    expect(h).not.toContain('/editor/cuenta');
    expect(h).not.toContain('href="/editor"');
    expect(h).toMatch(/^<header class="pv-encabezado">/);
  });
  it('Encabezado con usuario enlaza a Mi cuenta', () => {
    const h = html(<Encabezado usuario={{ etiqueta: 'Fabricio · Coordinador', inicial: 'F' }} enlaceInicio />);
    expect(h).toContain('href="/editor/cuenta"');
    expect(h).toContain('aria-label="Mi cuenta: Fabricio · Coordinador"');
    expect(h).toContain('href="/editor"');
    expect(h).toContain('>F</span>');
  });
  it('variante editor con chip antes de la etiqueta', () => {
    const h = html(<Encabezado variante="editor" chip={<span className="x">chip</span>} usuario={{ etiqueta: 'María López · Coordinador', inicial: 'M' }} />);
    expect(h).toContain('pv-usuario--editor');
    expect(h.indexOf('chip')).toBeLessThan(h.indexOf('María López'));
  });
});

describe('Marcos', () => {
  it('MarcoAcceso: encabezado sin usuario y main centrado', () => {
    const h = html(<MarcoAcceso>hola</MarcoAcceso>);
    expect(h).toContain('<main class="pv-acceso">hola</main>');
    expect(h).not.toContain('pv-usuario');
  });
  it('TarjetaAcceso con ancho y separación', () => {
    expect(html(<TarjetaAcceso ancho={480} separacion={12}>x</TarjetaAcceso>)).toBe(
      '<div class="pv-tarjeta-acceso pv-tarjeta-acceso--480 pv-tarjeta-acceso--sep-12">x</div>',
    );
    expect(html(<TarjetaAcceso>x</TarjetaAcceso>)).toBe('<div class="pv-tarjeta-acceso pv-tarjeta-acceso--440 pv-tarjeta-acceso--sep-18">x</div>');
  });
  it('MarcoPagina: encabezado con usuario y enlace al inicio', () => {
    const h = html(<MarcoPagina usuario={{ etiqueta: 'a@x.org · Coordinador', inicial: 'A' }}>contenido</MarcoPagina>);
    expect(h).toContain('href="/editor/cuenta"');
    expect(h).toContain('href="/editor"');
    expect(h).toContain('contenido');
  });
});
