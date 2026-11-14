import type { Requisito } from '../../lib/clave';

/** Requisitos de la contraseña, marcados mientras se escribe. El estado también se dice en texto. */
export function ListaRequisitos({ requisitos }: { requisitos: Requisito[] }) {
  return (
    <ul className="pv-requisitos" aria-live="polite">
      {requisitos.map((r) => (
        <li key={r.texto} className={r.cumplido ? 'pv-requisito pv-requisito--cumplido' : 'pv-requisito'}>
          {r.cumplido ? (
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24">
              <path d="M5 12l5 5 9-10" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="2" fill="none" />
            </svg>
          )}
          {r.texto}
          <span className="pv-solo-lectores">{r.cumplido ? ' (cumplido)' : ' (falta)'}</span>
        </li>
      ))}
    </ul>
  );
}
