// Menú lateral, pestañas, interruptor y segmentado (plan 2, tarea 6).
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Interruptor } from '../../app/componentes/Interruptor';
import { MenuLateral } from '../../app/componentes/MenuLateral';
import { Pestanas } from '../../app/componentes/Pestanas';
import { Segmentado } from '../../app/componentes/Segmentado';

const html = (e: ReactElement) => renderToStaticMarkup(e);
const nada = () => {};

describe('MenuLateral', () => {
  it('ítem actual, ítem sin estado y pie', () => {
    const h = html(
      <MenuLateral
        items={[
          { href: '/a', texto: 'Resumen', estado: 'listo' },
          { href: '/b', texto: 'Identidad', estado: 'listo', actual: true },
          { href: '/c', texto: 'Publicar' },
        ]}
        pie="Todo se guarda solo como borrador."
      />,
    );
    expect(h).toContain('aria-label="Secciones del editor"');
    expect((h.match(/aria-current="page"/g) ?? []).length).toBe(1);
    expect(h).toMatch(/aria-current="page"[^>]*>Identidad/);
    const publicar = h.slice(h.indexOf('>Publicar'));
    expect(publicar.slice(0, publicar.indexOf('</a>'))).not.toContain('pv-punto');
    expect((h.match(/pv-punto /g) ?? []).length).toBe(2);
    expect(h).toContain('Todo se guarda solo como borrador.');
    expect(h).toContain('pv-menu-pie');
  });
});

describe('Pestanas', () => {
  it('etiqueta por defecto y un solo aria-current', () => {
    const h = html(
      <Pestanas
        items={[
          { href: '/editor/admin', texto: 'Parroquias', actual: true },
          { href: '/editor/admin/coordinadores', texto: 'Coordinadores' },
          { href: '/editor/admin/registro', texto: 'Registro' },
        ]}
      />,
    );
    expect(h).toContain('aria-label="Secciones"');
    expect((h.match(/aria-current="page"/g) ?? []).length).toBe(1);
  });
});

describe('Interruptor', () => {
  it('role=switch con su estado y etiqueta', () => {
    const h = html(<Interruptor etiqueta="Logo" activo={false} onCambiar={nada} />);
    expect(h).toContain('role="switch"');
    expect(h).toContain('aria-checked="false"');
    expect(h).toContain('aria-label="Logo"');
    expect(h).toContain('type="button"');
    expect(html(<Interruptor etiqueta="Logo" activo onCambiar={nada} />)).toContain('aria-checked="true"');
  });
});

describe('Segmentado', () => {
  it('un solo botón presionado y el grupo apunta a su etiqueta', () => {
    const h = html(
      <Segmentado
        etiqueta="Fondo"
        opciones={[
          { valor: 'colores', texto: 'Colores de la parroquia' },
          { valor: 'foto', texto: 'Foto de la galería' },
          { valor: 'liso', texto: 'Color liso' },
        ]}
        valor="foto"
        onCambiar={nada}
      />,
    );
    expect((h.match(/aria-pressed="true"/g) ?? []).length).toBe(1);
    expect((h.match(/aria-pressed="false"/g) ?? []).length).toBe(2);
    const id = h.match(/aria-labelledby="([^"]+)"/)![1];
    expect(h).toContain(`id="${id}"`);
    expect(h).toContain('role="group"');
  });
});
