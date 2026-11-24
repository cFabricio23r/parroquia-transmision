// Campos de color e imagen, pastilla de contraste, tabla y diálogo (plan 2, tarea 7).
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CampoColor } from '../../app/componentes/CampoColor';
import { CampoImagen } from '../../app/componentes/CampoImagen';
import { Dialogo } from '../../app/componentes/Dialogo';
import { PastillaContraste } from '../../app/componentes/PastillaContraste';
import { Tabla } from '../../app/componentes/Tabla';
import { ListaTipografias } from '../../app/componentes/ListaTipografias';
import { Segmentado } from '../../app/componentes/Segmentado';
import { CampoColorParroquia } from '../../app/editor/p/[slug]/rotulos/CampoColorParroquia';
import { formatearRazon } from '../../lib/contraste';

const html = (e: ReactElement) => renderToStaticMarkup(e);
const nada = () => {};

describe('formatearRazon', () => {
  it('trunca a un decimal y usa coma', () => {
    expect(formatearRazon(8.94)).toBe('8,9:1');
    expect(formatearRazon(4.46)).toBe('4,4:1');
    expect(formatearRazon(21)).toBe('21,0:1');
  });
});

describe('PastillaContraste', () => {
  it('verde con ✓ si alcanza el mínimo', () => {
    const h = html(<PastillaContraste etiqueta="Texto blanco sobre principal" razon={8.94} bloquea />);
    expect(h).toContain('Texto blanco sobre principal: 8,9:1 ✓');
    expect(h).toContain('pv-chip--verde');
  });
  it('ámbar con ✗ si no alcanza y no bloquea; peligro si bloquea', () => {
    const h = html(<PastillaContraste etiqueta="Sobre oscuro" razon={3.1} bloquea={false} />);
    expect(h).toContain('✗');
    expect(h).toContain('pv-chip--ambar');
    const b = html(<PastillaContraste etiqueta="Sobre oscuro" razon={3.1} bloquea />);
    expect(b).toContain('pv-chip--bloquea');
    expect(b).toContain('Sobre oscuro: 3,1:1 ✗');
  });
});

describe('CampoColor', () => {
  it('muestra la muestra del color y el input monoespaciado', () => {
    const h = html(<CampoColor id="principal" etiqueta="Color principal" valor="#8a1c2b" onCambiar={nada} />);
    expect(h).toContain('background:#8a1c2b');
    expect(h).toContain('id="principal"');
    expect(h).toContain('spellCheck="false"');
    expect(h).toContain('Color principal');
    const malo = html(<CampoColor id="x" etiqueta="X" valor="rojo" onCambiar={nada} />);
    expect(malo).toContain('pv-color-muestra--vacia');
  });
  it('el nombre del input es solo la etiqueta, aunque haya error (aria-labelledby)', () => {
    const h = html(<CampoColor id="principal" etiqueta="Color principal" valor="#8a1" onCambiar={nada} error="Escribe el color como #rrggbb." />);
    expect(h).toContain('<span id="principal-etiqueta" class="pv-campo-etiqueta">Color principal</span>');
    expect(h).toContain('aria-labelledby="principal-etiqueta"');
    expect(h).toContain('aria-describedby="principal-error"');
  });
});

describe('CampoImagen', () => {
  it('sin src muestra el texto vacío y la etiqueta del alt exacta', () => {
    const h = html(<CampoImagen id="logo" etiqueta="Logo blanco" textoVacio="logo blanco" alt="" onAlt={nada} onCambiar={nada} />);
    expect(h).toContain('logo blanco</div>');
    expect(h).toContain('Descripción para lectores de pantalla (alt)');
    expect(h).toContain('>Cambiar</button>');
    expect(h).not.toContain('Elegir de la galería');
    const conGaleria = html(<CampoImagen id="logo" etiqueta="Logo a color" opcional src="/x.png" textoVacio="logo a color" alt="Escudo" onAlt={nada} onCambiar={nada} onElegir={nada} />);
    expect(conGaleria).toContain('Elegir de la galería');
    expect(conGaleria).toContain('(opcional)');
    expect(conGaleria).toContain('<img alt=""');
  });
});

describe('Tabla', () => {
  it('cabecera con columnheader y la grilla de anchos', () => {
    const h = html(
      <Tabla
        etiqueta="Parroquias"
        columnas={[
          { titulo: 'Parroquia', ancho: '2.2fr' },
          { titulo: 'Link', ancho: '1.4fr' },
          { titulo: 'Estado', ancho: '1.1fr' },
          { titulo: 'Coordinadores', ancho: '1.5fr' },
          { titulo: '', ancho: '230px' },
        ]}
        filas={[{ clave: 'a', celdas: ['A', 'a', 'Borrador', 'María', 'Ver'] }]}
      />,
    );
    expect(h).toContain('grid-template-columns:2.2fr 1.4fr 1.1fr 1.5fr 230px');
    expect(h).toContain('role="table"');
    expect(h).toContain('aria-label="Parroquias"');
    expect((h.match(/role="columnheader"/g) ?? []).length).toBe(5);
    expect((h.match(/role="cell"/g) ?? []).length).toBe(5);
  });
});

