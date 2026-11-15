import { describe, expect, it } from 'vitest';
import { AVISO_TIPO_EDITOR, cambiadoDesdeApp, etiquetaAccion, etiquetaFila, rangoSemana } from '../../lib/editor/semana-textos';
import type { ItemSemana } from '../../lib/semana';

const item: ItemSemana = {
  clave: 'fija:x:2026-11-19', fecha: '2026-11-19', hora: '18:00', tipo: 'horasanta', datos: {},
  origen: 'fija', fijaId: 'x', serieId: null, serie: null, diaSemanaFija: 4,
  id: null, saltada: false, editada: false, actualizadoEn: '2026-11-14T00:42:00Z', actualizadoDesde: 'app',
};

describe('textos de la semana', () => {
  it('rangoSemana', () => {
    expect(rangoSemana('2026-11-16')).toBe('16 – 22 nov 2026');
    expect(rangoSemana('2026-11-30')).toBe('30 nov – 6 dic 2026');
    expect(rangoSemana('2026-12-28')).toBe('28 dic 2026 – 3 ene 2027');
  });

  it('cambiadoDesdeApp', () => {
    expect(cambiadoDesdeApp(item)).toBe('Cambiado desde la app el 13 nov, 18:42');
    expect(cambiadoDesdeApp({ ...item, actualizadoDesde: 'web' })).toBeNull();
  });

  it('etiquetaFila y etiquetaAccion', () => {
    expect(etiquetaFila(item, 'Hora Santa')).toBe('Jue 19 · 18:00 · Hora Santa');
    expect(etiquetaAccion('Editar', item, 'Hora Santa')).toBe('Editar el jueves 19, 18:00, Hora Santa');
    expect(AVISO_TIPO_EDITOR).toBe('Este tipo ya no está en la parroquia. Cámbialo.');
  });
});
