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

describe('estilo de todas las pantallas, tamaños y encuadre (pantallas más opciones, Tarea 7)', async () => {
  const m = await import('../../lib/editor/pantallas');

  it('listas de opciones', () => {
    expect(m.OPCIONES_TAMANO).toEqual([
      { valor: 'chico', texto: 'Chico' },
      { valor: 'normal', texto: 'Normal' },
      { valor: 'grande', texto: 'Grande' },
    ]);
    expect(m.OPCIONES_LETRA_FRASE[0]).toEqual({ valor: 'vibes', texto: 'Great Vibes (la de hoy)' });
    expect(m.OPCIONES_LETRA_FRASE).toHaveLength(10);
    expect(m.OPCIONES_LETRA_FRASE[1].valor).toBe('montserrat');
    expect(m.FAMILIA_LETRA_FRASE.vibes).toBe('Vibes');
    expect(m.FAMILIA_LETRA_FRASE.cinzel).toBe('Cinzel');
  });

  it('conEstiloPantallas: pone la clave, quita la de siempre y devuelve undefined si queda vacío', () => {
    expect(m.conEstiloPantallas(undefined, 'letraTitulo', 'cinzel')).toEqual({ letraTitulo: 'cinzel' });
    expect(m.conEstiloPantallas(congelar({ letraTitulo: 'cinzel', logo: 'grande' }), 'letraTitulo', 'montserrat')).toEqual({ logo: 'grande' });
    expect(m.conEstiloPantallas({ letraFrase: 'oswald' }, 'letraFrase', 'vibes')).toBeUndefined();
    expect(m.conEstiloPantallas({ logo: 'chico' }, 'logo', 'normal')).toBeUndefined();
    expect(m.conEstiloPantallas(congelar({ logo: 'chico' }), 'logo', 'grande')).toEqual({ logo: 'grande' });
  });

  it('tamanoDe y conTamano', () => {
    expect(m.tamanoDe(undefined, 'titulo')).toBe('normal');
    expect(m.tamanoDe({ tamanos: { frase: 'chico' } }, 'frase')).toBe('chico');
    expect(m.conTamano(congelar({ imagen: 'patrono' }), 'titulo', 'grande')).toEqual({ imagen: 'patrono', tamanos: { titulo: 'grande' } });
    expect(m.conTamano({ tamanos: { titulo: 'grande' } }, 'titulo', 'normal')).toEqual({});
    expect(m.conTamano({ tamanos: { titulo: 'grande', frase: 'chico' } }, 'titulo', 'normal')).toEqual({ tamanos: { frase: 'chico' } });
  });

  it('fotoEncuadrable: solo fotos fijas, y nunca el arco de Evento', () => {
    expect(m.fotoEncuadrable({}, 'imagen', 'inicio')).toBeNull();
    expect(m.fotoEncuadrable({ imagen: 'automatica' }, 'imagen', 'inicio')).toBeNull();
    expect(m.fotoEncuadrable({ imagen: 'logo' }, 'imagen', 'inicio')).toBeNull();
    expect(m.fotoEncuadrable({ imagen: 'ninguna' }, 'imagen', 'inicio')).toBeNull();
    expect(m.fotoEncuadrable({ imagen: 'santo' }, 'imagen', 'inicio')).toBe('santo');
    expect(m.fotoEncuadrable({ imagen: 'patrono' }, 'imagen', 'inicio')).toBe('patrono');
    expect(m.fotoEncuadrable({ imagen: 'galeria:taller' }, 'imagen', 'avisos')).toBe('galeria:taller');
    expect(m.fotoEncuadrable({ imagen: 'patrono' }, 'imagen', 'evento')).toBeNull();
    expect(m.fotoEncuadrable({ fondo: { tipo: 'color', color: '#112233' } }, 'fondo', 'inicio')).toBeNull();
    expect(m.fotoEncuadrable({ fondo: { tipo: 'imagen', imagen: 'taller' } }, 'fondo', 'evento')).toBe('galeria:taller');
  });

  it('encuadreDe: el guardado si es de la misma foto; si no, el de siempre', () => {
    const p = { imagen: 'patrono', encuadre: { imagen: { de: 'patrono', x: 30, y: 70, zoom: 150 } } };
    expect(m.encuadreDe(p, 'imagen', 'inicio')).toEqual({ x: 30, y: 70, zoom: 150 });
    expect(m.encuadreDe({ ...p, imagen: 'fachada' }, 'imagen', 'inicio')).toEqual({ x: 50, y: 20, zoom: 100 });
    expect(m.encuadreDe({ fondo: { tipo: 'imagen', imagen: 'taller' } }, 'fondo', 'inicio')).toEqual({ x: 50, y: 50, zoom: 100 });
  });

  it('conEncuadre: guarda con su foto, y null lo borra', () => {
    const con = m.conEncuadre(congelar({ imagen: 'patrono' }), 'imagen', { x: 30, y: 70, zoom: 150 }, 'inicio');
    expect(con).toEqual({ imagen: 'patrono', encuadre: { imagen: { de: 'patrono', x: 30, y: 70, zoom: 150 } } });
    expect(m.conEncuadre(con, 'imagen', null, 'inicio')).toEqual({ imagen: 'patrono' });
    const f = m.conEncuadre({ fondo: { tipo: 'imagen', imagen: 'taller' } }, 'fondo', { x: 10, y: 90, zoom: 100 }, 'inicio');
    expect(f.encuadre).toEqual({ fondo: { de: 'galeria:taller', x: 10, y: 90, zoom: 100 } });
    expect(m.conEncuadre({ imagen: 'logo' }, 'imagen', { x: 1, y: 1, zoom: 100 }, 'inicio')).toEqual({ imagen: 'logo' });
  });

  it('Review Focus 4: cambiar la foto borra su encuadre y deja el de la otra', () => {
    const antes = {
      inicio: {
        modo: 'personalizada',
        imagen: 'patrono',
        fondo: { tipo: 'imagen', imagen: 'taller' },
        encuadre: { imagen: { de: 'patrono', x: 30, y: 70, zoom: 150 }, fondo: { de: 'galeria:taller', x: 10, y: 90, zoom: 100 } },
      },
    };
    const otraImagen = m.ponerEnPantalla(congelar(structuredClone(antes)), 'inicio', { imagen: 'fachada' });
    expect((otraImagen.inicio as Record<string, unknown>).encuadre).toEqual({ fondo: { de: 'galeria:taller', x: 10, y: 90, zoom: 100 } });
    const sinFondo = m.ponerEnPantalla(otraImagen, 'inicio', { fondo: undefined });
    expect((sinFondo.inicio as Record<string, unknown>).encuadre).toBeUndefined();
    const mismo = m.ponerEnPantalla(structuredClone(antes), 'inicio', { distribucion: 'derecha' });
    expect((mismo.inicio as Record<string, unknown>).encuadre).toEqual(antes.inicio.encuadre);
  });
});

describe('el patrono sin imagen no se encuadra (se ve la fachada)', () => {
  it('fotoEncuadrable con conPatrono=false da null para el patrono, y sigue igual para otras fotos', async () => {
    const { fotoEncuadrable } = await import('../../lib/editor/pantallas');
    expect(fotoEncuadrable({ imagen: 'patrono' }, 'imagen', 'inicio', false)).toBeNull();
    expect(fotoEncuadrable({ imagen: 'patrono' }, 'imagen', 'inicio', true)).toBe('patrono');
    expect(fotoEncuadrable({ imagen: 'galeria:taller' }, 'imagen', 'inicio', false)).toBe('galeria:taller');
  });
});
