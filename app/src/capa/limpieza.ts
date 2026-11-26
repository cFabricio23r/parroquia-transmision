// La limpieza 'capa' (Tarea 3 de app-cuentas-limpias): al cerrar sesión libera la capa nativa
// (el transmisor), para que no quede nada de la cuenta anterior. Solo corre con alcance 'todo';
// al quitar una sola parroquia no hace falta tocar la capa.
import type { Limpiezas } from '../sincronizar/sincronizar';

/** Registra la limpieza 'capa' en `l`. `nativo.limpiarTodo` rechaza si la capa está en vivo. */
export function registrarLimpiezaCapa(l: Limpiezas, nativo: { limpiarTodo(): Promise<void> }): void {
  l.registrar('capa', async (a) => {
    if (a.tipo === 'todo') await nativo.limpiarTodo();
  });
}
