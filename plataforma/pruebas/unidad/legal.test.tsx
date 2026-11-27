// Páginas públicas que pide Meta para pasar la app «Parroquia en Vivo» a modo Live (2026-11-27):
// política de privacidad, condiciones del servicio e instrucciones para eliminar datos.
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import Privacidad from '../../app/(legal)/privacidad/page';
import Terminos from '../../app/(legal)/terminos/page';
import EliminarDatos from '../../app/(legal)/eliminar-datos/page';
import { CONTACTO, ACTUALIZADO } from '../../lib/legal';

const paginas = [
  ['privacidad', Privacidad, 'Política de privacidad'],
  ['terminos', Terminos, 'Condiciones del servicio'],
  ['eliminar-datos', EliminarDatos, 'Cómo eliminar tus datos'],
] as const;

describe('páginas legales', () => {
  it.each(paginas)('%s: un solo h1, fecha, correo de contacto y enlaces a las otras dos', (ruta, Pagina, titulo) => {
    const h = renderToStaticMarkup(<Pagina />);
    expect(h.match(/<h1[ >]/g)).toHaveLength(1);
    expect(h).toContain(`>${titulo}</h1>`);
    expect(h).toContain(ACTUALIZADO);
    expect(h).toContain(`href="${CONTACTO.href}"`);
    expect(h).toContain('<main');
    for (const [otra] of paginas) if (otra !== ruta) expect(h).toContain(`href="/${otra}"`);
  });

  it('el contacto es un enlace https o un mailto válido', () => {
    expect(CONTACTO.href).toMatch(/^(https:\/\/\S+|mailto:[^\s@]+@[^\s@]+\.[a-z]{2,})$/i);
  });

  it('privacidad nombra lo que se guarda de Facebook y que el token no sale del servidor', () => {
    const h = renderToStaticMarkup(<Privacidad />);
    expect(h).toContain('cifrad');
    expect(h).toContain('No vendemos');
    expect(h).toContain('href="/eliminar-datos"');
  });

  it('eliminar-datos explica los tres caminos: desconectar, quitar la app en Facebook y escribir', () => {
    const h = renderToStaticMarkup(<EliminarDatos />);
    expect(h).toContain('Desconectar');
    expect(h).toContain('Integraciones comerciales');
    expect(h).toContain(`href="${CONTACTO.href}"`);
    expect(h).toContain('Eliminar mis datos');
  });
});
