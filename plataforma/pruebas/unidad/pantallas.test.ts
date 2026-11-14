// Lógica de las pantallas personalizadas (plan 4, Tarea 2).
import { describe, expect, it } from 'vitest';
import {
  avisoImagenPatrono,
  conInterruptor,
  encendido,
  fondoGaleriaInicial,
  imagenFijaInicial,
  opcionesImagenFija,
  opcionFondo,
  opcionImagen,
  ponerEnPantalla,
  ponerTexto,
  VISTAS_PANTALLA,
  vistaEditor,
  volverComoVenia,
} from '../../lib/editor/pantallas';

const congelar = <T,>(o: T): T => {
  if (o && typeof o === 'object') {
    Object.values(o as object).forEach(congelar);
    Object.freeze(o);
  }
  return o;
};

describe('catálogo de pantallas', () => {
  it('las 7 en el orden de F4, con sus nombres y descripciones', () => {
    expect(VISTAS_PANTALLA.map((v) => v.nombre)).toEqual([
      'Inicio',
      'Portada de la fiesta',
      'Portada de evento',
      'Avisos',
      'Gracias',
      'Producción',
      'Capa EN VIVO',
    ]);
    expect(VISTAS_PANTALLA.map((v) => v.titulo)).toEqual([
      'Pantalla de Inicio',
      'Portada de la fiesta',
      'Portada de evento',
      'Pantalla de Avisos',
      'Pantalla de Gracias',
      'Producción',
      'Capa EN VIVO',
    ]);
    expect(vistaEditor('inicio')?.descripcion).toBe('Antes de empezar: «En breve comenzamos», con cuenta regresiva.');
    expect(vistaEditor('produccion')?.descripcion).toBe('Cierre: «Una producción de…».');
  });

  it('interruptores, textos y fondo de cada una (Decisión 1)', () => {
    expect(vistaEditor('produccion')?.conFondoEImagen).toBe(false);
    expect(vistaEditor('envivo')?.conFondoEImagen).toBe(false);
    expect(vistaEditor('inicio')?.conFondoEImagen).toBe(true);
    const inicio = vistaEditor('inicio')!;
    expect(inicio.interruptores.map((i) => i.etiqueta)).toEqual(['Logo', 'Cuenta regresiva', 'Franja del lema', 'Redes sociales']);
    expect(inicio.interruptores.find((i) => i.elemento === 'franja')?.ayuda).toBe('Solo en la novena y la fiesta.');
    expect(inicio.textos).toEqual([
      { clave: 'inicio_titulo', etiqueta: 'Texto de arriba', ayuda: 'Cada tipo de transmisión puede tener el suyo; este es el que se usa si no.' },
    ]);
    expect(vistaEditor('envivo')?.interruptores.map((i) => i.etiqueta)).toEqual(['Logo', 'EN VIVO']);
    expect(vistaEditor('avisos')?.interruptores.map((i) => i.elemento)).toEqual(['marca', 'horarios', 'redes']);
    expect(vistaEditor('gracias')?.textos.map((t) => t.clave)).toEqual(['gracias_titulo']);
    expect(vistaEditor('produccion')?.textos.map((t) => [t.clave, t.placeholder])).toEqual([
      ['prod_ceja', 'UNA PRODUCCIÓN DE'],
      ['prod_nombre', 'Comunicaciones'],
    ]);
    expect(vistaEditor('evento')?.textos).toEqual([]);
    expect(vistaEditor('horarios')).toBeNull();
    expect(vistaEditor('nada')).toBeNull();
  });
});

describe('interruptores', () => {
  it('encendido: ocultar al revés, mostrar al derecho', () => {
    expect(encendido(undefined, 'marca')).toBe(true);
    expect(encendido(undefined, 'redes')).toBe(false);
    expect(encendido({ mostrar: ['redes'] }, 'redes')).toBe(true);
    expect(encendido({ ocultar: ['marca'] }, 'marca')).toBe(false);
  });

  it('conInterruptor conserva lo demás y quita la lista vacía', () => {
    expect(conInterruptor(congelar({ ocultar: ['chispas', 'franja'] }), 'franja', true)).toEqual({ ocultar: ['chispas'] });
    expect(conInterruptor({}, 'redes', true)).toEqual({ mostrar: ['redes'] });
    expect(conInterruptor(congelar({ mostrar: ['redes'] }), 'redes', false)).toEqual({});
    expect(conInterruptor(congelar({ ocultar: ['chispas'] }), 'envivo', false)).toEqual({ ocultar: ['chispas', 'envivo'] });
    expect(conInterruptor(undefined, 'marca', false)).toEqual({ ocultar: ['marca'] });
  });
});

