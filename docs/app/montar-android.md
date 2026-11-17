# Preparar una computadora para compilar la app

Para quien mantiene la app, no para el voluntario. Es Windows; lo que sigue es lo que se usa hoy en la
computadora donde se armó la app (comprobado el 2026-11-16).

## 1. Programas

| Programa | Versión que se usa hoy | Para qué |
|---|---|---|
| [Node.js](https://nodejs.org) | 22.16.0 | Expo, Metro y los tests |
| JDK | 17 (17.0.11) | Gradle |
| [Android Studio](https://developer.android.com/studio) | — | El SDK de Android y `adb` |
| Git | — | Bajar el repositorio |

En Android Studio: **More Actions → SDK Manager** e instalar el SDK de Android que pida la compilación
(Gradle avisa cuál falta) y **Android SDK Platform-Tools**, que trae `adb`.

## 2. Variables de entorno

En **Editar las variables de entorno del sistema → Variables de entorno**, para su usuario:

- `ANDROID_HOME` = `C:\Users\<usuario>\AppData\Local\Android\Sdk`
- `JAVA_HOME` = la carpeta del JDK 17, por ejemplo `C:\Program Files\Java\jdk-17`
- En `Path`, agregar `%ANDROID_HOME%\platform-tools`

Cierre y abra la terminal, y compruebe:

```bash
node -v
java -version
adb version
```

## 3. El repositorio, en una ruta corta

```bash
git clone https://github.com/cFabricio23r/parroquia-transmision.git C:\parroquia-obs
```

Use una ruta corta como `C:\parroquia-obs`. La compilación nativa de Android arma rutas muy largas y con una
carpeta muy adentro puede fallar.

## 4. La configuración de la app: `app/.env.local`

La app no arranca sin este archivo («La app está mal armada…»). No va a git. Créelo con:

```
EXPO_PUBLIC_PLATAFORMA_ORIGEN=https://plataforma-vicaria.vercel.app
EXPO_PUBLIC_SUPABASE_URL=https://<proyecto>.supabase.co
EXPO_PUBLIC_SUPABASE_CLAVE_PUBLICA=sb_publishable_…
```

Los valores de Supabase están en el panel del proyecto, en la parte de claves de API. Va la clave
**publicable** (`sb_publishable_…`). La secreta (`sb_secret_…`) nunca va en la app: si se pone, la app la
rechaza.

## 5. El celular

1. En el celular (así es en el Samsung de la parroquia; en otras marcas cambia el camino):
   **Ajustes → Acerca del teléfono → Información de software**, tocar 7 veces **Número de compilación**.
   Aparece **Opciones de desarrollador**.
2. En **Opciones de desarrollador**, activar **Depuración por USB**.
3. Conectarlo por USB, aceptar el aviso en el celular y comprobar que aparece:

```bash
adb devices
```

## 6. Compilar e instalar

Los comandos van en **Git Bash**, cada bloque desde la carpeta del repositorio (`C:\parroquia-obs`).

Para probar mientras se programa (con Metro):

```bash
cd app && npm install && npm run android
```

`npm run android` copia antes las páginas de `vicaria/` a la app (`copiar-vicaria`).

Para el APK que se usa en la misa (release, sin computadora):

```bash
cd app && npm install && node scripts/copiar-vicaria.js && npx expo prebuild --platform android
```

```bash
cd app/android && ./gradlew :app:createBundleReleaseJsAndAssets --rerun -q && ./gradlew assembleRelease -q
```

```bash
adb install -r app/android/app/build/outputs/apk/release/app-release.apk
```

- `--rerun` hace falta: sin él, Gradle puede reusar el JavaScript viejo y no toma los cambios de
  `.env.local` ni del código.
- El APK queda firmado con la clave de depuración, así que se instala encima de la app que ya está.

## 7. Tests

```bash
cd app && npx jest && npx tsc --noEmit
```
