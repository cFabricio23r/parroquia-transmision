// Pruebas de la regla del ajuste que manda. Las claves son falsas, solo para pruebas.
import { AJUSTES_INICIALES } from './ajustes';
import {
  AjustesCelular,
  AjustesDeParroquia,
  aplicarCambioCelular,
  CampoAjuste,
  ClaveDeParroquia,
  Origen,
  resolverAjustes,
  seguirConLaDelCelular,
  TEXTOS_AJUSTES,
  textoOrigen,
  volverALaParroquia,
} from './origen';

const P: AjustesDeParroquia = { servidor: 'rtmps://p/', calidad: '1080p', estiloFinal: 'claro', actualizadoEn: '2026-11-14T10:00:00Z' };
const K: ClaveDeParroquia = { clave: 'FB-CLAVE-FALSA-1111', guardadaEn: '2026-11-14T10:00:00Z' };

describe('resolverAjustes', () => {
  it('sin cambios en el celular, todo viene de la parroquia', () => {
    const e = resolverAjustes(P, K, {}, 'celular');
    expect(e.ajustes).toEqual({ servidor: 'rtmps://p/', clave: 'FB-CLAVE-FALSA-1111', calidad: '1080p', microfono: 'celular', estiloFinal: 'claro' });
    expect(e.origen).toEqual({ servidor: 'parroquia', clave: 'parroquia', calidad: 'parroquia', estiloFinal: 'parroquia', microfono: 'celular' });
    expect(e.deParroquia).toEqual({ servidor: true, clave: true, calidad: true });
    expect(e.claveNueva).toBe(false);
  });
  it('sin parroquia ni celular, los valores de la app', () => {
    const e = resolverAjustes(null, null, {}, 'externo');
    expect(e.ajustes).toEqual({ ...AJUSTES_INICIALES, microfono: 'externo' });
    expect(e.origen).toEqual({ servidor: 'app', clave: 'app', calidad: 'app', estiloFinal: 'app', microfono: 'celular' });
  });
  it('lo del celular manda, salvo la pantalla final', () => {
    const c: AjustesCelular = { servidor: 'rtmps://c/', clave: 'FB-CLAVE-FALSA-2222', calidad: '720p', claveParroquiaVista: K.guardadaEn };
    const e = resolverAjustes(P, K, c, 'celular');
    expect(e.ajustes).toMatchObject({ servidor: 'rtmps://c/', clave: 'FB-CLAVE-FALSA-2222', calidad: '720p', estiloFinal: 'claro' });
    expect(e.origen).toMatchObject({ servidor: 'celular', clave: 'celular', calidad: 'celular', estiloFinal: 'parroquia' });
    expect(e.claveNueva).toBe(false);
  });
  it('servidor null de la parroquia: vacío y de la app', () => {
    const e = resolverAjustes({ ...P, servidor: null }, K, {}, 'celular');
    expect(e.ajustes.servidor).toBe('');
    expect(e.origen.servidor).toBe('app');
    expect(e.deParroquia.servidor).toBe(false);
  });
  it('el estilo nunca sale del celular', () => {
    const c = { estiloFinal: 'azul' } as unknown as AjustesCelular;
    const e = resolverAjustes(P, K, c, 'celular');
    expect(e.ajustes.estiloFinal).toBe('claro');
    expect(e.origen.estiloFinal).toBe('parroquia');
  });
});

describe('claveNueva', () => {
  const propia = (vista: string | null): AjustesCelular => ({ clave: 'FB-CLAVE-FALSA-2222', claveParroquiaVista: vista });
  it('propia sin haber visto ninguna y la parroquia tiene: true', () => {
    expect(resolverAjustes(P, K, propia(null), 'celular').claveNueva).toBe(true);
  });
  it('propia que ya vio esa: false', () => {
    expect(resolverAjustes(P, K, propia(K.guardadaEn), 'celular').claveNueva).toBe(false);
  });
  it('la parroquia la reemplazó: true', () => {
    expect(resolverAjustes(P, { ...K, guardadaEn: '2026-11-15T10:00:00Z' }, propia(K.guardadaEn), 'celular').claveNueva).toBe(true);
  });
  it('la parroquia la quitó: false', () => {
    expect(resolverAjustes(P, null, propia(K.guardadaEn), 'celular').claveNueva).toBe(false);
  });
  it('sin clave propia: false', () => {
    expect(resolverAjustes(P, K, {}, 'celular').claveNueva).toBe(false);
  });
});

