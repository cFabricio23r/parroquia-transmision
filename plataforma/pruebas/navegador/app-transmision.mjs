// Pruebas de navegador de «App y transmisión» (etapa 3c, Tarea 4), contra `next dev` + Supabase local.
// La clave de prueba es falsa y se nota; nunca tiene que aparecer en el HTML, la consola ni una respuesta.
import { chromium } from 'playwright';
import { BASE, camposSinEtiqueta, entrar, igual, limpiar, prepararParroquia, revisar, servicio, terminar, VIEWPORT } from './lib/editor.mjs';

const FALSA = 'FB-CLAVE-FALSA';
const esperar = async (cond, timeout = 8000) => {
  const limite = Date.now() + timeout;
  for (;;) {
    const v = await cond();
    if (v || Date.now() > limite) return v;
    await new Promise((ok) => setTimeout(ok, 250));
  }
};

const navegador = await chromium.launch();
try {
  const P = await prepararParroquia();
  const pagina = await (await navegador.newContext({ viewport: VIEWPORT })).newPage();
  const consola = [];
  const respuestas = [];
  pagina.on('console', (m) => consola.push(m.text()));
  pagina.on('pageerror', (e) => revisar(false, `error de JavaScript: ${e.message}`));
  pagina.on('response', async (r) => {
    if (r.url().includes('/app/clave')) respuestas.push(await r.text().catch(() => ''));
  });
  await entrar(pagina, P.correo);
  await pagina.goto(`${BASE}/editor/p/${P.slug}/app-y-transmision`);

  console.log('Menú');
  const menu = pagina.locator('nav[aria-label="Secciones del editor"]');
  const enlace = menu.getByRole('link', { name: /^App y transmisión/ });
  revisar(await enlace.isVisible(), 'el menú tiene «App y transmisión»');
  igual(await enlace.locator('.pv-solo-lectores').count(), 0, 'su ítem no tiene punto de estado');

  console.log('Ajustes');
  await pagina.getByLabel('Servidor (lo muestra Facebook)').fill('rtmps://live-api-s.facebook.com:443/rtmp/');
  await pagina.getByRole('button', { name: '1080p', exact: true }).click();
  igual(await pagina.locator('[role="status"].pv-guardado').innerText(), 'Sin guardar', 'con algo escrito, el encabezado dice «Sin guardar»');
  await pagina.getByRole('button', { name: 'Guardar', exact: true }).click();
  const estado = pagina.getByRole('status').filter({ hasText: 'Guardado. Los celulares' });
  await estado.waitFor({ timeout: 10_000 });
  igual(await estado.innerText(), 'Guardado. Los celulares lo bajan la próxima vez que abren la app con internet.', 'el estado dice que se guardó');
  const fila = await esperar(async () => (await servicio.from('ajustes_app').select('servidor, calidad_defecto').eq('parroquia_id', P.id).maybeSingle()).data);
  igual(JSON.stringify(fila), JSON.stringify({ servidor: 'rtmps://live-api-s.facebook.com:443/rtmp/', calidad_defecto: '1080p' }), 'la base tiene los ajustes');

  await pagina.getByLabel('Servidor (lo muestra Facebook)').fill('http://x');
  await pagina.getByRole('button', { name: 'Guardar', exact: true }).click();
  await pagina.locator('#app-servidor-error').waitFor({ timeout: 10_000 });
  igual(await pagina.locator('#app-servidor').getAttribute('aria-invalid'), 'true', 'el servidor malo queda marcado bajo el campo');
  await pagina.getByLabel('Servidor (lo muestra Facebook)').fill('rtmps://live-api-s.facebook.com:443/rtmp/');

  console.log('Clave');
  await pagina.getByLabel('Clave de transmisión de la página').fill('FB-CLAVE-FALSA-1111');
  await pagina.getByRole('button', { name: 'Guardar la clave', exact: true }).click();
  await pagina.getByText(/^Clave guardada el /).waitFor({ timeout: 10_000 });
  igual(await pagina.getByLabel('Clave de transmisión de la página').count(), 0, 'el campo de la clave desaparece');
  revisar(await pagina.getByRole('button', { name: 'Reemplazar' }).isVisible(), 'se ve «Reemplazar»');
  revisar(await pagina.getByRole('button', { name: 'Quitar', exact: true }).isVisible(), 'se ve «Quitar»');
  revisar(!(await pagina.content()).includes(FALSA), 'el HTML no tiene la clave');
  await pagina.reload();
  await pagina.getByText(/^Clave guardada el /).waitFor({ timeout: 10_000 });
  revisar(!(await pagina.content()).includes(FALSA), 'después de recargar, el HTML no tiene la clave');

  await pagina.getByRole('button', { name: 'Reemplazar' }).click();
  igual(await pagina.getByLabel('Clave de transmisión de la página').inputValue(), '', '«Reemplazar» muestra el campo vacío');
  await pagina.getByRole('button', { name: 'Cancelar' }).click();
  igual(await pagina.getByLabel('Clave de transmisión de la página').count(), 0, '«Cancelar» lo cierra');

  await pagina.getByRole('button', { name: 'Quitar', exact: true }).click();
  const dialogo = pagina.getByRole('dialog', { name: '¿Quitar la clave?' });
  await dialogo.waitFor();
  await dialogo.getByRole('button', { name: 'Quitar la clave' }).click();
  await pagina.getByLabel('Clave de transmisión de la página').waitFor({ timeout: 10_000 });
  igual(await pagina.getByLabel('Clave de transmisión de la página').inputValue(), '', 'vuelve el campo vacío');
  const k = await esperar(async () => (await servicio.from('claves_transmision').select('parroquia_id').eq('parroquia_id', P.id)).data?.length === 0);
  revisar(k, 'en la base no hay clave');

  igual((await camposSinEtiqueta(pagina)).length, 0, 'todo campo tiene etiqueta');
  revisar(!consola.some((t) => t.includes(FALSA)), 'la consola no tiene la clave');
  revisar(respuestas.length > 0 && !respuestas.some((t) => t.includes(FALSA)), 'las respuestas de la clave no la traen');
} catch (e) {
  revisar(false, `excepción: ${e instanceof Error ? e.message : e}`);
} finally {
  await navegador.close();
  await limpiar();
}
terminar('App y transmisión');
