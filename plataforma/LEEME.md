# plataforma/

App Next.js (16.4.5) de la plataforma multiparroquia. En esta etapa sirve las pantallas estáticas de `vicaria/` y tiene un `/editor` mínimo.

## Cómo funciona

- `npm run dev` y `npm run build` corren antes `herramientas/copiar-vicaria.mjs` (`predev` / `prebuild`): copia `vicaria/` a `public/` (sin `vercel.json` ni `LEEME-config.md`) y escribe `lib/generado/slugs-del-repo.json`. Ambos se generan, no se versionan.
- `npm run build` corre además `herramientas/descargar-publicado.mjs` (solo `prebuild`): baja de Supabase, con la clave publicable, el `config.json` de cada parroquia publicada y sus imágenes a `public/<slug>/`. Necesita `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; si Supabase no responde, el build falla (Vercel conserva el despliegue anterior). Una parroquia que no se puede traer (config inválido, `src` con forma rara, slug inválido, imagen que falta) también hace fallar el build, con una línea `ERROR:` que la nombra: omitirla la borraría del despliegue nuevo. `copiar-vicaria.mjs` (predev, prebuild y pretest*) genera además `lib/generado/fuentes-vicaria.mjs`, que `lib/validar-nucleo.mjs` importa para que el texto de los scripts quede dentro del bundle de Vercel.
- `next.config.ts` lee `../vicaria/vercel.json` y devuelve sus `rewrites` y `headers` sin cambios: es la única fuente de verdad, igual que `herramientas/servidor-vicaria.js`.
- `.env.example` lista las variables. Los secretos (`SUPABASE_SECRET_KEY`, `RESEND_API_KEY`, `VERCEL_DEPLOY_HOOK_URL`) nunca llevan `NEXT_PUBLIC_`.
- Pruebas: `npm --prefix plataforma test` (unidad) y `npm --prefix plataforma run test:integracion`. `npm run test:navegador` (Playwright, Chromium) levanta `next dev` en el puerto 3100 contra el Supabase local y corre `pruebas/navegador/*.mjs`; la primera vez hace falta `npx playwright install chromium`.

## Archivo que refresca la sesión (Tarea 4)

En Next 16 se llama **`proxy.ts`** (ya no `middleware.ts`). Va en la raíz de `plataforma/`, al mismo nivel que `app/` (no usamos `src/`). Exporta una función `proxy` (o `export default`). Corre en Node.js por defecto.

Fuentes:

- Documentación de Next incluida en el paquete instalado: `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` («The `middleware` file convention is deprecated and has been renamed to `proxy`»; tabla de versiones: v16.0.0).
- Versión en línea de esa misma página: https://nextjs.org/docs/app/api-reference/file-conventions/proxy
- Guía de Supabase para Next.js (consultada el 2026-11-08): https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs — dice que Next.js 16 renombró el archivo a `proxy.ts`, que antes era `middleware.ts`, y que en Next 15 o anterior un `proxy.ts` nunca se ejecuta (la sesión no se refresca).

Esta tarea no instaló `@supabase/ssr`; la Tarea 4 verifica su API al usarla.

## Notas

- `AGENTS.md` lo genera `next dev` (aviso de que Next 16 difiere de lo que se recuerda). Se versiona para que `next dev` no deje la carpeta sucia.
- Los patrones `:pagina(panel|pantalla|rotulos|produccion).html` de `vercel.json` los aplica Next tal cual (comprobado con `next dev`, sin adaptar nada).
