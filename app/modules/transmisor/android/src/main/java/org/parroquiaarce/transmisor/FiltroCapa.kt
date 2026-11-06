package org.parroquiaarce.transmisor

import android.content.Context
import android.graphics.Color
import android.graphics.PorterDuff
import android.graphics.SurfaceTexture
import android.opengl.GLES11Ext
import android.opengl.GLES20
import android.opengl.Matrix
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import android.view.Surface
import android.view.View
import android.view.ViewTreeObserver
import com.pedro.encoder.input.gl.render.filters.BaseFilterRender
import com.pedro.encoder.utils.gl.GlUtil
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.concurrent.atomic.AtomicBoolean

/*
 * Filtro de RootEncoder que pone la capa (una vista de Android) sobre la cámara.
 *
 * Es la copia de ViewFilterRender (RootEncoder 2.8.1, Apache 2.0) que se probó en la Tarea 1
 * («FiltroVistaPrincipal»), con dos cambios:
 *  1. view.draw(canvas) se hace en el hilo principal. ViewFilterRender lo hace en Dispatchers.IO
 *     y, con la vista adjunta a la ventana, revienta («Recording currently in progress»).
 *  2. Calor: no copia la vista 30 veces por segundo. La copia solo cuando la ventana se redibuja
 *     (ViewTreeObserver.OnDrawListener) y la capa cambió (View.isDirty), como máximo a 30 fps. La textura conserva el último
 *     cuadro, así que mientras nada cambia el video sigue mostrando la capa sin trabajo extra.
 *     Con `continuo = true` (durante la transición) copia cada cuadro a 30 fps.
 *     Un latido cada LATIDO_MS copia igual, por si se perdió un aviso.
 */
class FiltroCapa(private val vista: View) : BaseFilterRender() {
  companion object {
    private const val TAG = "Transmisor"
    private const val CUADRO_MS = 33L
    private const val LATIDO_MS = 2000L
    private const val INFORME_MS = 10_000L
  }

  private val datos = floatArrayOf(
    -1f, -1f, 0f, 0f, 0f,
    1f, -1f, 0f, 1f, 0f,
    -1f, 1f, 0f, 0f, 1f,
    1f, 1f, 0f, 1f, 1f,
  )
  private var program = -1
  private var aPositionHandle = -1
  private var aTextureHandle = -1
  private var uMVPMatrixHandle = -1
  private var uSTMatrixHandle = -1
  private var uSamplerHandle = -1
  private var uSamplerViewHandle = -1
  private val viewId = intArrayOf(-1)
  @Volatile private var surfaceTexture: SurfaceTexture? = null
  @Volatile private var surface: Surface? = null
  private val frameAvailable = AtomicBoolean(false)
  private val h = Handler(Looper.getMainLooper())

  /** true después de release(): RootEncoder lo saca de la lista y hay que crear otro. */
  @Volatile var liberado = false
    private set

  /** Durante la transición: copiar cada cuadro. */
  var continuo = false
    set(v) {
      field = v
      pedir()
    }

  // Todo lo que sigue se usa solo en el hilo principal.
  private var programado = false
  private var ultimo = 0L
  // Contadores para el informe del log (cada 10 s).
  private var dibujos = 0
  private var avisos = 0
  private var avisosCapa = 0
  private var latidos = 0
  private var errores = 0

  /** Copias por segundo de la capa en los últimos 10 s (null hasta el primer informe). Para el registro. */
  @Volatile var fps: Double? = null
    private set

  /** Entre transmisiones: hasta el próximo informe no hay dato (review M7). Desde cualquier hilo. */
  fun olvidarFps() {
    fps = null
  }

  // El aviso es de toda la ventana (también la interfaz de RN). Solo se copia si la capa
  // cambió: View.isDirty() es true si la vista (o una hija) se invalidó desde el último dibujo.
  private val alDibujarVentana = ViewTreeObserver.OnDrawListener {
    avisos++
    if (vista.isDirty) {
      avisosCapa++
      pedir()
    }
  }

  private val dibujarProgramado = Runnable {
    programado = false
    dibujar()
    if (continuo) pedir()
  }

  private val latido = object : Runnable {
    override fun run() {
      if (SystemClock.uptimeMillis() - ultimo >= LATIDO_MS) {
        latidos++
        dibujar()
      }
      h.postDelayed(this, LATIDO_MS)
    }
  }

  private val informe = object : Runnable {
    override fun run() {
      fps = dibujos / (INFORME_MS / 1000.0)
      Log.w(TAG, "capa: dibujos=$dibujos avisos=$avisos deLaCapa=$avisosCapa latidos=$latidos errores=$errores en 10 s continuo=$continuo")
      dibujos = 0; avisos = 0; avisosCapa = 0; latidos = 0
      h.postDelayed(this, INFORME_MS)
    }
  }

  init {
    squareVertex = ByteBuffer.allocateDirect(datos.size * FLOAT_SIZE_BYTES)
      .order(ByteOrder.nativeOrder()).asFloatBuffer()
    squareVertex.put(datos).position(0)
    Matrix.setIdentityM(MVPMatrix, 0)
    Matrix.setIdentityM(STMatrix, 0)
    // Se crea en el hilo principal (Capa).
    vista.viewTreeObserver.addOnDrawListener(alDibujarVentana)
    h.postDelayed(latido, LATIDO_MS)
    h.postDelayed(informe, INFORME_MS)
  }

