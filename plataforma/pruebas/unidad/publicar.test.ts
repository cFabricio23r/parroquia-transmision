import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { estadoDeLlegada } from '../../lib/llegada';
import { erroresDeMedios, prepararPublicacion } from '../../lib/publicar';
import { validarConfig } from '../../lib/validar';

// Un borrador completo (la config de Ciudad Arce sin lo que pone la publicación) con imágenes como las
// deja la subida: medios/<campo>-<8 hex>.<ext>. La misma imagen se usa en dos campos a propósito.
const { esquema, version, publicado, slug, ...base } = JSON.parse(
  readFileSync(new URL('../../../vicaria/ciudad-arce/config.json', import.meta.url), 'utf8'),
);
void esquema, void version, void publicado, void slug;
const borrador = () => ({
  ...structuredClone(base),
  logos: {
    blanco: { src: 'medios/logo-blanco-aabbccdd.png', alt: 'Logo en blanco' },
    color: { src: 'medios/logo-color-11223344.svg', alt: 'Logo a color' },
  },
  fachada: { src: 'medios/fachada-0a1b2c3d.jpg', alt: 'Fachada' },
  patrono: { ...base.patrono, imagen: { src: 'medios/fachada-0a1b2c3d.jpg', alt: 'La misma imagen en otro campo' } },
  galeria: [{ id: 'foto-a', src: 'medios/foto-99887766.png', alt: 'Foto' }, { id: 'foto-b', src: 'medios/foto-99887766.png', alt: 'Otra vez' }],
});
const AHORA = new Date('2026-11-08T15:30:00Z');

describe('prepararPublicacion', () => {
  it('renombra src a v<N>-, lista copias sin duplicados y el resultado pasa validarConfig', () => {
    const entrada = borrador();
    const copia = structuredClone(entrada);
    const { config, copias } = prepararPublicacion(entrada, 'ciudad-arce', 3, AHORA);
    const c = config as Record<string, any>;
    expect(c.logos.blanco.src).toBe('medios/v3-logo-blanco-aabbccdd.png');
    expect(c.logos.color.src).toBe('medios/v3-logo-color-11223344.svg');
    expect(c.fachada.src).toBe('medios/v3-fachada-0a1b2c3d.jpg');
    expect(c.patrono.imagen.src).toBe('medios/v3-fachada-0a1b2c3d.jpg');
    expect(c.galeria[0].src).toBe('medios/v3-foto-99887766.png'); // dentro de un arreglo
    expect(c.galeria[1].src).toBe('medios/v3-foto-99887766.png');
    expect(c).toMatchObject({ esquema: 1, version: 3, publicado: '2026-11-08T15:30:00.000Z', slug: 'ciudad-arce' });
    expect(copias).toEqual([
      { desde: 'logo-blanco-aabbccdd.png', hacia: 'ciudad-arce/medios/v3-logo-blanco-aabbccdd.png' },
      { desde: 'logo-color-11223344.svg', hacia: 'ciudad-arce/medios/v3-logo-color-11223344.svg' },
      { desde: 'fachada-0a1b2c3d.jpg', hacia: 'ciudad-arce/medios/v3-fachada-0a1b2c3d.jpg' },
      { desde: 'foto-99887766.png', hacia: 'ciudad-arce/medios/v3-foto-99887766.png' },
    ]);
    expect(validarConfig(config, 'ciudad-arce')).toEqual({ ok: true, errores: [] });
    expect(entrada).toEqual(copia); // no muta el borrador
  });

  it('pisa esquema, version, publicado y slug que ya traiga el borrador, y deja intactos los src que no son de medios/', () => {
    const { config, copias } = prepararPublicacion(
      { ...borrador(), version: 99, slug: 'otro', fondo: { src: 'img/fondo.png', alt: 'x' } },
      'ciudad-arce',
      1,
      AHORA,
    );
    expect(config).toMatchObject({ version: 1, slug: 'ciudad-arce', fondo: { src: 'img/fondo.png' } });
    expect(copias.every((c) => c.hacia.startsWith('ciudad-arce/medios/v1-'))).toBe(true);
    expect(copias).toHaveLength(4);
  });
});

describe('erroresDeMedios', () => {
  it('acepta lo que deja la subida y rechaza todo src de medios/ que no tenga ese nombre', () => {
    expect(erroresDeMedios(borrador())).toEqual([]);
    for (const malo of ['medios/logo.png', 'medios/../x-aabbccdd.png', 'medios/a/b-aabbccdd.png', 'medios/x-AABBCCDD.png', 'medios/x-aabbccdd.gif']) {
      const errores = erroresDeMedios({ fachada: { src: malo } });
      expect(errores, malo).toHaveLength(1);
      expect(errores[0]).toContain(malo);
    }
    expect(erroresDeMedios({ fondo: { src: 'img/fondo.png' } })).toEqual([]);
  });
});

describe('estadoDeLlegada', () => {
  it('sin publicar nada', () => {
    expect(estadoDeLlegada(null, null)).toBe('Todavía no publicaste');
    expect(estadoDeLlegada(2, null)).toBe('Todavía no publicaste');
  });
  it('la versión ya está en las pantallas', () => {
    expect(estadoDeLlegada(4, 4)).toBe('Publicado y en las pantallas (versión 4)');
  });
  it('publicada pero las pantallas siguen en una anterior', () => {
    expect(estadoDeLlegada(2, 5)).toBe('Publicaste la versión 5; todavía no llegó a las pantallas (están en la 2)');
  });
  it('las pantallas no responden', () => {
    expect(estadoDeLlegada(null, 5)).toBe('Publicaste la versión 5; las pantallas todavía no la tienen');
  });
});
