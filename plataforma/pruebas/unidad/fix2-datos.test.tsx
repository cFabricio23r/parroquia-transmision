// Ronda de arreglos 2 · datos (plan 3): mensajes «Falta …» junto al campo, el título del iframe,
// el mensaje de publicar con el guardado automático y los avisos que se muestran hoy.
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CampoSelect } from '../../app/componentes/CampoSelect';
import { CampoImagen } from '../../app/componentes/CampoImagen';
import { faltaCampo, FALTA_CAMPO } from '../../lib/editor/errores';
import { estadoDeSeccion } from '../../lib/editor/estados';
import { mensajeSinGuardar } from '../../lib/editor/revision';
import { vistaPreviaDeRuta } from '../../lib/editor/secciones';
import { tituloMarcoVistaPrevia } from '../../lib/vista-previa';

const html = (e: ReactElement) => renderToStaticMarkup(e);
const hoy = '2026-11-14';

describe('faltaCampo: el «Falta …» de un obligatorio vacío', () => {
  it('vacío o con solo espacios da su mensaje; con valor, nada', () => {
    expect(faltaCampo('nombre', '')).toBe('Falta el nombre de la parroquia.');
    expect(faltaCampo('nombre', '   ')).toBe('Falta el nombre de la parroquia.');
    expect(faltaCampo('nombre', undefined)).toBe('Falta el nombre de la parroquia.');
    expect(faltaCampo('nombre', 'Parroquia San José')).toBeUndefined();
    expect(faltaCampo('fiesta.mes', undefined)).toBe('Falta el mes de la fiesta.');
    expect(faltaCampo('fiesta.mes', 3)).toBeUndefined();
  });
  it('cubre los obligatorios de Identidad y de Patrono y fiesta', () => {
    expect(Object.keys(FALTA_CAMPO).sort()).toEqual(
      ['colores.oscuro', 'colores.principal', 'fachada', 'fiesta.dia', 'fiesta.mes', 'logos.blanco', 'lugar', 'nombre', 'patrono.corto', 'patrono.nombre'].sort(),
    );
    for (const m of Object.values(FALTA_CAMPO)) expect(m).toMatch(/^Falta .+\.$/);
  });
});

describe('CampoSelect con error', () => {
  it('ata el error con aria-describedby y aria-invalid', () => {
    const h = html(
      <CampoSelect id="mes" etiqueta="Mes" ayuda="A" error="Falta el mes de la fiesta.">
        <option value="">Elige</option>
      </CampoSelect>,
    );
    expect(h).toContain('aria-describedby="mes-ayuda mes-error"');
    expect(h).toContain('aria-invalid="true"');
    expect(h).toContain('<span id="mes-error" class="pv-campo-error">Falta el mes de la fiesta.</span>');
  });
});

describe('CampoImagen con «falta»', () => {
  it('muestra el «Falta …» sin role=alert y lo ata al grupo', () => {
    const h = html(<CampoImagen id="logo" etiqueta="Logo" textoVacio="logo" alt="" onAlt={() => {}} onCambiar={() => {}} falta="Falta el logo blanco." />);
    expect(h).toContain('aria-describedby="logo-falta"');
    expect(h).toContain('<span id="logo-falta" class="pv-campo-error">Falta el logo blanco.</span>');
  });
});

describe('título del iframe de la vista previa', () => {
  const titulo = (ruta: string) => tituloMarcoVistaPrevia(vistaPreviaDeRuta(`/editor/p/x/${ruta}`, 'x').vistaPrevia!);
  it('usa el nombre de la pantalla, no la clave', () => {
    expect(titulo('identidad')).toBe('Vista previa: Inicio');
    expect(titulo('avisos')).toBe('Vista previa: Avisos');
    expect(titulo('pantallas/portada')).toBe('Vista previa: Portada de la fiesta');
    expect(titulo('pantallas/evento')).toBe('Vista previa: Portada de evento');
    expect(titulo('pantallas/produccion')).toBe('Vista previa: Producción');
    expect(titulo('pantallas/envivo')).toBe('Vista previa: Capa EN VIVO');
    expect(titulo('rotulos')).toBe('Vista previa: Rótulos');
  });
});

describe('publicar con el guardado automático', () => {
  it('guardando: no pide guardar, dice que espere', () => {
    expect(mensajeSinGuardar('guardando', false)).toBe('Guardando tus cambios. En un momento puedes publicar.');
    expect(mensajeSinGuardar('pendiente', false)).toBe('Guardando tus cambios. En un momento puedes publicar.');
  });
  it('un formulario con su botón de guardar sí pide guardarlo', () => {
    expect(mensajeSinGuardar('guardado', true)).toBe('Tienes un formulario sin guardar. Guárdalo para poder publicar.');
  });
  it('si el guardado falló, remite al aviso', () => {
    for (const e of ['error', 'sin-conexion', 'sesion-cerrada', 'conflicto', 'rechazado'] as const) {
      expect(mensajeSinGuardar(e, false)).toBe('Tus últimos cambios no se guardaron. Revisa el aviso de arriba para poder publicar.');
    }
  });
  it('nunca dice «Guarda antes de publicar»', () => {
    for (const e of ['guardando', 'pendiente', 'error'] as const) expect(mensajeSinGuardar(e, false)).not.toMatch(/Guarda antes/);
  });
});

describe('Resumen: avisos que se muestran hoy', () => {
  it('no cuenta los que empiezan después de hoy', () => {
    const b = { avisos: [{ texto: 'a' }, { texto: 'b', desde: '2026-12-01' }, { texto: 'c', desde: hoy }] };
    expect(estadoDeSeccion(b, 'avisos', [], hoy).frase).toBe('3 avisos fijos; 2 se muestran.');
  });
  it('ni los apagados ni los vencidos', () => {
    const b = { avisos: [{ texto: 'a', activo: false }, { texto: 'b', desde: '2026-12-01' }] };
    expect(estadoDeSeccion(b, 'avisos', [], hoy).frase).toBe('2 avisos fijos; 0 se muestran.');
  });
});
