# CLAUDE.md — Parroquia OBS

Gráficos en vivo para OBS Studio (Windows) de la **Parroquia Inmaculada Concepción de María, Ciudad Arce (El Salvador)**.
Se usan en 11 tipos de transmisión (misa dominical, entre semana, Hora Santa, misa en sector, patronal de sector,
procesión, misa de otro santo, prenovena, novena, fiesta patronal del 8 de diciembre y evento especial).
El usuario y el equipo de transmisión hablan **español**: toda la interfaz, los textos, los comentarios del código
y los mensajes van en español.

## Reglas que no se rompen

1. **Sitio estático, sin dependencias externas.** OBS carga las páginas desde Vercel
   (`https://parroquia-transmision.vercel.app`, publica solo `obs/`, se despliega solo con cada push a `main`).
   Nada de websockets, obs-websocket, servidores, funciones, CDNs ni Google Fonts: fuentes e imágenes son
   archivos propios en `obs/fuentes` y `obs/img`, con rutas relativas. Así la carpeta `obs/` sigue funcionando
   también sin internet, con `file:///`, como respaldo.
2. **Comunicación panel ↔ pantallas** solo por `localStorage` (clave `parroquia_obs_estado_v1`) + `BroadcastChannel('parroquia_obs')`.
   Las páginas también revisan `localStorage` cada 300 ms como respaldo. El panel es el único que escribe el estado;
   las pantallas solo leen y escriben su «latido» en `parroquia_obs_latido_v1`.
3. **Un solo origen en OBS.** Panel y fuentes usan todos `https://parroquia-transmision.vercel.app/…`
   (o todos `file:///` en el respaldo sin internet). Mezclar orígenes —otro dominio de Vercel, `file:///` o
   «Archivo local»— separa el almacenamiento y esa fuente deja de recibir los cambios del panel.
4. **Escenario fijo de 1920×1080** dentro de `.escenario`, escalado con `escalarEscenario()` (en `comun.js`) para
   cualquier tamaño de fuente. Todo se diseña en píxeles de 1920×1080.
5. **Texto siempre con `textContent`** (nunca `innerHTML` con datos del panel). Los saltos de línea se muestran con
   la clase `.multilinea` (`white-space: pre-line`).
6. El diseño ya fue aprobado por el usuario: **no cambiar colores, tipografías ni la estructura visual** salvo que lo pida.

## Archivos

- `obs/tipos.js` — catálogo de contenido, cargado **antes** de `comun.js` en las 3 páginas (script clásico).
  `TIPOS` (los 11 tipos: títulos, frases, imagen, esquina, cuenta, lista de rótulos y datos que pide) y `ORDEN_TIPOS`
  (orden de los botones del panel); `ROTULOS` (las 10 bases de rótulo con su ceja); `CARGOS` (sugerencias del cargo
  del rótulo «persona»); `tipoDe(s)` (tipo del estado; clave desconocida = dominical); `rellenar(plantilla, s)`
  (`{dia}` `{santo}` `{sector}` `{lugar}` `{evento}` `{anio}`; dato vacío = `[santo]`); `rotulosDe(s)` (rótulos del
  tipo con su texto ya resuelto). **Todo valor de contenido vive solo aquí.**
- `obs/guardadas.js` — solo del panel (después de `tipos.js` y `comun.js`): guardar, cargar, duplicar y borrar
  transmisiones. Clave `parroquia_obs_guardadas_v1`; si lo guardado es ilegible, copia el texto original a
  `parroquia_obs_guardadas_v1_respaldo` antes de escribir. Viven en ese navegador y en ese dominio: Vercel y
  `file:///` son almacenes separados y no hay exportar. Lo guardado no incluye `rotulo`, `rotuloHasta` ni
  `rotuloDesde`: cargar una transmisión nunca deja un rótulo en pantalla.
- `obs/comun.js` — `PREDETERMINADO` (forma del estado), `normalizarEstado` (migra estados viejos),
  `leerEstado/guardarEstado/escucharEstado`, `latir`, `diasFaltan` (cuenta regresiva automática al 8 de diciembre),
  `tituloCelebracion`, `textosBase(s)` (textos automáticos por celebración), `tx(s, clave)` (texto escrito a mano o
  el automático), `esquinaDe`, `imagenDe`, `ajustarTexto`, `escalarEscenario`.
