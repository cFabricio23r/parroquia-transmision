# Prueba técnica de la app Android (Tarea 1)

Fecha: 2026-11-05. Teléfono: Samsung SM-S948B, Android 17 (SDK 37). App de prueba `com.parroquia.prueba`
(Expo ~58.0.23, React Native 0.88.1, `react-native-webview` 14.0.1, targetSdk 36), con un módulo local de Android y
RootEncoder **2.8.1** (`com.github.pedroSG94.RootEncoder:library:2.8.1`, jitpack).

La app de prueba se descarta. Lo que queda es este informe.

## Cómo se probó

- **Nunca se transmitió a Facebook.** El teléfono transmitió a un receptor local en la PC:
  `ffmpeg -listen 1 -i rtmp://127.0.0.1:1935/live/prueba -c copy salida.flv`, por USB con
  `adb reverse tcp:1935 tcp:1935`.
- La app se manejó por `adb shell am broadcast -a prueba.CMD --es c <comando>`.
- **Toda la evidencia visual son cuadros del video recibido** (extraídos con ffmpeg), nunca capturas de la pantalla
  del teléfono.
- Video: 1280×720, 30 fps, 3 Mbps, H.264 High. Audio: AAC 44,1 kHz estéreo, 128 kbps. ffmpeg recibió exactamente eso.

## Resumen

| # | Pregunta | Resultado |
|---|----------|-----------|
| 1 | `ViewFilterRender` + WebView 1920×1080 con `rotulos.html` sobre la cámara, fondo transparente | **SÍ**, con dos arreglos (ver abajo) |
| 2 | `.webm` con alfa en `<video>` conserva la transparencia | **SÍ**. Transición = **logo** |
| 3 | 5 WebViews precargadas: memoria y fps durante 10 min | **SÍ**: 30 fps estables. Memoria alta: unos 800 MB entre la app y el renderer |
| 4 | `react-native-webview` y la WebView del módulo comparten `localStorage` | **SÍ** |
| 5 | `file:///android_asset/obs/panel.html?modo=app` conserva `?modo=app` | **SÍ** |
| 6 | Micrófono USB-C | **Pendiente**: no había un micrófono USB-C para probar |
| 7 | Sigue con la pantalla apagada y en segundo plano | **SÍ, con servicio en primer plano** (`camera\|microphone`). **NO** sin él |
| 8 | Corte de 20 s: ¿reintenta solo? | **NO reintenta solo.** Reconecta si la app llama a `reTry` desde `onConnectionFailed` |
| 9 | Temperatura y batería tras 30 min a 720p | Aguanta 30 fps los 30 min, pero se calienta: la piel llega a 45,9 °C (SEVERE) y la batería baja 7 puntos aunque esté enchufada |

## Clases y métodos reales de RootEncoder 2.8.1 usados

Todos los nombres se comprobaron en el código fuente del tag `2.8.1`.

- `com.pedro.library.rtmp.RtmpStream(context, connectChecker)`. Usa por defecto `Camera2Source` y `MicrophoneSource`.
- `StreamBase.prepareVideo(width, height, bitrate, fps = 30, iFrameInterval = 2, rotation = 0, …)` y
  `prepareAudio(sampleRate, isStereo, bitrate, …)`. Se usó `prepareVideo(1280, 720, 3_000_000, 30, 2, 0)` y
  `prepareAudio(44100, true, 128_000)`. Las dos devolvieron `true`.
- `startPreview(surfaceView)`, `stopPreview()`, `startStream(url)`, `stopStream()`, `isStreaming` e `isOnPreview`.
- `getGlInterface().addFilter(filtro)`.
- `com.pedro.encoder.input.gl.render.filters.ViewFilterRender`: su propiedad `view` y `isHardwareMode`.
- `setFpsListener(FpsListener.Callback)` y su `onFps(fps)`.
- `com.pedro.common.ConnectChecker` define `onConnectionStarted(url)`, `onConnectionSuccess()`,
  `onConnectionFailed(reason)`, `onDisconnect()`, `onAuthError()` y `onAuthSuccess()`. Extiende `BitrateChecker`,
  que define `onNewBitrate(bitrate: Long)` y `onStreamingStats(report)`.
- `getStreamClient().setReTries(n)` y `getStreamClient().reTry(delay, reason[, backupUrl]): Boolean`.
- `setVideoBitrateOnFly(bitrate: Int)`. Para adaptar el bitrate solo, el ejemplo de RootEncoder usa
  `QueueAwareBitrateAdapter(maxBitrate) { setVideoBitrateOnFly(it - aBitrate) }` y lo alimenta desde
  `onStreamingStats(report)`. También existe `BitrateAdapter` (Java): `setMaxBitrate` y
  `adaptBitrate(actualBitrate, hasCongestion)`. El adaptador no se probó con una red real.
