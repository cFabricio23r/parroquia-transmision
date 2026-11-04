# Prompt para empezar con Claude Code

Abra una terminal en la carpeta del repositorio (por ejemplo `C:\parroquia-obs`), ejecute `claude`
y pegue el siguiente mensaje. Cambie la última parte por el ajuste que necesite.

---

Hola. Este repositorio tiene los gráficos en vivo para OBS de la Parroquia Inmaculada Concepción de María,
Ciudad Arce: pantallas completas (inicio, portada del 8 de diciembre, avisos y gracias), una capa transparente
con rótulos animados (celebrante, primera lectura, salmo, segunda lectura, evangelio y Santo Rosario) y un panel
de control que se usa como dock dentro de OBS. Todo es HTML/CSS/JS estático, sin websockets,
publicado en Vercel (`https://parroquia-transmision.vercel.app`) con cada push a `main`.

Antes de cambiar nada:
1. Lee `CLAUDE.md` y `README.md` completos.
2. Revisa `obs/comun.js`, `obs/panel.html`, `obs/pantalla.html`, `obs/rotulos.html` y `obs/estilos.css`.
3. Instala lo necesario (`npm install` y `npx playwright install chromium`) y corre `npm run prueba`
   para confirmar que todo funciona. Mira las capturas de `pruebas/capturas/`.

Reglas:
- Respóndeme en español y escribe la interfaz y los comentarios en español.
- Respeta el diseño actual (colores, tipografías, franja inferior, rótulos) salvo que te pida cambiarlo.
- No agregues CDNs, servicios externos ni websockets: la carpeta `obs/` debe seguir funcionando también
  sin internet, con `file:///`, como respaldo.
- Los cambios llegan a OBS solo después de `git push` a `main`.
- Si agregas un campo al estado, ponlo en `PREDETERMINADO` para no romper lo que ya está guardado.
- Después de cada cambio, corre `npm run prueba`, revisa las capturas y dime qué cambió y cómo actualizarlo en OBS.
- Si necesito volver a generar las transiciones, usa `npm run transiciones` (requiere ffmpeg en el PATH).
- Haz commits pequeños con mensajes claros en español.

El ajuste que necesito ahora es:
[Escriba aquí lo que quiere cambiar. Ejemplos:
 - "Agrega un rótulo para el Credo / la Oración de los fieles."
 - "Quiero una pantalla nueva para la procesión con el horario."
 - "Haz que el rótulo del celebrante permita poner dos nombres."
 - "Cambia la frase de la franja inferior según el día de la novena."]
