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
  revisar(await panel.isVisible('#rot-rosario-s'), 'novena: el panel tiene el campo del Santo Rosario');
  revisar((await panel.$$eval('#hoja-vivo [data-rotulo] .nom', (ns) => ns.map((n) => n.textContent))).includes('Santo Rosario'), 'novena: En vivo tiene el botón «Santo Rosario»');

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

  console.log('Guardadas');
  const abrirGuardadas = async () => { await panel.click('[data-hoja="guardadas"]'); };
  await panel.evaluate(() => localStorage.removeItem('parroquia_obs_guardadas_v1'));
  await panel.reload();
  await panel.waitForTimeout(500);
  revisar(!(await panel.isVisible('#sec-rapidas')), 'sin guardadas, Elegir no muestra «O cargar una guardada»');
  await elegirTipo('horasanta');
  await panel.fill('#rot-guia-t', 'Juan');
  await panel.waitForTimeout(500);
  revisar((await estadoPanel()).celebrante === 'Pbro. Héctor Cruz', 'el nombre de la guía no pisa al celebrante (' + (await estadoPanel()).celebrante + ')');
  revisar((await estadoPanel()).rotulosTexto.guia.t === 'Juan', 'el nombre de la guía queda en rotulosTexto.guia');
  await panel.click('#guardar-esta');
  revisar(await panel.isVisible('#hoja-guardadas'), '«Guardar esta transmisión…» abre la pestaña Guardadas');
  revisar((await panel.evaluate(() => document.activeElement.id)) === 'guardar-nombre', 'y deja el foco en el nombre');
  revisar((await panel.inputValue('#guardar-nombre')).startsWith('Hora Santa '), 'el nombre viene sugerido (' + (await panel.inputValue('#guardar-nombre')) + ')');
  await panel.fill('#guardar-nombre', '   ');
  await panel.click('#guardar-boton');
  revisar((await panel.evaluate(() => JSON.parse(localStorage.getItem('parroquia_obs_guardadas_v1') || '[]').length)) === 0, 'un nombre vacío no guarda nada');
  await panel.fill('#guardar-nombre', 'Prueba HS');
  await panel.click('#guardar-boton');
  const guardadasLs = () => panel.evaluate(() => JSON.parse(localStorage.getItem('parroquia_obs_guardadas_v1') || '[]'));
  revisar((await guardadasLs()).length === 1 && (await guardadasLs())[0].tipo === 'horasanta', 'Guardar crea la entrada «Prueba HS» de tipo horasanta');
  revisar(!('rotulo' in (await guardadasLs())[0].datos), 'lo guardado no incluye el rótulo al aire');
  await panel.fill('#guardar-nombre', 'prueba hs ');
  await panel.fill('#guardar-nombre', 'prueba hs ');
  let pregunta = '';
  panel.once('dialog', (d) => { pregunta = d.message(); d.dismiss(); });
  await panel.click('#guardar-boton');
  revisar(pregunta === 'Ya existe «prueba hs». ¿Reemplazarla?', 'guardar con un nombre existente pregunta antes de reemplazar (' + pregunta + ')');
  revisar((await guardadasLs()).length === 1 && (await guardadasLs())[0].nombre === 'Prueba HS', 'Cancelar no guarda nada');
  panel.once('dialog', (d) => d.accept());
  await panel.click('#guardar-boton');
  revisar((await guardadasLs()).length === 1 && (await guardadasLs())[0].nombre === 'prueba hs', 'Aceptar reemplaza la entrada (otras mayúsculas)');
  await panel.evaluate(() => { window.__setItem = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k === 'parroquia_obs_guardadas_v1') throw new Error('cuota'); return window.__setItem.call(this, k, v); }; });
  await panel.fill('#guardar-nombre', 'Otra');
  await panel.click('#guardar-boton');
  revisar((await panel.textContent('#estado-guardadas')).includes('No se pudo guardar'), 'si el navegador no deja escribir, el panel no dice «Guardada»');
  await panel.evaluate(() => { Storage.prototype.setItem = window.__setItem; });

  // otro tipo, con un rótulo al aire: cargar tiene que dejar la pantalla sin rótulo
  await elegirTipo('dominical');
  await panel.fill('#rot-lectura1-t', 'Isaías 2, 1-5');
  await panel.waitForTimeout(500);
  await panel.click('[data-hoja="vivo"]');
  await panel.keyboard.press('2');
  await rotulos.waitForTimeout(1500);
  revisar((await rotulos.getAttribute('#rotulo', 'class')).includes('en'), 'antes de cargar hay un rótulo al aire');
  await abrirGuardadas();
  const botonCargar = panel.locator('#lista-guardadas button[aria-label="Cargar «prueba hs»"]');
  revisar((await botonCargar.count()) === 1, 'el botón «Cargar» tiene el nombre de la transmisión');
  for (const b of await panel.locator('#lista-guardadas button').all()) {
    const caja = await b.boundingBox();
    if (caja.height < 44) revisar(false, 'botón de menos de 44 px: ' + (await b.getAttribute('aria-label')) + ' ' + caja.height);
  }
  await panel.screenshot({ path: path.join(salida, 'panel_guardadas.png'), fullPage: true });
  await botonCargar.click();
  await rotulos.waitForTimeout(1500);
  revisar((await estadoPanel()).tipo === 'horasanta', 'Cargar vuelve a Hora Santa');
  revisar(await panel.isVisible('#hoja-preparar'), 'Cargar abre Preparar');
  revisar((await panel.inputValue('#rot-guia-t')) === 'Juan', 'el campo del guía vuelve a «Juan»');
  revisar((await panel.textContent('#transmision')).startsWith('Hora Santa'), 'la píldora dice Hora Santa');
  revisar((await estadoPanel()).rotulo === 'ninguno', 'Cargar deja el rótulo en «ninguno»');
  revisar(!(await rotulos.getAttribute('#rotulo', 'class')).includes('en'), 'rotulos.html no muestra rótulo tras cargar');
  revisar(!(await rotulos.isVisible('#r-t')), '#r-t de rotulos.html no está visible');

  // desde Elegir
  await elegirTipo('dominical');
  await panel.click('#cambiar-tipo');
  revisar(await panel.isVisible('#sec-rapidas'), 'con guardadas, Elegir muestra «O cargar una guardada»');
  await panel.click('#rapidas button[aria-label="Cargar «prueba hs»"]');
  await panel.waitForTimeout(400);
  revisar((await estadoPanel()).tipo === 'horasanta' && await panel.isVisible('#preparar-datos'), 'Cargar desde Elegir también vuelve a Hora Santa');

  // duplicar y borrar
  await abrirGuardadas();
  await panel.click('#lista-guardadas button[aria-label="Duplicar «prueba hs»"]');
  revisar((await guardadasLs()).map((g) => g.nombre).sort().join('|') === 'prueba hs|prueba hs (copia)', 'Duplicar crea «(copia)»');
  panel.once('dialog', (d) => d.dismiss());
  await panel.click('#lista-guardadas button[aria-label="Borrar «prueba hs (copia)»"]');
  revisar((await guardadasLs()).length === 2, 'Borrar y decir que no, no borra');
  panel.once('dialog', (d) => d.accept());
  await panel.click('#lista-guardadas button[aria-label="Borrar «prueba hs (copia)»"]');
  revisar((await guardadasLs()).length === 1, 'Borrar y aceptar quita la entrada');
  panel.once('dialog', (d) => d.accept());
  await panel.click('#lista-guardadas button[aria-label="Borrar «prueba hs»"]');
  revisar((await guardadasLs()).length === 0 && (await panel.textContent('#lista-guardadas')).includes('Todavía no hay'), 'sin guardadas la lista lo dice');
  await panel.click('[data-hoja="preparar"]');

  console.log('Imagen en todos los tipos');
  for (const clave of await panel.evaluate(() => ORDEN_TIPOS)) {
    await elegirTipo(clave);
    const def = await panel.evaluate((k) => TIPOS[k].imagen, clave);
    revisar((await estadoPanel()).imagen === '' && (await panel.getAttribute('[data-imagen=""]', 'aria-pressed')) === 'true', `${clave}: arranca con la imagen del tipo (${def}) precargada`);
    const otra = def === 'virgen-b' ? 'fachada' : 'virgen-b';
    await panel.click(`[data-imagen="${otra}"]`);
    revisar((await estadoPanel()).imagen === otra, `${clave}: la imagen se puede cambiar a ${otra}`);
  }
  await elegirTipo('semana');
  revisar((await panel.textContent('[data-imagen=""] .sub')) === 'Virgen A', 'Misa entre semana: la imagen automática es la Virgen A (Inmaculada)');
  await panel.click('[data-hoja="preparar"]');

  console.log('Tipos');
  const fijar = (cambios) => panel.evaluate((c) => { const s = leerEstado(); Object.assign(s, c); guardarEstado(s); }, cambios);
  const imagenFinal = (p) => p.evaluate(() => document.getElementById('virgen').getAttribute('src'));
  const esquinaTx = (p) => p.evaluate(() => [document.querySelector('.franja .fecha b').hidden ? '' : document.querySelector('.franja .fecha b').textContent, document.querySelector('.franja .fecha span').textContent]);
  await fijar({ tipo: 'horasanta', imagen: '', cuenta: null });
  await inicio.waitForTimeout(700);
  revisar((await inicio.textContent('#i-pildora')) === 'HORA SANTA', 'Hora Santa: la píldora dice HORA SANTA');
  revisar((await inicio.$eval('#i-cuenta', (e) => getComputedStyle(e).display)) === 'none', 'Hora Santa: sin cuenta regresiva');
  revisar((await inicio.evaluate(() => { const v = document.getElementById('virgen'); return v.currentSrc.endsWith('img/custodia.png') && v.complete && v.naturalHeight > 0; })), 'Hora Santa: muestra la custodia (img/custodia.png carga)');
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
  await fijar({ tipo: 'novena', imagen: 'imagen-que-no-existe' });
  await inicio.waitForTimeout(900);
  revisar((await inicio.evaluate(() => document.getElementById('virgen').currentSrc)).endsWith('fachada.jpg'), 'Imagen que no existe: cae a la fachada sin repetir la carga');
  await fijar({ tipo: 'novena', imagen: '' });
  await inicio.waitForTimeout(500);

  console.log('Modo app');
  const app = await abrir('panel.html?modo=app', 360, 318);
  await app.waitForTimeout(600);
  revisar(await app.evaluate(() => document.documentElement.classList.contains('modo-app')), 'modo app: clase modo-app');
  revisar(!(await app.isVisible('#conexion')), 'modo app: sin fila de conexión');
  revisar(!(await app.isVisible('#atajos')), 'modo app: sin atajos de teclado');
  await app.click('#tab-vivo');
  const caja = (sel) => app.$eval(sel, (e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  const sig = await caja('#siguiente'); const ocu = await caja('#ocultar');
  revisar(Math.abs(sig.y - ocu.y) < 4 && ocu.x > sig.x, 'modo app: Ocultar al lado de Siguiente');
  revisar((await app.textContent('#ocultar-sub')) === 'nada en pantalla', 'modo app: Ocultar dice «nada en pantalla»');
  const rs = await app.$$eval('#hoja-vivo [data-rotulo]', (bs) => bs.map((b) => { const r = b.getBoundingClientRect(); return { x: r.x, y: r.y, h: r.height }; }));
  revisar(rs.length >= 2 && Math.abs(rs[0].y - rs[1].y) < 2 && rs[1].x > rs[0].x, 'modo app: rótulos en dos columnas');
  revisar(rs.every((r) => r.h >= 44), 'modo app: botones de rótulo de 44 px o más');
  const teclas = await app.$$eval('#hoja-vivo [data-rotulo] .tecla', (ts) => ts.slice(0, 9).map((e, i) => { const r = e.getBoundingClientRect(); return e.textContent === String(i + 1) && r.width >= 20 && r.height >= 20; }));
  revisar(teclas.length >= 2 && teclas.every(Boolean), 'modo app: cada rótulo muestra su número en un cuadrito');
  await app.evaluate(() => window.fijarEscenaApp('camara'));
  await app.click('#hoja-vivo [data-rotulo]');
  await app.waitForTimeout(300);
  const nomPrimero = await app.textContent('#hoja-vivo [data-rotulo] .nom');
  revisar((await app.textContent('#ocultar-sub')).startsWith(nomPrimero) && (await app.textContent('#ocultar-sub')) !== 'nada en pantalla', 'modo app: Ocultar muestra el nombre del rótulo en pantalla');
  const altos = await app.$$eval('#hoja-vivo [data-rotulo]', (bs) => bs.map((b) => b.getBoundingClientRect().height));
  revisar(altos.length >= 2 && Math.abs(altos[0] - altos[1]) < 0.5 && (await app.getAttribute('#hoja-vivo [data-rotulo]', 'aria-pressed')) === 'true', 'modo app: un rótulo pulsado mide lo mismo que uno sin pulsar');
  const fin6 = await app.$$eval('#hoja-vivo [data-rotulo]', (bs) => bs.slice(0, 6).map((b) => b.getBoundingClientRect().bottom));
  revisar(fin6.every((f) => f <= 318), 'modo app: con un rótulo pulsado, los 6 primeros siguen dentro de 318 px');
  await app.click('#ocultar');

  console.log('Modo app: rótulos solo en Cámara');
  const rotuloEstado = () => panel.evaluate(() => JSON.parse(localStorage.getItem('parroquia_obs_estado_v1')).rotulo);
  const app2 = await abrir('panel.html?modo=app', 360, 318);
  await app2.waitForTimeout(600);
  await app2.click('#tab-vivo');
  const bl = () => app2.$$eval('[data-rotulo]', (bs) => bs.length > 0 && bs.every((b) => b.disabled && b.getAttribute('aria-disabled') === 'true'));
  const li = () => app2.$$eval('[data-rotulo]', (bs) => bs.length > 0 && bs.every((b) => !b.disabled && !b.hasAttribute('aria-disabled')));
  revisar(await bl(), 'solo en Cámara: recién cargado (sin avisar escena) los rótulos están bloqueados');
  revisar(await app2.$eval('#siguiente', (e) => e.disabled && e.getAttribute('aria-disabled') === 'true'), 'solo en Cámara: Siguiente bloqueado al cargar');
  revisar(await app2.evaluate(() => document.documentElement.classList.contains('fuera-de-camara')), 'solo en Cámara: <html> con clase fuera-de-camara');
  revisar((await app2.textContent('#siguiente .sub')) === 'Solo en Cámara' && await app2.isVisible('#siguiente .sub'), 'solo en Cámara: Siguiente dice «Solo en Cámara» y se ve');
  await app2.keyboard.press('1');
  await app2.keyboard.press('Space');
  await app2.keyboard.press('n');
  await app2.waitForTimeout(300);
  revisar((await rotuloEstado()) === 'ninguno', 'solo en Cámara: teclas 1, Espacio y N no sacan rótulo fuera de Cámara');
  await app2.evaluate(() => window.fijarEscenaApp('camara'));
  await app2.waitForTimeout(200);
  revisar(await li(), 'en Cámara: los rótulos se activan');
  revisar(await app2.$eval('#siguiente', (e) => !e.disabled && !e.hasAttribute('aria-disabled')), 'en Cámara: Siguiente activo');
  revisar(!(await app2.isVisible('#siguiente .sub')), 'en Cámara: el subtítulo de Siguiente vuelve a ocultarse en modo app');
  revisar(!(await app2.evaluate(() => document.documentElement.classList.contains('fuera-de-camara'))), 'en Cámara: sin clase fuera-de-camara');
  revisar((await rotuloEstado()) === 'ninguno', 'en Cámara: no se muestra ningún rótulo hasta tocar uno');
  const primero = await app2.$eval('[data-rotulo]', (b) => b.dataset.rotulo);
  await app2.click('[data-rotulo]');
  await app2.waitForTimeout(300);
  revisar((await rotuloEstado()) === primero, 'en Cámara: tocar un rótulo lo pone en el estado');
  await app2.evaluate(() => window.fijarEscenaApp('inicio'));
  await app2.waitForTimeout(300);
  revisar((await rotuloEstado()) === 'ninguno', 'al salir de Cámara el rótulo en pantalla se oculta');
  revisar(await bl(), 'al salir de Cámara los botones vuelven a bloquearse');
  revisar((await app2.textContent('#siguiente .sub')) === 'Solo en Cámara', 'al salir de Cámara Siguiente vuelve a decir «Solo en Cámara»');
  await app2.keyboard.press('1');
  await app2.waitForTimeout(300);
  revisar((await rotuloEstado()) === 'ninguno', 'fuera de Cámara la tecla 1 no hace nada');
  await app2.evaluate(() => window.fijarEscenaApp('camara'));
  await app2.waitForTimeout(300);
  revisar((await rotuloEstado()) === 'ninguno' && await li(), 'de vuelta en Cámara: el estado sigue en ninguno y los botones activos');
  await app2.keyboard.press('1');
  await app2.waitForTimeout(300);
  revisar((await rotuloEstado()) !== 'ninguno', 'en Cámara la tecla 1 sí saca el rótulo');
  await app2.evaluate(() => window.fijarEscenaApp('desconocida'));
  await app2.waitForTimeout(300);
  revisar((await rotuloEstado()) === 'ninguno' && await bl(), 'una escena desconocida cuenta como «no Cámara»');
  await app2.close();
  revisar(await panel.evaluate(() => typeof window.fijarEscenaApp === 'undefined'), 'panel de OBS: window.fijarEscenaApp no existe');
  await panel.click('#tab-vivo');
  revisar(await panel.$$eval('[data-rotulo]', (bs) => bs.length > 0 && bs.every((b) => !b.disabled && !b.hasAttribute('aria-disabled'))), 'panel de OBS: los botones de rótulo están activos sin tocar escenas');
  await panel.click('[data-rotulo]');
  await panel.waitForTimeout(300);
  revisar((await rotuloEstado()) !== 'ninguno', 'panel de OBS: tocar un rótulo funciona como siempre');
  await panel.waitForTimeout(1000);
  revisar((await rotuloEstado()) !== 'ninguno', 'panel de OBS: el rótulo se queda en pantalla (el ocultado por escena es solo del modo app)');
  await panel.click('#ocultar');
  await panel.waitForTimeout(200);

  console.log('Modo app: ocultar todo rótulo fuera de Cámara');
  await panel.click('[data-rotulo]');
  await panel.waitForTimeout(300);
  revisar((await rotuloEstado()) !== 'ninguno', 'preparación: hay un rótulo guardado antes de abrir el panel de la app');
  // Escribe el rótulo directo en el estado compartido, como lo haría otro cliente (sin pasar por el panel).
  const escribirRotulo = () => panel.evaluate(() => { const e = JSON.parse(localStorage.getItem('parroquia_obs_estado_v1')); e.rotulo = document.querySelector('[data-rotulo]').dataset.rotulo; e.rotuloHasta = 0; localStorage.setItem('parroquia_obs_estado_v1', JSON.stringify(e)); });
  const app3 = await abrir('panel.html?modo=app', 360, 318);
  await app3.waitForTimeout(800);
  revisar((await rotuloEstado()) === 'ninguno', 'rótulo guardado antes de cargar: al abrir en modo app queda en ninguno, sin llamar a fijarEscenaApp');
  await escribirRotulo();
  await app3.waitForTimeout(1000);
  revisar((await rotuloEstado()) === 'ninguno', 'rótulo escrito por otro cliente fuera de Cámara: el panel de la app lo oculta en 1 s');
  await app3.evaluate(() => window.fijarEscenaApp('camara'));
  await escribirRotulo();
  await app3.waitForTimeout(1000);
  revisar((await rotuloEstado()) !== 'ninguno', 'en Cámara el panel de la app no oculta rótulos ajenos');
  await app3.close();

  // Si el almacenamiento falla al escribir (cupo lleno), el panel sigue funcionando en memoria.
  await escribirRotulo();
  const erroresAntes = errores.length;
  const app4 = await ctx.newPage();
  app4.on('pageerror', (e) => errores.push('app4: ' + e.message));
  await app4.setViewportSize({ width: 360, height: 318 });
  await app4.addInitScript(() => { const orig = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k === 'parroquia_obs_estado_v1') throw new DOMException('cupo', 'QuotaExceededError'); return orig.call(this, k, v); }; });
  await app4.goto(url('panel.html?modo=app'));
  await app4.waitForTimeout(1200);
  revisar(errores.length === erroresAntes, 'escritura fallida con rótulo guardado fuera de Cámara: sin errores de JavaScript' + (errores.length > erroresAntes ? ' (' + errores.slice(erroresAntes, erroresAntes + 1) + ')' : ''));
  await app4.click('#tab-vivo');
  revisar(await app4.$$eval('[data-rotulo]', (bs) => bs.length > 0 && bs.every((b) => b.disabled)), 'escritura fallida: el panel sigue pintando y los rótulos bloqueados');
  revisar(await app4.evaluate(() => s.rotulo === 'ninguno'), 'escritura fallida: el estado en memoria queda en ninguno');
  errores.length = erroresAntes;
  await app4.close();
  await panel.evaluate(() => { const e = JSON.parse(localStorage.getItem('parroquia_obs_estado_v1')); e.rotulo = 'ninguno'; localStorage.setItem('parroquia_obs_estado_v1', JSON.stringify(e)); });
  // El tipo con más rótulos: los 6 primeros botones deben caber en los 318 px de alto.
  const masRotulos = await panel.evaluate(() => ORDEN_TIPOS.map((c) => [c, rotulosDe(normalizarEstado({ tipo: c })).length]).sort((a, b) => b[1] - a[1])[0][0]);
  await elegirTipo(masRotulos);
  await app.reload();
  await app.waitForTimeout(600);
  await app.click('#tab-vivo');
  const sig2 = await caja('#siguiente');
  const seis = await app.$$eval('#hoja-vivo [data-rotulo]', (bs) => bs.slice(0, 6).map((b) => { const r = b.getBoundingClientRect(); return { y: r.y, fin: r.bottom }; }));
  revisar(seis.length === 6 && seis.every((r) => r.y >= sig2.y + sig2.h - 1 && r.fin <= 318), 'modo app: con el tipo de más rótulos (' + masRotulos + '), los 6 primeros caben en 318 px, tras Siguiente');
  revisar(!(await panel.evaluate(() => document.documentElement.classList.contains('modo-app'))), 'panel de OBS sin modo app');
  revisar(await panel.evaluate(() => !!document.querySelector('.arriba #ocultar')), 'panel de OBS: Ocultar sigue en el encabezado');
  await app.close();

  for (const [n, p] of [['inicio', inicio], ['gracias', gracias], ['avisos', avisos], ['portada', portada], ['inicio_800x600', chica], ['panel', panel]]) {
    await p.screenshot({ path: path.join(salida, n + '.png'), fullPage: n === 'panel' });
  }

  console.log('Producción (pantalla final, Tarea 9d)');
  {
    // Estilo según la URL: claro, azul; sin estilo o con uno desconocido, Azul.
    const casos = [['produccion.html?estilo=claro', 'claro'], ['produccion.html?estilo=azul', 'azul'], ['produccion.html', 'azul'], ['produccion.html?estilo=rojo', 'azul']];
    const comunes = ['UNA PRODUCCIÓN DE', 'Comunicaciones', 'PARROQUIA DE CIUDAD ARCE'];
    for (const [archivo, esperado] of casos) {
      const p = await abrir(archivo, 1920, 1080);
      await p.waitForTimeout(300);
      const estilo = await p.evaluate(() => document.body.dataset.estilo);
      revisar(estilo === esperado, `${archivo} → estilo ${esperado} (salió ${estilo})`);
      const textos = await p.$$eval('[data-texto]', (es) => es.filter((e) => e.checkVisibility()).map((e) => e.textContent));
      const propio = esperado === 'claro' ? 'Parroquia Inmaculada Concepción de María · Ciudad Arce, La Libertad' : 'INMACULADA CONCEPCIÓN DE MARÍA · LA LIBERTAD';
      revisar(JSON.stringify(textos) === JSON.stringify([...comunes, propio]), `${archivo}: textos exactos (${JSON.stringify(textos)})`);
      const logos = await p.$$eval('img', (is) => is.filter((i) => i.checkVisibility()).map((i) => ({ alt: i.alt, src: i.getAttribute('src'), cargo: i.complete && i.naturalWidth > 0 })));
      revisar(logos.length === 1 && logos[0].alt.trim() !== '' && logos[0].cargo, `${archivo}: un logo visible, cargado y con alt`);
      revisar(logos[0] && logos[0].src === (esperado === 'claro' ? 'img/logo-color.png' : 'img/logo-blanco.png'), `${archivo}: usa ${logos[0] && logos[0].src}`);
      revisar(await p.$$eval('img', (is) => is.every((i) => i.alt.trim() !== '')), `${archivo}: todos los logos tienen alt`);
      const fuente = await p.evaluate(async () => { await document.fonts.ready; return document.fonts.check('900 40px Mont'); });
      revisar(fuente, `${archivo}: fuente Mont local cargada`);
      const sinRed = await p.evaluate(() => [...document.querySelectorAll('link[href],script[src],img[src]')].every((e) => !/^(https?:)?\/\//.test(e.getAttribute('href') || e.getAttribute('src'))));
      revisar(sinRed, `${archivo}: no pide nada a internet`);
      if (archivo.includes('estilo=' + esperado)) await p.screenshot({ path: path.join(salida, 'produccion-' + esperado + '.png') });
      await p.close();
    }
    // Escala igual que las demás: en 800×600 entra entera y centrada.
    const antes = await panel.evaluate(() => localStorage.getItem('parroquia_obs_estado_v1'));
    const pc = await abrir('produccion.html?estilo=azul', 800, 600);
    await pc.waitForTimeout(500);
    const r = await pc.$eval('.escenario', (e) => { const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; });
    revisar(Math.abs(r.w - 800) < 1 && Math.abs(r.h - 450) < 1 && Math.abs(r.x) < 1 && Math.abs(r.y - 75) < 1, `produccion en 800×600 escala a 800×450 centrada (${JSON.stringify(r)})`);
    revisar(antes === (await panel.evaluate(() => localStorage.getItem('parroquia_obs_estado_v1'))), 'produccion no cambia el estado del panel');
    revisar(await pc.evaluate(() => typeof leerEstado === 'undefined'),'produccion no carga comun.js (no lee el estado)');
    await pc.close();
  }

  console.log('Errores de JavaScript');
  revisar(errores.length === 0, errores.length ? errores.join('\n') : 'ninguno');
  await b.close();
  console.log(fallos ? `\n${fallos} prueba(s) fallaron.` : '\nTodo bien. Capturas en pruebas/capturas/');
  process.exit(fallos ? 1 : 0);
})();