describe('Dialogo', () => {
  it('cerrado renderiza <dialog sin open', () => {
    const h = html(
      <Dialogo abierto={false} titulo="Invitar coordinador" onCerrar={nada}>
        <p>x</p>
      </Dialogo>,
    );
    expect(h).toMatch(/^<dialog /);
    expect(h).not.toMatch(/ open/);
    const id = h.match(/aria-labelledby="([^"]+)"/)![1];
    expect(h).toContain(`<h2 id="${id}"`);
  });
  it('ancho 520 suma su clase; sin ancho, solo pv-dialogo', () => {
    const con = html(
      <Dialogo abierto={false} titulo="Subir imagen" onCerrar={nada} ancho={520}>
        <p>x</p>
      </Dialogo>,
    );
    expect(con).toContain('class="pv-dialogo pv-dialogo--520"');
    expect(html(<Dialogo abierto={false} titulo="x" onCerrar={nada}><p>x</p></Dialogo>)).toContain('class="pv-dialogo"');
  });
});

describe('CampoImagen (plan 3)', () => {
  const base = { id: 'logo', etiqueta: 'Logo blanco (PNG o SVG)', textoVacio: 'logo blanco', alt: 'Escudo', onAlt: nada, onCambiar: nada };
  it('ocupado muestra «Subiendo…» en lugar de los enlaces', () => {
    const h = html(<CampoImagen {...base} ocupado onElegir={nada} />);
    expect(h).toContain('Subiendo…');
    expect(h).toContain('role="status"');
    expect(h).not.toContain('Cambiar');
  });
  it('con error lleva un role=alert con el texto', () => {
    const h = html(<CampoImagen {...base} error="X" />);
    expect(h).toContain('role="alert"');
    expect(h).toContain('id="logo-error"');
    expect(h).toContain('>X<');
  });
});

describe('ListaTipografias (diseños de rótulo)', () => {
  const opciones = [
    { valor: 'montserrat', texto: 'Montserrat (la de hoy)' },
    { valor: 'cinzel', texto: 'Cinzel (solemne)' },
  ];
  const familias = { montserrat: 'Montserrat', cinzel: 'Cinzel' };
  it('un radio nativo por tipografía, con su texto escrito en su letra, dentro de un fieldset con leyenda', () => {
    const h = html(<ListaTipografias etiqueta="Tipografía" opciones={opciones} familias={familias} valor="cinzel" onCambiar={nada} />);
    expect(h).toContain('<legend');
    expect(h).toContain('Tipografía</legend>');
    expect((h.match(/type="radio"/g) ?? []).length).toBe(2);
    expect((h.match(/name="rotulos-tipografia"/g) ?? []).length).toBe(2);
    expect(h).toContain('font-family:Cinzel');
    expect(h).toContain('font-family:Montserrat');
    expect(h).toMatch(/value="cinzel"[^>]*checked=""|checked=""[^>]*value="cinzel"/);
    expect(h).not.toMatch(/value="montserrat"[^>]*checked=""|checked=""[^>]*value="montserrat"/);
    expect(h).toContain('Cinzel (solemne)');
  });
});

describe('Segmentado y CampoColorParroquia deshabilitados (Minimal)', () => {
  it('Segmentado con deshabilitado: botones disabled y la nota visible', () => {
    const h = html(
      <Segmentado etiqueta="Esquinas" opciones={[{ valor: 'rectas', texto: 'Rectas' }]} valor="rectas" onCambiar={nada} deshabilitado nota="El diseño Minimal no tiene caja" />,
    );
    expect(h).toContain('disabled=""');
    expect(h).toContain('El diseño Minimal no tiene caja');
    const sin = html(<Segmentado etiqueta="Esquinas" opciones={[{ valor: 'rectas', texto: 'Rectas' }]} valor="rectas" onCambiar={nada} />);
    expect(sin).not.toContain('disabled');
  });
  it('CampoColorParroquia con deshabilitado: el select queda disabled', () => {
    const h = html(
      <CampoColorParroquia id="rotulos-lado" etiqueta="Fondo del rótulo" opciones={[{ valor: '', texto: 'Como viene', hex: null }]} valor="" onCambiar={nada} deshabilitado />,
    );
    expect(h).toMatch(/<select[^>]*disabled=""/);
  });
});
