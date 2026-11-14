import { describe, expect, it } from 'vitest';
import { ESPERA_VISTA_PREVIA_MS, mensajeVistaPrevia, prepararVistaPrevia, recogerMedios, srcVistaPrevia, tiposParaVistaPrevia } from '../../lib/vista-previa';

const urls = { 'medios/logo.png': 'http://x/firmada-logo?token=1', 'medios/fachada.jpg': 'http://x/firmada-fachada?token=2' };

describe('prepararVistaPrevia', () => {
  it('cambia cada src de medios/ por su URL firmada, a cualquier profundidad', () => {
    const r = prepararVistaPrevia(
      {
        logos: { blanco: { src: 'medios/logo.png', alt: 'Logo' } },
        fachada: { src: 'medios/fachada.jpg', alt: 'Fachada' },
        galeria: [{ id: 'a', imagen: { src: 'medios/logo.png', alt: 'Otra' } }],
      },
      urls,
    );
    expect(r).toEqual({
      logos: { blanco: { src: urls['medios/logo.png'], alt: 'Logo' } },
      fachada: { src: urls['medios/fachada.jpg'], alt: 'Fachada' },
      galeria: [{ id: 'a', imagen: { src: urls['medios/logo.png'], alt: 'Otra' } }],
    });
  });

  it('deja igual un src sin URL firmada y los textos que no son src', () => {
    const r = prepararVistaPrevia({ fachada: { src: 'medios/otra.png', alt: 'x' }, nombre: 'medios/logo.png' }, urls);
    expect(r).toEqual({ fachada: { src: 'medios/otra.png', alt: 'x' }, nombre: 'medios/logo.png' });
  });

  it('quita null y undefined (lo vacío del formulario) sin tocar 0 ni cadenas vacías', () => {
    const r = prepararVistaPrevia({ nombre: 'A', nombreCorto: null, fachada: undefined, fiesta: { dia: 0, lema: '' } }, urls);
    expect(r).toEqual({ nombre: 'A', fiesta: { dia: 0, lema: '' } });
  });

  it('no muta lo que recibe', () => {
    const borrador = { fachada: { src: 'medios/fachada.jpg', alt: 'F' } };
    prepararVistaPrevia(borrador, urls);
    expect(borrador.fachada.src).toBe('medios/fachada.jpg');
  });
});

describe('recogerMedios', () => {
  it('junta cada src de medios/ a cualquier profundidad, sin repetidos', () => {
    const r = recogerMedios({
      logos: { blanco: { src: 'medios/logo.png', alt: 'L' } },
      galeria: [{ id: 'a', imagen: { src: 'medios/g1.jpg' } }, { id: 'b', imagen: { src: 'medios/logo.png' } }],
      pantallas: { inicio: { fondo: { tipo: 'imagen', src: 'medios/fondo.jpg' } } },
    });
    expect(r.sort()).toEqual(['medios/fondo.jpg', 'medios/g1.jpg', 'medios/logo.png']);
  });

  it('ignora src que no son de medios/ y textos que no son src', () => {
    expect(recogerMedios({ a: { src: 'https://x/y.png' }, b: 'medios/z.png', c: { src: 3 }, d: null })).toEqual([]);
  });
});

describe('vista previa continua (plan 3)', () => {
  const comunes = [
    { clave: 'dominical', nombre: 'Misa dominical' },
    { clave: 'semana', nombre: 'Misa entre semana' },
    { clave: 'horasanta', nombre: 'Hora Santa' },
  ];

  it('srcVistaPrevia arma la URL de la pantalla con la vista', () => {
    expect(srcVistaPrevia('san-jose', { pagina: 'pantalla', vista: 'avisos', titulo: 'x', conSelectorTipo: false })).toBe(
      '/san-jose/pantalla.html?tipo=avisos&vista-previa=1',
    );
    expect(srcVistaPrevia('san-jose', { pagina: 'rotulos', vista: '', titulo: 'x', conSelectorTipo: false })).toBe(
      '/san-jose/rotulos.html?vista-previa=1',
    );
  });

  it('tiposParaVistaPrevia: comunes encendidos con su nombre del panel y después los propios', () => {
    const t = tiposParaVistaPrevia(
      {
        tipos: {
          apagados: ['semana'],
          ajustes: { horasanta: { nombrePanel: 'Hora Santa parroquial' } },
          propios: [{ clave: 'rosario-aurora', nombre: 'Rosario de la aurora' }],
        },
      },
      comunes,
    );
    expect(t[0]).toEqual({ clave: 'dominical', nombre: 'Misa dominical' });
    expect(t.some((x) => x.clave === 'semana')).toBe(false);
    expect(t.find((x) => x.clave === 'horasanta')?.nombre).toBe('Hora Santa parroquial');
    expect(t[t.length - 1]).toEqual({ clave: 'rosario-aurora', nombre: 'Rosario de la aurora' });
  });

  it('mensajeVistaPrevia lleva el estado solo con tipo', () => {
    const b = { nombre: 'X', logos: { blanco: { src: 'medios/a.png', alt: 'a' } } };
    const urls = { 'medios/a.png': 'https://firmada/a' };
    expect(mensajeVistaPrevia(b, urls, 'horasanta')).toEqual({
      tipo: 'pev-vista-previa',
      config: prepararVistaPrevia(b, urls),
      estado: { tipo: 'horasanta' },
    });
    expect(mensajeVistaPrevia(b, urls, null)).toEqual({ tipo: 'pev-vista-previa', config: prepararVistaPrevia(b, urls) });
    expect(ESPERA_VISTA_PREVIA_MS).toBe(400);
  });
});
