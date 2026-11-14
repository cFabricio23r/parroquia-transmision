// Galería del borrador (plan 3, Tarea 14; Review Focus 5).
import { describe, expect, it } from 'vitest';
import { aplicarCambios } from '../../lib/borrador';
import {
  ETIQUETAS_GALERIA,
  etiquetaDe,
  filtrar,
  MAX_GALERIA,
  nombreDeImagen,
  nuevoIdGaleria,
  quitarImagen,
  usosDeImagen,
} from '../../lib/editor/galeria';
import { validarBorrador } from '../../lib/validar';

const azarQueDevuelve = (...valores: string[]) => {
  let i = 0;
  return () => valores[i++];
};
const NOMBRES = { horasanta: 'Hora Santa', dominical: 'Misa dominical' };
const img = (id: string, etiquetas?: string[]) => ({ id, src: `medios/${id}.png`, alt: `Alt ${id}`, ...(etiquetas ? { etiquetas } : {}) });
const CONFIG = {
  nombre: 'Parroquia San José',
  lugar: 'Lugar',
  colores: { principal: '#8a1c2b', oscuro: '#4b0f18' },
  patrono: { nombre: 'San José', corto: 'San José' },
  fiesta: { dia: 19, mes: 3 },
  galeria: [img('img-x', ['santos']), img('img-y')],
  pantallas: {
    inicio: { modo: 'personalizada', imagen: 'galeria:img-x' },
    avisos: { modo: 'personalizada', fondo: { tipo: 'imagen', imagen: 'img-x' } },
  },
  tipos: {
    propios: [{ clave: 'misa-ninos', nombre: 'Misa de niños', imagen: 'galeria:img-x' }],
    ajustes: { horasanta: { imagen: 'galeria:img-x' } },
  },
};

describe('galería', () => {
  it('constantes', () => {
    expect(MAX_GALERIA).toBe(30);
    expect(ETIQUETAS_GALERIA.map((e) => e.valor)).toEqual(['patrono', 'santos', 'custodia', 'fachada', 'fondos']);
  });
  it('nuevoIdGaleria no repite y tiene la forma de un id', () => {
    const id = nuevoIdGaleria(['img-aaaaaa'], azarQueDevuelve('aaaaaa', 'bbbbbb'));
    expect(id).toBe('img-bbbbbb');
    expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    expect(id).toHaveLength(10);
    expect(nuevoIdGaleria([])).toMatch(/^img-[0-9a-f]{6}$/);
  });
  it('nombreDeImagen y etiquetaDe', () => {
    expect(nombreDeImagen({ alt: 'A' })).toBe('A');
    expect(nombreDeImagen({ alt: 'A', nombre: 'N' })).toBe('N');
    expect(etiquetaDe({ etiquetas: ['ejemplo', 'santos'] })).toBe('Santos');
    expect(etiquetaDe({})).toBeNull();
  });
  it('filtrar por etiqueta', () => {
    const lista = [img('a', ['santos']), img('b', ['fondos']), img('c')];
    expect(filtrar(lista, null)).toHaveLength(3);
    expect(filtrar(lista, 'fondos').map((i) => i.id)).toEqual(['b']);
  });
  it('usosDeImagen en orden', () => {
    expect(usosDeImagen(CONFIG, 'img-x', NOMBRES)).toEqual([
      'Pantalla de Inicio',
      'Fondo de la pantalla de Avisos',
      'Tipo «Misa de niños»',
      'Tipo «Hora Santa» (ajuste)',
    ]);
    expect(usosDeImagen(CONFIG, 'img-y', NOMBRES)).toEqual([]);
  });
  it('quitarImagen no deja referencias colgando y el borrador sigue válido en la galería', () => {
    const cambios = quitarImagen(CONFIG, 'img-x');
    const aplicado = aplicarCambios(CONFIG, cambios) as typeof CONFIG;
    expect(JSON.stringify(aplicado)).not.toContain('img-x');
    expect(aplicado.pantallas.avisos).not.toHaveProperty('fondo');
    expect(aplicado.pantallas.inicio).toEqual({ modo: 'personalizada' });
    const deGaleria = (b: object) => validarBorrador(b, 'san-jose').errores.filter((e) => e.includes('galería') || e.includes('galeria'));
    expect(deGaleria(aplicado)).toEqual([]);
    // Control: quitar solo de la galería sí deja referencias colgando.
    expect(deGaleria(aplicarCambios(CONFIG, { galeria: [img('img-y')] })).length).toBeGreaterThan(0);
    expect(CONFIG.galeria).toHaveLength(2); // no muta
  });
  it('quitarImagen de una imagen sin usos devuelve solo la galería', () => {
    expect(Object.keys(quitarImagen(CONFIG, 'img-y'))).toEqual(['galeria']);
  });
});

describe('textoBorrar (Decisión 3)', () => {
  it('con usos y sin usos', async () => {
    const { textoBorrar } = await import('../../app/editor/p/[slug]/galeria/DialogoEditarImagen');
    expect(textoBorrar(['Pantalla de Inicio'])).toBe('Esta imagen se usa en: Pantalla de Inicio. Si la borras, esos lugares vuelven a como vienen.');
    expect(textoBorrar([])).toBe('¿Borrar esta imagen de la galería?');
  });
});