- `obs/pantalla.html?tipo=inicio|portada|gracias|avisos` — una sola página con cuatro vistas (`#v-inicio`, etc.).
  Animaciones: Ken Burns en la fachada, rayos que giran, chispas, Virgen flotando, entrada escalonada (`.entra`)
  que se repite cuando cambia la «firma» de la vista (celebración/día), no al escribir cada letra.
- `obs/rotulos.html` — capa transparente. Rótulo con máquina de estados: `entrar` (clase `.en`, animación por etapas),
  `salir` (clase `.sale`, 430 ms), cambio de rótulo = sale y entra; mismo rótulo con texto nuevo = solo anima el texto (`.cambia`).
  La barra del título se oculta mientras hay un rótulo.
- `obs/panel.html` — dock (Panel 2.0). Tres pestañas: **Preparar** (elegir el tipo, lista «Faltan N datos», datos,
  campos de los rótulos, imagen/esquina/cuenta, y los avisos y textos en secciones plegables), **En vivo** (sin campos
  de texto: botón «Siguiente», rótulos, duración, logo/EN VIVO/barra) y **Guardadas**. Los rótulos y el orden de
  «Siguiente» salen de `rotulosDe(s)` (o sea, de `tipos.js`). Atajos: 1–9, Espacio, Enter y N **solo con En vivo abierta**;
  Esc en cualquier pestaña. Cambiar de tipo vuelve a automático la imagen, la esquina y la cuenta regresiva; los
  datos, rótulos y avisos se quedan. `ESQUEMA` define los textos editables.
- `obs/estilos.css` — tokens de color en `:root`, componentes y la sección «ANIMACIONES».
- `herramientas/transiciones/` — `stinger.html` y `stinger_virgen.html` (animación con `window.setFrame(t)`),
  `render.js` (Playwright → PNG → ffmpeg VP9 con alfa + sonido sintetizado). Punto de transición = mitad de la duración.

## Estado (resumen de campos)

`tipo` (una clave de `TIPOS`: dominical|semana|horasanta|sector|patronalsector|procesion|otros|prenovena|novena|patronal|evento),
`prenovenaDia`, `novenaDia`, `santo`, `sector`, `fecha` (AAAA-MM-DD), `lugar`, `evento`, `cuenta` (`null` = la del tipo,
`true`/`false` = forzada), `diasManual`, `frase` (vacío = la franja del tipo), `imagen` (vacío = la del tipo; clave
como `virgen-a`, `santo`, `custodia`), `esquina` (vacío = la del tipo; `hoy`|`fecha`|`fiesta`|`texto`), `esquinaTexto`,
`parroquia`, `celebranteRol`, `celebrante`, `lectura1`, `salmoNum`, `salmoResp`, `lectura2`, `evangelio`, `rosario`,
`mostrarLogo`, `mostrarEnVivo`, `mostrarBarra`, `barraTexto`, `rotulo`, `rotuloHasta`, `rotuloDesde`, `duracionSeg`,
`rotulosTexto{idRotulo: {k,t,s}}`, `avisos[4]{a,f}`, `textos{clave: texto}`. `mostrarCuenta` queda solo para migrar.
Si se agrega un campo: ponerlo en `PREDETERMINADO` (así los estados viejos guardados siguen funcionando).
Migraciones en `normalizarEstado`: `virgen` a|b|c → `imagen` `virgen-a|b|c`; rótulo `celebrante` → `persona`;
`mostrarCuenta:false` → `cuenta:false` (una sola vez); la frase antigua `«TODA HERMOSA ERES, MARÍA»` → `''`.

## Recetas

- **Nuevo texto editable**: agregar la clave con su valor automático en `textosBase()`, usar `tx(s,'clave')` donde se
  pinta, y agregar `['clave','Nombre visible']` en `ESQUEMA` del panel (con `,1` si es de varias líneas).
