// Envío de los formularios de acceso (plan 2, ronda 2): un solo envío a la vez, sin botón trabado.
import { describe, expect, it, vi } from 'vitest';
import { enviarUnaVez } from '../../lib/envio';

const nada = () => {};

describe('enviarUnaVez', () => {
  it('marca ocupado mientras espera y lo suelta al terminar', async () => {
    const cerrojo = { current: false };
    const marcar = vi.fn();
    const r = await enviarUnaVez(cerrojo, marcar, async () => 42, nada);
    expect(r).toEqual({ tipo: 'ok', valor: 42 });
    expect(marcar.mock.calls).toEqual([[true], [false]]);
    expect(cerrojo.current).toBe(false);
  });

  it('un segundo envío mientras el primero espera se ignora', async () => {
    const cerrojo = { current: false };
    let soltar: (v: string) => void = () => {};
    const accion = vi.fn(() => new Promise<string>((ok) => (soltar = ok)));
    const primero = enviarUnaVez(cerrojo, nada, accion, nada);
    expect(await enviarUnaVez(cerrojo, nada, accion, nada)).toEqual({ tipo: 'ocupado' });
    expect(accion).toHaveBeenCalledTimes(1);
    soltar('listo');
    expect(await primero).toEqual({ tipo: 'ok', valor: 'listo' });
  });

  it('si la acción falla (red caída, 5xx) devuelve «fallo» y suelta el botón', async () => {
    const cerrojo = { current: false };
    const marcar = vi.fn();
    const r = await enviarUnaVez(cerrojo, marcar, () => Promise.reject(new TypeError('Failed to fetch')), nada);
    expect(r).toEqual({ tipo: 'fallo' });
    expect(marcar).toHaveBeenLastCalledWith(false);
    expect(cerrojo.current).toBe(false);
  });

  it('la redirección de Next (rechazo de la acción) se relanza y también suelta el cerrojo', async () => {
    const cerrojo = { current: false };
    const redireccion = Object.assign(new Error('NEXT_REDIRECT'), { digest: 'NEXT_REDIRECT;push;/editor;307;' });
    const relanzar = (e: unknown) => {
      if (e === redireccion) throw e;
    };
    await expect(enviarUnaVez(cerrojo, nada, () => Promise.reject(redireccion), relanzar)).rejects.toBe(redireccion);
    expect(cerrojo.current).toBe(false);
  });
});
