// «Qué cambia» entre la última versión publicada y el borrador (spec, sección 9), por sección, con
// frases como las del diseño. Puro. Los medios publicados llevan el prefijo `medios/vN-`: se quita
// antes de comparar. La igualdad no mira el orden de claves (jsonb).
import { NOMBRES_REDES, unirLista } from './estados';
import { iguales } from './fusion';
import { disenoDe, nombreDiseno, nombreTipografia } from './rotulos';
import { aFormaNueva } from './horarios';
import { OPCIONES_LETRA_FRASE, OPCIONES_TAMANO } from './pantallas';
import { NOMBRES_VISTAS, SECCIONES, type IdSeccion } from './secciones';

export interface CambiosSeccion {
  seccion: IdSeccion;
  frases: string[];
}

type Config = Record<string, unknown>;
const esObjeto = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const obj = (v: unknown): Config => (esObjeto(v) ? v : {});
const lista = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
const distinto = (a: unknown, b: unknown) => !iguales(a, b);

/** Cambia `medios/v<n>-archivo` por `medios/archivo` en todos los `src`. */
export function normalizarMedios(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(normalizarMedios);
  if (esObjeto(v)) {
    const salida: Config = {};
    for (const [k, x] of Object.entries(v)) {
      salida[k] = k === 'src' && typeof x === 'string' ? x.replace(/^medios\/v\d+-/, 'medios/') : normalizarMedios(x);
    }
    return salida;
  }
  return v;
}

function identidad(p: Config, b: Config): string[] {
  const partes: string[] = [];
  if (distinto(p.nombre, b.nombre)) partes.push('nombre');
  if (distinto(p.nombreCorto, b.nombreCorto)) partes.push('nombre corto');
  if (distinto(p.lugar, b.lugar)) partes.push('lugar');
  if (distinto(obj(p.logos).blanco, obj(b.logos).blanco)) partes.push('logo blanco');
  if (distinto(obj(p.logos).color, obj(b.logos).color)) partes.push('logo a color');
  if (distinto(p.colores, b.colores)) partes.push('colores');
  if (distinto(p.fachada, b.fachada)) partes.push('fachada');
  return partes.length ? [`Identidad: ${unirLista(partes)}`] : [];
}

function patrono(p: Config, b: Config): string[] {
  const pp = obj(p.patrono);
  const bp = obj(b.patrono);
  const pf = obj(p.fiesta);
  const bf = obj(b.fiesta);
  const partes: string[] = [];
  if (distinto(pp.nombre, bp.nombre) || distinto(pp.corto, bp.corto)) partes.push('patrono');
  if (distinto(pp.imagen, bp.imagen)) partes.push('imagen del patrono');
  if (distinto(pf.dia, bf.dia) || distinto(pf.mes, bf.mes)) partes.push('fecha de la fiesta');
  if (distinto(pf.lema, bf.lema)) partes.push('lema');
  if (distinto(pf.cuentaDesdeDias, bf.cuentaDesdeDias)) partes.push('cuenta regresiva');
  return partes.length ? [`Patrono y fiesta: ${unirLista(partes)}`] : [];
}

const ORDEN_VISTAS = ['inicio', 'portada', 'evento', 'avisos', 'gracias', 'produccion', 'envivo', 'horarios'];
const DISTRIBUCION: Record<string, string> = { derecha: 'imagen a la derecha', izquierda: 'imagen a la izquierda', centro: 'imagen al centro' };
const ELEMENTOS: [string, string][] = [
  ['marca', 'logo'],
  ['cuenta', 'cuenta regresiva'],
  ['franja', 'franja'],
  ['redes', 'redes'],
  ['horarios', 'horarios'],
  ['envivo', 'EN VIVO'],
  ['chispas', 'chispas'],
  ['rayos', 'rayos'],
  ['fachada', 'fachada'],
  ['esquina', 'esquina'],
];

