// Textos de tiempo y velocidad para las pantallas (TypeScript puro).

const dos = (n: number): string => String(n).padStart(2, '0');

/** Segundos al aire como hh:mm:ss (el reloj de la barra superior). */
export function formatoReloj(segundos: number): string {
  const s = Number.isFinite(segundos) && segundos > 0 ? Math.floor(segundos) : 0;
  return `${dos(Math.floor(s / 3600))}:${dos(Math.floor((s % 3600) / 60))}:${dos(s % 60)}`;
}

/** Mbps de subida con coma decimal, como en el lienzo de diseño. */
export function formatoMbps(mbps: number | null): string {
  if (mbps === null || !Number.isFinite(mbps)) return '— Mbps';
  return `${mbps.toFixed(1).replace('.', ',')} Mbps`;
}

/** «1 h 18 min» para el diálogo de terminar. */
export function formatoDuracion(segundos: number): string {
  const min = Math.floor((Number.isFinite(segundos) && segundos > 0 ? segundos : 0) / 60);
  if (min < 1) return 'menos de 1 min';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

// Por debajo de esto el video se nota entrecortado: el número de la barra se pinta ámbar.
const FPS_BAJO = 25;

/** Cuadros por segundo del video que sale, para la barra superior. */
export function formatoFps(fps: number | null): string {
  if (fps === null || !Number.isFinite(fps)) return '— fps';
  return `${Math.round(fps)} fps`;
}

/** true si los fps se conocen y están por debajo de 25. */
export function fpsBajo(fps: number | null): boolean {
  return fps !== null && Number.isFinite(fps) && fps < FPS_BAJO;
}
