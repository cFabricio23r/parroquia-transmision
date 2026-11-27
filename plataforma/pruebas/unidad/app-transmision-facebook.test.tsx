// «App y transmisión»: la tarjeta «Facebook de la parroquia» (Tarea 6) y la tarjeta de respaldo.
// Artboards C1 (sin conectar), C4 (conectado), D1 (volver a conectar) y D2 (cuenta no invitada).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { EstadoAppTransmision } from '../../lib/app-transmision-reglas';

vi.mock('../../app/editor/p/[slug]/ProveedorBorrador', () => ({
  useBorrador: () => ({ datos: { slug: 'prueba' }, recordarFormulario: () => {} }),
}));

const { SeccionAppTransmision } = await import('../../app/editor/p/[slug]/app-y-transmision/SeccionAppTransmision');

type Fb = NonNullable<EstadoAppTransmision['facebook']>;
const CONECTADO: Fb = {
  estado: 'conectado',
  cuenta: 'Comunicaciones Ciudad Arce',
  conectadoPor: 'Ana Coordinadora',
  conectadoEn: '2026-11-26T18:00:00Z',
  principal: 'Parroquia Ciudad Arce',
  extras: [
    { nombre: 'Vicaría Ciudad Arce', porDefecto: true },
    { nombre: 'Sector 3', porDefecto: false },
  ],
};
const SIN: Fb = { estado: 'sin-conectar', cuenta: null, conectadoPor: null, conectadoEn: null, principal: null, extras: [] };
const RECONECTAR: Fb = { ...CONECTADO, estado: 'reconectar' };

const dibujar = (facebook: Fb | null, error: string | null = null, guardada = true) =>
  renderToStaticMarkup(
    <SeccionAppTransmision
      inicial={{ ajustes: null, clave: guardada ? { guardadaEn: '2026-11-14T18:00:00Z' } : null, facebook }}
      errorFacebook={error}
    />,
  ).replace(/<!-- -->/g, '');

const CONECTAR = '/editor/p/prueba/app-y-transmision/facebook/conectar';
const PAGINAS = '/editor/p/prueba/app-y-transmision/facebook';
const enlace = (href: string, texto: string) => new RegExp(`<a[^>]*href="${href}"[^>]*>(?:<[^>]+>)*${texto}</a>`);

describe('C1: sin conectar', () => {
  const html = dibujar(SIN, null, false);
  it('la tarjeta va arriba de todo, con su estado en texto', () => {
    expect(html.indexOf('Facebook de la parroquia')).toBeGreaterThan(-1);
    expect(html.indexOf('Facebook de la parroquia')).toBeLessThan(html.indexOf('Clave de transmisión de respaldo'));
    expect(html).toContain('Sin conectar');
  });
  it('trae los textos del lienzo y el botón a la ruta conectar', () => {
    expect(html).toContain(
      'Conecta la cuenta de Facebook que administra las páginas de la parroquia. Después eliges en qué página sale la misa y en cuáles más se muestra.',
    );
    expect(html).toContain('Antes, la Pastoral de Comunicaciones tiene que invitar la cuenta de Facebook de la parroquia. Se pide una sola vez.');
    expect(html).toMatch(enlace(CONECTAR, 'Conectar con Facebook'));
  });
  it('la tarjeta de la clave pasó a llamarse «Clave de transmisión de respaldo» y ya no es «Facebook Live»', () => {
    expect(html).toContain('Clave de transmisión de respaldo');
    expect(html).not.toContain('Facebook Live');
    expect(html).toContain('Mientras no conectes Facebook, la app transmite con esta clave de transmisión, como hoy.');
  });
});

describe('C4: conectado', () => {
  const html = dibujar(CONECTADO);
  it('dice con qué cuenta, quién la conectó y cuándo', () => {
    expect(html).toContain('Conectado');
    expect(html).toContain('Con la cuenta Comunicaciones Ciudad Arce · la conectó Ana Coordinadora el 26 nov');
  });
  it('«SALE EN»: la principal y las extras, con la marcada por defecto', () => {
    expect(html).toContain('SALE EN');
    expect(html).toContain('Parroquia Ciudad Arce');
    expect(html).toContain('También se puede mostrar en: Vicaría Ciudad Arce (marcada por defecto), Sector 3.');
  });
  it('los tres botones: Cambiar páginas (a la Tarea 5), Volver a conectar (a conectar) y Desconectar Facebook', () => {
    expect(html).toMatch(enlace(PAGINAS, 'Cambiar páginas'));
    expect(html).toMatch(enlace(CONECTAR, 'Volver a conectar'));
    expect(html).toMatch(/<button[^>]*>Desconectar Facebook<\/button>/);
  });
  it('«Desconectar Facebook» pide confirmación con el diálogo existente', () => {
    expect(html).toContain('<dialog');
    expect(html).toContain('¿Desconectar Facebook?');
  });
  it('la tarjeta de respaldo dice cuándo se usa y de qué página tiene que ser', () => {
    expect(html).toContain(
      'Se usa solo si Facebook no responde al iniciar. Tiene que ser la clave de transmisión de la página principal, Parroquia Ciudad Arce.',
    );
    expect(html).not.toContain('Mientras no conectes');
  });
  it('sin extras no hay línea de «También se puede mostrar en»; sin principal lo dice', () => {
    expect(dibujar({ ...CONECTADO, extras: [] })).not.toContain('También se puede mostrar en');
    const sinPrincipal = dibujar({ ...CONECTADO, principal: null, extras: [] });
    expect(sinPrincipal).toContain('Todavía no elegiste dónde sale la misa.');
    expect(sinPrincipal).toContain('la clave de transmisión de la página principal.');
  });
  it('sin saber quién la conectó no inventa un nombre', () => {
    expect(dibujar({ ...CONECTADO, conectadoPor: null })).toContain('Con la cuenta Comunicaciones Ciudad Arce · conectada el 26 nov');
  });
});

