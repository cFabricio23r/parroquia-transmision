import { leerFacebook, textosVivo } from './textos';

const vacio = { titulo: '', descripcion: '' };
const base = { guardado: vacio, tipo: 'Misa dominical' as string | null, parroquia: 'Inmaculada', editado: null };

describe('textosVivo', () => {
  it('sin nada: título automático y sin descripción', () => {
    expect(textosVivo(base)).toEqual({ titulo: 'Misa dominical · Inmaculada', descripcion: '' });
  });
  it('sin tipo elegido: «Transmisión · parroquia»', () => {
    expect(textosVivo({ ...base, tipo: null }).titulo).toBe('Transmisión · Inmaculada');
  });
  it('un título guardado de solo espacios usa el automático', () => {
    expect(textosVivo({ ...base, guardado: { titulo: '   ', descripcion: '' } }).titulo).toBe('Misa dominical · Inmaculada');
  });
  it('lo guardado se recorta y se corta a 254 / 1000', () => {
    const r = textosVivo({ ...base, guardado: { titulo: ' ' + 'x'.repeat(300), descripcion: 'y'.repeat(1200) } });
    expect(r.titulo).toBe('x'.repeat(254));
    expect(r.descripcion).toBe('y'.repeat(1000));
    expect(textosVivo({ ...base, guardado: { titulo: ' Misa ', descripcion: ' Hola ' } })).toEqual({ titulo: 'Misa', descripcion: 'Hola' });
  });
  it('lo editado gana; un título editado vacío vuelve al guardado; una descripción editada vacía queda vacía', () => {
    const guardado = { titulo: 'Guardado', descripcion: 'Desc guardada' };
    expect(textosVivo({ ...base, guardado, editado: { titulo: 'Editado', descripcion: 'Nueva' } })).toEqual({ titulo: 'Editado', descripcion: 'Nueva' });
    expect(textosVivo({ ...base, guardado, editado: { titulo: '  ', descripcion: '' } })).toEqual({ titulo: 'Guardado', descripcion: '' });
    expect(textosVivo({ ...base, editado: { titulo: '', descripcion: '' } }).titulo).toBe('Misa dominical · Inmaculada');
  });
});

describe('leerFacebook', () => {
  it('lee datos.facebook; lo que falta o no es texto es vacío', () => {
    expect(leerFacebook({ facebook: { titulo: 'T' } })).toEqual({ titulo: 'T', descripcion: '' });
    expect(leerFacebook({ facebook: { titulo: 3, descripcion: 'D' } })).toEqual({ titulo: '', descripcion: 'D' });
    expect(leerFacebook(null)).toEqual(vacio);
    expect(leerFacebook({ facebook: 'x' })).toEqual(vacio);
  });
});
