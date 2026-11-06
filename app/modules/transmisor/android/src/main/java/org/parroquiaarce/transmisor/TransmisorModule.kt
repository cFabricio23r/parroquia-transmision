package org.parroquiaarce.transmisor

import android.os.Handler
import android.os.Looper
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
    Events("onEstado")

    OnCreate {
      // Antes de cualquier conexión: RootEncoder escribe la clave con Log.i.
      RegistroSeguro.activar()
      Motor.alEvento = { cuerpo -> sendEvent("onEstado", cuerpo) }
    }

    // Todo en el hilo principal, como el resto de Motor y Capa (review de la Tarea 7). El hilo
    // de OnDestroy no está verificado: si ya es el principal se hace en el acto.
    OnDestroy {
      val soltar = Runnable {
        Motor.alEvento = null
        Motor.terminar()
        Capa.liberar()
        Registro.cerrar()
      }
      if (Looper.myLooper() == Looper.getMainLooper()) soltar.run() else Handler(Looper.getMainLooper()).post(soltar)
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

    // Transición del logo a otra escena; resuelve al terminar (unos 2 s).
    AsyncFunction("cambiarEscena") { escena: String, promise: Promise ->
      Capa.cambiarEscena(
        escena,
        { promise.resolve(null) },
        { e: CodedException -> promise.reject(e.code, e.message, null) },
      )
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

    View(TransmisorView::class) {}
  }
}
