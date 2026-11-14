'use client';
import { useState, type ReactNode } from 'react';
import { contraste } from '../../../lib/contraste';
import { requisitosClave } from '../../../lib/clave';
import { Boton } from '../../componentes/Boton';
import { CajaInfo } from '../../componentes/CajaInfo';
import { CampoClave } from '../../componentes/CampoClave';
import { CampoColor } from '../../componentes/CampoColor';
import { CampoImagen } from '../../componentes/CampoImagen';
import { CampoSelect } from '../../componentes/CampoSelect';
import { CampoTexto } from '../../componentes/CampoTexto';
import { Chip } from '../../componentes/Chip';
import { Dialogo } from '../../componentes/Dialogo';
import { EnlaceTexto } from '../../componentes/EnlaceTexto';
import { Interruptor } from '../../componentes/Interruptor';
import { ListaRequisitos } from '../../componentes/ListaRequisitos';
import { MenuLateral, type ItemMenu } from '../../componentes/MenuLateral';
import { PastillaContraste } from '../../componentes/PastillaContraste';
import { Pestanas } from '../../componentes/Pestanas';
import { PuntoEstado } from '../../componentes/PuntoEstado';
import { Segmentado } from '../../componentes/Segmentado';
import { Tabla } from '../../componentes/Tabla';
import { Tarjeta } from '../../componentes/Tarjeta';

// Las 10 entradas del menú de AB/VicEdIdentidad, con sus puntos.
const MENU: ItemMenu[] = [
  { href: '#resumen', texto: 'Resumen', estado: 'listo' },
  { href: '#identidad', texto: 'Identidad', estado: 'listo', actual: true },
  { href: '#patrono', texto: 'Patrono y fiesta', estado: 'listo' },
  { href: '#pantallas', texto: 'Pantallas', estado: 'listo' },
  { href: '#rotulos', texto: 'Rótulos y estilo', estado: 'revisar' },
  { href: '#tipos', texto: 'Tipos de transmisión', estado: 'listo' },
  { href: '#galeria', texto: 'Galería', estado: 'falta' },
  { href: '#horarios', texto: 'Horarios y redes', estado: 'listo' },
  { href: '#avisos', texto: 'Avisos fijos', estado: 'opcional' },
  { href: '#publicar', texto: 'Publicar' },
];

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="pv-muestra" aria-labelledby={`m-${titulo}`}>
      <h2 id={`m-${titulo}`} className="pv-muestra-titulo">
        {titulo}
      </h2>
      <div className="pv-muestra-cuerpo">{children}</div>
    </section>
  );
}

