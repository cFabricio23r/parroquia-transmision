// Qué clics pregunta la guardia de salida del editor (ronda final): solo los enlaces que cambian de
// página dentro del sitio, sin teclas que abran otra pestaña.
import { describe, expect, it } from 'vitest';
import { destinoDeClic } from '../../app/editor/p/[slug]/GuardiaSalida';

const actual = { href: 'http://127.0.0.1:3200/editor/p/x/avisos', origin: 'http://127.0.0.1:3200', pathname: '/editor/p/x/avisos', search: '' } as Location;

function clic(href: string | null, opciones: Partial<MouseEvent> = {}, atributos: Record<string, string> = {}) {
  const enlace = href === null ? null : { href: new URL(href, actual.href).href, target: atributos.target ?? '', hasAttribute: (n: string) => n in atributos };
  return { defaultPrevented: false, button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, target: { closest: () => enlace }, ...opciones } as unknown as MouseEvent;
}

describe('destinoDeClic', () => {
  it('un enlace a otra sección devuelve su ruta', () => {
    expect(destinoDeClic(clic('/editor/p/x/identidad'), actual)).toBe('/editor/p/x/identidad');
  });
  it('fuera de un enlace, a la misma página o a otro sitio, no pregunta', () => {
    expect(destinoDeClic(clic(null), actual)).toBeNull();
    expect(destinoDeClic(clic('/editor/p/x/avisos#lista'), actual)).toBeNull();
    expect(destinoDeClic(clic('https://ejemplo.org/'), actual)).toBeNull();
  });
  it('con Ctrl, en otra pestaña o para descargar, no pregunta', () => {
    expect(destinoDeClic(clic('/editor/p/x/identidad', { ctrlKey: true }), actual)).toBeNull();
    expect(destinoDeClic(clic('/editor/p/x/identidad', {}, { target: '_blank' }), actual)).toBeNull();
    expect(destinoDeClic(clic('/editor/p/x/identidad', {}, { download: '' }), actual)).toBeNull();
  });
});
