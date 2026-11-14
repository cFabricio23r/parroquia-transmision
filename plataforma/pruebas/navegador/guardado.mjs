// Pruebas de navegador del guardado automático (plan 3, Tarea 10): 800 ms, cambio de sección antes de
// guardar, fusión silenciosa, conflicto («Usar lo mío» / «Ver lo suyo»), sesión cerrada, sin conexión
// y aviso antes de salir. Contra `next dev` + Supabase local.
import { chromium } from 'playwright';
import {
  BASE,
  CONFIG_BASE,
  entrar,
  esperarEnBase,
  esperarGuardado,
  igual,
  leerConfig,
  limpiar,
  prepararParroquia,
  revisar,
  terminar,
  VIEWPORT,
} from './lib/editor.mjs';

const TEXTO_CONFLICTO = 'Otra persona cambió esta sección mientras editabas.';
const estadoGuardado = (p) => p.locator('[role="status"].pv-guardado').innerText();

const navegador = await chromium.launch();
try {
  const P = await prepararParroquia({ config: CONFIG_BASE });
  const nuevaPagina = async () => {
    const c = await navegador.newContext({ viewport: VIEWPORT });
    const p = await c.newPage();
    await entrar(p, P.correo);
    await p.goto(`${BASE}/editor/p/${P.slug}/identidad`);
    await p.getByLabel('Lugar').waitFor();
    return p;
  };

  console.log('800 ms');
  const A = await nuevaPagina();
  const puts = [];
  A.on('request', (r) => r.method() === 'PUT' && r.url().endsWith('/borrador') && puts.push(Date.now()));
  const t0 = Date.now();
  await A.getByLabel('Lugar').fill('Lugar uno');
  await A.waitForTimeout(650);
  igual(puts.length, 0, 'antes de 700 ms no se mandó ningún PUT');
  await A.waitForFunction(() => document.querySelector('[role="status"].pv-guardado')?.textContent === 'Guardando…', null, { timeout: 3000 });
  revisar(true, 'aparece «Guardando…»');
  await esperarGuardado(A);
  revisar(puts[0] - t0 >= 700, `el primer PUT salió a los ${puts[0] - t0} ms`);
  igual((await leerConfig(P.id)).lugar, 'Lugar uno', 'la base tiene el lugar nuevo');

  console.log('Cambiar de sección antes de 800 ms');
  await A.getByLabel('Lugar').fill('Lugar dos');
  await A.getByRole('link', { name: /^Galería/ }).click();
  await A.waitForTimeout(1500);
  igual((await esperarEnBase(P.id, (c) => c.lugar === 'Lugar dos')).lugar, 'Lugar dos', 'el cambio se guardó aunque se cambió de sección');

  console.log('Fusión silenciosa');
  await A.goto(`${BASE}/editor/p/${P.slug}/identidad`);
  const B = await nuevaPagina();
  await A.getByLabel('Lugar').fill('Lugar de A');
  await esperarGuardado(A);
  await B.getByLabel('Nombre completo').fill('Nombre de B');
  await esperarGuardado(B);
  igual(await B.locator('.pv-aviso-guardado').count(), 0, 'B no muestra ningún aviso');
  const fusion = await leerConfig(P.id);
  revisar(fusion.lugar === 'Lugar de A' && fusion.nombre === 'Nombre de B', 'la base tiene los dos cambios');

  console.log('Conflicto: Usar lo mío');
  await A.reload();
  await B.reload();
  await A.getByLabel('Lugar').fill('Lugar A2');
  await esperarGuardado(A);
  await B.getByLabel('Lugar').fill('Lugar B2');
  await B.getByText(TEXTO_CONFLICTO).waitFor({ timeout: 5000 });
  revisar(true, 'B muestra el aviso de conflicto');
  const putsB = [];
  B.on('request', (r) => r.method() === 'PUT' && r.url().endsWith('/borrador') && putsB.push(r));
  await B.getByLabel('Nombre corto').fill('Corto B');
  await B.waitForTimeout(1500);
  igual(putsB.length, 0, 'con el aviso abierto, escribir en otro campo no manda ningún PUT');
  await B.getByRole('button', { name: 'Usar lo mío' }).click();
  await esperarGuardado(B);
  igual((await leerConfig(P.id)).lugar, 'Lugar B2', '«Usar lo mío» deja el valor de B en la base');
  igual(await B.getByText(TEXTO_CONFLICTO).count(), 0, 'y el aviso desaparece');

  console.log('Conflicto: Ver lo suyo');
  await A.reload();
  await A.getByLabel('Lugar').fill('Lugar A3');
  await esperarGuardado(A);
  await B.getByLabel('Lugar').fill('Lugar B3');
  await B.getByText(TEXTO_CONFLICTO).waitFor({ timeout: 5000 });
  await B.getByRole('button', { name: 'Ver lo suyo' }).click();
  await B.waitForTimeout(1500);
  igual(await B.getByLabel('Lugar').inputValue(), 'Lugar A3', '«Ver lo suyo» muestra el valor de A');
  igual((await leerConfig(P.id)).lugar, 'Lugar A3', 'y la base sigue con el de A');

  console.log('Sesión cerrada');
  await B.context().clearCookies();
  await B.getByLabel('Lugar').fill('Sin sesión');
  await B.getByText('Sesión cerrada').waitFor({ timeout: 5000 });
  revisar(await B.getByRole('link', { name: 'Entrar de nuevo' }).isVisible(), 'aparece «Sesión cerrada» con «Entrar de nuevo»');
  igual(await B.getByLabel('Lugar').inputValue(), 'Sin sesión', 'el campo conserva lo escrito');

  console.log('Sin conexión');
  await A.reload();
  await A.route('**/borrador', (r) => r.abort());
  await A.getByLabel('Lugar').fill('Sin red');
  await A.getByText('Sin conexión').waitFor({ timeout: 5000 });
  revisar(true, 'aparece «Sin conexión»');
  await A.unroute('**/borrador');
  await A.getByRole('button', { name: 'Reintentar' }).click();
  await esperarGuardado(A);
  igual((await leerConfig(P.id)).lugar, 'Sin red', 'después de «Reintentar» la base tiene el valor');
  igual(await estadoGuardado(A), 'Guardado', 'y el encabezado dice «Guardado»');

  console.log('Antes de salir');
  await A.route('**/borrador', async (r) => {
    if (r.request().method() !== 'PUT') return r.continue();
    await new Promise((ok) => setTimeout(ok, 5000));
    await r.continue();
  });
  let dialogo = false;
  A.on('dialog', async (d) => {
    if (d.type() === 'beforeunload') dialogo = true;
    await d.dismiss();
  });
  await A.getByLabel('Lugar').fill('Sin guardar');
  await A.waitForTimeout(900);
  await A.reload({ timeout: 3000 }).catch(() => {});
  revisar(dialogo, 'recargar con un cambio sin guardar pide confirmación');
} finally {
  await navegador.close();
  await limpiar();
}
terminar('guardado');
