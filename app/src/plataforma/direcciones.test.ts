import { esRutaDeMedio, esSlugValido, esUrlPermitida, normalizarOrigen, urlDePagina } from './direcciones';

describe('normalizarOrigen', () => {
  it('deja igual un origen https ya normal', () => {
    expect(normalizarOrigen('https://plataforma.vercel.app')).toBe('https://plataforma.vercel.app');
    expect(normalizarOrigen('https://x.app:8443')).toBe('https://x.app:8443');
  });

  it('pasa a minúsculas y quita la barra final', () => {
    expect(normalizarOrigen('HTTPS://Plataforma.Vercel.App/')).toBe('https://plataforma.vercel.app');
  });

  it.each([
    'http://x.app',
    'https://x.app/editor',
    'https://u@x.app',
    'https://x.app?q=1',
    'https://x.app#a',
    'x.app',
    '',
    'https://x.app.',
    'file:///android_asset/',
  ])('rechaza %p', (texto) => {
    expect(normalizarOrigen(texto)).toBeNull();
  });
});

describe('esUrlPermitida', () => {
  const origen = 'https://plataforma.vercel.app';

  it.each([
    'file:///android_asset/app/transicion.html',
    'https://plataforma.vercel.app/ciudad-arce/panel.html?modo=app',
  ])('permite %p', (url) => {
    expect(esUrlPermitida(url, origen)).toBe(true);
  });

  it.each([
    'https://plataforma.vercel.app.evil.com/x',
    'https://plataforma.vercel.app@evil.com/x',
    'http://plataforma.vercel.app/x',
    'https://plataforma.vercel.app:444/x',
    'https://evil.com/?https://plataforma.vercel.app',
    'file:///data/x',
    'javascript:alert(1)',
    undefined,
  ])('bloquea %p', (url) => {
    expect(esUrlPermitida(url, origen)).toBe(false);
  });
});

describe('esSlugValido', () => {
  it.each(['ciudad-arce', 'abc'])('acepta %p', (s) => {
    expect(esSlugValido(s)).toBe(true);
  });

  it.each(['ab', 'Ciudad', 'a_b', '-a', 'a--b', 'a'.repeat(41), "x');alert(1)//"])('rechaza %p', (s) => {
    expect(esSlugValido(s)).toBe(false);
  });
});

describe('esRutaDeMedio', () => {
  it('acepta un archivo dentro de medios/', () => {
    expect(esRutaDeMedio('medios/logo.png')).toBe(true);
  });

  it.each(['medios/../x.png', 'medios/a/b.png', 'img/x.png', 'medios/x.gif'])('rechaza %p', (r) => {
    expect(esRutaDeMedio(r)).toBe(false);
  });
});

describe('urlDePagina', () => {
  it('arma la dirección de una página de la parroquia', () => {
    expect(urlDePagina('https://p.app', 'ciudad-arce', 'pantalla.html?tipo=inicio')).toBe(
      'https://p.app/ciudad-arce/pantalla.html?tipo=inicio',
    );
  });

  it('lanza con un slug inválido', () => {
    expect(() => urlDePagina('https://p.app', '../otra', 'panel.html')).toThrow();
  });
});