describe('poner y quitar', () => {
  it('ponerEnPantalla aplica el cambio, pone personalizada y conserva las otras vistas', () => {
    const p = congelar({ horarios: { modo: 'personalizada' } });
    expect(ponerEnPantalla(p, 'inicio', { distribucion: 'derecha' })).toEqual({
      horarios: { modo: 'personalizada' },
      inicio: { distribucion: 'derecha', modo: 'personalizada' },
    });
    const q = congelar({ inicio: { modo: 'personalizada', fondo: { tipo: 'color', color: '#0c3562' } } });
    expect(ponerEnPantalla(q, 'inicio', { fondo: undefined })).toEqual({ inicio: { modo: 'personalizada' } });
    expect(ponerEnPantalla(undefined, 'gracias', {})).toEqual({ gracias: { modo: 'personalizada' } });
  });

  it('volverComoVenia quita la vista, y el bloque si queda vacío', () => {
    expect(volverComoVenia(congelar({ inicio: {} }), 'inicio')).toBeUndefined();
    expect(volverComoVenia(congelar({ inicio: {}, horarios: { modo: 'personalizada' } }), 'inicio')).toEqual({ horarios: { modo: 'personalizada' } });
  });

  it('ponerTexto quita la clave vacía y el objeto vacío (Decisión 27)', () => {
    expect(ponerTexto(congelar({ textos: { inicio_titulo: 'a' } }), 'inicio_titulo', '  ')).toEqual({});
    expect(ponerTexto(congelar({ textos: { inicio_titulo: 'a', marca: 'b' } }), 'inicio_titulo', '')).toEqual({ textos: { marca: 'b' } });
    expect(ponerTexto(congelar({}), 'inicio_titulo', 'Hola')).toEqual({ textos: { inicio_titulo: 'Hola' } });
  });
});

describe('opciones de fondo e imagen', () => {
  it('lee la opción pintada (Decisión 3)', () => {
    expect(opcionFondo({ fondo: { tipo: 'degradado' } })).toBe('parroquia');
    expect(opcionFondo(undefined)).toBe('parroquia');
    expect(opcionFondo({ fondo: { tipo: 'color', color: '#000000' } })).toBe('color');
    expect(opcionFondo({ fondo: { tipo: 'imagen', imagen: 'img-a' } })).toBe('galeria');
    expect(opcionImagen({ imagen: 'automatica' })).toBe('tipo');
    expect(opcionImagen({})).toBe('tipo');
    expect(opcionImagen({ imagen: 'galeria:img-a' })).toBe('fija');
    expect(opcionImagen({ imagen: 'santo' })).toBe('fija');
    expect(opcionImagen({ imagen: 'ninguna' })).toBe('ninguna');
  });

  it('la imagen fija inicial es la del patrono si hay; si no, la fachada', () => {
    expect(imagenFijaInicial({})).toBe('fachada');
    expect(imagenFijaInicial({ patrono: { imagen: { src: 'medios/p.png', alt: 'P' } } })).toBe('patrono');
  });

  it('el fondo de galería inicial prefiere una imagen con etiqueta «fondos»', () => {
    expect(fondoGaleriaInicial({})).toBeNull();
    expect(
      fondoGaleriaInicial({
        galeria: [
          { id: 'img-a', src: 'medios/a.png', alt: 'A' },
          { id: 'img-b', src: 'medios/b.png', alt: 'B', etiquetas: ['fondos'] },
        ],
      }),
    ).toBe('img-b');
    expect(fondoGaleriaInicial({ galeria: [{ id: 'img-a', src: 'medios/a.png', alt: 'A' }] })).toBe('img-a');
  });

  it('las opciones de «¿Cuál imagen?» (Decisión 2)', () => {
    const b = congelar({ galeria: [{ id: 'img-a', src: 'medios/a.png', alt: 'Virgen', nombre: 'Virgen del Rosario' }] });
    expect(opcionesImagenFija(b, 'santo')).toEqual([
      { valor: 'patrono', texto: 'Imagen del patrono' },
      { valor: 'fachada', texto: 'Fachada' },
      { valor: 'logo', texto: 'Logo' },
      { valor: 'custodia', texto: 'Custodia' },
      { valor: 'galeria:img-a', texto: 'Virgen del Rosario' },
      { valor: 'santo', texto: 'La del santo del día (se elige en el panel)' },
    ]);
    expect(opcionesImagenFija(b, 'patrono')).toHaveLength(5);
  });
});

describe('aviso «Siempre la misma» sin imagen del patrono', () => {
  it('nombra las pantallas personalizadas que usan el patrono sin imagen', () => {
    expect(avisoImagenPatrono({ pantallas: { inicio: { modo: 'personalizada', imagen: 'patrono' } } })).toEqual([{ vista: 'inicio', nombre: 'Inicio' }]);
    expect(
      avisoImagenPatrono({
        pantallas: { inicio: { modo: 'personalizada', imagen: 'patrono' } },
        patrono: { imagen: { src: 'medios/p.png', alt: 'P' } },
      }),
    ).toEqual([]);
    expect(avisoImagenPatrono({ pantallas: { inicio: { modo: 'como-viene', imagen: 'patrono' } } })).toEqual([]);
  });
});