  /** Pide una copia de la vista; varias seguidas se juntan en una, como máximo cada 33 ms. */
  fun pedir() {
    if (liberado || programado) return
    programado = true
    val espera = (ultimo + CUADRO_MS - SystemClock.uptimeMillis()).coerceIn(0L, CUADRO_MS)
    h.postDelayed(dibujarProgramado, espera)
  }

  private fun dibujar() {
    ultimo = SystemClock.uptimeMillis()
    val s = surface ?: return
    val v = vista
    if (v.width <= 0 || v.height <= 0 || previewWidth <= 0) return
    val canvas = try {
      s.lockHardwareCanvas()
    } catch (e: Exception) {
      errores++
      return
    }
    try {
      canvas.drawColor(Color.TRANSPARENT, PorterDuff.Mode.CLEAR)
      canvas.scale(previewWidth.toFloat() / v.width, previewHeight.toFloat() / v.height)
      v.draw(canvas)
      dibujos++
    } catch (e: Exception) {
      errores++
      if (errores < 5) Log.w(TAG, "capa: error al dibujar ${e.javaClass.simpleName}")
    } finally {
      runCatching { s.unlockCanvasAndPost(canvas) }
    }
  }

  // --- Hilo de GL (RootEncoder) ---

  override fun initGlFilter(context: Context) {
    val vs = GlUtil.getStringFromRaw(context, com.pedro.encoder.R.raw.simple_vertex)
    val fs = GlUtil.getStringFromRaw(context, com.pedro.encoder.R.raw.android_view_fragment)
    program = GlUtil.createProgram(vs, fs)
    aPositionHandle = GLES20.glGetAttribLocation(program, "aPosition")
    aTextureHandle = GLES20.glGetAttribLocation(program, "aTextureCoord")
    uMVPMatrixHandle = GLES20.glGetUniformLocation(program, "uMVPMatrix")
    uSTMatrixHandle = GLES20.glGetUniformLocation(program, "uSTMatrix")
    uSamplerHandle = GLES20.glGetUniformLocation(program, "uSampler")
    uSamplerViewHandle = GLES20.glGetUniformLocation(program, "uSamplerView")
    GlUtil.createExternalTextures(viewId.size, viewId, 0)
    val st = SurfaceTexture(viewId[0])
    st.setDefaultBufferSize(previewWidth, previewHeight)
    st.setOnFrameAvailableListener { frameAvailable.set(true) }
    surfaceTexture = st
    surface = Surface(st)
    // La superficie es nueva y está vacía: copiar la vista una vez.
    h.post { pedir() }
  }

  override fun drawFilter() {
    surfaceTexture?.let {
      it.setDefaultBufferSize(previewWidth, previewHeight)
      if (frameAvailable.getAndSet(false)) it.updateTexImage()
    }
    GLES20.glUseProgram(program)
    squareVertex.position(SQUARE_VERTEX_DATA_POS_OFFSET)
    GLES20.glVertexAttribPointer(aPositionHandle, 3, GLES20.GL_FLOAT, false, SQUARE_VERTEX_DATA_STRIDE_BYTES, squareVertex)
    GLES20.glEnableVertexAttribArray(aPositionHandle)
    squareVertex.position(SQUARE_VERTEX_DATA_UV_OFFSET)
    GLES20.glVertexAttribPointer(aTextureHandle, 2, GLES20.GL_FLOAT, false, SQUARE_VERTEX_DATA_STRIDE_BYTES, squareVertex)
    GLES20.glEnableVertexAttribArray(aTextureHandle)
    GLES20.glUniformMatrix4fv(uMVPMatrixHandle, 1, false, MVPMatrix, 0)
    GLES20.glUniformMatrix4fv(uSTMatrixHandle, 1, false, STMatrix, 0)
    GLES20.glUniform1i(uSamplerHandle, 0)
    GLES20.glActiveTexture(GLES20.GL_TEXTURE0)
    GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, previousTexId)
    GLES20.glUniform1i(uSamplerViewHandle, 1)
    GLES20.glActiveTexture(GLES20.GL_TEXTURE1)
    GLES20.glBindTexture(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, viewId[0])
  }

  override fun disableResources() {
    GlUtil.disableResources(aTextureHandle, aPositionHandle)
  }

  // RootEncoder lo llama al parar el GL (MainRender.release) y saca el filtro de la lista.
  override fun release() {
    liberado = true
    h.post { soltarOyentes() }
    GLES20.glDeleteProgram(program)
    surface?.release(); surface = null
    surfaceTexture?.release(); surfaceTexture = null
  }

  /** Hilo principal. También lo llama Capa al liberarse. */
  fun soltarOyentes() {
    liberado = true
    h.removeCallbacks(dibujarProgramado)
    h.removeCallbacks(latido)
    h.removeCallbacks(informe)
    val vto = vista.viewTreeObserver
    if (vto.isAlive) vto.removeOnDrawListener(alDibujarVentana)
  }
}
