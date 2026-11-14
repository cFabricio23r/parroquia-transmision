/*
  Diferencias entre dos líneas base de vicaria/ (pruebas/vicaria/linea-base.json).

  Uso:  node pruebas/vicaria/diferencias-linea-base.js <vieja.json> <nueva.json> [--informe=<ruta.md>]

  Recorre caso por caso cada grupo de la huella (variables, textos, ocultos, imagenes, estilos, clasesEscenario,
  clasesDocumento) e id.propiedad, y anota cada valor distinto, agregado o quitado. Cada cambio tiene que estar
  permitido por una regla de ESPERADOS (la lista «Cambios esperados de la línea base» del plan 1.1); una regla
  permite un cambio, no lo exige.
  - Sale con 1 si queda algún cambio sin regla, o si falta o sobra un caso: imprime esos cambios y no escribe
    el informe.
  - Con todo explicado sale con 0 y, con --informe, escribe por regla cuántos casos tocó y un ejemplo antes/después.
*/
const fs = require('node:fs');
const path = require('node:path');

/* Grupos de casos (pruebas/vicaria/linea-base.js): P pantalla.html, R rotulos.html, C producción claro, A azul. */
const P = /\/pantalla\.html\?tipo=/;
const R = /\/rotulos\.html /;
const C = /\/produccion\.html\?estilo=claro /;
const A = /\/produccion\.html\?estilo=azul /;
const unir = (...l) => new RegExp(l.map((r) => r.source).join('|'));

const VARIABLES_NUEVAS = ['--vivo', '--tenue', '--velo', '--tinta', '--gris', '--papel', '--fila-texto', '--vivo-rgb', '--tenue-rgb', '--acento-claro'];

/* Copia de «Cambios esperados de la línea base (R5)» del plan 1.1
   (05-Planes/2026-11-14-rediseno-plan-1-1-vicaria-ajuste-visual.md). Cada regla: {n, caso, ruta, motivo};
   opcional `valor(antes, despues)` para atar el cambio a lo que dice el plan. */
