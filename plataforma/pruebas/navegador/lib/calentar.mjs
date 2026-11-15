// Calienta `next dev` antes de las pruebas de navegador (fix2): en modo dev cada ruta se compila la
// primera vez que alguien la pide, y con la suite completa esa primera compilación pasaba a veces de
// los 30 s de page.goto. El runner (herramientas/navegador.mjs) corre esto una vez, con una
// administradora de prueba que también es miembro de una parroquia, y visita cada página del editor.
// No es una prueba: nunca falla la corrida; si una ruta no responde, lo dice y sigue.
import { chromium } from 'playwright';
import { BASE, entrar, limpiar, prepararParroquia, servicio } from './editor.mjs';

const P = await prepararParroquia();
const navegador = await chromium.launch();
const inicio = Date.now();
try {
  const { error } = await servicio.from('administradores').insert({ usuario_id: P.usuarioId });
  if (error) throw error;
  const pagina = await (await navegador.newContext()).newPage();
  pagina.setDefaultNavigationTimeout(180_000);
  pagina.setDefaultTimeout(180_000);
  await entrar(pagina, P.correo);
  const p = `/editor/p/${P.slug}`;
  const paginas = [
    '/editor',
    p,
    `${p}/identidad`,
    `${p}/patrono`,
    `${p}/horarios-y-redes`,
    `${p}/avisos`,
    `${p}/galeria`,
    `${p}/pantallas`,
    `${p}/pantallas/portada`,
    `${p}/rotulos`,
    `${p}/tipos`,
    `${p}/tipos/nuevo`,
    `${p}/publicar`,
    '/editor/cuenta',
    '/editor/admin',
    '/editor/admin/coordinadores',
    '/editor/admin/registro',
    `/editor/admin/parroquia/${P.slug}`,
    '/editor/muestrario',
  ];
  for (const ruta of paginas) {
    try {
      await pagina.goto(`${BASE}${ruta}`, { waitUntil: 'load' });
    } catch (e) {
      console.log(`  (calentar) ${ruta} no respondió: ${String(e instanceof Error ? e.message : e).split('\n')[0]}`);
    }
  }
  // Las rutas de la API también se compilan al primer pedido; un GET basta (contestan 405 o un error).
  for (const api of ['borrador', 'imagen', 'publicar', 'restaurar']) {
    await pagina.request.get(`${BASE}/editor/api/${P.slug}/${api}`, { timeout: 180_000 }).catch(() => {});
  }
  // Las páginas sin sesión, en un contexto aparte.
  const anonima = await (await navegador.newContext()).newPage();
  anonima.setDefaultNavigationTimeout(180_000);
  for (const ruta of ['/editor/olvide', '/editor/invitacion', '/editor/nueva-contrasena']) {
    await anonima.goto(`${BASE}${ruta}`).catch(() => {});
  }
  console.log(`Servidor calentado en ${Math.round((Date.now() - inicio) / 1000)} s.`);
} catch (e) {
  console.log(`(calentar) no se pudo calentar todo: ${String(e instanceof Error ? e.message : e).split('\n')[0]}`);
} finally {
  await navegador.close();
  await limpiar();
}
