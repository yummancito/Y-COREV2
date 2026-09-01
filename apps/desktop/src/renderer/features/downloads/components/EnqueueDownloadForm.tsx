/**
 * `EnqueueDownloadForm` — formulario manual para encolar una descarga.
 *
 * Sirve para verificar el motor de descargas (Fase 4) en la app real: hasta
 * que exista una feature que resuelva "de dónde sale la URL y el hash de lo
 * que se va a descargar" (ver `docs/02-features/downloads/README.md`,
 * sección "Lo que falta"), este formulario es la única forma de ejercitar
 * `downloads.enqueue` fuera de los tests. No resuelve catálogos ni conoce
 * Steam — el usuario pega la URL y el hash a mano.
 */

import { useId, useState } from 'react';
import { useEnqueueDownload, type EnqueueDownloadInput } from '../hooks/use-enqueue-download.js';

const EMPTY_FORM: EnqueueDownloadInput = { appId: 0, sourceUrl: '', installPath: '', expectedSha256: '' };

interface FormFieldProps {
  readonly id: string;
  readonly label: string;
  readonly type: 'number' | 'url' | 'text';
  readonly value: string | number;
  readonly onChange: (value: string) => void;
}

/** Un `<label>` + `<input>` requerido, para no repetir el mismo bloque cuatro veces. */
function FormField({ id, label, type, value, onChange }: FormFieldProps): React.JSX.Element {
  return (
    <div>
      <label htmlFor={id}>{label}</label>
      <input id={id} type={type} required value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

export function EnqueueDownloadForm(): React.JSX.Element {
  const appIdFieldId = useId();
  const sourceUrlFieldId = useId();
  const installPathFieldId = useId();
  const sha256FieldId = useId();

  const [form, setForm] = useState<EnqueueDownloadInput>(EMPTY_FORM);
  const enqueue = useEnqueueDownload();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    enqueue.mutate(form, { onSuccess: () => setForm(EMPTY_FORM) });
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2>Encolar descarga (prueba manual)</h2>
      <FormField
        id={appIdFieldId}
        label="App ID"
        type="number"
        value={form.appId}
        onChange={(value) => setForm({ ...form, appId: Number(value) })}
      />
      <FormField
        id={sourceUrlFieldId}
        label="URL de origen"
        type="url"
        value={form.sourceUrl}
        onChange={(value) => setForm({ ...form, sourceUrl: value })}
      />
      <FormField
        id={installPathFieldId}
        label="Ruta de instalación"
        type="text"
        value={form.installPath}
        onChange={(value) => setForm({ ...form, installPath: value })}
      />
      <FormField
        id={sha256FieldId}
        label="SHA-256 esperado"
        type="text"
        value={form.expectedSha256}
        onChange={(value) => setForm({ ...form, expectedSha256: value })}
      />
      <button type="submit" disabled={enqueue.isPending}>
        Encolar
      </button>
      {enqueue.isError && <p role="alert">No se pudo encolar: {enqueue.error.message}</p>}
    </form>
  );
}