const ESPERADOS = [
  { n: 1, caso: unir(P, R, C, A), ruta: new RegExp('^variables\\.(' + VARIABLES_NUEVAS.join('|') + ')$'),
    valor: (a) => a === undefined, motivo: 'R1, Tarea 2: variables nuevas de tintes(); las seis de antes no cambian' },
  { n: 2, caso: P, ruta: /^estilos\.lienzo\.backgroundImage$/,
    valor: (a, d) => typeof d === 'string' && a.replace(/rgb\([^)]*\) 100%/, '') === d.replace(/rgb\([^)]*\) 100%/, ''),
    motivo: 'A1: la parada del 100% del degradado pasa de --celeste a --vivo' },
  { n: 3, caso: P, ruta: /^(estilos\.fachada\.display|ocultos\.fachada)$/, motivo: 'A1, decisión 3: la silueta de la fachada ya no se ve por defecto' },
  { n: 4, caso: P, ruta: /^estilos\.virgen\.(borderRadius|borderTopWidth|borderTopColor)$/, motivo: 'A2: marco de arco (300px 300px 40px 40px) sin borde' },
  { n: 5, caso: P, ruta: /^textos\.(t-marca|marca)$/, motivo: 'A4: la marca va en dos líneas (el \\n se ve como espacio en la huella)' },
  // 5b (agregada en la Tarea 5): el textContent de #lienzo contiene el de la marca; solo puede perder el « · » de la marca
  { n: '5b', caso: P, ruta: /^textos\.lienzo$/,
    valor: (a, d) => typeof a === 'string' && typeof d === 'string' && (a.match(/ · /g) || []).length === (d.match(/ · /g) || []).length + 1 && a.replace(/ · /g, ' ') === d.replace(/ · /g, ' '),
    motivo: 'A4: #lienzo contiene el texto de la marca, que pierde su « · »' },
  { n: 6, caso: P, ruta: /^estilos\.(i-ceja|p-ceja|g-ceja|p-sub)\.(color|borderTopColor)$/, motivo: 'A3: cejas y sub de la portada de #bfe0ff a --tenue (borderTopColor sigue a color: currentColor)' },
  { n: 7, caso: P, ruta: /^estilos\.(i-titulo|p-titulo|g-titulo)\.backgroundImage$/, motivo: 'A3: el destello del título de #bfe0ff a --tenue' },
  { n: 8, caso: P, ruta: /^estilos\.(i-cursiva|p-cursiva|g-cursiva)\.(color|borderTopColor)$/, motivo: 'A3: la cursiva de --palido a --velo (borderTopColor sigue a color: currentColor)' },
  { n: 9, caso: /\/pantalla\.html\?tipo=gracias /, ruta: /^(estilos\.envivo\.display|ocultos\.envivo)$/, motivo: 'C6: Gracias sin EN VIVO' },
  { n: 10, caso: P, ruta: /^estilos\.(a-sub|h-sub)\.(color|borderTopColor)$/, motivo: 'C7: el sub de Avisos y Horarios de --medio a --vivo (borderTopColor sigue a color: currentColor)' },
  { n: 11, caso: P, ruta: /^estilos\.a-filas\.justifyContent$/, motivo: 'C7: filas de Avisos repartidas (space-between)' },
  { n: 12, caso: P, ruta: /^estilos\.h-redes\.borderTopColor$/, motivo: 'A3: el filete de las redes de #eef5fc a --velo' },
  { n: 13, caso: P, ruta: /^(imagenes\.(a-logo|h-logo)\.(src|alt)|ocultos\.(a-logo|h-logo)|estilos\.(a-logo|h-logo)\.\w+)$/, motivo: 'C7, decisión 7: el logo de Avisos y Horarios pasa a logos.blanco' },
  { n: 14, caso: P, ruta: /^(estilos|textos|ocultos|imagenes)\.(a-logo-caja|h-logo-caja)(\.\w+)?$/, motivo: 'C7: círculo nuevo del logo de Avisos y Horarios' },
  { n: 15, caso: R, ruta: /^estilos\.r-k\.color$/, motivo: 'C3/R1: el kicker del rótulo de --medio a --vivo' },
  { n: 16, caso: R, ruta: /^textos\.(logo-txt|logo)$/, motivo: 'A4, decisión 6: la capa del logo dice nombre y lugar en dos líneas' },
  { n: 17, caso: R, ruta: /^(estilos|textos|ocultos|imagenes)\.logo-esquina(\.\w+)?$/, motivo: 'C2: logo de esquina nuevo (imagen sola) durante un rótulo' },
  { n: 18, caso: C, ruta: /^estilos\.claro\.backgroundColor$/, motivo: 'C5: el fondo del Claro de #f4f7fb a --papel' },
  { n: 19, caso: C, ruta: /^estilos\.pie\.color$/, motivo: 'C5: el pie del Claro de #4a5a6c a --gris' },
  { n: 20, caso: C, ruta: /^(imagenes\.logo-claro\.(src|alt)|ocultos\.logo-claro|estilos\.logo-claro\.\w+)$/, motivo: 'C5: el logo del Claro pasa a logos.blanco' },
  { n: 21, caso: C, ruta: /^(estilos|textos|ocultos|imagenes)\.logo-claro-caja(\.\w+)?$/, motivo: 'C5: círculo nuevo del logo del Claro' },
  { n: 22, caso: A, ruta: /^estilos\.azul\.backgroundImage$/,
    valor: (a, d) => typeof d === 'string' && a.replace(/rgb\([^)]*\) 100%/, '') === d.replace(/rgb\([^)]*\) 100%/, ''),
    motivo: 'R1: la parada del 100% del degradado del Azul pasa de --celeste a --vivo' }
];

/* Lista de cambios [{caso, ruta, antes, despues}] entre dos huellas del mismo caso. */
function cambiosDeCaso(caso, a, b) {
  const out = [];
  const grupos = [...new Set([...Object.keys(a || {}), ...Object.keys(b || {})])];
  for (const g of grupos) {
    const ga = (a || {})[g]; const gb = (b || {})[g];
    if (g === 'clasesEscenario' || g === 'clasesDocumento' || Array.isArray(ga) || Array.isArray(gb)) {
      if (JSON.stringify(ga) !== JSON.stringify(gb)) out.push({ caso, ruta: g, antes: ga, despues: gb });
      continue;
    }
    const ids = [...new Set([...Object.keys(ga || {}), ...Object.keys(gb || {})])];
    for (const id of ids) {
      const va = (ga || {})[id]; const vb = (gb || {})[id];
      const objeto = (v) => v !== null && typeof v === 'object';
      if (objeto(va) || objeto(vb)) {
        const props = [...new Set([...Object.keys(va || {}), ...Object.keys(vb || {})])];
        for (const p of props) {
          const x = (va || {})[p]; const y = (vb || {})[p];
          if (JSON.stringify(x) !== JSON.stringify(y)) out.push({ caso, ruta: g + '.' + id + '.' + p, antes: x, despues: y });
        }
      } else if (JSON.stringify(va) !== JSON.stringify(vb)) {
        out.push({ caso, ruta: g + '.' + id, antes: va, despues: vb });
      }
    }
  }
  return out;
}

