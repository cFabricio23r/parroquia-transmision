// Fija la prioridad mínima de log de TODO el proceso (API 30+).
// Se busca con dlsym para no exigir minSdk 30: si no existe, devuelve false.
#include <jni.h>
#include <dlfcn.h>
#include <stdint.h>

typedef int32_t (*fijar_prioridad_t)(int32_t);

JNIEXPORT jboolean JNICALL
Java_org_parroquiaarce_transmisor_RegistroSeguro_fijarPrioridadMinima(JNIEnv *env, jclass clase, jint prioridad) {
  (void) env;
  (void) clase;
  fijar_prioridad_t fijar = (fijar_prioridad_t) dlsym(RTLD_DEFAULT, "__android_log_set_minimum_priority");
  if (fijar == NULL) return JNI_FALSE;
  fijar((int32_t) prioridad);
  return JNI_TRUE;
}