- `MicrophoneSource.setPreferredDevice(AudioDeviceInfo): Boolean`. Es para el punto 6; no se pudo probar.

## Dos arreglos necesarios (hallados en la prueba)

1. **El dibujo en el hilo IO revienta la app → `FiltroVistaPrincipal`.** Con las transiciones, la app se cerró con
   `IllegalStateException: Recording currently in progress - missing #endRecording() call?`, lanzada en
   `RenderNode.beginRecording` ← `View.updateDisplayListIfDirty`.
   - Causa, leída en `ViewFilterRender.kt` 2.8.1: `startRender()` hace `view.draw(canvas)` en
     `CoroutineScope(Dispatchers.IO)`. Con la vista adjunta a la ventana, ese dibujo choca con el dibujo normal de la
     ventana en el hilo principal.
   - Arreglo: `FiltroVistaPrincipal`, una copia de `ViewFilterRender` (Apache 2.0) que dibuja en el hilo principal
     con un `Handler` a 30 fps. Usa el mismo shader `R.raw.android_view_fragment` y
     `Surface.lockHardwareCanvas()`.
   - Resultado: en 30 min, `dibujados=55408 errores=0`, sin ningún cierre.
2. **La escala de la WebView → `useWideViewPort` + `loadWithOverviewMode`.** Dentro de la WebView,
   `innerWidth×innerHeight = 1936×1089`, `devicePixelRatio = 2.625` y `.escenario` queda con `scale(1)`.
   - Síntoma: la WebView mostraba solo un 1/2,6 del escenario. El logo salía enorme y EN VIVO, la barra y el rótulo
     quedaban fuera del cuadro.
   - Arreglo: `settings.useWideViewPort = true` y `settings.loadWithOverviewMode = true`. Con eso el escenario entra
     entero. `obs/` no se tocó.

## Evidencia por punto

### 1. Capas web sobre la cámara: SÍ

Cuadros del video recibido (corrida de las 09:14, con los dos arreglos):

- Logo arriba a la izquierda a tamaño normal, EN VIVO arriba a la derecha y el rótulo «CELEBRANTE / Pbro. Héctor Cruz»
  completo abajo a la izquierda, con fondo transparente sobre la cámara: `prueba-tecnica/1-camara-rotulo.png`.
- La escena `pantalla.html?tipo=inicio` completa: `prueba-tecnica/1-escena-inicio.png`.

Una primera corrida (08:50) salió sin capas y no se repitió. Lo más probable es que la ventana de la app no estuviera
visible en ese momento.

**Detalle para la tarea de escenas:** las pantallas tienen su propio logo arriba a la izquierda. Si la escena y
`rotulos.html` se ven a la vez, ese logo se superpone con el de `rotulos.html` (se ve en
`prueba-tecnica/9-minuto-29.png`). Hay que ocultar uno de los dos.

### 2. Transición con alfa: SÍ

En los primeros cuadros de la cortina, el `.webm` VP9 con alfa dentro de `<video>` deja ver la cámara y el rótulo
detrás de la franja azul: `prueba-tecnica/2-transicion-alfa.png`. A los 1000 ms el logo opaco tapa el cambio de
escena. **Transición = logo**; el fundido de respaldo no hace falta.

### 3. WebViews precargadas: SÍ (fps estables, memoria alta)

Las capas eran 6 WebViews de 1920×1080: `rotulos.html`, las 4 `pantalla.html?tipo=…` y la de la transición. Corrida
de 30 min (14:53:41 → 15:24:32) con el rótulo visible y una transición cada 2 min.

- **fps en el teléfono** (`FpsListener`, una muestra por segundo, 30 min): 1151×30, 669×31, 11×29 y 2×28.
- **fps en el video recibido** (ffprobe, ventanas de 5 min): 29,7 / 29,9 / 30,0 / 30,0 / 30,0 / 30,0. En total
  fueron 55 613 cuadros en 1857 s, una media de 29,94 fps, sin ningún hueco de más de 0,5 s.
- **Memoria**, con `adb shell dumpsys meminfo com.parroquia.prueba` (KB):

| Momento | TOTAL PSS de la app | Graphics | Renderer de WebView (pid 18788) |
|---------|--------------------:|---------:|--------------------------------:|
| App abierta, sin capas | 205 215 | 88 192 | 39 789 |
| Capas creadas, al empezar | 250 590 | 130 044 | 117 736 |
| 2 min | 309 100 | 206 172 | 159 543 |
| 4 min | 440 360 | 299 468 | 194 279 |
| 6 min | 513 994 | 364 668 | 195 309 |
| 8 min | 566 187 | 430 408 | 199 989 |
| 10 min | 615 812 | 475 940 | 189 309 |
| 20 min | 601 920 | 475 700 | 192 444 |
| 30 min | 615 603 | 485 408 | 188 870 |