describe('aplicarCambioCelular', () => {
  it('clave propia, recortada, anota la de la parroquia vista', () => {
    expect(aplicarCambioCelular({}, P, K, 'clave', ' FB-CLAVE-FALSA-2222 ')).toEqual({ clave: 'FB-CLAVE-FALSA-2222', claveParroquiaVista: K.guardadaEn });
  });
  it('sin clave de la parroquia, vista null', () => {
    expect(aplicarCambioCelular({}, P, null, 'clave', 'FB-CLAVE-FALSA-2222')).toEqual({ clave: 'FB-CLAVE-FALSA-2222', claveParroquiaVista: null });
  });
  it('la misma clave de la parroquia quita el cambio', () => {
    const c = { clave: 'FB-CLAVE-FALSA-2222', claveParroquiaVista: null };
    expect(aplicarCambioCelular(c, P, K, 'clave', 'FB-CLAVE-FALSA-1111')).toEqual({});
  });
  it('clave vacía quita el cambio', () => {
    const c = { clave: 'FB-CLAVE-FALSA-2222', claveParroquiaVista: null };
    expect(aplicarCambioCelular(c, P, K, 'clave', '')).toEqual({});
  });
  it('el mismo servidor de la parroquia quita el cambio', () => {
    expect(aplicarCambioCelular({ servidor: 'rtmps://c/' }, P, K, 'servidor', 'rtmps://p/')).toEqual({});
  });
  it('calidad igual a la de la parroquia quita; distinta queda', () => {
    expect(aplicarCambioCelular({ calidad: '720p' }, P, K, 'calidad', '1080p')).toEqual({});
    expect(aplicarCambioCelular({}, P, K, 'calidad', '720p')).toEqual({ calidad: '720p' });
  });
  it('sin parroquia, la calidad queda en el celular', () => {
    const c = aplicarCambioCelular({}, null, null, 'calidad', '720p');
    expect(c).toEqual({ calidad: '720p' });
    expect(resolverAjustes(null, null, c, 'celular').origen.calidad).toBe('celular');
  });
  it('una calidad inválida no cambia nada', () => {
    const c: AjustesCelular = { calidad: '720p' };
    expect(aplicarCambioCelular(c, P, K, 'calidad', '4k')).toEqual({ calidad: '720p' });
  });
  it('no muta lo que recibe', () => {
    const c = { clave: 'FB-CLAVE-FALSA-2222', claveParroquiaVista: null };
    aplicarCambioCelular(c, P, K, 'clave', '');
    expect(c).toEqual({ clave: 'FB-CLAVE-FALSA-2222', claveParroquiaVista: null });
  });
});

describe('volver y seguir', () => {
  it('volverALaParroquia(clave) quita la clave y la vista', () => {
    expect(volverALaParroquia({ clave: 'FB-CLAVE-FALSA-2222', claveParroquiaVista: null, calidad: '720p' }, 'clave')).toEqual({ calidad: '720p' });
  });
  it('seguirConLaDelCelular anota la clave actual y el aviso se va', () => {
    const c = seguirConLaDelCelular({ clave: 'FB-CLAVE-FALSA-2222', claveParroquiaVista: null }, K);
    expect(c.claveParroquiaVista).toBe(K.guardadaEn);
    expect(resolverAjustes(P, K, c, 'celular').claveNueva).toBe(false);
  });
});

describe('textoOrigen', () => {
  it('cada fila de la tabla', () => {
    expect(textoOrigen('servidor', 'parroquia', true)).toEqual({ texto: 'Viene de la parroquia', volver: false });
    expect(textoOrigen('calidad', 'celular', true)).toEqual({ texto: 'Cambiado en este celular', volver: true });
    expect(textoOrigen('clave', 'celular', false)).toEqual({ texto: 'Solo en este celular', volver: false });
    expect(textoOrigen('servidor', 'app', false)).toEqual({ texto: 'La parroquia no lo puso todavía', volver: false });
    expect(textoOrigen('calidad', 'app', false)).toEqual({ texto: 'La parroquia no lo puso todavía', volver: false });
    expect(textoOrigen('clave', 'app', false)).toEqual({
      texto: 'La parroquia no tiene clave guardada. Pégala aquí: queda solo en este celular.',
      volver: false,
    });
    expect(textoOrigen('estiloFinal', 'app', false)).toEqual({ texto: 'La parroquia no la eligió todavía: se usa Azul.', volver: false });
    expect(textoOrigen('microfono', 'celular', false)).toEqual({ texto: 'Solo en este celular', volver: false });
  });
  it('los textos fijos', () => {
    expect(TEXTOS_AJUSTES).toEqual({
      cabecera: 'Algunos vienen de la parroquia',
      volver: 'Volver a la de la parroquia',
      claveNueva: 'La parroquia cambió su clave.',
      usarParroquia: 'Usar la de la parroquia',
      seguirCelular: 'Seguir con la de este celular',
      claveNuevaCorta: 'La parroquia cambió su clave',
      placeholderClave: 'Guardada por la parroquia',
    });
  });
  it('la clave no está en ningún texto', () => {
    const textos: string[] = [JSON.stringify(TEXTOS_AJUSTES)];
    const campos: CampoAjuste[] = ['servidor', 'clave', 'calidad', 'estiloFinal', 'microfono'];
    const origenes: Origen[] = ['parroquia', 'celular', 'app'];
    for (const c of campos) for (const o of origenes) for (const d of [true, false]) textos.push(JSON.stringify(textoOrigen(c, o, d)));
    for (const t of textos) expect(t).not.toContain('FB-CLAVE');
  });
});
