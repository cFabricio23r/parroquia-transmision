// La transición de OBS armada en el navegador (pantallas más opciones, #3): 120 cuadros de la página de la
// transición (vicaria/transicion.html, que los dibuja con la identidad de la parroquia) se codifican en WebM
// VP9 con transparencia, más el sonido en Opus, con mediabunny. Sin servidor: el archivo se arma y se baja
// en el navegador. VideoEncoder solo existe en páginas seguras (https o localhost) y en Chrome/Edge.

export type VersionTransicion = 'logo' | 'patrono';
export interface SonidoTransicion {
  izq: Float32Array;
  der: Float32Array;
}

// Valores exactos de la spec (Restricciones globales del plan).
export const ANCHO_TRANSICION = 1920;
export const ALTO_TRANSICION = 1080;
export const CUADROS_POR_SEGUNDO = 60;
export const DURACION_TRANSICION = 2;
export const FRECUENCIA_SONIDO = 48000;
const BITRATE_VIDEO = 6_000_000;
const BITRATE_SONIDO = 128_000;

/** «Transicion_<slug>_Logo.webm» o «Transicion_<slug>_Patrono.webm». */
export function nombreArchivoTransicion(slug: string, version: VersionTransicion): string {
  return `Transicion_${slug}_${version === 'patrono' ? 'Patrono' : 'Logo'}.webm`;
}

/** Si este navegador puede armar VP9 con transparencia de 1920×1080 (sin VideoEncoder, no). */
export async function puedeArmarTransicion(): Promise<boolean> {
  if (typeof (globalThis as { VideoEncoder?: unknown }).VideoEncoder === 'undefined') return false;
  try {
    const { canEncodeVideo } = await import('mediabunny');
    return await canEncodeVideo('vp9', { width: ANCHO_TRANSICION, height: ALTO_TRANSICION, alpha: 'keep' });
  } catch {
    return false;
  }
}

/**
 * Arma el video: `cuadro(t)` dibuja el segundo `t` y devuelve su canvas (puede ser el de un iframe del mismo
 * origen: cada cuadro se copia a un canvas propio). `sonido` son los dos canales a 48 000 muestras por segundo.
 */
export async function armarTransicion(cuadro: (t: number) => HTMLCanvasElement, sonido: SonidoTransicion): Promise<Blob> {
  const { Output, WebMOutputFormat, BufferTarget, CanvasSource, AudioBufferSource } = await import('mediabunny');
  const lienzo = document.createElement('canvas');
  lienzo.width = ANCHO_TRANSICION;
  lienzo.height = ALTO_TRANSICION;
  const g = lienzo.getContext('2d', { alpha: true });
  if (!g) throw new Error('Este navegador no puede dibujar la transición.');

  const salida = new Output({ format: new WebMOutputFormat(), target: new BufferTarget() });
  const video = new CanvasSource(lienzo, { codec: 'vp9', bitrate: BITRATE_VIDEO, alpha: 'keep', keyFrameInterval: 1 });
  const audio = new AudioBufferSource({ codec: 'opus', bitrate: BITRATE_SONIDO });
  salida.addVideoTrack(video, { frameRate: CUADROS_POR_SEGUNDO });
  salida.addAudioTrack(audio);
  await salida.start();

  const cuadros = CUADROS_POR_SEGUNDO * DURACION_TRANSICION;
  for (let n = 0; n < cuadros; n++) {
    const t = n / CUADROS_POR_SEGUNDO;
    const origen = cuadro(t);
    g.clearRect(0, 0, ANCHO_TRANSICION, ALTO_TRANSICION);
    g.drawImage(origen, 0, 0, ANCHO_TRANSICION, ALTO_TRANSICION);
    await video.add(t, 1 / CUADROS_POR_SEGUNDO);
  }

  const buffer = new AudioBuffer({ length: sonido.izq.length, numberOfChannels: 2, sampleRate: FRECUENCIA_SONIDO });
  buffer.copyToChannel(new Float32Array(sonido.izq), 0);
  buffer.copyToChannel(new Float32Array(sonido.der), 1);
  await audio.add(buffer);

  await salida.finalize();
  if (!salida.target.buffer) throw new Error('No se pudo armar el video.');
  return new Blob([salida.target.buffer], { type: 'video/webm' });
}
