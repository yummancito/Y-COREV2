/**
 * `SettingsPanel` — pantalla de ajustes: idioma, canal de updates, Discord,
 * bandeja del sistema.
 *
 * Sirve como la única superficie de UI de la feature Settings. Cada control
 * dispara `useUpdateSettings` con solo el campo que cambió — el servicio del
 * main fusiona ese parche con lo ya guardado, así que el componente nunca
 * manda el objeto completo.
 */

import { useSettingsQuery } from '../hooks/use-settings-query.js';
import { useUpdateSettings } from '../hooks/use-update-settings.js';

const LANGUAGE_OPTIONS = [
  { value: '', label: 'Seguir el idioma del sistema' },
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'English' },
];

export function SettingsPanel(): React.JSX.Element {
  const settings = useSettingsQuery();
  const update = useUpdateSettings();

  if (settings.isPending) return <p>Cargando ajustes…</p>;
  if (settings.isError) return <p>No se pudieron cargar los ajustes: {settings.error.message}</p>;

  const { data } = settings;

  return (
    <section>
      <h2>Ajustes</h2>

      <label>
        Idioma
        <select
          value={data.language ?? ''}
          onChange={(event) => update.mutate({ language: event.target.value.length === 0 ? null : event.target.value })}
        >
          {LANGUAGE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label>
        Canal de actualizaciones
        <select
          value={data.updateChannel}
          onChange={(event) => update.mutate({ updateChannel: event.target.value as 'stable' | 'beta' })}
        >
          <option value="stable">Estable</option>
          <option value="beta">Beta</option>
        </select>
      </label>

      <label>
        <input
          type="checkbox"
          checked={data.discordRichPresenceEnabled}
          onChange={(event) => update.mutate({ discordRichPresenceEnabled: event.target.checked })}
        />
        Mostrar presencia en Discord
      </label>

      <label>
        <input
          type="checkbox"
          checked={data.closeToTray}
          onChange={(event) => update.mutate({ closeToTray: event.target.checked })}
        />
        Minimizar a la bandeja al cerrar
      </label>
    </section>
  );
}
