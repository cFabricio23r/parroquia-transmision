package org.parroquiaarce.transmisor

import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Módulo nativo de la transmisión: cámara a Facebook (Etapa 1).
// Capa de escenas encima de la cámara (Tarea 7); el servicio en primer plano llega en la 9.
class TransmisorModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("Transmisor")

    // Cambios de conexión: { conexion, motivo, kbps }.
    Events("onEstado")

    OnCreate {
      // Antes de cualquier conexión: RootEncoder escribe la clave con Log.i.
      RegistroSeguro.activar()
      Motor.alEvento = { cuerpo -> sendEvent("onEstado", cuerpo) }
    }

    OnDestroy {
      Motor.alEvento = null
      Motor.terminar()
      Capa.liberar()
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
      Capa.cambiarEscena(escena) { promise.resolve(null) }
    }.runOnQueue(Queues.MAIN)

    // Estado del panel (JSON) para las escenas de la capa.
    AsyncFunction("actualizarEstado") { json: String ->
      Capa.actualizarEstado(json)
    }.runOnQueue(Queues.MAIN)

    View(TransmisorView::class) {}
  }
}
