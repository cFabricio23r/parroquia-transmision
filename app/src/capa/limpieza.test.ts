// La limpieza 'capa' (Tarea 3 de app-cuentas-limpias): al salir, libera la capa nativa.
import { crearLimpiezas, type AlcanceLimpieza } from '../sincronizar/sincronizar';
import type { ParroquiaApp } from '../sesion/tipos';
import { registrarLimpiezaCapa } from './limpieza';

const PARROQUIA: ParroquiaApp = { id: 'id-1', slug: 'ciudad-arce', nombre: 'Ciudad Arce' };
const TODO: AlcanceLimpieza = { tipo: 'todo' };
const PARROQUIA_ALCANCE: AlcanceLimpieza = { tipo: 'parroquia', parroquia: PARROQUIA };

function nativoFalso(rechaza = false) {
  const limpiarTodo = jest.fn(() => (rechaza ? Promise.reject(new Error('vivo')) : Promise.resolve()));
  return { limpiarTodo };
}

describe('registrarLimpiezaCapa', () => {
  it("con 'todo' llama a limpiarTodo una vez y reporta 'ok'", async () => {
    const l = crearLimpiezas();
    const n = nativoFalso();
    registrarLimpiezaCapa(l, n);
    const r = await l.limpiar(TODO);
    expect(r).toEqual({ capa: 'ok' });
    expect(n.limpiarTodo).toHaveBeenCalledTimes(1);
  });

  it("con 'parroquia' no llama a limpiarTodo", async () => {
    const l = crearLimpiezas();
    const n = nativoFalso();
    registrarLimpiezaCapa(l, n);
    const r = await l.limpiar(PARROQUIA_ALCANCE);
    expect(r).toEqual({ capa: 'ok' });
    expect(n.limpiarTodo).not.toHaveBeenCalled();
  });

  it("si el nativo rechaza, reporta 'fallo'", async () => {
    const l = crearLimpiezas();
    const n = nativoFalso(true);
    registrarLimpiezaCapa(l, n);
    const r = await l.limpiar(TODO);
    expect(r).toEqual({ capa: 'fallo' });
    expect(n.limpiarTodo).toHaveBeenCalledTimes(1);
  });
});
