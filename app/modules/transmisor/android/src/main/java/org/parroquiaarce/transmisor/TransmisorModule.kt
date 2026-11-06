package org.parroquiaarce.transmisor

import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Módulo nativo de la transmisión: cámara a Facebook (Etapa 1).
// La capa web encima de la cámara llega en la Tarea 7; el servicio en primer plano, en la 9.
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
    }

    AsyncFunction("version") {
      "0.1.0"
    }

    AsyncFunction("prepararVista") { calidad: String, microfono: String ->
      val ctx = appContext.reactContext ?: throw IllegalStateException("Sin contexto de Android.")
      Motor.prepararVista(ctx, calidad, microfono)
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("iniciar") { url: String, clave: String ->
      Motor.iniciar(url, clave)
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("terminar") {
      Motor.terminar()
    }.runOnQueue(Queues.MAIN)

    View(TransmisorView::class) {}
  }
}
