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

  /* Elige un tipo desde Preparar, como lo haría el voluntario. */
  const elegirTipo = async (clave) => {
    await panel.click('[data-hoja="preparar"]');
    await panel.click('#cambiar-tipo');
    await panel.click(`[data-tipo="${clave}"]`);
    await panel.click('#continuar');
  };
  const estadoPanel = () => panel.evaluate(() => JSON.parse(localStorage.getItem('parroquia_obs_estado_v1')));

  console.log('Celebración');
  await elegirTipo('novena');
  await panel.click('#dia-mas'); await panel.click('#dia-mas');
  await inicio.waitForTimeout(600);
  revisar((await inicio.textContent('#i-pildora')) === 'NOVENA · DÍA 3', 'inicio muestra NOVENA · DÍA 3');

  console.log('Rótulos');
  await elegirTipo('dominical');
  await panel.fill('#rot-lectura1-t', 'Isaías 2, 1-5');
  await panel.fill('#rot-salmo-t', 'Vamos con alegría a la casa del Señor');
  await panel.waitForTimeout(600);
  await panel.click('[data-hoja="vivo"]');
  await panel.keyboard.press('2');
  await rotulos.waitForTimeout(1500);
  revisar((await rotulos.textContent('#r-t')) === 'Isaías 2, 1-5', 'dominical: la tecla 2 muestra la primera lectura');
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
  await panel.click('[data-hoja="preparar"]');
  await panel.click('#det-textos > summary');
  await panel.click('summary >> text=Gracias por acompañarnos');
  await panel.fill('[data-texto="gracias_cursiva"]', 'Que la Virgen\nlos acompañe');
  await gracias.waitForTimeout(900);
  revisar((await gracias.textContent('#g-cursiva')) === 'Que la Virgen\nlos acompañe', 'gracias usa el texto escrito');

  console.log('Avisos');
  await panel.click('#det-avisos > summary');
  await panel.fill('[data-aviso="0"][data-c="a"]', 'Rezo de la novena');
  await avisos.waitForTimeout(900);
  revisar((await avisos.textContent('#a-filas')).includes('Rezo de la novena'), 'avisos muestra el aviso');
  await panel.waitForTimeout(500);
  revisar((await panel.textContent('#det-avisos > summary')).includes('1 escrito'), 'el resumen de Avisos cuenta los escritos');

  console.log('Panel 2.0');
  // lectura2 al aire en dominical; al pasar a Hora Santa (sin 2.ª lectura) el rótulo se oculta.
  await elegirTipo('dominical');
  await panel.fill('#rot-lectura2-t', 'Romanos 13, 11-14');
  await panel.waitForTimeout(500);
  await panel.click('[data-hoja="vivo"]');
  await panel.keyboard.press('4');
  await rotulos.waitForTimeout(1500);
  revisar((await rotulos.textContent('#r-t')) === 'Romanos 13, 11-14', 'dominical: la tecla 4 muestra la segunda lectura');
  await elegirTipo('horasanta');
  await rotulos.waitForTimeout(900);
  revisar(!(await rotulos.getAttribute('#rotulo', 'class')).includes('en'), 'al pasar a Hora Santa, rotulos.html oculta la 2.ª lectura');
  revisar((await estadoPanel()).rotulo === 'ninguno', 'al pasar a Hora Santa, el estado queda con rotulo «ninguno»');
  await panel.screenshot({ path: path.join(salida, 'panel_preparar.png'), fullPage: true });

  await panel.click('[data-hoja="vivo"]');
  const nombresVivo = await panel.$$eval('#hoja-vivo [data-rotulo]', (bs) => bs.map((b) => b.querySelector('.nom').textContent));
  revisar(nombresVivo.length === 5, 'Hora Santa: la hoja En vivo tiene 5 botones de rótulo (' + nombresVivo.join(', ') + ')');
  revisar(!nombresVivo.includes('2.ª lectura'), 'Hora Santa: ningún botón es «2.ª lectura»');
  revisar((await panel.textContent('#siguiente')).includes('Siguiente: Guía'), 'Hora Santa: #siguiente dice «Siguiente: Guía»');
  revisar((await panel.textContent('#transmision')).startsWith('Hora Santa · '), 'la píldora #transmision muestra el tipo');
  revisar((await panel.$$eval('#hoja-vivo input, #hoja-vivo textarea', (els) => els.length)) === 0, 'la hoja En vivo no tiene campos de texto');
  const antes7 = await panel.evaluate(() => localStorage.getItem('parroquia_obs_estado_v1'));
  await panel.keyboard.press('7');
  await panel.waitForTimeout(500);
  revisar((await panel.evaluate(() => localStorage.getItem('parroquia_obs_estado_v1'))) === antes7, 'Hora Santa: la tecla 7 no cambia el estado');
  await panel.screenshot({ path: path.join(salida, 'panel_vivo.png'), fullPage: true });

  // Escribir un número en una casilla no muestra un rótulo.
  await panel.click('[data-hoja="preparar"]');
  await panel.click('#rot-oracion-t');
  await panel.keyboard.press('1');
  await panel.waitForTimeout(500);
  revisar((await estadoPanel()).rotulo === 'ninguno', 'la tecla 1 dentro de una casilla no muestra un rótulo');
  await panel.fill('#rot-oracion-t', '');

  console.log('Panel 2.0 · atajos solo en En vivo');
  await panel.waitForTimeout(500);
  await panel.focus('#cambiar-tipo');
  await panel.keyboard.press('2');
  await panel.waitForTimeout(400);
  revisar((await estadoPanel()).rotulo === 'ninguno', 'Preparar: la tecla 2 no muestra un rótulo');
  await panel.focus('#cambiar-tipo');
  await panel.keyboard.press(' ');
  await panel.waitForTimeout(400);
  revisar((await estadoPanel()).rotulo === 'ninguno', 'Preparar: Espacio sobre «Cambiar» no muestra un rótulo');
  revisar(await panel.isVisible('#elegir'), 'Preparar: Espacio sobre «Cambiar» hace lo del botón (abre Elegir)');
  await panel.focus('[data-tipo="horasanta"]');
  await panel.keyboard.press(' ');
  await panel.keyboard.press('2');
  await panel.waitForTimeout(400);
  revisar((await estadoPanel()).rotulo === 'ninguno', 'Preparar: Espacio y 2 sobre un tipo no muestran un rótulo');
  revisar((await panel.textContent('[data-tipo="horasanta"] .sub')) === (await panel.evaluate(() => TIPOS.horasanta.descripcion)), 'el botón del tipo muestra su descripción');
  await panel.click('#continuar');
  revisar((await panel.$$eval('#rot-guia-k', (els) => els[0] && els[0].list ? els[0].list.options.length : 0)) === 6, 'el cargo sugiere los 6 CARGOS');

  await panel.click('[data-hoja="vivo"]');
  const logoAntes = (await estadoPanel()).mostrarLogo;
  await panel.focus('[data-switch="mostrarLogo"]');
  await panel.keyboard.press(' ');
  await panel.waitForTimeout(400);
  revisar((await estadoPanel()).mostrarLogo === !logoAntes, 'En vivo: Espacio sobre el interruptor del logo lo cambia');
  revisar((await estadoPanel()).rotulo === 'ninguno', 'En vivo: Espacio sobre el interruptor no muestra un rótulo');
  await panel.keyboard.press(' ');
  await panel.waitForTimeout(400);
  await panel.focus('#siguiente');
  await panel.keyboard.press(' ');
  await panel.waitForTimeout(400);
  revisar((await estadoPanel()).rotulo === 'guia', 'En vivo: Espacio sobre «Siguiente» muestra el siguiente (Guía)');
  await panel.keyboard.press('Escape');
  await panel.waitForTimeout(400);

  console.log('Panel 2.0 · cambiar de tipo');
  await panel.click('[data-hoja="preparar"]');
  await panel.click('[data-imagen="virgen-b"]');
  await panel.selectOption('#esquina', 'texto');
  await panel.fill('#esquinaTexto', 'SOLO HORA SANTA');
  await panel.click('[data-cuenta="si"]');
  await panel.waitForTimeout(500);
  const antesTipo = await estadoPanel();
  revisar(antesTipo.imagen === 'virgen-b' && antesTipo.esquina === 'texto' && antesTipo.esquinaTexto === 'SOLO HORA SANTA' && antesTipo.cuenta === true, 'Hora Santa: imagen, esquina y cuenta elegidas a mano');
  await elegirTipo('sector');
  const trasTipo = await estadoPanel();
  revisar(trasTipo.imagen === '' && trasTipo.esquina === '' && trasTipo.esquinaTexto === '' && trasTipo.cuenta === null, 'al cambiar de tipo, imagen, esquina, texto de esquina y cuenta vuelven a automático');
  revisar(trasTipo.lectura1 === antesTipo.lectura1 && trasTipo.celebrante === antesTipo.celebrante && trasTipo.santo === antesTipo.santo
    && JSON.stringify(trasTipo.avisos) === JSON.stringify(antesTipo.avisos) && JSON.stringify(trasTipo.rotulosTexto) === JSON.stringify(antesTipo.rotulosTexto), 'al cambiar de tipo se conservan datos, textos de rótulos y avisos');

  // Misa en sector: el lugar se escribe una sola vez (dato y rótulo «Lugar»).
  await panel.fill('#dato-lugar', '');
  await panel.waitForTimeout(500);
  const faltasLugar = await panel.$$eval('#revision a', (as) => as.filter((a) => /lugar/i.test(a.textContent)).length);
  revisar(faltasLugar === 1, 'Misa en sector sin lugar: la lista lo pide una sola vez (' + faltasLugar + ')');
  await panel.fill('#dato-lugar', 'Capilla San Juan');
  await panel.waitForTimeout(500);
  revisar((await panel.$$eval('#revision a', (as) => as.filter((a) => /lugar/i.test(a.textContent)).length)) === 0, 'Misa en sector con lugar: ya no falta');
  revisar((await panel.textContent('#hoja-vivo [data-rotulo="lugar"] .prev')) === 'Capilla San Juan', 'el rótulo «Lugar» toma el lugar del dato');

  await elegirTipo('patronalsector');
  await panel.fill('#dato-sector', '');
  await panel.waitForTimeout(500);
  const revision = await panel.textContent('#revision');
  revisar(revision.includes('Faltan'), 'Patronal de sector sin sector: #revision dice «Faltan» (' + revision.trim().split('\n')[0] + ')');
  revisar((await panel.$$eval('#revision a[href="#dato-sector"]', (a) => a.length)) === 1, 'la falta del sector enlaza a su campo');
  await panel.click('#revision a[href="#dato-sector"]');
  revisar((await panel.evaluate(() => document.activeElement && document.activeElement.id)) === 'dato-sector', 'el enlace de la falta enfoca el campo');
  await panel.click('#cambiar-tipo');
  await panel.screenshot({ path: path.join(salida, 'panel_elegir.png'), fullPage: true });
  await panel.click('#continuar');

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
