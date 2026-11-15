// Pruebas de navegador de las pantallas de acceso A1, A3 y A4 (plan 2, tareas 12 a 14),
// contra `next dev` + Supabase local. Correos con sufijo aleatorio: la base local se comparte.
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

const creados = [];
async function crearUsuario() {
  const correo = `acceso-${sufijo()}@prueba.test`;
  const { data, error } = await servicio.auth.admin.createUser({ email: correo, password: CLAVE, email_confirm: true });
  if (error) throw error;
  creados.push(data.user.id);
  return { id: data.user.id, correo };
}

const estilo = (loc, props) =>
  loc.evaluate((e, p) => {
    const s = getComputedStyle(e);
    return Object.fromEntries(p.map((k) => [k, s.getPropertyValue(k)]));
  }, props);

// Ancho de borde escrito en la hoja de estilos (la última regla que aplica al elemento). Chromium
// redondea el ancho calculado a píxeles enteros (1.5px sale «1px» en getComputedStyle), así que el
// valor del artboard se compara contra lo declarado. Con var() en el atajo `border`, el navegador no
// separa los largos: se lee la primera medida del atajo.
const bordeDeclarado = (loc) =>
  loc.evaluate((e) => {
    let valor = '';
    for (const hoja of document.styleSheets) {
      let reglas;
      try {
        reglas = hoja.cssRules;
      } catch {
        continue;
      }
      for (const r of reglas) {
        if (!(r instanceof CSSStyleRule)) continue;
        const v =
          r.style.getPropertyValue('border-top-width') ||
          (r.style.getPropertyValue('border') || r.style.getPropertyValue('border-width')).match(/(^|\s)(\d*\.?\d+px)/)?.[2] ||
          '';
        if (!v) continue;
        try {
          if (e.matches(r.selectorText)) valor = v;
        } catch {
          // selector con pseudoelemento: no aplica al elemento
        }
      }
    }
    return valor;
  });
const unH1 = async (p, texto, msg) => {
  const h1 = p.locator('h1');
  igual(await h1.count(), 1, `${msg}: un solo h1`);
  igual((await h1.first().textContent())?.trim(), texto, `${msg}: h1 «${texto}»`);
};

