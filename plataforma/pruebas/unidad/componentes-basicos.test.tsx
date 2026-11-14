// Componentes básicos del sistema visual (plan 2, tarea 2).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Boton } from '../../app/componentes/Boton';
import { CajaInfo } from '../../app/componentes/CajaInfo';
import { Chip } from '../../app/componentes/Chip';
import { EnlaceTexto } from '../../app/componentes/EnlaceTexto';
import { PuntoEstado, TEXTO_ESTADO } from '../../app/componentes/PuntoEstado';
import { Tarjeta } from '../../app/componentes/Tarjeta';

const html = (e: ReactElement) => renderToStaticMarkup(e);
const css = readFileSync(resolve(__dirname, '..', '..', 'app', 'estilos', 'componentes.css'), 'utf8');
/** El bloque de reglas de un selector exacto (la primera aparición). */
const regla = (selector: string) => {
  const i = css.indexOf(`${selector} {`);
  if (i < 0) return '';
  return css.slice(i, css.indexOf('}', i));
};

describe('Boton', () => {
  it('Boton con href y target=_blank abre en otra pestaña con rel=noopener', () => {
    const h = html(
      <Boton href="/editor/entrar" variante="secundario" target="_blank">
        Entrar de nuevo
      </Boton>,
    );
    expect(h).toContain('target="_blank"');
    expect(h).toContain('rel="noopener"');
    expect(html(<Boton href="/x">x</Boton>)).not.toContain('target=');
  });
  it('Boton primario es un button con sus clases y type=button por defecto', () => {
    expect(html(<Boton>Entrar</Boton>)).toBe('<button type="button" class="pv-boton pv-boton--primario">Entrar</button>');
  });
  it('Boton con href es un enlace; compacto y peligro suman clases', () => {
    const h = html(
      <Boton href="/editor/p/x" variante="secundario" compacto aria-label="Editar X">
        Editar
      </Boton>,
    );
    expect(h).toMatch(/^<a [^>]*href="\/editor\/p\/x"/);
    expect(h).toContain('pv-boton--secundario');
    expect(h).toContain('pv-boton--compacto');
    expect(h).toContain('aria-label="Editar X"');
    const p = html(
      <Boton variante="peligro" type="submit" anchoCompleto disabled>
        Cerrar sesión
      </Boton>,
    );
    expect(p).toContain('type="submit"');
    expect(p).toContain('pv-boton--peligro');
    expect(p).toContain('pv-boton--ancho');
    expect(p).toContain('disabled=""');
  });
});

describe('PuntoEstado', () => {
  it('PuntoEstado lleva el texto para lectores', () => {
    const h = html(<PuntoEstado estado="falta" />);
    expect(h).toContain('title="Falta algo"');
    expect(h).toContain('aria-hidden="true"');
    expect(h).toContain('<span class="pv-solo-lectores">Falta algo</span>');
    expect(TEXTO_ESTADO).toEqual({ listo: 'Listo', revisar: 'Revisar', falta: 'Falta algo', opcional: 'Opcional' });
  });
});

describe('Chip, Tarjeta, CajaInfo y EnlaceTexto', () => {
  it('Chip ámbar y Tarjeta con etiqueta', () => {
    expect(html(<Chip tono="ambar">Borrador</Chip>)).toBe('<span class="pv-chip pv-chip--ambar">Borrador</span>');
    expect(html(<Tarjeta como="section" etiqueta="Datos" relleno={26}>x</Tarjeta>)).toBe(
      '<section aria-label="Datos" class="pv-tarjeta pv-tarjeta--26">x</section>',
    );
    expect(html(<Tarjeta>x</Tarjeta>)).toBe('<div class="pv-tarjeta pv-tarjeta--0">x</div>');
  });
  it('CajaInfo y EnlaceTexto', () => {
    expect(html(<CajaInfo>Hola</CajaInfo>)).toBe('<div class="pv-info">Hola</div>');
    const e = html(<EnlaceTexto href="/editor/olvide">Olvidé mi contraseña</EnlaceTexto>);
    expect(e).toContain('href="/editor/olvide"');
    expect(e).toContain('class="pv-enlace"');
    expect(html(<EnlaceTexto href="/x" tamano={12}>x</EnlaceTexto>)).toContain('class="pv-enlace pv-enlace--12"');
  });
});

describe('componentes.css', () => {
  it('componentes.css trae los valores del artboard', () => {
    expect(regla('.pv-boton')).toMatch(/min-height:\s*44px/);
    expect(regla('.pv-boton')).toMatch(/border-radius:\s*10px/);
    expect(regla('.pv-boton')).toMatch(/font-size:\s*15px/);
    expect(regla('.pv-boton--compacto')).toMatch(/min-height:\s*40px/);
    expect(regla('.pv-boton--compacto::after')).toMatch(/inset:\s*-2px 0/);
    expect(regla('.pv-chip')).toMatch(/border-radius:\s*999px/);
    expect(regla('.pv-tarjeta')).toMatch(/border-radius:\s*14px/);
    expect(regla('.pv-punto')).toMatch(/width:\s*9px/);
    expect(regla('.pv-info')).toMatch(/padding:\s*12px 14px/);
  });
});
