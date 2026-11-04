# Parroquia OBS · Inmaculada Concepción de María, Ciudad Arce

Pantallas, rótulos y panel de control para las transmisiones en vivo con **OBS Studio (Windows)**:
11 tipos de transmisión: misa dominical, entre semana, Hora Santa, misa en sector, patronal de sector, procesión,
misa de otro santo, prenovena, novena, fiesta patronal del **8 de diciembre** y eventos especiales.

Son páginas HTML estáticas, sin websockets ni plugins, publicadas en **Vercel**
(`https://parroquia-transmision.vercel.app`) y cargadas en OBS como *fuentes de navegador* y un
*dock de navegador personalizado* que hace de panel de control. Si falla el internet, la carpeta `obs/`
funciona igual desde el disco con direcciones `file:///` (ver «Respaldo sin internet»).

![Pantalla de inicio](docs/capturas/inicio.png)

## Qué hay en el repositorio

| Carpeta / archivo | Para qué sirve |
|---|---|
| `obs/panel.html` | Panel de control (dock de OBS). Pestañas **Preparar · En vivo · Guardadas**. |
| `obs/pantalla.html?tipo=…` | Pantallas completas: `inicio`, `portada`, `gracias`, `avisos`. |
| `obs/rotulos.html` | Capa transparente sobre la cámara: logo, EN VIVO, barra del título y rótulos animados. |
| `obs/tipos.js` | Catálogo de los tipos de transmisión y de los rótulos (todos los textos y el orden de los rótulos). |
| `obs/comun.js` | Estado compartido, textos automáticos y utilidades (lo usan todas las páginas). |
| `obs/guardadas.js` | Transmisiones guardadas (solo lo usa el panel). |
| `obs/estilos.css` | Diseño y animaciones. |
| `obs/img/`, `obs/fuentes/` | Imágenes (Virgen A/B/C, fachada, logos) y tipografías locales. Si falta la imagen de un tipo, se usa la fachada. |
| `obs/LEEME - Instrucciones.txt` | Instalación paso a paso en OBS (para el equipo de transmisión). |
| `transiciones/` | Transiciones Stinger `.webm` con transparencia (2000 ms, punto de transición 1000 ms). |
| `herramientas/transiciones/` | Plantillas y script para volver a generar las transiciones. |
| `pruebas/prueba.js` | Prueba automática del panel y las pantallas. |
| `CLAUDE.md` | Contexto del proyecto para Claude Code. |
| `PROMPT_PARA_CLAUDE.md` | Prompt para empezar a trabajar con Claude Code en este repositorio. |

## Uso del panel

El panel tiene tres pestañas:

- **Preparar** (antes de la misa): elegir **qué se transmite** (el tipo), llenar los datos y los rótulos, y revisar la
  lista **«Faltan N datos»** (cada línea lleva al campo que falta; cuando está completo dice «Todo listo»). Aquí también
  se ajustan la imagen, la esquina y la cuenta regresiva, los avisos y los textos de las pantallas.
- **En vivo** (durante la misa): sin campos de texto, solo botones: «Siguiente», un botón por rótulo, cuánto tiempo
  queda en pantalla y el logo, EN VIVO y la barra. Atajos: **1 a 9** muestran u ocultan ese rótulo, **Espacio** o **N**
  = siguiente (solo con En vivo abierta, para no sacar nada al aire por accidente); **Esc** oculta el rótulo desde
  cualquier pestaña.
- **Guardadas**: guardar la transmisión actual con un nombre (p. ej. «Hora Santa jueves») y **cargar, duplicar o borrar**
  las que ya hay. Cargar una trae todos los datos pero **nunca deja un rótulo en pantalla**. Las guardadas viven en el
  navegador del panel y en ese dominio: la dirección de Vercel y `file:///` guardan por separado, y no se pueden exportar.

Al **cambiar de tipo**, la imagen, la esquina y la cuenta regresiva vuelven a ser automáticas; los datos, los rótulos
y los avisos se quedan. Las direcciones de OBS no cambian.

## Instalación rápida en OBS

1. **Docks → Docks de navegador personalizados**: nombre `Panel Parroquia`, URL
   `https://parroquia-transmision.vercel.app/panel.html`
2. En cada escena, **Fuente → Navegador**, *sin* marcar «Archivo local», **1920 × 1080**:

   | Escena | URL |
   |---|---|
   | Inicio | `https://parroquia-transmision.vercel.app/pantalla.html?tipo=inicio` |
   | Portada 8 de diciembre | `https://parroquia-transmision.vercel.app/pantalla.html?tipo=portada` |
   | Avisos | `https://parroquia-transmision.vercel.app/pantalla.html?tipo=avisos` |
   | Gracias | `https://parroquia-transmision.vercel.app/pantalla.html?tipo=gracias` |
   | Misa (sobre la cámara) | `https://parroquia-transmision.vercel.app/rotulos.html` |

3. Transición: **Stinger** con `transiciones/Transicion_2000ms_Logo.webm` (o `_Virgen`), punto de transición **1000 ms**.
   Las transiciones son archivos locales: clone o copie el repositorio, por ejemplo en `C:\parroquia-obs`.

> Importante: panel y fuentes deben usar **exactamente el mismo dominio** (`parroquia-transmision.vercel.app`)
> para compartir el mismo almacenamiento. Otro dominio de Vercel, una dirección `file:///` o «Archivo local»
> en una sola fuente hacen que esa fuente no reciba los cambios del panel.

### Respaldo sin internet

Si falla el internet y OBS no puede cargar una página, cambie **todas** las direcciones (panel y fuentes) a la
copia local, por ejemplo `file:///C:/parroquia-obs/obs/panel.html`, `file:///C:/parroquia-obs/obs/pantalla.html?tipo=inicio`, etc.
Los textos escritos en el panel no pasan de una dirección a la otra: hay que volver a escribirlos.

## Desarrollo

Requisitos: [Node.js LTS](https://nodejs.org) y, para las transiciones, [ffmpeg](https://www.gyan.dev/ffmpeg/builds/) en el PATH.

```powershell
npm install
npx playwright install chromium
npm run prueba:unidad   # prueba los módulos de obs/ sin navegador
npm run prueba          # prueba el panel y las pantallas, guarda capturas en pruebas/capturas
npm run transiciones    # vuelve a generar los .webm de transiciones/
```

Para ver los cambios sin OBS: abra `obs/panel.html` y `obs/pantalla.html?tipo=inicio` en Chrome o Edge
(en el mismo navegador) y cambie cosas en el panel.

**Publicar:** cada `git push` a `main` publica la carpeta `obs/` en Vercel en unos segundos
(proyecto `parroquia-transmision`). Hasta el push, OBS sigue mostrando la versión anterior.

En OBS, después de publicar: clic derecho en la fuente → **Propiedades → Actualizar caché de la página actual**,
y en el panel clic derecho → **Recargar**.

## Diseño

- Colores: azul oscuro `#0c3562`, azul rey `#1155a4`, azul medio `#157ec1`, celeste `#3d9be0`, celeste claro `#8cc0ef`, rojo EN VIVO `#dd0300`.
- Tipografías: **Montserrat** (500–900) y **Great Vibes** (frases en cursiva). Licencia SIL OFL.
- Imágenes de la Virgen: A «La Colosal» (Murillo) y B (Tiepolo), dominio público (Wikimedia Commons); C, imagen de las pantallas originales de la parroquia.
- Diseño de referencia (Claude Design, privado): https://claude.ai/artifact/PNAgq8yG9VYeJgG8J68jCW
