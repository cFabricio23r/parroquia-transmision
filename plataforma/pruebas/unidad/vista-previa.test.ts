import { describe, expect, it } from 'vitest';
import { prepararVistaPrevia } from '../../lib/vista-previa';

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
