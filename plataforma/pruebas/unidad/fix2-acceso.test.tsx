// Revisión fix2 · acceso (plan 2): un solo h1 en las páginas de estado, título de la invitación igual
// al h1, «Mostrar contraseña» con nombre propio y zona de 44 px que no tapa la etiqueta siguiente.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CampoClave, nombreMostrarClave } from '../../app/componentes/CampoClave';
import { MensajeEstado } from '../../app/componentes/MensajeEstado';
import { tituloInvitacion } from '../../lib/mensajes-acceso';

const html = (e: ReactElement) => renderToStaticMarkup(e);
const css = readFileSync(resolve(__dirname, '..', '..', 'app', 'estilos', 'componentes.css'), 'utf8');
const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const regla = (selector: string) => css.match(new RegExp(String.raw`(?:^|\n)${escapar(selector)}\s*\{([^}]*)\}`))?.[1] ?? '';

describe('MensajeEstado como página entera', () => {
  it('con nivel={1} el título es el h1 de la página (misma clase, sin h2)', () => {
    const h = html(<MensajeEstado codigo="enlace-vencido" nivel={1} />);
    expect(h).toContain('<h1 class="pv-mensaje-titulo">Enlace vencido o usado</h1>');
    expect(h).not.toContain('<h2');
  });
  it('sin nivel sigue siendo h2 (dentro de un formulario que ya tiene su h1)', () => {
    expect(html(<MensajeEstado codigo="sin-conexion" />)).toContain('<h2 class="pv-mensaje-titulo">');
  });
});

describe('tituloInvitacion', () => {
  const vigente = { estado: 'vigente' as const, venceEn: '', correo: 'a@b.c', parroquia: 'X', paso: 'crear' as const };
  it('coincide con el h1 de cada estado', () => {
    expect(tituloInvitacion({ ...vigente, rol: 'coordinador' })).toBe('Te invitaron a coordinar');
    expect(tituloInvitacion({ ...vigente, rol: 'administrador' })).toBe('Te invitaron a administrar');
    expect(tituloInvitacion({ estado: 'vencida' })).toBe('Invitación vencida');
    expect(tituloInvitacion({ estado: 'no-sirve' })).toBe('Invitación que ya no sirve');
  });
});

describe('«Mostrar contraseña» con nombre propio', () => {
  it('cada campo de clave le da al botón un nombre distinto que empieza con el texto visible', () => {
    expect(nombreMostrarClave('Contraseña')).toBe('Mostrar contraseña');
    expect(nombreMostrarClave('Contraseña actual')).toBe('Mostrar contraseña actual');
    expect(nombreMostrarClave('Contraseña nueva')).toBe('Mostrar contraseña nueva');
    expect(nombreMostrarClave('Crea una contraseña')).toBe('Mostrar contraseña nueva');
    expect(nombreMostrarClave('Repite la contraseña')).toBe('Mostrar contraseña repetida');
    expect(nombreMostrarClave('Repite la contraseña nueva')).toBe('Mostrar contraseña repetida');
  });
  it('el botón lleva aria-label solo cuando el nombre no es el texto visible', () => {
    expect(html(<CampoClave id="nueva" etiqueta="Contraseña nueva" autoComplete="new-password" />)).toContain(
      'aria-label="Mostrar contraseña nueva"',
    );
    expect(html(<CampoClave id="clave" etiqueta="Contraseña" autoComplete="current-password" />)).not.toContain('aria-label=');
  });
  it('la zona de 44 px es el propio botón (sin ::after que tape la etiqueta siguiente)', () => {
    const boton = regla('.pv-mostrar-clave');
    expect(boton).toMatch(/min-height:\s*44px/);
    expect(regla('.pv-mostrar-clave::after')).toMatch(/content:\s*none/);
  });
});