describe('D1: hay que volver a conectar', () => {
  const html = dibujar(RECONECTAR);
  it('el aviso ámbar va arriba de la página, antes del título', () => {
    const aviso = 'Facebook se desconectó. La app transmite con la clave de transmisión de respaldo hasta que vuelvas a conectar.';
    expect(html).toContain(aviso);
    expect(html.indexOf(aviso)).toBeLessThan(html.indexOf('<h1'));
    expect(html).toMatch(/role="alert"[^>]*>Facebook se desconectó/);
  });
  it('estado en texto y explicación', () => {
    expect(html).toContain('Hay que volver a conectar');
    expect(html).toContain(
      'Facebook ya no acepta el acceso guardado. Pasa si se cambió la contraseña de la cuenta o se quitó el permiso. Las páginas elegidas se mantienen.',
    );
    expect(html).toMatch(enlace(CONECTAR, 'Volver a conectar'));
    const tarjeta = html.slice(html.indexOf('<section'), html.indexOf('</section>'));
    expect(tarjeta).not.toContain('Desconectar Facebook');
    expect(tarjeta).not.toContain('Cambiar páginas');
  });
  it('la tarjeta de respaldo avisa que mientras tanto transmite con esta clave de transmisión', () => {
    expect(html).toContain('Mientras tanto, la app transmite con esta clave de transmisión a la página principal.');
  });
});

describe('D2: la cuenta no está invitada (?error=no-invitada)', () => {
  const html = dibujar(SIN, 'no-invitada');
  it('muestra la pantalla D2 en lugar de la página', () => {
    expect(html).toMatch(/<h1[^>]*>Esta cuenta de Facebook todavía no puede conectarse<\/h1>/);
    expect(html).toContain(
      'Pide a la Pastoral de Comunicaciones que invite la cuenta de Facebook de la parroquia. Cuando la cuenta acepte la invitación en Facebook, vuelve a intentarlo.',
    );
    expect(html).toContain('Mientras tanto, la app sigue transmitiendo con la clave de transmisión de la parroquia.');
    expect(html).toContain('role="alert"');
  });
  it('«Intentar de nuevo» va a conectar y «Volver» a la sección', () => {
    expect(html).toMatch(enlace(CONECTAR, 'Intentar de nuevo'));
    expect(html).toMatch(enlace('/editor/p/prueba/app-y-transmision', 'Volver'));
    expect(html).toMatch(enlace('/editor/p/prueba/app-y-transmision', '‹ App y transmisión'));
  });
  it('no queda el formulario del respaldo', () => {
    expect(html).not.toContain('app-servidor');
  });
});

describe('otros estados', () => {
  it('?error=1: avisa que no se pudo conectar y sigue la página', () => {
    const html = dibujar(SIN, '1');
    expect(html).toContain('No se pudo conectar con Facebook. Intenta de nuevo');
    expect(html).toContain('Facebook de la parroquia');
  });
  it('si no se pudo leer facebook (null), lo dice y no inventa un estado', () => {
    const html = dibujar(null);
    expect(html).toContain('No se pudo leer el estado de Facebook. Recarga la página.');
    expect(html).not.toContain('Conecta la cuenta de Facebook');
    expect(html).not.toContain('Se usa solo si Facebook');
    expect(html).not.toContain('Mientras no conectes');
  });
  it('D13: no hay chip «Borrador · N cambios sin publicar» en esta pantalla', () => {
    for (const f of [SIN, CONECTADO, RECONECTAR]) expect(dibujar(f)).not.toMatch(/Borrador|sin publicar/);
  });
  it('nunca dice «clave» sola en los textos nuevos de Facebook (D3)', () => {
    for (const f of [SIN, CONECTADO, RECONECTAR]) {
      const nuevo = dibujar(f).match(/(Mientras no conectes[^<]*|Se usa solo si[^<]*|Mientras tanto[^<]*|Facebook se desconectó[^<]*)/g) ?? [];
      for (const t of nuevo) expect(t).not.toMatch(/\bclave\b(?! de transmisión)/);
    }
  });
});

describe('estilos (D11, D16, D17)', () => {
  const css = readFileSync(resolve(__dirname, '..', '..', 'app/estilos/facebook.css'), 'utf8');
  it('la tarjeta tiene sus estilos, con botones que se acomodan en pantallas angostas', () => {
    expect(css).toMatch(/\.pv-fbt-acciones[^{]*\{[^}]*flex-wrap:\s*wrap/);
    expect(css).toMatch(/\.pv-fbt-titulo[^{]*\{[^}]*font-size:\s*26px/);
  });
});