const nombreTamano = (v: unknown) => (OPCIONES_TAMANO.find((o) => o.valor === v) ?? OPCIONES_TAMANO[1]).texto;
const nombreLetraFrase = (v: unknown) => (OPCIONES_LETRA_FRASE.find((o) => o.valor === v) ?? OPCIONES_LETRA_FRASE[0]).texto.replace(/ \(.*\)$/, '');

function estiloPantallas(p: Config, b: Config): string[] {
  const a = obj(p.estiloPantallas);
  const d = obj(b.estiloPantallas);
  const frases: string[] = [];
  if (distinto(a.letraTitulo, d.letraTitulo)) frases.push(`Letra del título: ${nombreTipografia(d.letraTitulo)}`);
  if (distinto(a.letraFrase, d.letraFrase)) frases.push(`Letra de la frase: ${nombreLetraFrase(d.letraFrase)}`);
  if (distinto(a.logo, d.logo)) frases.push(`Tamaño del logo: ${nombreTamano(d.logo)}`);
  return frases;
}

function pantallas(p: Config, b: Config): string[] {
  const pp = obj(p.pantallas);
  const bp = obj(b.pantallas);
  const vistas = [...ORDEN_VISTAS, ...Object.keys({ ...pp, ...bp }).filter((v) => !ORDEN_VISTAS.includes(v))];
  const frases: string[] = estiloPantallas(p, b);
  for (const v of vistas) {
    const a = obj(pp[v]);
    const d = obj(bp[v]);
    if (iguales(a, d)) continue;
    const nombre = NOMBRES_VISTAS[v] ?? v;
    const personalizadaAntes = a.modo === 'personalizada';
    if (personalizadaAntes && d.modo !== 'personalizada') {
      frases.push(`Pantalla de ${nombre}: como venía`);
      continue;
    }
    const detalles: string[] = [];
    if (distinto(a.distribucion, d.distribucion) && typeof d.distribucion === 'string' && DISTRIBUCION[d.distribucion]) {
      detalles.push(DISTRIBUCION[d.distribucion]);
    }
    if (distinto(a.imagen, d.imagen)) detalles.push('imagen');
    if (distinto(a.fondo, d.fondo)) detalles.push('fondo');
    const visible = (c: Config, e: string) => (lista(c.mostrar).includes(e) ? 'mostrar' : lista(c.ocultar).includes(e) ? 'ocultar' : '');
    for (const [e, texto] of ELEMENTOS) if (visible(a, e) !== visible(d, e)) detalles.push(texto);
    if (distinto(a.textos, d.textos)) detalles.push('texto de arriba');
    if (distinto(obj(a.tamanos).titulo, obj(d.tamanos).titulo)) detalles.push('tamaño del título');
    if (distinto(obj(a.tamanos).frase, obj(d.tamanos).frase)) detalles.push('tamaño de la frase');
    if (distinto(a.encuadre, d.encuadre)) detalles.push('foto movida');
    frases.push(`Pantalla de ${nombre}: ${detalles.length ? unirLista(detalles) : 'personalizada'}`);
  }
  return frases;
}

const ESQUINAS: Record<string, string> = { rectas: 'rectas', suaves: 'suaves', redondas: 'redondas', redondeadas: 'suaves' };
const POSICIONES: Record<string, string> = { centro: 'al centro', derecha: 'abajo a la derecha', 'arriba-derecha': 'arriba a la derecha' };