- **El renderer de WebView es un proceso aparte.** Se identificó como el de la app por
  `ServiceRecord … c:com.parroquia.prueba` (`u0a446i30`). Los demás `sandboxed_process` eran de otras apps y no se
  cuentan.
- La memoria Graphics crece unos 33 MB/min durante los primeros 10 min y después se aplana en 470–485 MB. Es llenado
  de caché, no una fuga sin fin.
- En régimen: app ≈ 600 MB más renderer ≈ 190 MB, **unos 800 MB en total**. En este teléfono no molestó. En un
  teléfono de gama baja puede ser demasiado: si hace falta, se precargan menos escenas.

### 4. `localStorage` compartido: SÍ

La WebView nativa (`rotulos.html`, `file://`) leyó `prueba_rn=escrito-por-rn-…`, que había escrito la
`react-native-webview` (`rn.html`, `file://`). En sentido contrario, la de RN leyó `prueba_nativo=escrito-por-nativo`
1 s después de que lo escribiera la nativa. Comparten proceso, perfil de WebView y origen `file://`. El puente de
estado se usa igual, como decía el plan.

### 5. `?modo=app`: SÍ

`file:///android_asset/obs/panel.html?modo=app` → `location.search = "?modo=app"`.

### 6. Micrófono USB-C: Pendiente

No había un micrófono USB-C. `AudioManager.getDevices(GET_DEVICES_INPUTS)` solo mostró los micrófonos internos: id 22
y 23 (tipo 15) y los ids 26 (tipo 18) y 30 (tipo 25); ninguno USB. La API prevista es `AudioManager.getDevices`, que
filtra `AudioDeviceInfo.TYPE_USB_DEVICE` y `TYPE_USB_HEADSET`, y `MicrophoneSource.setPreferredDevice(device)`. Hay que
probarla cuando haya un micrófono.

### 7. Segundo plano y pantalla apagada: SÍ con servicio en primer plano, NO sin él

**Sin servicio en primer plano**, la app pasó a segundo plano a las 15:34:13:

- A los 6 s, CameraService bloquea la cámara:
  ```
  CameraService: Camera 0: Access for "com.parroquia.prueba" has been restricted, … isUidVisible false, … procState 15
  CameraService: block for PID 31528
  ```
- Y silencia el micrófono:
  ```
  audioserver: App op 27 missing, silencing record … packageName: com.parroquia.prueba
  ```
- El video recibido se corta unos 3 s después de ir a segundo plano y **no vuelve aunque la app vuelva al frente**.
  Llegaron 726 cuadros en 24 s y después nada.
- La conexión RTMP sigue abierta (`isStreaming=true`, sin `onConnectionFailed`). En Facebook sería un vivo
  congelado, sin ningún aviso.

**Con servicio en primer plano** el vivo no se corta:

- El servicio declara en el manifiesto `android:foregroundServiceType="camera|microphone"` y los permisos
  `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_CAMERA` y `FOREGROUND_SERVICE_MICROPHONE`. `POST_NOTIFICATIONS` ya estaba
  concedido.
- Arranca con `Context.startForegroundService(intent)`. Dentro del servicio se llama a
  `Service.startForeground(1, notificación, ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA or ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE)`.
- **Se arranca con la app en primer plano y antes de transmitir.** El log lo confirma:
  `Background started FGS: Allowed … uidState: TOP` y `isForeground=true … types=0x000000C0`.
- La secuencia fue: primer plano 20 s → segundo plano 30 s → de vuelta al frente 15 s → pantalla apagada 30 s
  (`mWakefulness=Dozing`) → encendida.
- Resultado: **2878 cuadros en 96 s, 29,98 fps, sin ningún hueco de más de 0,5 s**. No hubo bloqueo de cámara ni
  silenciado de micrófono.
- Las capas siguen en el video en las tres fases: `prueba-tecnica/7-fondo-y-pantalla-apagada-con-fgs.png` (primer
  plano / segundo plano / pantalla apagada).

**No verificado:** si una capa *cambia* (por ejemplo, otro rótulo) mientras la ventana está oculta. En esta prueba el
contenido era fijo.

**Consecuencia:** la app real necesita este servicio en primer plano, arrancado al pulsar «Transmitir». Además, por
defecto la pantalla se apaga sola (el timeout de este teléfono es de 10 min). Sin `FLAG_KEEP_SCREEN_ON` en la pantalla
de transmisión, el voluntario pierde la vista previa.

### 8. Corte de la conexión ~20 s: NO reintenta solo