const navegador = await chromium.launch();
try {
  const contexto = await navegador.newContext({ viewport: { width: 1440, height: 900 } });
  const pagina = await contexto.newPage();
  const erroresJs = [];
  pagina.on('pageerror', (e) => erroresJs.push(e.message));

  // ---------------- A1 · Entrar ----------------
  console.log('A1 · Entrar');
  await pagina.goto(`${BASE}/editor/entrar`);
  await pagina.evaluate(() => document.fonts.ready);
  igual(await pagina.title(), 'Entrar · Parroquia en Vivo', 'título de la pestaña');
  const tarjeta = pagina.locator('.pv-tarjeta-acceso');
  igual(await tarjeta.locator('h1').textContent(), 'Entrar', 'h1 «Entrar»');
  igual(
    await tarjeta.locator('p.pv-texto-acceso').first().textContent(),
    'Usa el correo con el que te invitaron y tu contraseña.',
    'texto de A1',
  );
  revisar(await pagina.getByLabel('Correo').isVisible(), 'campo «Correo» con su etiqueta');
  revisar(await pagina.getByLabel('Contraseña', { exact: true }).isVisible(), 'campo «Contraseña» con su etiqueta');
  revisar(await pagina.getByRole('button', { name: 'Mostrar contraseña' }).isVisible(), 'botón «Mostrar contraseña»');
  revisar(await pagina.getByRole('button', { name: 'Entrar', exact: true }).isVisible(), 'botón «Entrar»');
  revisar(await tarjeta.getByRole('link', { name: 'Olvidé mi contraseña' }).isVisible(), 'enlace «Olvidé mi contraseña»');
  igual(
    (await tarjeta.locator('.pv-info').textContent())?.trim(),
    'Solo pueden entrar las personas invitadas por la Pastoral de Comunicaciones. ¿Te llegó una invitación? Ábrela desde el correo para crear tu contraseña.',
    'caja de información de A1',
  );

  const caja = await tarjeta.boundingBox();
  igual(Math.round(caja.width), 440, 'tarjeta de 440 px');
  const et = await estilo(tarjeta, ['border-radius', 'box-shadow']);
  igual(et['border-radius'], '18px', 'tarjeta con radio 18');
  igual(et['box-shadow'], 'rgba(12, 53, 98, 0.08) 0px 12px 32px 0px', 'sombra de la tarjeta');
  const eh = await estilo(tarjeta.locator('h1'), ['font-size', 'font-weight']);
  igual(eh['font-size'], '26px', 'h1 de 26 px');
  igual(eh['font-weight'], '800', 'h1 en 800');
  const correoInput = pagina.getByLabel('Correo');
  revisar((await correoInput.boundingBox()).height >= 44, 'campo de al menos 44 px');
  igual(await bordeDeclarado(correoInput), '1.5px', 'borde del campo de 1.5 px (declarado, como el artboard)');
  igual(
    (await estilo(pagina.getByRole('button', { name: 'Entrar', exact: true }), ['background-color']))['background-color'],
    'rgb(17, 85, 164)',
    'botón primario azul',
  );
  const encabezado = pagina.locator('header.pv-encabezado');
  igual(Math.round((await encabezado.boundingBox()).height), 64, 'encabezado de 64 px');
  igual((await estilo(encabezado, ['background-color']))['background-color'], 'rgb(12, 53, 98)', 'encabezado azul oscuro');
  revisar((await estilo(pagina.locator('body'), ['font-family']))['font-family'].startsWith('Montserrat'), 'el cuerpo usa Montserrat');
  revisar(await pagina.evaluate(() => document.fonts.check('800 16px Montserrat')), 'Montserrat 800 cargada');
  revisar(await pagina.getByRole('img', { name: 'Logo de la Pastoral de Comunicaciones' }).isVisible(), 'logo con su alt');

  const u = await crearUsuario();
  await correoInput.fill(u.correo);
  await pagina.getByLabel('Contraseña', { exact: true }).fill('clave-equivocada-9');
  await pagina.getByRole('button', { name: 'Entrar', exact: true }).click();
  const alerta = pagina.locator('main').getByRole('alert');
  await alerta.waitFor();
  revisar((await alerta.textContent()).includes('Correo o contraseña incorrectos'), 'clave mala: «Correo o contraseña incorrectos»');
  revisar(
    (await alerta.textContent()).includes('El correo o la contraseña no coinciden. Revísalos, o crea una contraseña nueva.'),
    'con el texto de A5',
  );
  revisar(await alerta.evaluate((e) => e === document.activeElement), 'el foco está en el mensaje');

  await pagina.getByLabel('Contraseña', { exact: true }).fill(CLAVE);
  await pagina.getByRole('button', { name: 'Entrar', exact: true }).click();
  await pagina.waitForURL((url) => !url.pathname.startsWith('/editor/entrar'), { timeout: 15_000 });
  revisar(!new URL(pagina.url()).pathname.startsWith('/editor/entrar'), 'con la clave buena entra');
  await contexto.clearCookies();

  // ---------------- A3 · Olvidé mi contraseña ----------------
  console.log('A3 · Olvidé mi contraseña');
  await pagina.goto(`${BASE}/editor/olvide`);
  igual(await pagina.title(), '¿Olvidaste tu contraseña? · Parroquia en Vivo', 'título de la pestaña');
  igual(await pagina.locator('h1').textContent(), '¿Olvidaste tu contraseña?', 'h1 de A3');
  igual((await estilo(pagina.locator('h1'), ['font-size']))['font-size'], '24px', 'h1 de 24 px');
  igual(
    await pagina.locator('p.pv-texto-acceso').first().textContent(),
    'Escribe tu correo y te mandamos un enlace para crear una nueva.',
    'texto de A3',
  );
  revisar(await pagina.getByRole('link', { name: 'Volver a entrar' }).isVisible(), 'enlace «Volver a entrar»');
  const fantasma = `fantasma-${sufijo()}@prueba.test`;
  await pagina.getByLabel('Correo').fill(fantasma);
  await pagina.getByRole('button', { name: 'Enviar enlace' }).click();
  await pagina.getByRole('heading', { name: 'Revisa tu correo' }).waitFor();
  igual(await pagina.locator('p.pv-texto-acceso b').textContent(), fantasma, 'el correo va en negrita');
  revisar(await pagina.locator('h1').evaluate((e) => e === document.activeElement), 'el foco pasa al h1');
  revisar((await pagina.locator('.pv-info').textContent()).includes('Revisa la carpeta de spam. El enlace dura 1 hora.'), 'caja «¿No te llegó?»');
  revisar(await pagina.getByRole('link', { name: 'Volver a entrar' }).isVisible(), 'botón «Volver a entrar»');

  await pagina.goto(`${BASE}/editor/olvide?error=enlace`);
  const vencido = pagina.locator('main').getByRole('alert');
  await vencido.waitFor();
  revisar((await vencido.textContent()).includes('Enlace vencido o usado'), '?error=enlace: «Enlace vencido o usado»');
  await unH1(pagina, 'Enlace vencido o usado', '?error=enlace');
  igual(await pagina.title(), 'Enlace vencido o usado · Parroquia en Vivo', '?error=enlace: el título de la pestaña es el del h1');
  await pagina.getByRole('link', { name: 'Pedir otro enlace' }).click();
  await pagina.getByRole('button', { name: 'Enviar enlace' }).waitFor();
  igual(new URL(pagina.url()).search, '', '«Pedir otro enlace» lleva al formulario');

  await pagina.goto(`${BASE}/editor/auth/confirmar?token_hash=malo&type=recovery`);
  await pagina.locator('main').getByRole('alert').waitFor();
  revisar((await pagina.locator('main').getByRole('alert').textContent()).includes('Enlace vencido o usado'), 'un token malo termina en «Enlace vencido o usado»');

  // ---------------- La app pide el enlace (etapa 3a, Decisión 7) ----------------
  console.log('POST /editor/olvide/pedir');
  {
    const MENSAJE = 'Si ese correo tiene cuenta, te llegó un enlace. Vence en 1 hora';
    const pedir = (cuerpo) =>
      fetch(`${BASE}/editor/olvide/pedir`, { method: 'POST', body: cuerpo, headers: { 'content-type': 'application/json' }, redirect: 'manual' });
    const r1 = await pedir(JSON.stringify({ correo: `nadie-${sufijo()}@prueba.test` }));
    igual(r1.status, 200, 'la ruta responde 200 sin cookies de sesión (no redirige a entrar)');
    igual(r1.headers.get('location'), null, 'sin redirección');
    igual((await r1.json()).mensaje, MENSAJE, 'responde MENSAJE_RECUPERAR');
    const r2 = await pedir('{roto');
    igual(r2.status, 200, 'con un cuerpo roto también responde 200');
    igual((await r2.json()).mensaje, MENSAJE, 'y el mismo mensaje');
  }

  // ---------------- A4 · Contraseña nueva ----------------
  console.log('A4 · Contraseña nueva');
  const r = await crearUsuario();
  const { data: enlace, error: errorEnlace } = await servicio.auth.admin.generateLink({ type: 'recovery', email: r.correo });
  if (errorEnlace) throw errorEnlace;
  await pagina.goto(`${BASE}/editor/auth/confirmar?token_hash=${encodeURIComponent(enlace.properties.hashed_token)}&type=recovery`);
  await pagina.waitForURL(`${BASE}/editor/nueva-contrasena`);
  igual(await pagina.title(), 'Crea una contraseña nueva · Parroquia en Vivo', 'título de la pestaña');
  igual((await pagina.locator('p.pv-texto-acceso').first().textContent()), `Para ${r.correo}.`, '«Para {correo}.»');
  const mostrarNueva = pagina.getByRole('button', { name: 'Mostrar contraseña nueva', exact: true });
  const mostrarRepetida = pagina.getByRole('button', { name: 'Mostrar contraseña repetida', exact: true });
  revisar(await mostrarNueva.isVisible(), '«Mostrar contraseña nueva» con su propio nombre');
  revisar(await mostrarRepetida.isVisible(), '«Mostrar contraseña repetida» con su propio nombre');
  // La zona de toque (el botón o su ::after) mide 44 px y no se mete en la etiqueta del campo siguiente.
  const zona = await mostrarNueva.evaluate((e) => {
    const b = e.getBoundingClientRect();
    const a = getComputedStyle(e, '::after');
    const conAfter = a.content !== 'none' && a.position === 'absolute';
    const top = conAfter ? b.top + parseFloat(a.top) : b.top;
    const alto = conAfter ? parseFloat(a.height) : b.height;
    return { alto, abajo: top + alto };
  });
  const etiquetaSiguiente = await pagina.locator('.pv-campo-etiqueta', { hasText: 'Repite la contraseña' }).boundingBox();
  revisar(zona.alto >= 44, `zona de «Mostrar contraseña» de 44 px (mide ${zona.alto})`);
  revisar(zona.abajo <= etiquetaSiguiente.y + 0.5, `la zona no tapa la etiqueta siguiente (termina en ${zona.abajo}, la etiqueta empieza en ${etiquetaSiguiente.y})`);
  await pagina.getByLabel('Contraseña nueva', { exact: true }).fill('clave-1234');
  await pagina.getByLabel('Repite la contraseña', { exact: true }).fill('clave-1235');
  revisar(await pagina.getByText('Las dos contraseñas no son iguales.').isVisible(), 'claves distintas: el error bajo el campo');
  revisar((await pagina.locator('.pv-requisitos li').nth(1).textContent()).includes('(falta)'), 'el segundo requisito dice «(falta)»');
  await pagina.getByLabel('Repite la contraseña', { exact: true }).fill('clave-1234');
  revisar((await pagina.locator('.pv-requisitos li').nth(1).textContent()).includes('(cumplido)'), 'iguales: «(cumplido)»');
  await pagina.getByRole('button', { name: 'Guardar y entrar' }).click();
  await pagina.waitForURL((url) => !url.pathname.startsWith('/editor/nueva-contrasena'), { timeout: 15_000 });
  revisar(new URL(pagina.url()).pathname.startsWith('/editor'), '«Guardar y entrar» lleva al editor');
  const prueba = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  revisar(!(await prueba.auth.signInWithPassword({ email: r.correo, password: 'clave-1234' })).error, 'la clave nueva sirve para entrar');

  igual(erroresJs.length, 0, `sin errores de JavaScript (${erroresJs.join(' | ')})`);
  await contexto.close();
} catch (e) {
  console.error(e);
  fallos++;
} finally {
  for (const id of creados) await servicio.auth.admin.deleteUser(id);
  await navegador.close();
}
console.log(fallos ? `\n${fallos} fallas` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
