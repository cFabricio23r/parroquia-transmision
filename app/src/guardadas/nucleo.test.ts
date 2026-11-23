/**
 * @jest-environment node
 */
// El núcleo de las misas listas dentro de la app (Tarea 6): la copia de vicaria/guardadas-nucleo.js y
// lo que se acepta de lo que manda el panel.
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { GUARDADAS, guardadasValidas, pendientesValidos } from './nucleo';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { generarNucleo } = require('../../scripts/copiar-vicaria');

const APP = path.resolve(__dirname, '..', '..');
const RAIZ = path.resolve(APP, '..');

test('la copia del núcleo de guardadas es igual al original', () => {
  const copia = fs.readFileSync(path.join(APP, 'src', 'generado', 'guardadas-nucleo.js'));
  const original = fs.readFileSync(path.join(RAIZ, 'vicaria', 'guardadas-nucleo.js'));
  if (!copia.equals(original)) {
    throw new Error('La copia de guardadas-nucleo.js está vieja: corre npm --prefix app run copiar-vicaria');
  }
});

test('generarNucleo copia también guardadas-nucleo.js', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nucleo-gua-'));
  try {
    generarNucleo(RAIZ, tmp);
    const nuevo = fs.readFileSync(path.join(tmp, 'generado', 'guardadas-nucleo.js'));
    expect(nuevo.equals(fs.readFileSync(path.join(RAIZ, 'vicaria', 'guardadas-nucleo.js')))).toBe(true);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('el núcleo funciona con tipos', () => {
  expect(GUARDADAS.LIMITE).toBe(50);
  expect(GUARDADAS.nombreLibre('Misa', ['Misa (copia)'])).toBe('Misa (copia 2)');
  const fila = GUARDADAS.aFila(
    { id: 'abcd-123456', nombre: 'Misa', tipo: 'dominical', guardadaEn: 1000, usadaEn: 2000, actualizadoEn: 2000, datos: { rotulo: 'x', a: 1 } },
    'app',
    'p1',
  );
  expect(fila.actualizado_desde).toBe('app');
  expect(fila.datos).toEqual({ a: 1 });
});

describe('lo que manda el panel', () => {
  it('guardadasValidas deja solo las que tienen id, nombre y datos, y completa actualizadoEn', () => {
    const lista = guardadasValidas([
      { id: 'a', nombre: 'A', tipo: 'dominical', guardadaEn: 1, usadaEn: 5, datos: {} },
      { id: 'b', nombre: 'B', tipo: 'dominical', guardadaEn: 1, usadaEn: 1, actualizadoEn: 9, datos: {} },
      { id: 'c', nombre: 'C' },
      null,
      'x',
      { id: 3, nombre: 'D', datos: {} },
    ]);
    expect(lista.map((g) => g.id)).toEqual(['a', 'b']);
    expect(lista[0].actualizadoEn).toBe(5);
    expect(lista[1].actualizadoEn).toBe(9);
  });

  it('pendientesValidos deja solo op conocida, id texto y cuando número', () => {
    expect(
      pendientesValidos([
        { op: 'guardar', id: 'a', cuando: 1 },
        { op: 'borrar', id: 'b', cuando: 2, rechazado: true },
        { op: 'usar', id: 'c', cuando: 3 },
        { op: 'otra', id: 'd', cuando: 4 },
        { op: 'usar', id: 'e', cuando: '5' },
        null,
      ]),
    ).toEqual([
      { op: 'guardar', id: 'a', cuando: 1 },
      { op: 'borrar', id: 'b', cuando: 2, rechazado: true },
      { op: 'usar', id: 'c', cuando: 3 },
    ]);
  });
});
