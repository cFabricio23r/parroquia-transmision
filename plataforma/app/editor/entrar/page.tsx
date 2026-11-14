import { MarcoAcceso } from '../../componentes/MarcoAcceso';
import { TarjetaAcceso } from '../../componentes/TarjetaAcceso';
import { FormEntrar } from './FormEntrar';

export const metadata = { title: 'Entrar · Parroquia en Vivo' };

export default function Entrar() {
  return (
    <MarcoAcceso>
      <TarjetaAcceso>
        <FormEntrar />
      </TarjetaAcceso>
    </MarcoAcceso>
  );
}
