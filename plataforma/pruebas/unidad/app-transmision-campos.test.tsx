// «App y transmisión» sin autocompletado de Chrome (2026-11-23).
// Con un type="password" en la pantalla, Chrome la trata como login: llenaba el servidor con el correo guardado y
// la clave con la contraseña. autocomplete="off" no lo impide en campos de login (MDN). La clave va como texto
// tapado por CSS.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../app/editor/p/[slug]/ProveedorBorrador', () => ({
  useBorrador: () => ({ datos: { slug: 'prueba' }, recordarFormulario: () => {} }),
}));

const { SeccionAppTransmision } = await import('../../app/editor/p/[slug]/app-y-transmision/SeccionAppTransmision');

const html = renderToStaticMarkup(
  <SeccionAppTransmision inicial={{ ajustes: null, clave: null } as never} />,
);
const input = (id: string) => html.match(new RegExp(`<input[^>]*id="${id}"[^>]*>`))?.[0] ?? '';

describe('App y transmisión: Chrome no autocompleta', () => {
  it('no hay ningún campo de contraseña', () => {
    expect(input('app-clave')).not.toBe('');
    expect(html).not.toContain('type="password"');
  });

  it('la clave es texto tapado, sin autocompletar ni corrector', () => {
    const c = input('app-clave');
    expect(c).toContain('type="text"');
    expect(c).toMatch(/class="[^"]*\bpv-campo-oculto\b/);
    expect(c).toContain('autoComplete="off"');
    expect(c).toContain('spellCheck="false"');
    expect(c).toContain('autoCapitalize="off"');
    expect(c).toContain('autoCorrect="off"');
  });

  it('el servidor no autocompleta', () => {
    expect(input('app-servidor')).toContain('autoComplete="off"');
  });

  it('el CSS tapa la clave', () => {
    const css = readFileSync(resolve(__dirname, '..', '..', 'app/estilos/componentes.css'), 'utf8');
    expect(css).toMatch(/\.pv-campo-oculto\s*\{[^}]*-webkit-text-security:\s*disc/);
  });
});
