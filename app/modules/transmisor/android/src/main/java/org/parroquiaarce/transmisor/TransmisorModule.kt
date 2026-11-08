package org.parroquiaarce.transmisor

import android.content.pm.ActivityInfo
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.WindowInsets
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Módulo nativo de la transmisión: cámara a Facebook (Etapa 1).
// Capa de escenas encima de la cámara (Tarea 7). Servicio en primer plano, datos para los avisos y
// registro de rendimiento (Tarea 9).
class TransmisorModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("Transmisor")

    // Cambios de conexión: { conexion, motivo, kbps, termico }.
    Events("onEstado", "onServicio")

    OnCreate {
      // Antes de cualquier conexión: RootEncoder escribe la clave con Log.i.
      RegistroSeguro.activar()
      Motor.alEvento = { cuerpo -> sendEvent("onEstado", cuerpo) }
      Motor.alServicio = { ok -> sendEvent("onServicio", mapOf("ok" to ok)) }
    }

    // Todo en el hilo principal, como el resto de Motor y Capa (review de la Tarea 7). El hilo
    // de OnDestroy no está verificado: si ya es el principal se hace en el acto.
    OnDestroy {
      // Los callbacks se sueltan en el acto: el runtime de JS se libera enseguida y un evento
      // posterior no debe llegarle (review M3 de la Tarea 9).
      Motor.alEvento = null
      Motor.alServicio = null
      val enPrincipal = Looper.myLooper() == Looper.getMainLooper()
      Log.w("Transmisor", "destroy en principal=$enPrincipal")
      val soltar = Runnable {
        Motor.terminar()
        Capa.liberar()
        Registro.cerrar()
      }
      if (enPrincipal) soltar.run() else Handler(Looper.getMainLooper()).post(soltar)
    }

    AsyncFunction("version") {
      "0.1.0"
    }

    AsyncFunction("prepararVista") { calidad: String, microfono: String ->
      val ctx = appContext.reactContext ?: throw IllegalStateException("Sin contexto de Android.")
      val actividad = appContext.currentActivity ?: throw IllegalStateException("Sin actividad.")
      // La capa va antes que la vista previa: al arrancar el GL se le pone el filtro.
      Capa.crear(actividad)
      Motor.prepararVista(ctx, calidad, microfono)
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("iniciar") { url: String, clave: String ->
      Motor.iniciar(url, clave)
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("terminar") {
      Motor.terminar()
    }.runOnQueue(Queues.MAIN)

    // Zoom de la cámara (Tarea 9g).
    AsyncFunction("rangoZoom") {
      Motor.rangoZoom()
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("ponerZoom") { nivel: Double ->
      Motor.ponerZoom(nivel)
    }.runOnQueue(Queues.MAIN)

    // Transición del logo a otra escena; resuelve al terminar (unos 2 s).
    AsyncFunction("cambiarEscena") { escena: String, promise: Promise ->
      Capa.cambiarEscena(
        escena,
        { promise.resolve(null) },
        { e: CodedException -> promise.reject(e.code, e.message, null) },
      )
    }.runOnQueue(Queues.MAIN)

    // Estilo de la pantalla final «Producción» (Tarea 9d): «claro» o «azul».
    AsyncFunction("fijarEstiloFinal") { estilo: String ->
      Capa.fijarEstiloProduccion(estilo)
    }.runOnQueue(Queues.MAIN)

    // Estado del panel (JSON) para las escenas de la capa.
    AsyncFunction("actualizarEstado") { json: String ->
      Capa.actualizarEstado(json)
    }.runOnQueue(Queues.MAIN)

    // Datos para los avisos y el registro: { termico, temperatura, memoriaMb, fpsVideo, fpsCapa }.
    // Corre fuera del hilo principal (Debug.getPss lee /proc y puede tardar).
    AsyncFunction("medir") {
      val ctx = appContext.reactContext ?: throw IllegalStateException("Sin contexto de Android.")
      mapOf(
        "termico" to Sistema.termico(ctx),
        "temperatura" to Sistema.temperaturaBateria(ctx),
        "memoriaMb" to Sistema.memoriaMb(),
        "fpsVideo" to Motor.fpsVideo,
        "fpsCapa" to Capa.fps(),
      )
    }

    // Solo lo que usan los avisos (cada 10 s): sin Debug.getPss, que es lento (review M5).
    // También los fps del video, para la barra superior (prueba del 2026-11-07).
    AsyncFunction("medirAvisos") {
      val ctx = appContext.reactContext ?: throw IllegalStateException("Sin contexto de Android.")
      mapOf(
        "termico" to Sistema.termico(ctx),
        "temperatura" to Sistema.temperaturaBateria(ctx),
        "fpsVideo" to Motor.fpsVideo,
      )
    }

    AsyncFunction("abrirRegistro") { nombre: String, encabezado: String ->
      val ctx = appContext.reactContext ?: throw IllegalStateException("Sin contexto de Android.")
      Registro.abrir(ctx, nombre, encabezado)
    }

    AsyncFunction("anotarRegistro") { linea: String ->
      Registro.anotar(linea)
    }

    AsyncFunction("cerrarRegistro") {
      Registro.cerrar()
    }

    /** Ruta del registro más nuevo, o null. */
    AsyncFunction("ultimoRegistro") {
      val ctx = appContext.reactContext ?: throw IllegalStateException("Sin contexto de Android.")
      Registro.ultimo(ctx)
    }

    /** true si No molestar está activo; null si no se sabe. */
    AsyncFunction("noMolestarActivo") {
      val ctx = appContext.reactContext ?: throw IllegalStateException("Sin contexto de Android.")
      Sistema.noMolestarActivo(ctx)
    }

    AsyncFunction("abrirNoMolestar") {
      val actividad = appContext.currentActivity ?: throw IllegalStateException("Sin actividad.")
      Sistema.abrirNoMolestar(actividad)
    }.runOnQueue(Queues.MAIN)

    // Orientación de la pantalla del operador (Tarea 9c): «vertical» para Preparar, «horizontal»
    // para Antes de iniciar y durante toda la transmisión. Fija, sin girar con el sensor.
    // La actividad no se recrea al girar: el manifiesto trae orientation|screenSize en configChanges
    // (lo pone la plantilla de Expo), así la vista de la cámara y el WebView del panel siguen.
    // Sin dependencia nueva: Activity.setRequestedOrientation existe desde la API 1.
    AsyncFunction("fijarOrientacion") { orientacion: String ->
      val actividad = appContext.currentActivity ?: throw IllegalStateException("Sin actividad.")
      val pedida = when (orientacion) {
        "vertical" -> ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
        "horizontal" -> ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
        else -> throw IllegalArgumentException("Orientación desconocida.")
      }
      if (actividad.requestedOrientation != pedida) actividad.requestedOrientation = pedida
    }.runOnQueue(Queues.MAIN)

    // Zonas seguras en dp (Tarea 9c): barra de estado, recorte de la cámara y barra de navegación,
    // para que nada quede tapado. Se usa esto y no react-native-safe-area-context porque su código
    // C++ generado no compila en esta PC: la ruta pasa de 300 caracteres y el ninja del NDK falla.
    // WindowInsets.getInsets y Type desde la API 30; antes, systemWindowInset* (deprecado).
    // Son los valores del momento: al girar, JS los vuelve a pedir.
    AsyncFunction("zonasSeguras") {
      val actividad = appContext.currentActivity ?: throw IllegalStateException("Sin actividad.")
      val vista = actividad.window.decorView
      val d = vista.resources.displayMetrics.density
      val ins = vista.rootWindowInsets
      if (ins == null) {
        mapOf("top" to 0.0, "bottom" to 0.0, "left" to 0.0, "right" to 0.0)
      } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        val i = ins.getInsets(WindowInsets.Type.systemBars() or WindowInsets.Type.displayCutout())
        mapOf("top" to i.top / d.toDouble(), "bottom" to i.bottom / d.toDouble(), "left" to i.left / d.toDouble(), "right" to i.right / d.toDouble())
      } else {
        @Suppress("DEPRECATION")
        mapOf(
          "top" to ins.systemWindowInsetTop / d.toDouble(),
          "bottom" to ins.systemWindowInsetBottom / d.toDouble(),
          "left" to ins.systemWindowInsetLeft / d.toDouble(),
          "right" to ins.systemWindowInsetRight / d.toDouble(),
        )
      }
    }.runOnQueue(Queues.MAIN)

    View(TransmisorView::class) {}
  }
}
