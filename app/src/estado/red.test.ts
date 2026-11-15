import { aHayRed } from './red';

describe('aHayRed', () => {
  it('sin conexión', () => expect(aHayRed({ isConnected: false })).toBe(false));
  it('tipo NONE', () => expect(aHayRed({ type: 'NONE' })).toBe(false));
  it('sin salida a internet', () => expect(aHayRed({ isInternetReachable: false })).toBe(false));
  it('si no se sabe, se supone que hay', () => expect(aHayRed({})).toBe(true));
  it('con wifi y salida', () => expect(aHayRed({ isConnected: true, type: 'WIFI', isInternetReachable: true })).toBe(true));
  it('null no es «sin red»', () => expect(aHayRed({ isConnected: null, isInternetReachable: null })).toBe(true));
});