function rotulos(p: Config, b: Config): string[] {
  const a = obj(p.rotulos);
  const d = obj(b.rotulos);
  const frases: string[] = [];
  const tipo = (r: Config) => nombreTipografia(r.tipografia);
  const dis = (r: Config) => nombreDiseno(disenoDe(r));
  const esq = (r: Config) => ESQUINAS[String(r.esquinas)] ?? 'suaves';
  const pos = (r: Config) => POSICIONES[String(r.posicion)] ?? 'abajo a la izquierda';
  if (dis(a) !== dis(d)) frases.push(`Diseño de rótulos: ${dis(d)}`);
  if (tipo(a) !== tipo(d)) frases.push(`Tipografía de rótulos: ${tipo(d)}`);
  if (esq(a) !== esq(d)) frases.push(`Esquinas de rótulos: ${esq(d)}`);
  if (distinto(a.colorLado, d.colorLado)) frases.push('Fondo del rótulo');
  if (distinto(a.colorLinea, d.colorLinea)) frases.push('Línea de acento');
  if (pos(a) !== pos(d)) frases.push(`Posición de rótulos: ${pos(d)}`);
  if (distinto(a.logoEsquina, d.logoEsquina)) frases.push('Logo en la esquina');
  if (distinto(a.cargos, d.cargos)) frases.push('Cargos sugeridos');
  return frases;
}

function tipos(p: Config, b: Config, nombresTipos: Record<string, string>): string[] {
  const a = obj(p.tipos);
  const d = obj(b.tipos);
  const frases: string[] = [];
  const porClave = (l: unknown) => new Map(lista(l).filter(esObjeto).map((t) => [String(t.clave), t]));
  const pa = porClave(a.propios);
  const pd = porClave(d.propios);
  for (const [k, t] of pd) if (!pa.has(k)) frases.push(`Nuevo tipo: ${String(t.nombre ?? k)}`);
  for (const [k, t] of pa) if (!pd.has(k)) frases.push(`Tipo quitado: ${String(t.nombre ?? k)}`);
  for (const [k, t] of pd) if (pa.has(k) && distinto(pa.get(k), t)) frases.push(`Cambios en el tipo ${String(t.nombre ?? k)}`);
  const aa = obj(a.ajustes);
  const ad = obj(d.ajustes);
  for (const k of new Set([...Object.keys(aa), ...Object.keys(ad)])) {
    if (distinto(aa[k], ad[k])) frases.push(`Cambios en el tipo ${nombresTipos[k] ?? k}`);
  }
  const apA = new Set(lista(a.apagados).map(String));
  const apD = new Set(lista(d.apagados).map(String));
  for (const k of apD) if (!apA.has(k)) frases.push(`Se apagó: ${nombresTipos[k] ?? k}`);
  for (const k of apA) if (!apD.has(k)) frases.push(`Se encendió: ${nombresTipos[k] ?? k}`);
  return frases;
}

function galeria(p: Config, b: Config): string[] {
  const porId = (l: unknown) => new Map(lista(l).filter(esObjeto).map((im) => [String(im.id), im]));
  const a = porId(p.galeria);
  const d = porId(b.galeria);
  const nuevas = [...d.keys()].filter((k) => !a.has(k)).length;
  const quitadas = [...a.keys()].filter((k) => !d.has(k)).length;
  const cambiadas = [...d.keys()].filter((k) => a.has(k) && distinto(a.get(k), d.get(k))).length;
  const frases: string[] = [];
  if (nuevas) frases.push(nuevas === 1 ? '1 imagen nueva en la galería' : `${nuevas} imágenes nuevas en la galería`);
  if (quitadas) frases.push(quitadas === 1 ? '1 imagen quitada de la galería' : `${quitadas} imágenes quitadas de la galería`);
  if (cambiadas) frases.push(`Cambios en ${plural(cambiadas, 'imagen', 'imágenes')} de la galería`);
  return frases;
}

