// Campos de formulario (plan 2, tarea 3).
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CampoClave } from '../../app/componentes/CampoClave';
import { CampoSelect } from '../../app/componentes/CampoSelect';
import { CampoTexto } from '../../app/componentes/CampoTexto';
import { ListaRequisitos } from '../../app/componentes/ListaRequisitos';

const html = (e: ReactElement) => renderToStaticMarkup(e);

describe('CampoTexto', () => {
  it('CampoTexto ata ayuda y error al input', () => {
    const h = html(<CampoTexto id="correo" etiqueta="Correo" ayuda="Es el correo de la invitación; no se puede cambiar." error="X" readOnly />);
    expect(h).toContain('aria-describedby="correo-ayuda correo-error"');
    expect(h).toContain('aria-invalid="true"');
    expect(h).toContain('readOnly=""');
    expect(h).toMatch(/^<label class="pv-campo">/);
    expect(h).toContain('<span class="pv-campo-etiqueta">Correo</span>');
    expect(h).toContain('id="correo-ayuda"');
    expect(h).toContain('id="correo-error"');
    expect(h).toContain('name="correo"');
  });
  it('sin ayuda ni error no hay aria-describedby; compacto suma su clase', () => {
    const h = html(<CampoTexto id="nombre" etiqueta="Nombre" compacto />);
    expect(h).not.toContain('aria-describedby');
    expect(h).not.toContain('aria-invalid');
    expect(h).toContain('pv-campo--compacto');
  });
});

describe('CampoSelect', () => {
  it('select con su etiqueta y opciones', () => {
    const h = html(
      <CampoSelect id="tipo" etiqueta="Tipo" ayuda="Elige uno">
        <option value="a">A</option>
      </CampoSelect>,
    );
    expect(h).toContain('<select');
    expect(h).toContain('aria-describedby="tipo-ayuda"');
    expect(h).toContain('<option value="a">A</option>');
  });
});

describe('CampoClave', () => {
  it('CampoClave empieza oculto, con el botón «Mostrar contraseña» sin presionar', () => {
    const h = html(<CampoClave id="clave" etiqueta="Contraseña" autoComplete="current-password" />);
    expect(h).toContain('type="password"');
    expect(h).toContain('aria-pressed="false"');
    expect(h).toContain('aria-controls="clave"');
    expect(h).toContain('>Mostrar contraseña</button>');
    expect(h).toContain('autoComplete="current-password"');
  });
  it('con error lo ata al input', () => {
    const h = html(<CampoClave id="repetida" etiqueta="Repite la contraseña" autoComplete="new-password" error="Las dos contraseñas no son iguales." />);
    expect(h).toContain('aria-invalid="true"');
    expect(h).toContain('aria-describedby="repetida-error"');
    expect(h).toContain('Las dos contraseñas no son iguales.');
  });
});

describe('ListaRequisitos', () => {
  it('ListaRequisitos dice a los lectores qué falta', () => {
    const h = html(
      <ListaRequisitos
        requisitos={[
          { texto: 'Al menos 8 caracteres', cumplido: true },
          { texto: 'Las dos son iguales', cumplido: false },
        ]}
      />,
    );
    expect(h).toContain('aria-live="polite"');
    expect(h).toContain('Al menos 8 caracteres<span class="pv-solo-lectores"> (cumplido)</span>');
    expect(h).toContain('Las dos son iguales<span class="pv-solo-lectores"> (falta)</span>');
    expect(h).toContain('d="M5 12l5 5 9-10"');
    expect(h).toContain('r="7"');
  });
});
