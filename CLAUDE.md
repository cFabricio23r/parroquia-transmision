# CLAUDE.md — Parroquia OBS

Gráficos en vivo para OBS Studio (Windows) de la **Parroquia Inmaculada Concepción de María, Ciudad Arce (El Salvador)**.
Se usan en misas dominicales, misas de otros santos, prenovena, novena y la Misa Patronal del 8 de diciembre.
El usuario y el equipo de transmisión hablan **español**: toda la interfaz, los textos, los comentarios del código
y los mensajes van en español.

## Reglas que no se rompen

1. **Todo dentro de OBS y sin internet.** Nada de websockets, obs-websocket, servidores, CDNs ni Google Fonts.
   Fuentes e imágenes son archivos locales en `obs/fuentes` y `obs/img`.
2. **Comunicación panel ↔ pantallas** solo por `localStorage` (clave `parroquia_obs_estado_v1`) + `BroadcastChannel('parroquia_obs')`.
   Las páginas también revisan `localStorage` cada 300 ms como respaldo. El panel es el único que escribe el estado;
   las pantallas solo leen y escriben su «latido» en `parroquia_obs_latido_v1`.
3. **Direcciones `file:///`** en OBS (no «Archivo local», que usa otro origen y rompe el almacenamiento compartido).
4. **Escenario fijo de 1920×1080** dentro de `.escenario`, escalado con `escalarEscenario()` (en `comun.js`) para
   cualquier tamaño de fuente. Todo se diseña en píxeles de 1920×1080.
5. **Texto siempre con `textContent`** (nunca `innerHTML` con datos del panel). Los saltos de línea se muestran con
   la clase `.multilinea` (`white-space: pre-line`).
6. El diseño ya fue aprobado por el usuario: **no cambiar colores, tipografías ni la estructura visual** salvo que lo pida.

## Archivos

- `obs/comun.js` — `PREDETERMINADO` (forma del estado), `leerEstado/guardarEstado/escucharEstado`, `latir`,
  `diasFaltan` (cuenta regresiva automática al 8 de diciembre), `tituloCelebracion`, `textosBase(s)` (textos
  automáticos por celebración), `tx(s, clave)` (texto escrito a mano o el automático), `ajustarTexto`, `escalarEscenario`.
- `obs/pantalla.html?tipo=inicio|portada|gracias|avisos` — una sola página con cuatro vistas (`#v-inicio`, etc.).
  Animaciones: Ken Burns en la fachada, rayos que giran, chispas, Virgen flotando, entrada escalonada (`.entra`)
  que se repite cuando cambia la «firma» de la vista (celebración/día), no al escribir cada letra.
- `obs/rotulos.html` — capa transparente. Rótulo con máquina de estados: `entrar` (clase `.en`, animación por etapas),
  `salir` (clase `.sale`, 430 ms), cambio de rótulo = sale y entra; mismo rótulo con texto nuevo = solo anima el texto (`.cambia`).
  La barra del título se oculta mientras hay un rótulo.
- `obs/panel.html` — dock. Pestañas En vivo / Preparar / Avisos / Textos. `ORDEN` define los rótulos y el botón
  «Siguiente» (orden de la misa). Atajos: 1–6, Espacio, Esc. `ESQUEMA` define los textos editables de la pestaña Textos.
- `obs/estilos.css` — tokens de color en `:root`, componentes y la sección «ANIMACIONES».
- `herramientas/transiciones/` — `stinger.html` y `stinger_virgen.html` (animación con `window.setFrame(t)`),
  `render.js` (Playwright → PNG → ffmpeg VP9 con alfa + sonido sintetizado). Punto de transición = mitad de la duración.

## Estado (resumen de campos)

`tipo` (dominical|otros|prenovena|novena|patronal), `prenovenaDia`, `novenaDia`, `santo`, `mostrarCuenta`, `diasManual`,
`frase`, `virgen` (a|b|c), `parroquia`, `celebranteRol`, `celebrante`, `lectura1`, `salmoNum`, `salmoResp`, `lectura2`,
`evangelio`, `rosario`, `mostrarLogo`, `mostrarEnVivo`, `mostrarBarra`, `barraTexto`, `rotulo`, `rotuloHasta`,
`rotuloDesde`, `duracionSeg`, `avisos[4]{a,f}`, `textos{clave: texto}`.
Si se agrega un campo: ponerlo en `PREDETERMINADO` (así los estados viejos guardados siguen funcionando).

## Recetas

- **Nuevo texto editable**: agregar la clave con su valor automático en `textosBase()`, usar `tx(s,'clave')` donde se
  pinta, y agregar `['clave','Nombre visible']` en `ESQUEMA` del panel (con `,1` si es de varias líneas).
- **Nuevo rótulo**: caso en `contenido()` de `rotulos.html`, entrada en `ORDEN` del panel (y su campo en «Preparar»),
  campo en `PREDETERMINADO`. Los atajos 1–6 cubren los seis primeros.
- **Nueva pantalla completa**: nueva vista `<div class="texto" id="v-NOMBRE" hidden>` en `pantalla.html`, su rama en
  `pintar()` y la fila en README/LEEME con `?tipo=NOMBRE`.
- **Nueva imagen de la Virgen**: PNG recortado en `obs/img/virgen-d.png`, botón `data-virgen="d"` en el panel, permitir
  `'d'` en `imagenVirgen()` y, si hace falta, tamaño en `.virgen.d`.

## Probar

```powershell
npm install
npx playwright install chromium
npm run prueba
```
`pruebas/prueba.js` abre panel y pantallas en el mismo contexto del navegador (igual que OBS), cambia datos y revisa
que lleguen. Siempre correrla después de un cambio y mirar las capturas de `pruebas/capturas/`.
Si un cambio afecta lo que se ve, revisar también `inicio_800x600.png` (tamaño por defecto de una fuente nueva en OBS).

## Después de cambiar algo en OBS

Clic derecho en la fuente → Propiedades → «Actualizar caché de la página actual». En el dock: clic derecho → Recargar.