export function Demostraciones() {
  const [logo, setLogo] = useState(true);
  const [enVivo, setEnVivo] = useState(false);
  const [fondo, setFondo] = useState<'colores' | 'foto' | 'liso'>('colores');
  const [principal, setPrincipal] = useState('#8a1c2b');
  const [oscuro, setOscuro] = useState('#4b0f18');
  const [acento, setAcento] = useState('#d9a441');
  const [alt, setAlt] = useState('');
  const [clave, setClave] = useState('');
  const [repetida, setRepetida] = useState('');
  const [dialogo, setDialogo] = useState(false);
  const hex = (v: string) => /^#[0-9a-fA-F]{6}$/.test(v);

  return (
    <main className="pv-muestrario">
      <h1 className="pv-muestrario-titulo">Muestrario de componentes</h1>
      <p className="pv-muestrario-texto">
        Solo en desarrollo. Los mensajes de acceso (A5) están en <EnlaceTexto href="/editor/muestrario?seccion=mensajes">?seccion=mensajes</EnlaceTexto>.
      </p>

      <Seccion titulo="Botones">
        <div className="pv-muestra-fila">
          <Boton>Guardar</Boton>
          <Boton variante="secundario">Cancelar</Boton>
          <Boton variante="peligro">Cerrar sesión</Boton>
          <Boton variante="secundario" compacto>
            Ver
          </Boton>
          <Boton variante="peligro" compacto>
            Desactivar
          </Boton>
          <Boton disabled>Deshabilitado</Boton>
        </div>
      </Seccion>

      <Seccion titulo="Chips y puntos">
        <div className="pv-muestra-fila">
          <Chip tono="verde">Publicada · v4</Chip>
          <Chip tono="ambar">Borrador</Chip>
          <Chip tono="gris">Sin configurar · invitación enviada</Chip>
          <Chip tono="gris">Desactivada</Chip>
          <Chip tono="azul">Personalizada</Chip>
        </div>
        <div className="pv-muestra-fila">
          {(['listo', 'revisar', 'falta', 'opcional'] as const).map((e) => (
            <span key={e} className="pv-muestra-punto">
              <PuntoEstado estado={e} /> <span aria-hidden="true">{e}</span>
            </span>
          ))}
        </div>
        <CajaInfo>Todo se guarda solo como borrador. En OBS no cambia nada hasta que publiques.</CajaInfo>
      </Seccion>

      <Seccion titulo="Menú lateral y pestañas">
        <div className="pv-muestra-menu">
          <MenuLateral items={MENU} pie="Todo se guarda solo como borrador. En OBS no cambia nada hasta que publiques." />
        </div>
        <Pestanas
          items={[
            { href: '#parroquias', texto: 'Parroquias', actual: true },
            { href: '#coordinadores', texto: 'Coordinadores' },
            { href: '#registro', texto: 'Registro' },
          ]}
        />
      </Seccion>

      <Seccion titulo="Interruptores y segmentado">
        <div className="pv-muestra-fila">
          <span className="pv-muestra-par">
            Logo <Interruptor etiqueta="Logo" activo={logo} onCambiar={setLogo} />
          </span>
          <span className="pv-muestra-par">
            En vivo <Interruptor etiqueta="En vivo" activo={enVivo} onCambiar={setEnVivo} />
          </span>
          <span className="pv-muestra-par">
            Deshabilitado <Interruptor etiqueta="Deshabilitado" activo={false} onCambiar={() => {}} deshabilitado />
          </span>
        </div>
        <Segmentado
          etiqueta="Fondo"
          opciones={[
            { valor: 'colores', texto: 'Colores de la parroquia' },
            { valor: 'foto', texto: 'Foto de la galería' },
            { valor: 'liso', texto: 'Color liso' },
          ]}
          valor={fondo}
          onCambiar={setFondo}
        />
      </Seccion>

      <Seccion titulo="Colores y contraste">
        <div className="pv-muestra-columnas">
          <CampoColor id="m-principal" etiqueta="Color principal" valor={principal} onCambiar={setPrincipal} />
          <CampoColor id="m-oscuro" etiqueta="Color oscuro" valor={oscuro} onCambiar={setOscuro} />
          <CampoColor id="m-acento" etiqueta="Color de acento" valor={acento} onCambiar={setAcento} />
        </div>
        <div className="pv-muestra-fila">
          {hex(principal) && <PastillaContraste etiqueta="Texto blanco sobre principal" razon={contraste('#ffffff', principal)} bloquea />}
          {hex(oscuro) && <PastillaContraste etiqueta="Sobre oscuro" razon={contraste('#ffffff', oscuro)} bloquea />}
          {hex(acento) && <PastillaContraste etiqueta="Texto blanco sobre acento" razon={contraste('#ffffff', acento)} bloquea={false} />}
          {hex(acento) && <PastillaContraste etiqueta="Ejemplo que bloquea" razon={contraste('#ffffff', acento)} bloquea />}
        </div>
      </Seccion>

      <Seccion titulo="Imagen">
        <CampoImagen id="m-logo" etiqueta="Logo blanco" textoVacio="logo blanco" alt={alt} onAlt={setAlt} onCambiar={() => {}} onElegir={() => {}} />
      </Seccion>

      <Seccion titulo="Campos">
        <div className="pv-muestra-columnas">
          <CampoTexto id="m-nombre" etiqueta="Nombre" ayuda="Así te ven en el registro de cambios." />
          <CampoTexto id="m-correo" etiqueta="Correo" readOnly defaultValue="correo@ejemplo.org" ayuda="Es el correo de la invitación; no se puede cambiar." />
          <CampoSelect id="m-asignar" etiqueta="Asignar a" ayuda="Una parroquia puede tener varios coordinadores; todos editan, publican y transmiten.">
            <option>San José</option>
          </CampoSelect>
        </div>
        <div className="pv-muestra-columnas">
          <CampoClave id="m-clave" etiqueta="Contraseña nueva" autoComplete="new-password" valor={clave} onCambio={setClave} requerido={false} />
          <CampoClave id="m-repetida" etiqueta="Repite la contraseña" autoComplete="new-password" valor={repetida} onCambio={setRepetida} requerido={false} />
          <ListaRequisitos requisitos={requisitosClave(clave, repetida)} />
        </div>
      </Seccion>

      <Seccion titulo="Tabla">
        <Tabla
          etiqueta="Parroquias"
          columnas={[
            { titulo: 'Parroquia', ancho: '2.2fr' },
            { titulo: 'Link', ancho: '1.4fr' },
            { titulo: 'Estado', ancho: '1.1fr' },
            { titulo: 'Coordinadores', ancho: '1.5fr' },
            { titulo: '', ancho: '230px' },
          ]}
          filas={[
            {
              clave: 'ciudad-arce',
              celdas: [
                <span key="n">
                  <b>Inmaculada Concepción de María</b>
                  <br />
                  <span className="pv-muestra-sub">Ciudad Arce, La Libertad</span>
                </span>,
                <span key="s" className="pv-muestra-slug">
                  ciudad-arce
                </span>,
                <Chip key="e" tono="verde">
                  Publicada · v4
                </Chip>,
                'Fabricio, Hno. Danilo',
                <span key="a" className="pv-muestra-acciones">
                  <Boton variante="secundario" compacto aria-label="Ver Inmaculada Concepción de María">
                    Ver
                  </Boton>
                  <Boton variante="peligro" compacto aria-label="Desactivar Inmaculada Concepción de María">
                    Desactivar
                  </Boton>
                </span>,
              ],
            },
            {
              clave: 'san-jose',
              celdas: [
                <span key="n">
                  <b>San José</b>
                  <br />
                  <span className="pv-muestra-sub">Lugar de ejemplo</span>
                </span>,
                <span key="s" className="pv-muestra-slug">
                  san-jose
                </span>,
                <Chip key="e" tono="ambar">
                  Borrador
                </Chip>,
                'María López',
                <span key="a" className="pv-muestra-acciones">
                  <Boton variante="secundario" compacto aria-label="Ver San José">
                    Ver
                  </Boton>
                  <Boton variante="peligro" compacto aria-label="Desactivar San José">
                    Desactivar
                  </Boton>
                </span>,
              ],
            },
          ]}
        />
      </Seccion>

      <Seccion titulo="Diálogo">
        <div>
          <Boton onClick={() => setDialogo(true)}>Invitar coordinador</Boton>
        </div>
        <Dialogo abierto={dialogo} titulo="Invitar coordinador" onCerrar={() => setDialogo(false)}>
          <CampoTexto id="m-invitar-correo" etiqueta="Correo" type="email"/>
          <CampoSelect id="m-invitar-parroquia" etiqueta="Asignar a" ayuda="Una parroquia puede tener varios coordinadores; todos editan, publican y transmiten.">
            <option>San José</option>
          </CampoSelect>
          <CajaInfo>Le llega un correo para crear su contraseña. La invitación dura 7 días; si vence, se reenvía desde la lista.</CajaInfo>
          <div className="pv-dialogo-acciones">
            <Boton variante="secundario" onClick={() => setDialogo(false)}>
              Cancelar
            </Boton>
            <Boton onClick={() => setDialogo(false)}>Enviar invitación</Boton>
          </div>
        </Dialogo>
      </Seccion>
    </main>
  );
}
