// Orden de la tira (Tarea 9d): Producción va después de Gracias, igual en Preparar y En vivo.
import { StyleSheet } from 'react-native';

import { ESCENAS, ESCENAS_PREPARAR, estilosTira } from './TiraEscenas';
import { ESCENAS_VALIDAS } from '../estado/transmision';

describe('tira de escenas', () => {
  it('Producción va última, después de Gracias', () => {
    expect(ESCENAS.map((e) => e.id)).toEqual(['inicio', 'camara', 'portada', 'avisos', 'comunion', 'horarios', 'gracias', 'produccion']);
    expect(ESCENAS[ESCENAS.length - 1].nombre).toBe('Producción');
    expect(ESCENAS.find((e) => e.id === 'horarios')?.nombre).toBe('Horarios');
  });

  it('Comunión (2026-11-27) va entre Avisos y Horarios', () => {
    expect(ESCENAS.find((e) => e.id === 'comunion')?.nombre).toBe('Comunión');
  });

  it('con 8 escenas cada botón sigue midiendo 44 px de alto o más (una fila, flex 1)', () => {
    const tira = StyleSheet.flatten(estilosTira.tira) as { height: number; flexDirection: string };
    const boton = StyleSheet.flatten(estilosTira.boton) as { flex: number; minHeight?: number };
    expect(ESCENAS).toHaveLength(8);
    expect(tira.flexDirection).toBe('row');
    expect(tira.height).toBeGreaterThanOrEqual(44);
    expect(boton.flex).toBe(1);
  });

  it('con columnas (Preparar en vertical), los botones envuelven: 4 por fila, 44 de alto o más', () => {
    const tira = StyleSheet.flatten(estilosTira.tiraEnFilas) as { flexWrap: string };
    const boton = StyleSheet.flatten(estilosTira.botonEnFilas) as { flexBasis: string; flexGrow: number; minHeight: number };
    expect(tira.flexWrap).toBe('wrap');
    expect(parseFloat(boton.flexBasis) * 4).toBeLessThan(100);
    expect(parseFloat(boton.flexBasis) * 5).toBeGreaterThan(100);
    expect(boton.flexGrow).toBe(1);
    expect(boton.minHeight).toBeGreaterThanOrEqual(44);
  });

  it('Preparar y En vivo usan el mismo orden', () => {
    expect(ESCENAS_PREPARAR.map((e) => e.id)).toEqual(ESCENAS.map((e) => e.id));
  });

  it('tiene todas las escenas válidas, sin repetir', () => {
    expect([...ESCENAS.map((e) => e.id)].sort()).toEqual([...ESCENAS_VALIDAS].sort());
  });
});
