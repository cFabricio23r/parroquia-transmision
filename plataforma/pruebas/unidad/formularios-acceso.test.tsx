// Formularios de acceso y Mi cuenta (plan 2, ronda 2): validación propia, botón sin `disabled`
// (el foco no se cae al <body>) y la invitación que ya no sirve con salida a «entrar».
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../app/editor/acciones-sesion', () => ({
  entrar: vi.fn(),
  salir: vi.fn(),
  pedirRecuperacion: vi.fn(),
  cambiarClave: vi.fn(),
  guardarMiNombre: vi.fn(),
  cambiarMiClave: vi.fn(),
}));
vi.mock('../../app/editor/admin/acciones', () => ({ aceptarInvitacion: vi.fn() }));
vi.mock('../../lib/supabase/servicio', () => ({ clienteServicio: () => ({}) }));
vi.mock('../../lib/supabase/servidor', () => ({ clienteServidor: async () => ({}) }));
const consultar = vi.hoisted(() => vi.fn());
vi.mock('../../lib/admin', async (original) => ({ ...(await original<typeof import('../../lib/admin')>()), consultarInvitacion: consultar }));

import { Boton } from '../../app/componentes/Boton';
import { FormCambiarClave } from '../../app/editor/cuenta/FormCambiarClave';
import { FormNuevaClave } from '../../app/editor/nueva-contrasena/FormNuevaClave';
import { FormInvitacion } from '../../app/editor/invitacion/FormInvitacion';
import Invitacion from '../../app/editor/invitacion/page';

const raiz = resolve(__dirname, '..', '..');
const FORMULARIOS = [
  'app/editor/entrar/FormEntrar.tsx',
  'app/editor/olvide/FormOlvide.tsx',
  'app/editor/invitacion/FormInvitacion.tsx',
  'app/editor/nueva-contrasena/FormNuevaClave.tsx',
  'app/editor/cuenta/FormCuenta.tsx',
  'app/editor/cuenta/FormCambiarClave.tsx',
];

describe('validación propia en vez de la del navegador', () => {
  // Con `required` y sin noValidate, el navegador no deja enviar y nunca aparece «Escribe tu nombre.»
  // ni «Contraseña que no sirve».
  it('A2, A4 y C2 llevan noValidate', () => {
    expect(renderToStaticMarkup(<FormInvitacion token="t" correo="a@b.test" crearCuenta pie="" />)).toMatch(/^<form noValidate="">/);
    expect(renderToStaticMarkup(<FormNuevaClave correo="a@b.test" />)).toMatch(/^<form noValidate="">/);
    expect(renderToStaticMarkup(<FormCambiarClave />)).toMatch(/^<form noValidate="" class="pv-cuenta-form">/);
  });
});

describe('el botón de enviar no se deshabilita mientras espera', () => {
  it('Boton ocupado: aria-disabled, sin disabled (conserva el foco)', () => {
    const h = renderToStaticMarkup(
      <Boton type="submit" ocupado>
        Guardar
      </Boton>,
    );
    expect(h).toBe('<button type="submit" class="pv-boton pv-boton--primario" aria-disabled="true">Guardar</button>');
    expect(renderToStaticMarkup(<Boton ocupado={false}>Guardar</Boton>)).toBe('<button type="button" class="pv-boton pv-boton--primario">Guardar</button>');
  });
  for (const ruta of FORMULARIOS) {
    it(`${ruta}: usa useEnvio y no disabled={ocupado}`, () => {
      const fuente = readFileSync(resolve(raiz, ruta), 'utf8');
      expect(fuente).toContain('useEnvio');
      expect(fuente).not.toMatch(/disabled=\{ocupado\}/);
      expect(fuente).toContain('sin-conexion'); // muestra «Sin conexión» si la acción falla
    });
  }
});

describe('invitación que ya no sirve', () => {
  it('lleva a entrar (quien ya creó su cuenta y vuelve a abrir el correo)', async () => {
    consultar.mockResolvedValueOnce({ estado: 'no-sirve' });
    const h = renderToStaticMarkup(await Invitacion({ searchParams: Promise.resolve({ token: 'usado' }) }));
    expect(h).toContain('Invitación que ya no sirve');
    expect(h).toContain('Si ya creaste tu cuenta, entra con tu correo.');
    expect(h).toMatch(/<a class="pv-boton pv-boton--secundario[^"]*" href="\/editor\/entrar">Ir a entrar<\/a>/);
  });
  it('la vencida queda como el artboard A5, sin acción', async () => {
    consultar.mockResolvedValueOnce({ estado: 'vencida' });
    const h = renderToStaticMarkup(await Invitacion({ searchParams: Promise.resolve({ token: 'viejo' }) }));
    expect(h).toContain('Invitación vencida');
    expect(h).not.toContain('Ir a entrar');
  });
});