- **Nuevo tipo de transmisión**: una entrada en `TIPOS` de `tipos.js` y su clave en `ORDEN_TIPOS` (ahí se decide el
  lugar del botón). Copiar uno parecido. Necesita: `nombre`, `descripcion`, `titulo`, `ceja`, `cursiva`, `franja`,
  `graciasCursiva`, `graciasPie`, `barra`, `imagen`, `esquina` (+ `esquinaTexto` si es `texto`), `cuenta`
  (`false`, o `{ hasta, texto[, desdeDias] }`), `rotulos` (lista de usos) y `datos` (qué pide el panel: `dia`, `santo`,
  `sector`, `fecha`, `lugar`, `evento`; si un texto usa `{santo}` o `{sector}`, el tipo debe pedir ese dato). Las claves
  de tipo existentes (`dominical`, `otros`, `prenovena`, `novena`, `patronal`) no se cambian.
- **Nuevo rótulo**: una base en `ROTULOS` (`{ ceja }`) y un uso en la lista `rotulos` de cada tipo que lo lleve:
  `{ id, base, nombre[, ceja, texto] }`. Con eso basta, sin tocar la lógica (la entrada en `ROTULOS` sigue siendo un dato): `rotulosDe()` (rama `default`) toma la ceja de
  `ROTULOS[base].ceja` y los textos de `rotulosTexto[id]`, y `camposDe()` del panel (rama `default`) da los campos
  Título / Texto / Texto opcional, como `libre`; el aviso de «falta» cae a «el texto» (`FALTA[base]`) y `rotulos.html`
  no lee `base`. Solo una base con campos o lógica propios necesita su caso en **los dos** sitios: `rotulosDe()` en
  `tipos.js` y `camposDe()` en `panel.html` (hoy tienen caso en ambos `persona`, `lectura1/2`, `evangelio`, `salmo`, `rosario` y `lugar`; `santisimo` y
  `oracion` solo en `camposDe()`), y de forma opcional una entrada en `FALTA` (`panel.html`). Un uso `persona` con `ceja` propia (Guía) guarda su nombre en `rotulosTexto[id].t`, no en `s.celebrante`.
  Los atajos 1–9 cubren los nueve primeros usos.
- **Nueva pantalla completa**: nueva vista `<div class="texto" id="v-NOMBRE" hidden>` en `pantalla.html`, su rama en
  `pintar()` y la fila en README/LEEME con `?tipo=NOMBRE`.
- **Nueva imagen**: un PNG recortado en `obs/img/` con el nombre de la clave (`obs/img/NOMBRE.png`, ver `imagenDe()`)
  y la clave en `IMAGENES` del panel (es el botón). Si el archivo no existe, la pantalla cae a la fachada (así pasa
  hoy con `custodia` y `santo`).

## Probar

```powershell
npm install
npx playwright install chromium
npm run prueba:unidad   # módulos de obs/ sin navegador (pruebas/unidad.js)
npm run prueba          # panel y pantallas en el navegador
```
`pruebas/prueba.js` abre panel y pantallas en el mismo contexto del navegador (igual que OBS), cambia datos y revisa
que lleguen. Siempre correrla después de un cambio y mirar las capturas de `pruebas/capturas/`.
Si un cambio afecta lo que se ve, revisar también `inicio_800x600.png` (tamaño por defecto de una fuente nueva en OBS).

## Pendiente de confirmar (contenido, no verificado)

Salió de la especificación y está sin confirmar con la parroquia. Cada punto se corrige en una línea de `tipos.js`:

- El **orden de los rótulos** de la Hora Santa y de la procesión.
- La **ventana de 60 días** (`desdeDias`) de la cuenta regresiva de la misa dominical.
- Los **textos inventados** de los tipos nuevos (frases, cejas, pies, textos de «Gracias»).
- **Imágenes que faltan**: `custodia` (Hora Santa) y el santo de cada sector / Medalla Milagrosa (`santo`). Sin el
  PNG en `obs/img/`, esas pantallas muestran la fachada.

## Después de cambiar algo en OBS

Los cambios llegan a OBS solo después de `git push` a `main` (Vercel publica en segundos).
Clic derecho en la fuente → Propiedades → «Actualizar caché de la página actual». En el dock: clic derecho → Recargar.