**Esta prueba simula la pérdida del receptor, no la del wifi.** El flujo iba por USB con `adb reverse`, así que se
mató el `ffmpeg` de la PC durante unos 20 s. Un corte real de wifi puede comportarse distinto: sin un `RST`, el error
de envío puede tardar más en aparecer. Eso no se verificó.

- **La app no hace nada:** a los ~1 s llega `onConnectionFailed reason=Error send packet, Broken pipe` y nada más.
  No hay reconexión, el receptor nuevo no recibe nada y `isStreaming` sigue en `true` hasta `stopStream()`.
  - El código lo confirma: dentro de la librería nadie llama a `reTry`; solo lo exponen los `StreamClient` para que
    lo llame la app.
  - `RtmpClient.shouldRetry(reason)` exige que `setReTries(n)` tenga n > 0 y que el motivo no sea
    «Endpoint malformed».
- **La app llama a `getStreamClient().reTry(5000, reason)` en `onConnectionFailed`** (con `setReTries(10)`):
  ```
  15:32:02.148 onConnectionFailed reason=Error send packet, Broken pipe
  15:32:02.152 reTry(5000)=true
  15:32:07.163 onConnectionStarted
  15:32:09.195 onConnectionFailed reason=Error configure stream, End of stream
  …                                   (2 intentos más igual; el receptor vuelve a las 15:32:21)
  15:32:28.284 onConnectionStarted
  15:32:28.510 onConnectionSuccess
  ```
  - El corte visto fue de unos 26 s y se usaron 4 de los 10 reintentos.
  - El receptor nuevo recibió 1080 cuadros en 36 s (29,95 fps), sin huecos.
- **Cuando se agotan los reintentos**, `reTry` devuelve `false` y la app tiene que llamar a `stopStream()`. Esto se vio
  en una corrida en la que el servidor adb se reinició y borró el túnel: 10 × `ECONNREFUSED` y después
  `reTry(5000)=false`.
- **Bitrate:** `onNewBitrate` informó unos 2,7–3,0 Mbps durante la transmisión. Para cambiarlo, `setVideoBitrateOnFly`.

### 9. Temperatura y batería tras 30 min a 720p

Fue la misma corrida del punto 3: 30 min, 720p, 30 fps, 3 Mbps, 6 WebViews y la pantalla encendida. Datos de
`dumpsys battery` y `dumpsys thermalservice` (temperaturas actuales del HAL, en °C):

| Momento | Batería % | Temp. batería | AP | SKIN (estado) | PA |
|---------|----------:|--------------:|---:|--------------:|---:|
| Antes de abrir la app (14:53) | 18 | 33,1 | 35,0 | 34,4 (0) | 35,2 |
| Inicio de la transmisión | 17 | 33,9 | 38,9 | 36,3 (0) | 38,6 |
| 5 min | 16 | 40,0 | 45,9 | 42,1 (2) | 45,7 |
| 10 min | 15 | 42,8 | 49,0 | 44,2 (2) | 48,9 |
| 20 min | 13 | 44,7 | 50,0 | 45,6 (3) | 50,2 |
| 30 min (fin) | 10 | 45,1 | 50,9 | 45,9 (3) | 50,5 |

- Al terminar, `Thermal Status: 3` (SEVERE). Los umbrales de SKIN del HAL son 38/40/42/45/47 °C.
- **El teléfono estuvo enchufado por USB a la PC todo el tiempo** (`status: 2`, cargando) y aun así bajó de 17 % a
  10 % (`current now` entre −0,5 y −0,77 A). Un cable de PC no alcanza; con un cargador de pared el resultado sería
  distinto (no verificado).
  - Desenchufado, la descarga será mayor que 7 puntos en 30 min.
  - Una misa de 1 h 30 min sin cargador, empezando con poca batería como acá (17 %), no llega al final.
    Es una estimación, no se midió.
- Aun así, los fps no bajaron en estado SEVERE. Se mantuvieron en 30.
- Recomendaciones para la app: avisar si la batería está baja o el estado térmico es alto
  (`PowerManager.getCurrentThermalStatus()`, no probado), pedir que el teléfono esté conectado a un cargador de pared y
  ofrecer 720p por defecto, no 1080p.
- Cuadro del minuto 29: `prueba-tecnica/9-minuto-29.png`.

## Otros hallazgos

- `npx create-expo-module@58.0.3 --local …` se cuelga en Windows en «Creating the module from template files». Se
  probó 4 veces y avisa «Couldn't download the versioned template from npm, falling back to the latest version». El
  módulo se armó a mano, copiando la estructura de `expo-module-template` 58.0.9.
- Reinstalar el APK disparó un diálogo de Play Protect. No se tocó; lo resolvió el usuario.
- El servidor adb de esta PC se reinicia solo por un desajuste de versiones, y al reiniciarse borra los
  `adb reverse`. Hay que rehacerlos después de cada reinicio.