function reglaDe(c) {
  return ESPERADOS.find((r) => r.caso.test(c.caso) && r.ruta.test(c.ruta) && (!r.valor || r.valor(c.antes, c.despues)));
}

function comparar(vieja, nueva) {
  const casos = [...new Set([...Object.keys(vieja), ...Object.keys(nueva)])];
  const faltan = casos.filter((k) => !(k in nueva));
  const sobran = casos.filter((k) => !(k in vieja));
  const cambios = [];
  for (const k of casos) if (k in vieja && k in nueva) cambios.push(...cambiosDeCaso(k, vieja[k], nueva[k]));
  const sinRegla = [];
  const porRegla = new Map();
  for (const c of cambios) {
    const r = reglaDe(c);
    if (!r) { sinRegla.push(c); continue; }
    if (!porRegla.has(r.n)) porRegla.set(r.n, { regla: r, casos: new Set(), cambios: 0, ejemplo: c });
    const e = porRegla.get(r.n); e.casos.add(c.caso); e.cambios++;
  }
  return { faltan, sobran, cambios, sinRegla, porRegla };
}

const mostrar = (v) => v === undefined ? '(no estaba)' : JSON.stringify(v);

function informe(res, rutaVieja, rutaNueva) {
  const l = [];
  l.push('# Línea base: cambios tras el ajuste visual (plan 1.1)', '');
  l.push('Generado por `pruebas/vicaria/diferencias-linea-base.js`.', '');
  l.push('- Vieja: `' + rutaVieja + '`', '- Nueva: `' + rutaNueva + '`');
  l.push('- Cambios: ' + res.cambios.length + ', todos explicados por una regla de `ESPERADOS`. Casos que faltan o sobran: ninguno.', '');
  l.push('| # | Regla (motivo) | Casos | Cambios | Ejemplo (caso · ruta: antes → después) |', '|---|---|---|---|---|');
  for (const r of ESPERADOS) {
    const e = res.porRegla.get(r.n);
    if (!e) { l.push('| ' + r.n + ' | ' + r.motivo + ' | 0 | 0 | (sin cambios) |'); continue; }
    const x = e.ejemplo;
    const celda = (s) => String(s).replace(/\|/g, '\\|');
    l.push('| ' + r.n + ' | ' + celda(r.motivo) + ' | ' + e.casos.size + ' | ' + e.cambios + ' | `' + celda(x.caso) + '` · `' + celda(x.ruta) + '`: ' + celda(mostrar(x.antes)) + ' → ' + celda(mostrar(x.despues)) + ' |');
  }
  l.push('');
  return l.join('\n');
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const rutas = args.filter((a) => !a.startsWith('--'));
  const inf = (args.find((a) => a.startsWith('--informe=')) || '').slice(10);
  if (rutas.length !== 2) {
    console.log('Uso: node pruebas/vicaria/diferencias-linea-base.js <vieja.json> <nueva.json> [--informe=<ruta.md>]');
    process.exit(2);
  }
  const leer = (r) => JSON.parse(fs.readFileSync(r, 'utf8'));
  const res = comparar(leer(rutas[0]), leer(rutas[1]));
  for (const k of res.faltan) console.log('✘ falta el caso en la nueva: ' + k);
  for (const k of res.sobran) console.log('✘ sobra el caso en la nueva: ' + k);
  for (const c of res.sinRegla) console.log('✘ sin regla: ' + c.caso + ' · ' + c.ruta + ': ' + mostrar(c.antes) + ' → ' + mostrar(c.despues));
  for (const r of ESPERADOS) {
    const e = res.porRegla.get(r.n);
    if (e) console.log('✔ regla ' + r.n + ' (' + r.motivo + '): ' + e.casos.size + ' casos, ' + e.cambios + ' cambios');
  }
  const mal = res.faltan.length + res.sobran.length + res.sinRegla.length;
  console.log(res.cambios.length + ' cambios, ' + res.sinRegla.length + ' sin regla' + (res.faltan.length + res.sobran.length ? ', ' + (res.faltan.length + res.sobran.length) + ' casos que faltan o sobran' : ''));
  if (mal) process.exit(1);
  if (inf) {
    fs.mkdirSync(path.dirname(inf), { recursive: true });
    fs.writeFileSync(inf, informe(res, rutas[0], rutas[1]));
    console.log('informe: ' + inf);
  }
  process.exit(0);
}

module.exports = { ESPERADOS, comparar, cambiosDeCaso };
