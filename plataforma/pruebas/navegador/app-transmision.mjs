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

const alto = async (loc) => (await loc.boundingBox())?.height ?? 0;

const navegador = await chromium.launch();
try {
  const P = await prepararParroquia();
  const pagina = await (await navegador.newContext({ viewport: VIEWPORT })).newPage();
  const consola = [];
  const respuestas = [];
  const respuestasFb = [];
  pagina.on('console', (m) => consola.push(m.text()));
  pagina.on('pageerror', (e) => revisar(false, `error de JavaScript: ${e.message}`));
  pagina.on('response', async (r) => {
    if (r.url().includes('/app/clave')) respuestas.push(await r.text().catch(() => ''));
    if (r.url().includes('/app/facebook/conexion')) respuestasFb.push(`${r.status()} ${await r.text().catch(() => '')}`);
  });
  await entrar(pagina, P.correo);
  await pagina.goto(`${BASE}/editor/p/${P.slug}/app-y-transmision`);

  console.log('Menú');
  const menu = pagina.locator('nav[aria-label="Secciones del editor"]');
  const enlace = menu.getByRole('link', { name: /^App y transmisión/ });
  revisar(await enlace.isVisible(), 'el menú tiene «App y transmisión»');
  igual(await enlace.locator('.pv-solo-lectores').count(), 0, 'su ítem no tiene punto de estado');

  console.log('Facebook de la parroquia (C1, C4, D1, D2)');
  const sinHtml = (txt) => revisar(!txt.includes('TOKEN-FALSO-FB') && !txt.includes(`pg-${P.id}`), 'ni un token ni un page_id en la página');
  const tarjetaFb = pagina.getByRole('region', { name: 'Facebook de la parroquia' });
  await tarjetaFb.waitFor();
  revisar((await tarjetaFb.innerText()).includes('Sin conectar'), 'C1: el estado dice «Sin conectar», en texto');
  revisar(await tarjetaFb.getByRole('link', { name: 'Conectar con Facebook' }).isVisible(), 'C1: está «Conectar con Facebook»');
  igual(await tarjetaFb.getByRole('link', { name: 'Conectar con Facebook' }).getAttribute('href'), `/editor/p/${P.slug}/app-y-transmision/facebook/conectar`, 'C1: va a la ruta conectar');
  revisar(await pagina.getByRole('heading', { name: 'Clave de transmisión de respaldo' }).isVisible(), 'la tarjeta «Facebook Live» pasó a «Clave de transmisión de respaldo»');
  igual(await pagina.getByText('Facebook Live', { exact: true }).count(), 0, 'ya no hay una tarjeta «Facebook Live»');
  revisar(await pagina.getByText('Mientras no conectes Facebook, la app transmite con esta clave de transmisión, como hoy.').isVisible(), 'C1: la nota del respaldo');
  igual(await pagina.getByText(/Borrador ·/).count(), 0, 'D13: no hay chip «Borrador · N cambios sin publicar»');
  for (const b of await tarjetaFb.locator('a, button').all()) revisar((await alto(b)) >= 44, 'D16: cada botón de la tarjeta mide 44 px o más');

  const { error: ec } = await servicio
    .from('facebook_conexion')
    .insert({ parroquia_id: P.id, nombre_facebook: 'Comunicaciones Ciudad Arce', token_usuario: 'v1.TOKEN-FALSO-FB-USUARIO', estado: 'conectado', conectado_por: P.usuarioId ?? null });
  if (ec) throw ec;
  const ids = { arce: `pg-${P.id}-arce`, vic: `pg-${P.id}-vic` };
  const { error: ep } = await servicio.from('facebook_paginas').insert([
    { parroquia_id: P.id, page_id: ids.arce, nombre: 'Parroquia Ciudad Arce', seguidores: 10, token: 'v1.TOKEN-FALSO-FB-PAGINA' },
    { parroquia_id: P.id, page_id: ids.vic, nombre: 'Vicaría Ciudad Arce', seguidores: 5, token: 'v1.TOKEN-FALSO-FB-PAGINA' },
  ]);
  if (ep) throw ep;
  await servicio.from('facebook_parroquia').insert({ parroquia_id: P.id, pagina_principal: ids.arce });
  await servicio.from('facebook_parroquia_extra').insert({ parroquia_id: P.id, page_id: ids.vic, por_defecto: true, crosspost: 'listo' });
  await pagina.reload();
  await tarjetaFb.getByText('SALE EN').waitFor({ timeout: 10_000 });
  const textoC4 = await tarjetaFb.innerText();
  revisar(textoC4.includes('Conectado') && textoC4.includes('Con la cuenta Comunicaciones Ciudad Arce'), 'C4: «Conectado» y la cuenta');
  revisar(textoC4.includes('Parroquia Ciudad Arce') && textoC4.includes('También se puede mostrar en: Vicaría Ciudad Arce (marcada por defecto).'), 'C4: «SALE EN» con la principal y la extra por defecto');
  revisar(await pagina.getByText('Tiene que ser la clave de transmisión de la página principal, Parroquia Ciudad Arce.').isVisible(), 'C4: la nota del respaldo nombra la principal');
  igual(await tarjetaFb.getByRole('link', { name: 'Cambiar páginas' }).getAttribute('href'), `/editor/p/${P.slug}/app-y-transmision/facebook`, 'C4: «Cambiar páginas» va a la Tarea 5');
  sinHtml(await pagina.content());
  for (const b of await tarjetaFb.locator('a, button').all()) revisar((await alto(b)) >= 44, 'D16: cada botón de C4 mide 44 px o más');

  await tarjetaFb.getByRole('button', { name: 'Desconectar Facebook' }).click();
  const dlg = pagina.getByRole('dialog', { name: '¿Desconectar Facebook?' });
  await dlg.waitFor();
  const ancho = (await dlg.boundingBox())?.width ?? 0;
  revisar(ancho > 0 && ancho <= 572, 'D11: el diálogo tiene ancho máximo');
  await dlg.getByRole('button', { name: 'Cancelar' }).click();
  igual((await servicio.from('facebook_conexion').select('parroquia_id').eq('parroquia_id', P.id)).data?.length, 1, 'cancelar no desconecta');

  await servicio.from('facebook_conexion').update({ estado: 'reconectar' }).eq('parroquia_id', P.id);
  await pagina.reload();
  const aviso = pagina.getByRole('alert').filter({ hasText: 'Facebook se desconectó.' });
  await aviso.waitFor({ timeout: 10_000 });
  revisar(await pagina.getByText('Hay que volver a conectar', { exact: true }).isVisible(), 'D1: el estado dice «Hay que volver a conectar»');
  revisar(await pagina.getByText('Mientras tanto, la app transmite con esta clave de transmisión a la página principal.').isVisible(), 'D1: la nota del respaldo');

  await servicio.from('facebook_conexion').update({ estado: 'conectado' }).eq('parroquia_id', P.id);
  await pagina.reload();
  await tarjetaFb.getByRole('button', { name: 'Desconectar Facebook' }).click();
  await dlg.waitFor();
  await dlg.getByRole('button', { name: 'Desconectar Facebook' }).click();
  await tarjetaFb.getByRole('link', { name: 'Conectar con Facebook' }).waitFor({ timeout: 10_000 }).catch((e) => {
    console.log('  respuestas de desconectar:', respuestasFb);
    throw e;
  });
  revisar(respuestasFb.length === 1 && respuestasFb[0].startsWith('200 ') && !respuestasFb[0].includes('TOKEN-FALSO-FB'), 'la respuesta de desconectar es 200 y no trae tokens');
  const quedan = await esperar(async () => (await servicio.from('facebook_conexion').select('parroquia_id').eq('parroquia_id', P.id)).data?.length === 0);
  revisar(quedan, 'desconectar borra la conexión');
  igual((await servicio.from('facebook_parroquia').select('parroquia_id').eq('parroquia_id', P.id)).data?.length, 1, 'las páginas elegidas se mantienen');

  await pagina.goto(`${BASE}/editor/p/${P.slug}/app-y-transmision?error=no-invitada`);
  const d2 = pagina.getByRole('heading', { level: 1, name: 'Esta cuenta de Facebook todavía no puede conectarse' });
  await d2.waitFor({ timeout: 10_000 });
  igual(await d2.evaluate((e) => getComputedStyle(e).fontSize), '26px', 'D19: el título de D2 es de 26 px');
  revisar(await pagina.getByRole('link', { name: 'Intentar de nuevo' }).isVisible(), 'D2: «Intentar de nuevo»');
  revisar(await pagina.getByText('Mientras tanto, la app sigue transmitiendo con la clave de transmisión de la parroquia.').isVisible(), 'D2: la nota de la clave de transmisión');
  await pagina.getByRole('link', { name: 'Volver', exact: true }).click();
  await pagina.waitForURL(`${BASE}/editor/p/${P.slug}/app-y-transmision`);
  await pagina.getByRole('heading', { name: 'Facebook de la parroquia' }).waitFor();

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
