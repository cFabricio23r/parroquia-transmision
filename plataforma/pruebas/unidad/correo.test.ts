import { afterEach, describe, expect, it, vi } from 'vitest';
import { correoInvitacion, correoRecuperar, enviarCorreo, REMITENTE, usarBuzonDePrueba, type Mensaje } from '../../lib/correo';
import { envolverCorreo, LOGO_CORREO } from '../../lib/plantilla-correo.mjs';

afterEach(() => {
  usarBuzonDePrueba(null);
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('correos', () => {
  it('correoInvitacion escapa <script> en el nombre de la parroquia y el texto plano lleva el enlace completo', () => {
    const enlace = 'https://ejemplo.org/editor/invitacion?token=abc_DEF-123';
    const c = correoInvitacion({ enlace, parroquia: '<script>alert(1)</script>', rol: 'admin"><b>' });
    expect(c.html).not.toContain('<script>');
    expect(c.html).toContain('&lt;script&gt;');
    expect(c.html).not.toContain('<b>');
    expect(c.texto).toContain(enlace);
    expect(c.html).toContain(enlace);
  });

  it('los dos correos llevan la marca: logo con texto alternativo, nombre, pie y dirección de ayuda', () => {
    for (const c of [
      correoInvitacion({ enlace: 'https://e.org/i?token=a', parroquia: 'San José', rol: 'coordinador' }),
      correoRecuperar({ enlace: 'https://e.org/r?token_hash=b' }),
    ]) {
      expect(c.html).toContain(`src="${LOGO_CORREO}"`);
      expect(c.html).toContain('alt="Logo de la Pastoral de Comunicaciones"');
      expect(c.html).toContain('Parroquia en vivo');
      expect(c.html).toContain('Pastoral de Comunicaciones · Ciudad Arce');
      expect(c.html).toContain('mailto:admin@parroquiaciudadarce.org');
      expect(c.html).toContain('<html lang="es">');
    }
  });

  it('la invitación cuenta para qué es la plataforma y avisa cuándo vence', () => {
    const c = correoInvitacion({ enlace: 'https://e.org/i?token=a', parroquia: 'San José', rol: 'coordinador' });
    expect(c.html).toContain('preparar las transmisiones de cada semana');
    expect(c.texto).toContain('preparar las transmisiones de cada semana');
    expect(c.html).toContain('vence en 7 días');
  });

  it('envolverCorreo escapa el título, la previa, el aviso y el botón', () => {
    const html = envolverCorreo({
      titulo: '<i>t</i>',
      previa: '<i>p</i>',
      parrafos: ['<strong>seguro</strong>'],
      enlace: 'https://e.org/?a=1&b=2',
      boton: '<i>b</i>',
      aviso: '<i>a</i>',
    });
    expect(html).not.toContain('<i>');
    expect(html).toContain('&lt;i&gt;p&lt;/i&gt;');
    expect(html).toContain('<strong>seguro</strong>');
    expect(html).toContain('href="https://e.org/?a=1&amp;b=2"');
  });

  it('correoRecuperar lleva el enlace en texto y en html', () => {
    const enlace = 'https://ejemplo.org/editor/nueva?token=zzz&x=1';
    const c = correoRecuperar({ enlace });
    expect(c.texto).toContain(enlace);
    expect(c.html).toContain('token=zzz&amp;x=1');
  });
});

describe('enviarCorreo', () => {
  const m: Mensaje = { para: 'a@b.c', asunto: 'Hola', texto: 'texto', html: '<p>texto</p>' };

  it('con el buzón de prueba guarda el mensaje y no envía nada', async () => {
    const buzon: Mensaje[] = [];
    usarBuzonDePrueba(buzon);
    await enviarCorreo(m);
    expect(buzon).toEqual([m]);
  });

  it('sin RESEND_API_KEY solo escribe en la consola', async () => {
    vi.stubEnv('RESEND_API_KEY', '');
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    await enviarCorreo(m);
    expect(info).toHaveBeenCalledOnce();
    expect(String(info.mock.calls[0][0])).toContain('a@b.c');
  });

  it('el remitente por defecto es el de la parroquia', () => {
    expect(REMITENTE).toBe('Parroquia en vivo <no-responder@avisos.parroquiaciudadarce.org>');
  });
});
