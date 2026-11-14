// Ayudas de Identidad (plan 3, Tarea 12): texto sobre el acento y subida de imágenes.
import { describe, expect, it } from 'vitest';
import { MENSAJE_RED_SUBIDA, MENSAJE_SESION, RE_HEX, subirImagen, textoSobreAcento } from '../../lib/editor/imagen';
import { nombreDeImagen } from '../../lib/editor/galeria';

const respuesta = (estado: number, cuerpo: unknown) =>
  ({ status: estado, ok: estado >= 200 && estado < 300, json: async () => cuerpo }) as unknown as Response;

describe('textoSobreAcento', () => {
  it('sobre dorado, texto oscuro y se lee bien', () => {
    const r = textoSobreAcento('#d9a441');
    expect(r.etiqueta).toBe('Sobre acento, texto oscuro');
    expect(r.razon).toBeGreaterThan(4.5);
  });
  it('sobre azul oscuro, texto claro', () => {
    expect(textoSobreAcento('#0c3562').etiqueta).toBe('Sobre acento, texto claro');
  });
  it('RE_HEX solo acepta #rrggbb', () => {
    expect(RE_HEX.test('#8a1c2b')).toBe(true);
    expect(RE_HEX.test('#8a1')).toBe(false);
  });
});

describe('subirImagen', () => {
  const archivo = new File([new Uint8Array([1, 2, 3])], 'logo.png', { type: 'image/png' });
  it('200 → src y url, con un POST multipart con archivo y campo', async () => {
    let pedido: { url: string; init: RequestInit } | null = null;
    const f = (async (url: string, init: RequestInit) => {
      pedido = { url, init };
      return respuesta(200, { src: 'medios/logo-blanco-abcd1234.png', url: 'https://firmada' });
    }) as unknown as typeof fetch;
    expect(await subirImagen('san-jose', 'logo-blanco', archivo, f)).toEqual({ src: 'medios/logo-blanco-abcd1234.png', url: 'https://firmada' });
    expect(pedido!.url).toBe('/editor/api/san-jose/imagen');
    expect(pedido!.init.method).toBe('POST');
    const cuerpo = pedido!.init.body as FormData;
    expect(cuerpo.get('campo')).toBe('logo-blanco');
    expect(cuerpo.get('archivo')).toBeInstanceOf(File);
  });
  it('401 → estado 401 con el mensaje de sesión', async () => {
    const f = (async () => respuesta(401, { error: 'x' })) as unknown as typeof fetch;
    expect(await subirImagen('san-jose', 'logo-blanco', archivo, f)).toEqual({ error: MENSAJE_SESION, estado: 401 });
  });
  it('otro error → el del servidor', async () => {
    const f = (async () => respuesta(400, { error: 'logo-blanco: el archivo no es una imagen PNG, JPG, WebP ni SVG.' })) as unknown as typeof fetch;
    expect(await subirImagen('san-jose', 'logo-blanco', archivo, f)).toEqual({
      error: 'logo-blanco: el archivo no es una imagen PNG, JPG, WebP ni SVG.',
      estado: 400,
    });
  });
  it('red caída → el mensaje de red', async () => {
    const f = (async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;
    expect(await subirImagen('san-jose', 'logo-blanco', archivo, f)).toEqual({ error: MENSAJE_RED_SUBIDA, estado: 0 });
    expect(MENSAJE_RED_SUBIDA).toBe('No se pudo subir. Revisa tu conexión y vuelve a intentarlo.');
  });
});

describe('nombreDeImagen', () => {
  it('nombre, si no alt, si no «Imagen sin descripción»', () => {
    expect(nombreDeImagen({ id: 'img-a', src: 'medios/a.png', alt: 'A' })).toBe('A');
    expect(nombreDeImagen({ id: 'img-a', src: 'medios/a.png', alt: 'A', nombre: 'N' })).toBe('N');
    expect(nombreDeImagen({ id: 'img-a', src: 'medios/a.png', alt: '' })).toBe('Imagen sin descripción');
  });
});