function horariosYRedes(p: Config, b: Config): string[] {
  const frases: string[] = [];
  const porDia = (l: unknown) => {
    const m = new Map<string, unknown>();
    for (const h of lista(l).map(aFormaNueva)) if (!m.has(h.dia)) m.set(h.dia, h);
    return m;
  };
  const a = porDia(p.horarios);
  const d = porDia(b.horarios);
  for (const [dia] of d) if (!a.has(dia)) frases.push(`Nuevo horario: ${dia.toLocaleLowerCase('es')}`);
  for (const [dia] of a) if (!d.has(dia)) frases.push(`Horario quitado: ${dia.toLocaleLowerCase('es')}`);
  for (const [dia, h] of d) if (a.has(dia) && distinto(a.get(dia), h)) frases.push(`Horario del ${dia.toLocaleLowerCase('es')}`);
  const redesDe = (l: unknown) => new Map(lista(l).filter(esObjeto).map((r) => [String(r.red), r]));
  const ra = redesDe(p.redes);
  const rd = redesDe(b.redes);
  const cambiadas = Object.keys(NOMBRES_REDES).filter((r) => distinto(ra.get(r), rd.get(r)));
  if (cambiadas.length) frases.push(`Redes: ${unirLista(cambiadas.map((r) => NOMBRES_REDES[r]))}`);
  return frases;
}

/** Orden estable por `orden` (los que no tienen, después), como vicaria. */
function ordenados(l: unknown): Config[] {
  return lista(l)
    .filter(esObjeto)
    .map((a, i) => ({ a, i }))
    .sort((x, y) => {
      const ox = typeof x.a.orden === 'number' ? x.a.orden : Infinity;
      const oy = typeof y.a.orden === 'number' ? y.a.orden : Infinity;
      return ox === oy ? x.i - y.i : ox - oy;
    })
    .map((x) => x.a);
}

function avisos(p: Config, b: Config): string[] {
  const sinOrden = (a: Config) => {
    const { orden: _o, ...resto } = a;
    return resto;
  };
  const la = ordenados(p.avisos);
  const ld = ordenados(b.avisos);
  const porTexto = (l: Config[]) => {
    const m = new Map<string, Config>();
    for (const a of l) if (!m.has(String(a.texto))) m.set(String(a.texto), sinOrden(a));
    return m;
  };
  const a = porTexto(la);
  const d = porTexto(ld);
  const frases: string[] = [];
  const nuevos = [...d.keys()].filter((k) => !a.has(k)).length;
  const quitados = [...a.keys()].filter((k) => !d.has(k)).length;
  if (nuevos) frases.push(nuevos === 1 ? '1 aviso fijo nuevo' : `${nuevos} avisos fijos nuevos`);
  if (quitados) frases.push(quitados === 1 ? '1 aviso fijo quitado' : `${quitados} avisos fijos quitados`);
  for (const [k, v] of d) if (a.has(k) && distinto(a.get(k), v)) frases.push(`Cambios en el aviso «${k}»`);
  if (!frases.length) {
    const ta = la.map((x) => String(x.texto));
    const td = ld.map((x) => String(x.texto));
    if (distinto(ta, td)) frases.push('Orden de los avisos fijos');
  }
  return frases;
}

export function cambiosEntre(publicada: object | null, borrador: object, nombresTipos: Record<string, string>): CambiosSeccion[] {
  if (publicada === null) return [];
  const p = normalizarMedios(publicada) as Config;
  const b = borrador as Config;
  const porSeccion: Partial<Record<IdSeccion, string[]>> = {
    identidad: identidad(p, b),
    patrono: patrono(p, b),
    pantallas: pantallas(p, b),
    rotulos: rotulos(p, b),
    tipos: tipos(p, b, nombresTipos),
    galeria: galeria(p, b),
    'horarios-y-redes': horariosYRedes(p, b),
    avisos: avisos(p, b),
  };
  return SECCIONES.filter((s) => (porSeccion[s.id]?.length ?? 0) > 0).map((s) => ({ seccion: s.id, frases: porSeccion[s.id] as string[] }));
}

export function textoChipBorrador(cambios: number, version: number | null): { texto: string; tono: 'ambar' | 'verde' } {
  if (version === null) return { texto: 'Borrador · sin publicar todavía', tono: 'ambar' };
  if (cambios === 0) return { texto: `Al día con la versión ${version}`, tono: 'verde' };
  return { texto: `Borrador · ${cambios} ${cambios === 1 ? 'cambio' : 'cambios'} sin publicar`, tono: 'ambar' };
}
