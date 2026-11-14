// Pruebas de navegador del muestrario de componentes (plan 2, tarea 8), contra `next dev` + Supabase local.
// Se corren con `npm run test:navegador -- muestrario.mjs` (herramientas/navegador.mjs pasa BASE_URL y las llaves).
import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL;
const servicio = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const sufijo = () => Math.random().toString(36).slice(2, 10);
const CLAVE = 'clave-de-prueba-123';

let fallos = 0;
const revisar = (cond, msg) => {
  console.log((cond ? '  ok   ' : '  FALLA ') + msg);
  if (!cond) fallos++;
};
const igual = (real, esperado, msg) =>
  revisar(real === esperado, msg + (real === esperado ? '' : ` (era ${JSON.stringify(real)}, se esperaba ${JSON.stringify(esperado)})`));

const TITULOS_A5 = [
  'Correo o contraseña incorrectos',
  'Contraseña que no sirve',
  'Muchos intentos',
  'Sin parroquia asignada',
  'Invitación vencida',
  'Enlace vencido o usado',
  'Sin conexión',
  'Sesión cerrada',
];

const navegador = await chromium.launch();
let usuarioId;
try {
  const correo = `muestrario-${sufijo()}@prueba.test`;
  const { data: u, error } = await servicio.auth.admin.createUser({ email: correo, password: CLAVE, email_confirm: true });
  if (error) throw error;
  usuarioId = u.user.id;

  const contexto = await navegador.newContext({ viewport: { width: 1440, height: 900 } });
  const pagina = await contexto.newPage();
  const erroresJs = [];
  pagina.on('pageerror', (e) => erroresJs.push(e.message));

  await pagina.goto(`${BASE}/editor/entrar`);
  await pagina.getByLabel('Correo').fill(correo);
  await pagina.getByLabel('Contraseña', { exact: true }).fill(CLAVE);
  await pagina.getByRole('button', { name: 'Entrar' }).click();
  await pagina.waitForURL((url) => !url.pathname.startsWith('/editor/entrar'));

  console.log('Muestrario');
  const r = await pagina.goto(`${BASE}/editor/muestrario`);
  igual(r?.status(), 200, 'el muestrario responde 200 en desarrollo');
  await pagina.getByRole('heading', { name: 'Muestrario de componentes' }).waitFor();

  const logo = pagina.getByRole('switch', { name: 'Logo' });
  igual(await logo.getAttribute('aria-checked'), 'true', 'el interruptor «Logo» empieza encendido');
  const medidas = await logo.evaluate((e) => {
    const s = getComputedStyle(e);
    return { ancho: s.width, alto: s.height, fondo: s.backgroundColor };
  });
  igual(medidas.ancho, '48px', 'interruptor de 48 px de ancho');
  igual(medidas.alto, '28px', 'interruptor de 28 px de alto');
  igual(medidas.fondo, 'rgb(17, 85, 164)', 'interruptor encendido en el azul primario');
  await logo.click();
  igual(await logo.getAttribute('aria-checked'), 'false', 'un clic lo apaga');
  await logo.focus();
  await pagina.keyboard.press('Space');
  igual(await logo.getAttribute('aria-checked'), 'true', 'la barra espaciadora lo vuelve a encender');

  await pagina.getByRole('button', { name: 'Color liso' }).click();
  const grupoFondo = pagina.getByRole('group', { name: 'Fondo' });
  igual(await grupoFondo.locator('[aria-pressed="true"]').count(), 1, '«Fondo» deja un solo botón presionado');
  igual(await pagina.getByRole('button', { name: 'Color liso' }).getAttribute('aria-pressed'), 'true', '«Color liso» quedó presionado');

  const clave = pagina.locator('#m-clave');
  await clave.fill('secreta-123');
  igual(await clave.getAttribute('type'), 'password', 'la contraseña empieza oculta');
  const mostrar = pagina.locator('button[aria-controls="m-clave"]');
  await mostrar.click();
  igual(await clave.getAttribute('type'), 'text', '«Mostrar contraseña» la muestra');
  igual(await clave.inputValue(), 'secreta-123', 'sin perder lo escrito');
  igual(await mostrar.getAttribute('aria-pressed'), 'true', 'y el botón queda presionado');

  const abrir = pagina.getByRole('button', { name: 'Invitar coordinador' });
  await abrir.click();
  const dialogo = pagina.getByRole('dialog', { name: 'Invitar coordinador' });
  revisar(await dialogo.isVisible(), 'el diálogo se abre con su botón');
  await pagina.keyboard.press('Escape');
  await pagina.waitForTimeout(200);
  revisar(!(await dialogo.isVisible()), 'Escape lo cierra');
  revisar(await abrir.evaluate((e) => e === document.activeElement), 'el foco vuelve al botón que lo abrió');

  const actual = pagina.locator('.pv-menu-item[aria-current="page"]');
  igual(await actual.evaluate((e) => getComputedStyle(e).backgroundColor), 'rgb(230, 238, 248)', 'el ítem actual del menú tiene el fondo del artboard');

  console.log('Mensajes de acceso (A5)');
  await pagina.goto(`${BASE}/editor/muestrario?seccion=mensajes`);
  const titulos = await pagina.locator('main h2').allTextContents();
  igual(JSON.stringify(titulos), JSON.stringify(TITULOS_A5), 'los 8 títulos de A5, en orden');

  igual(erroresJs.length, 0, `sin errores de JavaScript (${erroresJs.join(' | ')})`);
  await contexto.close();
} catch (e) {
  console.error(e);
  fallos++;
} finally {
  if (usuarioId) await servicio.auth.admin.deleteUser(usuarioId);
  await navegador.close();
}
console.log(fallos ? `\n${fallos} fallas` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
