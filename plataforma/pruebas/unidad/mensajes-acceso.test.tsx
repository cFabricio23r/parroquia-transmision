// Catálogo de mensajes de acceso (A5) y su tarjeta (plan 2, tarea 5).
import { existsSync, readFileSync } from 'node:fs';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MensajeEstado } from '../../app/componentes/MensajeEstado';
import { MENSAJES_ACCESO, ORDEN_A5 } from '../../lib/mensajes-acceso';

const html = (e: ReactElement) => renderToStaticMarkup(e);

// Copia local del artboard A5 (si está en esta máquina, se compara contra él; si no, contra la tabla).
const ARTBOARD =
  'C:/Users/fabri/AppData/Local/Temp/claude/4994fda92fe86eb8/33521007-007e-4c0b-a569-8fda59b88293/scratchpad/artifact-files/b51da3ac-1f87-4d4b-9b72-8aba4008a8cb/project/VicAccesoEstados.dc.html';

const TABLA: [string, string][] = [
  ['Correo o contraseña incorrectos', 'El correo o la contraseña no coinciden. Revísalos, o crea una contraseña nueva.'],
  ['Contraseña que no sirve', 'Revisa la contraseña: al menos 8 caracteres, y las dos iguales.'],
  ['Muchos intentos', 'Probaste muchas veces seguidas. Espera unos minutos y vuelve a intentar.'],
  ['Sin parroquia asignada', 'Tu cuenta ya no tiene una parroquia asignada. Pídele a la Pastoral de Comunicaciones que te asigne una.'],
  ['Invitación vencida', 'Esta invitación ya venció. Pídele a la Pastoral de Comunicaciones que te la reenvíe.'],
  ['Enlace vencido o usado', 'Este enlace para crear una contraseña ya venció o ya se usó.'],
  ['Sin conexión', 'No hay internet. Revisa el wifi o los datos y vuelve a intentar.'],
  ['Sesión cerrada', 'Tu sesión se cerró. Vuelve a entrar para seguir; lo que guardaste no se pierde.'],
];

function delArtboard(): [string, string][] {
  const fuente = readFileSync(ARTBOARD, 'utf8');
  const pares: [string, string][] = [];
  const re = /<h2[^>]*>([^<]*)<\/h2><\/div>\s*<p[^>]*>([^<]*)<\/p>/g;
  for (const m of fuente.matchAll(re)) pares.push([m[1], m[2]]);
  return pares;
}

describe('MENSAJES_ACCESO', () => {
  it('los 8 mensajes de A5, en orden, con el texto exacto del artboard', () => {
    const esperado = existsSync(ARTBOARD) ? delArtboard() : TABLA;
    expect(esperado).toHaveLength(8);
    expect(ORDEN_A5.map((c) => [MENSAJES_ACCESO[c].titulo, MENSAJES_ACCESO[c].texto])).toEqual(esperado);
    expect(esperado).toEqual(TABLA);
  });
  it('tonos y el mensaje sin artboard (invitación que no sirve)', () => {
    expect(MENSAJES_ACCESO.incorrectos.tono).toBe('rojo');
    expect(MENSAJES_ACCESO['clave-no-sirve'].tono).toBe('rojo');
    expect(MENSAJES_ACCESO['muchos-intentos'].tono).toBe('ambar');
    expect(MENSAJES_ACCESO['sin-parroquia'].tono).toBe('gris');
    expect(MENSAJES_ACCESO['invitacion-vencida'].tono).toBe('ambar');
    expect(MENSAJES_ACCESO['enlace-vencido'].tono).toBe('ambar');
    expect(MENSAJES_ACCESO['sin-conexion'].tono).toBe('azul');
    expect(MENSAJES_ACCESO['sesion-cerrada'].tono).toBe('azul');
    expect(MENSAJES_ACCESO['invitacion-no-sirve']).toEqual({
      titulo: 'Invitación que ya no sirve',
      texto: 'Esta invitación ya no sirve. Si ya creaste tu cuenta, entra con tu correo. Si no, pide una nueva a la Pastoral de Comunicaciones.',
      tono: 'gris',
    });
  });
});

describe('MensajeEstado', () => {
  it('MensajeEstado con rol alert, título, texto y acción', () => {
    const h = html(<MensajeEstado codigo="sin-parroquia" rol="alert" accion={<button>Cerrar sesión</button>} />);
    expect(h).toContain('role="alert"');
    expect(h).toContain('tabindex="-1"');
    expect(h).toContain('<h2');
    expect(h).toContain('Sin parroquia asignada');
    expect(h).toContain('pv-mensaje-punto--gris');
    expect(h).toContain(MENSAJES_ACCESO['sin-parroquia'].texto);
    expect(h).toContain('<div class="pv-mensaje-accion"><button>Cerrar sesión</button></div>');
  });
  it('incrustado suma su clase; sin acción no hay bloque de acción', () => {
    const h = html(<MensajeEstado codigo="incorrectos" incrustado />);
    expect(h).toContain('pv-mensaje--incrustado');
    expect(h).not.toContain('pv-mensaje-accion');
    expect(h).not.toContain('role=');
  });
});
