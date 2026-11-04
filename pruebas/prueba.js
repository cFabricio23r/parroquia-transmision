/*
  Prueba automática: abre el panel y las pantallas en un navegador (como en OBS),
  cambia datos desde el panel y revisa que las pantallas se actualicen.
  Guarda capturas en pruebas/capturas/.

  Uso:  npm run prueba
*/
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const raiz = path.resolve(__dirname, '..', 'obs');
const url = (archivo) => 'file://' + path.join(raiz, archivo).replace(/\\/g, '/').replace(/^([A-Za-z]):/, '/$1:');
const salida = path.join(__dirname, 'capturas');
fs.mkdirSync(salida, { recursive: true });

let fallos = 0;
const revisar = (cond, msg) => { console.log((cond ? '  ✔ ' : '  ✘ ') + msg); if (!cond) fallos++; };

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext();       // mismo contexto = mismo almacenamiento, como en OBS
  const errores = [];
  const abrir = async (archivo, w, h) => {
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errores.push(archivo + ': ' + e.message));
    await p.setViewportSize({ width: w, height: h });
    await p.goto(url(archivo));
    return p;
  };

  const panel = await abrir('panel.html', 360, 1250);
  const inicio = await abrir('pantalla.html?tipo=inicio', 1920, 1080);
  const gracias = await abrir('pantalla.html?tipo=gracias', 1920, 1080);
  const avisos = await abrir('pantalla.html?tipo=avisos', 1920, 1080);
  const portada = await abrir('pantalla.html?tipo=portada', 1920, 1080);
  const rotulos = await abrir('rotulos.html', 1920, 1080);
  const chica = await abrir('pantalla.html?tipo=inicio', 800, 600);   // tamaño por defecto de OBS
  await panel.waitForTimeout(1200);

  console.log('Conexión');
  revisar((await panel.textContent('#conexion')).includes('Conectado'), 'el panel ve las pantallas');

  console.log('Celebración');
  await panel.click('[data-hoja="vivo"]');
  await panel.click('[data-tipo="novena"]');
  await panel.click('#dia-mas'); await panel.click('#dia-mas');
  await inicio.waitForTimeout(600);
  revisar((await inicio.textContent('#i-pildora')) === 'NOVENA · DÍA 3', 'inicio muestra NOVENA · DÍA 3');

  console.log('Rótulos');
  await panel.click('[data-hoja="preparar"]');
  await panel.fill('#lectura1', 'Isaías 2, 1-5');
  await panel.fill('#salmoResp', 'Vamos con alegría a la casa del Señor');
  await panel.waitForTimeout(600);
  await panel.click('[data-hoja="vivo"]');
  await panel.keyboard.press('2');
  await rotulos.waitForTimeout(1500);
  revisar((await rotulos.textContent('#r-t')) === 'Isaías 2, 1-5', 'tecla 2 muestra la primera lectura');
  await panel.keyboard.press(' ');
  await rotulos.waitForTimeout(1600);
  revisar((await rotulos.textContent('#r-t')).startsWith('Vamos con alegría'), 'Espacio pasa al salmo');
  await rotulos.screenshot({ path: path.join(salida, 'rotulo.png') });
  await panel.keyboard.press('Escape');
  await rotulos.waitForTimeout(700);
  revisar(!(await rotulos.getAttribute('#rotulo', 'class')).includes('en'), 'Esc oculta el rótulo');

  console.log('Textos editables');
  await panel.click('[data-hoja="textos"]');
  await panel.click('summary >> text=Gracias por acompañarnos');
  await panel.fill('[data-texto="gracias_cursiva"]', 'Que la Virgen\nlos acompañe');
  await gracias.waitForTimeout(900);
  revisar((await gracias.textContent('#g-cursiva')) === 'Que la Virgen\nlos acompañe', 'gracias usa el texto escrito');

  console.log('Avisos');
  await panel.click('[data-hoja="avisos"]');
  await panel.fill('[data-aviso="0"][data-c="a"]', 'Rezo de la novena');
  await avisos.waitForTimeout(900);
  revisar((await avisos.textContent('#a-filas')).includes('Rezo de la novena'), 'avisos muestra el aviso');

  for (const [n, p] of [['inicio', inicio], ['gracias', gracias], ['avisos', avisos], ['portada', portada], ['inicio_800x600', chica], ['panel', panel]]) {
    await p.screenshot({ path: path.join(salida, n + '.png'), fullPage: n === 'panel' });
  }

  console.log('Errores de JavaScript');
  revisar(errores.length === 0, errores.length ? errores.join('\n') : 'ninguno');
  await b.close();
  console.log(fallos ? `\n${fallos} prueba(s) fallaron.` : '\nTodo bien. Capturas en pruebas/capturas/');
  process.exit(fallos ? 1 : 0);
})();
