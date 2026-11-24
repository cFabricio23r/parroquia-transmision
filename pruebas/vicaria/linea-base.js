/*
  Línea base de compatibilidad de vicaria/: una «huella» del DOM de cada pantalla con las
  configuraciones que ya existen. Las etapas siguientes añaden campos opcionales; esta huella
  prueba que lo de antes se sigue pintando IGUAL. Se graba una vez sobre el código sin cambios
  (node pruebas/vicaria/navegador.js --grabar-linea-base) y después solo se compara.
  Nunca lee #chispas: sus partículas son aleatorias.
*/
const SLUGS = ['ciudad-arce', 'san-jose-ejemplo'];
const VISTAS = ['inicio', 'portada', 'gracias', 'avisos', 'horarios'];
const TIPOS = ['dominical', 'horasanta', 'novena', 'evento'];

const CASOS = [];
for (const slug of SLUGS) {
  for (const vista of VISTAS) {
    for (const tipo of TIPOS) {
      CASOS.push({ slug, pagina: 'pantalla.html', query: '?tipo=' + vista, estado: { tipo } });
    }
  }
  CASOS.push({ slug, pagina: 'rotulos.html', query: '', estado: { tipo: 'dominical', rotulo: 'persona', celebrante: 'P. Prueba' } });
  CASOS.push({ slug, pagina: 'produccion.html', query: '?estilo=claro', estado: {} });
  CASOS.push({ slug, pagina: 'produccion.html', query: '?estilo=azul', estado: {} });
}
/* Diseños de rótulo (2026-11-24): un caso por diseño nuevo, con un lugar nuevo. `rotulos` se suma al bloque rotulos de
   la config de la parroquia (el runner la sirve con route) y entra en el nombre del caso; los casos de antes no lo llevan. */
for (const rotulos of [{ diseno: 'tarjeta', posicion: 'derecha' }, { diseno: 'minimal', posicion: 'derecha' }, { diseno: 'etiqueta', posicion: 'arriba-derecha' }]) {
  CASOS.push({ slug: 'ciudad-arce', pagina: 'rotulos.html', query: '', estado: { tipo: 'dominical', rotulo: 'persona', celebrante: 'P. Prueba' }, rotulos });
}

/* Se evalúa dentro de la página. */
async function huella(page) {
  return page.evaluate(() => {
    const oculto = (e) => {
      for (let n = e; n && n.nodeType === 1; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (n.hidden || cs.display === 'none' || cs.visibility === 'hidden') return true;
      }
      return false;
    };
    const esc = document.getElementById('escenario');
    const variables = {};
    for (const el of [document.documentElement, esc]) {
      for (let i = 0; i < el.style.length; i++) {
        const k = el.style[i];
        if (k.startsWith('--')) variables[k] = el.style.getPropertyValue(k).trim();
      }
    }
    for (const k of ['--rey', '--oscuro', '--celeste']) variables[k] = getComputedStyle(document.documentElement).getPropertyValue(k).trim();
    const textos = {}; const ocultos = {}; const imagenes = {}; const estilos = {};
    const PROPS = ['color', 'backgroundColor', 'backgroundImage', 'fontFamily', 'fontSize', 'fontWeight', 'display', 'borderRadius', 'borderTopColor', 'borderTopWidth', 'textAlign', 'justifyContent'];
    const estilo = (e) => { const cs = getComputedStyle(e); const o = {}; for (const p of PROPS) o[p] = cs[p]; return o; };
    estilos.escenario = estilo(esc);
    for (const e of document.querySelectorAll('[id]')) {
      if (e.id === 'chispas' || e.id === 'escenario') continue;
      estilos[e.id] = estilo(e);
      textos[e.id] = e.textContent.replace(/\s+/g, ' ').trim();
      ocultos[e.id] = oculto(e);
      if (e.tagName === 'IMG') imagenes[e.id] = { src: e.getAttribute('src'), alt: e.getAttribute('alt') };
    }
    return { clasesEscenario: [...esc.classList].sort(), clasesDocumento: { html: [...document.documentElement.classList].sort(), body: [...document.body.classList].sort() }, variables, textos, ocultos, imagenes, estilos };
  });
}

module.exports = { huella, CASOS };
