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
  await panel.evaluate(() => { const e = leerEstado(); e.rotulo = 'persona'; e.rotuloHasta = 0; guardarEstado(e); });
  await rotulos.waitForTimeout(1600);
  revisar((await rotulos.textContent('#r-t')) === 'Pbro. Héctor Cruz', 'el rótulo «persona» muestra al celebrante');
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

  console.log('Tipos');
  const fijar = (cambios) => panel.evaluate((c) => { const s = leerEstado(); Object.assign(s, c); guardarEstado(s); }, cambios);
  const imagenFinal = (p) => p.evaluate(() => document.getElementById('virgen').getAttribute('src'));
  const esquinaTx = (p) => p.evaluate(() => [document.querySelector('.franja .fecha b').hidden ? '' : document.querySelector('.franja .fecha b').textContent, document.querySelector('.franja .fecha span').textContent]);
  await fijar({ tipo: 'horasanta', imagen: '', cuenta: null });
  await inicio.waitForTimeout(700);
  revisar((await inicio.textContent('#i-pildora')) === 'HORA SANTA', 'Hora Santa: la píldora dice HORA SANTA');
  revisar((await inicio.$eval('#i-cuenta', (e) => getComputedStyle(e).display)) === 'none', 'Hora Santa: sin cuenta regresiva');
  revisar((await inicio.evaluate(() => document.getElementById('virgen').currentSrc)).endsWith('fachada.jpg'), 'Hora Santa: sin custodia.png cae a la fachada');
  const [numHS, txtHS] = await esquinaTx(inicio);
  revisar(numHS === '' && txtHS === 'JUEVES\nEUCARÍSTICO', 'Hora Santa: la esquina es solo texto, sin número');
  await inicio.screenshot({ path: path.join(salida, 'inicio_horasanta.png') });

  await fijar({ tipo: 'patronalsector', sector: 'SECTOR 8', santo: 'la Virgen de la Medalla Milagrosa', fecha: '2026-11-27' });
  await inicio.waitForTimeout(700);
  revisar((await inicio.textContent('#i-pildora')) === 'MISA PATRONAL · SECTOR 8', 'Patronal de sector: píldora con el sector');
  const [numPS, txtPS] = await esquinaTx(inicio);
  revisar(numPS === '27' && txtPS === 'DE\nNOVIEMBRE', 'Patronal de sector: la franja dice 27 DE NOVIEMBRE');
  revisar((await inicio.$eval('#i-cuenta', (e) => getComputedStyle(e).display)) === 'none', 'Patronal de sector: sin cuenta regresiva');
  await inicio.screenshot({ path: path.join(salida, 'inicio_patronalsector.png') });

  await fijar({ tipo: 'procesion', santo: 'San José', lugar: 'Parque central · 5:00 p. m.', fecha: '' });
  await inicio.waitForTimeout(700);
  revisar((await inicio.textContent('#i-titulo')) === 'En breve\nsalimos', 'Procesión: el título dice «En breve salimos»');
  revisar((await inicio.$eval('#i-salida', (e) => getComputedStyle(e).display)) !== 'none', 'Procesión: se ve el recuadro de salida');
  revisar((await inicio.textContent('#i-salida-lugar')) === 'Parque central · 5:00 p. m.', 'Procesión: el recuadro muestra el lugar');
  await inicio.screenshot({ path: path.join(salida, 'inicio_procesion.png') });
  await fijar({ tipo: 'dominical' });
  await inicio.waitForTimeout(500);
  revisar((await inicio.$eval('#i-salida', (e) => getComputedStyle(e).display)) === 'none', 'Dominical: sin recuadro de salida');

  await fijar({ tipo: 'novena', imagen: '' });
  await inicio.waitForTimeout(500);
  revisar((await imagenFinal(inicio)).endsWith('img/virgen-a.png'), 'Novena: imagen del tipo (virgen-a)');
  await panel.evaluate(() => { const s = JSON.parse(localStorage.getItem('parroquia_obs_estado_v1')); s.virgen = 'b'; delete s.imagen; localStorage.setItem('parroquia_obs_estado_v1', JSON.stringify(s)); });
  await inicio.waitForTimeout(700);
  revisar((await imagenFinal(inicio)).endsWith('virgen-b.png'), 'Novena con estado viejo virgen:b: la imagen es virgen-b.png');
  await fijar({ tipo: 'novena', imagen: '' });

  await fijar({ tipo: 'evento', evento: 'Concierto de Adviento', fecha: '2026-12-13', lugar: 'Salón parroquial' });
  await portada.waitForTimeout(800);
  revisar((await portada.$eval('#v-portada', (e) => !e.hidden)) && (await portada.textContent('#p-titulo')) === 'CONCIERTO DE ADVIENTO', 'Portada de evento: muestra el nombre del evento');
  revisar((await portada.textContent('#p-caja-num')) === '13' && (await portada.textContent('#p-caja-mes')) === 'DIC', 'Portada de evento: fecha 13 DIC');
  revisar((await portada.textContent('#p-fecha')) === 'Salón parroquial', 'Portada de evento: lugar');
  revisar(await portada.$eval('#p-aro', (e) => !e.hidden), 'Portada de evento: logo grande');
  await portada.screenshot({ path: path.join(salida, 'portada_evento.png') });
  await fijar({ tipo: 'dominical' });
  await portada.waitForTimeout(800);
  revisar((await portada.$eval('#v-inicio', (e) => !e.hidden)) && (await portada.$eval('#v-portada', (e) => e.hidden)), 'Portada de un tipo sin portada: pinta el Inicio');
  await fijar({ tipo: 'novena', imagen: '' });
  await portada.waitForTimeout(800);
  revisar((await portada.textContent('#p-fecha')) === 'DE DICIEMBRE' && (await portada.$eval('#p-aro', (e) => e.hidden)), 'Portada de novena: la portada del 8 de diciembre');
  await fijar({ tipo: 'novena', imagen: 'custodia' });
  await inicio.waitForTimeout(900);
  revisar((await inicio.evaluate(() => document.getElementById('virgen').currentSrc)).endsWith('fachada.jpg'), 'Imagen que no existe: cae a la fachada sin repetir la carga');
  await fijar({ tipo: 'novena', imagen: '' });
  await inicio.waitForTimeout(500);

  for (const [n, p] of [['inicio', inicio], ['gracias', gracias], ['avisos', avisos], ['portada', portada], ['inicio_800x600', chica], ['panel', panel]]) {
    await p.screenshot({ path: path.join(salida, n + '.png'), fullPage: n === 'panel' });
  }

  console.log('Errores de JavaScript');
  revisar(errores.length === 0, errores.length ? errores.join('\n') : 'ninguno');
  await b.close();
  console.log(fallos ? `\n${fallos} prueba(s) fallaron.` : '\nTodo bien. Capturas en pruebas/capturas/');
  process.exit(fallos ? 1 : 0);
})();
