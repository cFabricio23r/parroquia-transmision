import { armarLugares } from './lugares';

// Samsung SM-S948B acostado, medido el 2026-11-16 por adb: 2340×1080 px a densidad 420 (891×411 dp),
// barra de botones de 126 px (48 dp) a la derecha y el recorte de la cámara a la izquierda (~40 dp).
const ANCHO = 891;
const ALTO = 411;
const ZONAS = { top: 0, bottom: 0, left: 40, right: 48 };

const derecha = (r: { left: number; width: number }) => r.left + r.width;

describe('armarLugares acostado (Tarea 9i)', () => {
  it('con recorte y barra a los lados, nada se mete debajo de la barra', () => {
    const l = armarLugares(ANCHO, ALTO, ZONAS);
    expect(l.lienzo.left).toBeGreaterThanOrEqual(ZONAS.left);
    expect(l.lienzo.left + l.lienzo.width).toBeLessThanOrEqual(ANCHO - ZONAS.right);
    expect(l.lienzo.left + derecha(l.panel)).toBeLessThanOrEqual(ANCHO - ZONAS.right);
    expect(l.lienzo.left + derecha(l.barra)).toBeLessThanOrEqual(ANCHO - ZONAS.right);
  });

  it('el espacio que falta lo cede el panel; la vista previa queda de 448×252', () => {
    const l = armarLugares(ANCHO, ALTO, ZONAS);
    expect(l.vista.width).toBe(448);
    expect(l.vista.height).toBe(252);
    expect(l.panel.width).toBe(ANCHO - ZONAS.left - ZONAS.right - 448 - 12);
  });

  it('si entra de sobra, el panel sigue de 360 y el lienzo va centrado', () => {
    const l = armarLugares(ANCHO, ALTO, { top: 0, bottom: 0, left: 0, right: 0 });
    expect(l.panel.width).toBe(360);
    expect(l.lienzo.left).toBeCloseTo((ANCHO - 820) / 2);
  });

  it('el panel no baja de 300', () => {
    const l = armarLugares(700, ALTO, ZONAS);
    expect(l.panel.width).toBe(300);
  });
});

describe('armarLugares parado', () => {
  it('el botón Listo queda arriba de la barra de abajo', () => {
    const l = armarLugares(411, 891, { top: 32, bottom: 48, left: 0, right: 0 });
    expect(l.vertical).toBe(true);
    expect(l.lienzo.top + l.listo.top + l.listo.height).toBeLessThanOrEqual(891 - 48);
  });
});
