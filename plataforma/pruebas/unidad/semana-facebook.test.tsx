// Título y descripción del vivo de Facebook en los diálogos de la semana (CamposTransmision).
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CamposTransmision, cambiarFacebook } from '../../app/editor/p/[slug]/semana/CamposTransmision';
import {
  AYUDA_FB_DESCRIPCION,
  AYUDA_FB_TITULO,
  ETIQUETA_FB_DESCRIPCION,
  ETIQUETA_FB_TITULO,
} from '../../lib/editor/semana-textos';
import { SEMANA } from '../../lib/semana';

const nada = () => {};

describe('textos de Facebook en la semana', () => {
  it('son los de la spec', () => {
    expect(ETIQUETA_FB_TITULO).toBe('Título en Facebook (opcional)');
    expect(ETIQUETA_FB_DESCRIPCION).toBe('Descripción en Facebook (opcional)');
    expect(AYUDA_FB_TITULO).toBe('Si lo dejas vacío, sale «Tipo · Parroquia». Hasta 254 caracteres.');
    expect(AYUDA_FB_DESCRIPCION).toBe('Se usa solo si la parroquia transmite directo a Facebook. Hasta 1000 caracteres.');
  });
});

describe('CamposTransmision con Facebook', () => {
  it('muestra los dos campos aunque no haya tipo, con sus topes y ayudas', () => {
    const h = renderToStaticMarkup(
      <CamposTransmision tipo={null} datos={{ facebook: { titulo: 'Misa', descripcion: 'Hola' } }} onCambiar={nada} />,
    );
    expect(h).toContain(ETIQUETA_FB_TITULO);
    expect(h).toContain(ETIQUETA_FB_DESCRIPCION);
    expect(h).toContain('value="Misa"');
    expect(h).toContain('maxLength="254"');
    expect(h).toMatch(/<textarea[^>]*maxLength="1000"[^>]*>Hola<\/textarea>/);
    expect(h).toContain(AYUDA_FB_TITULO);
    expect(h).toContain('aria-describedby="sem-fb-titulo-ayuda"');
    expect(h).toContain('aria-describedby="sem-fb-descripcion-ayuda"');
  });

  it('cambiarFacebook escribe en datos.facebook sin tocar lo demás', () => {
    const datos = { celebrante: 'P. Ana' };
    expect(cambiarFacebook(datos, 'titulo', 'Misa')).toEqual({ celebrante: 'P. Ana', facebook: { titulo: 'Misa' } });
    expect(datos).toEqual({ celebrante: 'P. Ana' });
    expect(cambiarFacebook({ facebook: { titulo: 'Misa' } }, 'descripcion', 'Hola')).toEqual({
      facebook: { titulo: 'Misa', descripcion: 'Hola' },
    });
  });

  it('los campos de Facebook no cuentan en «Faltan N datos»', () => {
    const tipo = SEMANA.tiposDisponibles(SEMANA.tiposParaCampos({}, []), null)[0] ?? null;
    const sin = SEMANA.contarFaltas(tipo, {});
    expect(SEMANA.contarFaltas(tipo, { facebook: { titulo: 'X' } })).toBe(sin);
  });
});
