/**
 * @jest-environment node
 */
// El núcleo compartido de la semana dentro de la app (Tarea 10 del plan 3b).
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { SEMANA, TIPOS_COMUNES } from './nucleo';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { generarNucleo } = require('../../scripts/copiar-vicaria');

const APP = path.resolve(__dirname, '..', '..');
const RAIZ = path.resolve(APP, '..');

test('la copia del núcleo es igual al original', () => {
  const copia = fs.readFileSync(path.join(APP, 'src', 'generado', 'semana.js'));
  const original = fs.readFileSync(path.join(RAIZ, 'vicaria', 'semana.js'));
  if (!copia.equals(original)) {
    throw new Error('La copia del núcleo está vieja: corre npm --prefix app run copiar-vicaria');
  }
});

test('tipos-comunes.json es lo que generarNucleo produce ahora', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nucleo-'));
  try {
    generarNucleo(RAIZ, tmp);
    const nuevo = fs.readFileSync(path.join(tmp, 'generado', 'tipos-comunes.json'), 'utf8');
    const guardado = fs.readFileSync(path.join(APP, 'src', 'generado', 'tipos-comunes.json'), 'utf8');
    if (nuevo !== guardado) {
      throw new Error('tipos-comunes.json está viejo: corre npm --prefix app run copiar-vicaria');
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('los tipos comunes y el núcleo funcionan', () => {
  expect(TIPOS_COMUNES.length).toBe(11);
  expect(typeof SEMANA.contarFaltas(TIPOS_COMUNES[0], {})).toBe('number');
  expect(SEMANA.lunesDe('2026-11-15')).toBe('2026-11-09');
});
