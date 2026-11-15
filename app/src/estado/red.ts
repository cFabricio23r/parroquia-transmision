/**
 * ¿Hay red? Sale de `App.tsx`: con el estado de expo-network. Si no se sabe, se supone que hay:
 * el aviso y las descargas solo se frenan con «sin internet» seguro.
 * `type` se compara con el texto de `Network.NetworkStateType.NONE` ('NONE'), así esto no importa expo-network.
 */
export function aHayRed(s: { isConnected?: boolean | null; type?: string; isInternetReachable?: boolean | null }): boolean {
  return !(s.isConnected === false || s.type === 'NONE' || s.isInternetReachable === false);
}
