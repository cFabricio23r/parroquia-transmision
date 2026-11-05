package org.parroquiaarce.transmisor

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Módulo nativo de la transmisión. Por ahora es un esqueleto: el motor real
// (cámara, capa y RTMP) llega en las tareas 6 y 7.
class TransmisorModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("Transmisor")

    // Evento de cambio de estado de la transmisión.
    Events("onEstado")

    // Función de prueba: confirma que el puente JS ↔ Kotlin funciona.
    AsyncFunction("version") {
      "0.1.0"
    }

    // Vista de la vista previa. Por ahora vacía.
    View(TransmisorView::class) {}
  }
}
