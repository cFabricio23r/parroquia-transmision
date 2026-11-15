import { describe, expect, it } from 'vitest';
import { BLOQUES, SECCIONES, VISTAS_EDITOR, hrefSeccion, seccion, seccionDeBloque, seccionDeRuta, SECCIONES_FUERA_DEL_BORRADOR, usaBorrador, vistaPreviaDeRuta } from '../../lib/editor/secciones';
import { bloqueDeError, limpiarMensaje } from '../../lib/editor/errores';

describe('catálogo de secciones', () => {
  it('tiene las 12 secciones del menú en orden', () => {
    expect(SECCIONES.map((s) => s.texto)).toEqual([
      'Resumen', 'Identidad', 'Patrono y fiesta', 'Pantallas', 'Rótulos y estilo', 'Tipos de transmisión',
      'Galería', 'Horarios y redes', 'Avisos fijos', 'Transmisiones de la semana', 'App y transmisión', 'Publicar',
    ]);
  });

  it('«App y transmisión» va fuera del borrador (3c)', () => {
    expect(seccionDeRuta('/editor/p/san-jose/app-y-transmision', 'san-jose').id).toBe('app');
    expect(usaBorrador('app')).toBe(false);
    expect(usaBorrador('publicar')).toBe(false);
    expect(usaBorrador('avisos')).toBe(true);
  });

  it('«Transmisiones de la semana» va fuera del borrador (3b)', () => {
    expect(seccion('semana')).toEqual({ id: 'semana', texto: 'Transmisiones de la semana', ruta: 'semana', bloques: [], conPunto: false, vistaPrevia: null, disposicion: 'una-columna' });
    expect(seccionDeRuta('/editor/p/x/semana/fijas', 'x').id).toBe('semana');
    expect(usaBorrador('semana')).toBe(false);
    expect(SECCIONES_FUERA_DEL_BORRADOR).toContain('semana');
  });

  it('cada bloque pertenece a exactamente una sección', () => {
    for (const b of BLOQUES) {
      expect(SECCIONES.filter((s) => s.bloques.includes(b)).length, b).toBe(1);
    }
    expect(seccionDeBloque('redes')).toBe('horarios-y-redes');
    expect(seccionDeBloque('fiesta')).toBe('patrono');
  });

  it('encuentra la sección de una ruta', () => {
    expect(seccionDeRuta('/editor/p/san-jose', 'san-jose').id).toBe('resumen');
    expect(seccionDeRuta('/editor/p/san-jose/', 'san-jose').id).toBe('resumen');
    expect(seccionDeRuta('/editor/p/san-jose/identidad', 'san-jose').id).toBe('identidad');
    expect(seccionDeRuta('/editor/p/san-jose/pantallas/inicio', 'san-jose').id).toBe('pantallas');
    expect(seccionDeRuta('/editor/p/san-jose/no-existe', 'san-jose').id).toBe('resumen');
    expect(seccionDeRuta('/otra/cosa', 'san-jose').id).toBe('resumen');
  });

  it('arma el href de cada sección', () => {
    expect(hrefSeccion('san-jose', 'resumen')).toBe('/editor/p/san-jose');
    expect(hrefSeccion('san-jose', 'avisos')).toBe('/editor/p/san-jose/avisos');
  });
});

describe('mensajes de error', () => {
  it('saca el bloque de la ruta del mensaje', () => {
    expect(bloqueDeError('Falta la descripción de la imagen (galeria[2].alt).')).toBe('galeria');
    expect(bloqueDeError('El color principal (colores.principal) debe tener la forma #rrggbb.')).toBe('colores');
    expect(bloqueDeError('La configuración no es un objeto válido.')).toBeNull();
    expect(bloqueDeError('El slug (slug) no coincide con el de la dirección de esta página.')).toBeNull();
  });

  it('salta los paréntesis que no son rutas de un bloque, como «(alt)»', () => {
    expect(bloqueDeError('Falta la descripción (alt) de el logo blanco (logos.blanco).')).toBe('logos');
  });

  it('quita la ruta entre paréntesis', () => {
    expect(limpiarMensaje('Falta el lugar (lugar).')).toBe('Falta el lugar.');
    expect(limpiarMensaje('La fecha de inicio (avisos[0].desde) no puede ser posterior al fin (avisos[0].hasta).')).toBe(
      'La fecha de inicio no puede ser posterior al fin.',
    );
  });

  it('conserva «(alt)», que es parte del texto y no una ruta', () => {
    expect(limpiarMensaje('Falta la descripción (alt) de el logo blanco (logos.blanco).')).toBe(
      'Falta la descripción (alt) de el logo blanco.',
    );
  });
});

describe('vistaPreviaDeRuta (plan 4, Tarea 1)', () => {
  const r = (resto: string) => vistaPreviaDeRuta(`/editor/p/s${resto}`, 's');

  it('la lista de pantallas no tiene vista previa', () => {
    expect(r('/pantallas')).toMatchObject({ vistaPrevia: null, disposicion: 'una-columna' });
    expect(r('/tipos')).toMatchObject({ vistaPrevia: null, disposicion: 'una-columna' });
  });

  it('una pantalla muestra esa pantalla', () => {
    const g = r('/pantallas/gracias');
    expect(g.vistaPrevia).toMatchObject({ pagina: 'pantalla', vista: 'gracias', conSelectorTipo: true });
    expect(g).toMatchObject({ disposicion: 'dos-columnas', anchoFormulario: 520 });
    expect(r('/pantallas/evento').vistaPrevia).toMatchObject({ vista: 'portada', tipoFijo: 'evento', conSelectorTipo: false });
    expect(r('/pantallas/portada').vistaPrevia).toMatchObject({ vista: 'portada', tipoFijo: 'patronal' });
    expect(r('/pantallas/produccion').vistaPrevia).toMatchObject({ pagina: 'produccion' });
    const ev = r('/pantallas/envivo').vistaPrevia;
    expect(ev?.pagina).toBe('rotulos');
    expect(ev?.estado?.mostrarBarra).toBe(true);
  });

  it('una vista que no se ofrece no tiene vista previa', () => {
    expect(r('/pantallas/horarios')).toMatchObject({ vistaPrevia: null, disposicion: 'una-columna' });
    expect(r('/pantallas/nada')).toMatchObject({ vistaPrevia: null });
  });

  it('rótulos muestra el rótulo de persona', () => {
    const ro = r('/rotulos');
    expect(ro.anchoFormulario).toBe(540);
    expect(ro.vistaPrevia).toMatchObject({ pagina: 'rotulos', titulo: 'Vista previa · Rótulo de persona', tipoFijo: 'dominical' });
    expect(ro.vistaPrevia?.estado?.rotulo).toBe('persona');
    expect(ro.vistaPrevia?.estado?.celebrante).toBe('P. Juan Pérez');
  });

  it('editar un tipo muestra Inicio', () => {
    const t = r('/tipos/nuevo');
    expect(t.anchoFormulario).toBe(560);
    expect(t.vistaPrevia).toMatchObject({ pagina: 'pantalla', vista: 'inicio', titulo: 'Vista previa · Inicio', conSelectorTipo: false });
  });

  it('las secciones del plan 3 no cambian', () => {
    expect(r('/identidad')).toEqual({ vistaPrevia: seccion('identidad').vistaPrevia, disposicion: 'dos-columnas', anchoFormulario: 560 });
    expect(r('').vistaPrevia).toBeNull();
    expect(VISTAS_EDITOR).toEqual(['inicio', 'portada', 'evento', 'avisos', 'gracias', 'produccion', 'envivo']);
  });
});
