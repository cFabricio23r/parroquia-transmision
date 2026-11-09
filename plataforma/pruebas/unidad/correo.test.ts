import { afterEach, describe, expect, it, vi } from 'vitest';
import { correoInvitacion, correoRecuperar, enviarCorreo, REMITENTE, usarBuzonDePrueba, type Mensaje } from '../../lib/correo';

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
    expect(REMITENTE).toBe('Transmisiones parroquiales <no-responder@avisos.parroquiaciudadarce.org>');
  });
});
