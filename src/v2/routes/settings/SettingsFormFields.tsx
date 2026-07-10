import type { AlertKind } from '../../domain';
import { CheckboxField, TextField } from '../../ui';
import styles from './SettingsPage.module.css';
import type { SettingsDraft, SettingsErrors } from './settingsModel';

const alertKinds: Array<{
  description: string;
  kind: AlertKind;
  label: string;
}> = [
  {
    description:
      'Crop-group deficits calculated from actual weather and watering.',
    kind: 'watering',
    label: 'Watering',
  },
  {
    description: 'Low-temperature risk against the saved garden location.',
    kind: 'frost',
    label: 'Frost',
  },
  {
    description: 'Heat conditions that change crop care or watering demand.',
    kind: 'heat',
    label: 'Heat stress',
  },
  {
    description: 'Severe weather that could damage the active plot.',
    kind: 'severeWeather',
    label: 'Severe weather',
  },
  {
    description: 'Field work that is due in Today.',
    kind: 'taskDue',
    label: 'Tasks due',
  },
];

export function GardenSettingsFields({
  draft,
  errors,
  onChange,
}: SettingsFieldsProps) {
  return (
    <section aria-labelledby="garden-settings-title" className={styles.panel}>
      <div className={styles.sectionHeading}>
        <h2 id="garden-settings-title">Shared garden</h2>
        <p>
          These values drive weather, frost timing, and watering for both garden
          accounts.
        </p>
      </div>
      <div className={styles.formGrid}>
        <TextField
          error={errors.locationLabel ?? null}
          label="Location label"
          onChange={(event) =>
            onChange({ locationLabel: event.currentTarget.value })
          }
          required
          value={draft.locationLabel}
        />
        <TextField
          error={errors.locationQuery ?? null}
          hint="A city, postal code, or weather-provider lookup string."
          label="Weather location"
          onChange={(event) =>
            onChange({ locationQuery: event.currentTarget.value })
          }
          required
          value={draft.locationQuery}
        />
        <TextField
          error={errors.timezone ?? null}
          hint="Use an IANA name such as America/Detroit."
          label="Garden timezone"
          onChange={(event) =>
            onChange({ timezone: event.currentTarget.value })
          }
          required
          value={draft.timezone}
        />
      </div>
      <fieldset className={styles.group}>
        <legend>Weather coordinates</legend>
        <p>
          Exact coordinates are required because weather observations and every
          crop-group watering calculation use this physical point. The location
          description above is for people; it is not geocoded automatically.
        </p>
        <div className={styles.formGridTwo}>
          <TextField
            error={errors.latitude ?? null}
            label="Latitude"
            max="90"
            min="-90"
            onChange={(event) =>
              onChange({ latitude: event.currentTarget.value })
            }
            placeholder="42.3314"
            required
            step="any"
            type="number"
            value={draft.latitude}
          />
          <TextField
            error={errors.longitude ?? null}
            label="Longitude"
            max="180"
            min="-180"
            onChange={(event) =>
              onChange({ longitude: event.currentTarget.value })
            }
            placeholder="-83.0458"
            required
            step="any"
            type="number"
            value={draft.longitude}
          />
        </div>
      </fieldset>
      <fieldset className={styles.group}>
        <legend>Climate assumptions</legend>
        <p>These are editable planning defaults, not observed guarantees.</p>
        <div className={styles.formGridThree}>
          <TextField
            error={errors.hardinessZone ?? null}
            hint="USDA zone, for example 6b."
            label="Hardiness zone"
            onChange={(event) =>
              onChange({ hardinessZone: event.currentTarget.value })
            }
            required
            value={draft.hardinessZone}
          />
          <TextField
            error={errors.lastFrost ?? null}
            hint="MM-DD"
            label="Typical last frost"
            onChange={(event) =>
              onChange({ lastFrost: event.currentTarget.value })
            }
            pattern="\d{2}-\d{2}"
            placeholder="05-05"
            required
            value={draft.lastFrost}
          />
          <TextField
            error={errors.firstFrost ?? null}
            hint="MM-DD"
            label="Typical first frost"
            onChange={(event) =>
              onChange({ firstFrost: event.currentTarget.value })
            }
            pattern="\d{2}-\d{2}"
            placeholder="10-20"
            required
            value={draft.firstFrost}
          />
        </div>
      </fieldset>
    </section>
  );
}

export function AlertSettingsFields({
  draft,
  errors,
  onChange,
}: SettingsFieldsProps) {
  return (
    <section aria-labelledby="alert-settings-title" className={styles.panel}>
      <div className={styles.sectionHeading}>
        <h2 id="alert-settings-title">Garden alerts</h2>
        <p>
          In-app history is always retained. These switches control which
          operational alerts may notify this account outside the stream.
        </p>
      </div>
      <fieldset className={styles.group}>
        <legend>Alert kinds</legend>
        <div className={styles.checkGrid}>
          {alertKinds.map(({ description, kind, label }) => (
            <CheckboxField
              checked={draft.alertKinds[kind]}
              key={kind}
              onChange={(event) =>
                onChange({
                  alertKinds: {
                    ...draft.alertKinds,
                    [kind]: event.currentTarget.checked,
                  },
                })
              }
            >
              <strong>{label}</strong>
              <small>{description}</small>
            </CheckboxField>
          ))}
        </div>
      </fieldset>
      <div className={styles.formGridThree}>
        <TextField
          error={errors.dailyCheckTime ?? null}
          hint="Watering push alerts generated earlier wait until this time in the garden timezone. Quiet hours can defer them longer."
          label="Daily watering check"
          onChange={(event) =>
            onChange({ dailyCheckTime: event.currentTarget.value })
          }
          required
          type="time"
          value={draft.dailyCheckTime}
        />
        <TextField
          error={errors.quietHoursStart ?? null}
          label="Quiet hours start"
          onChange={(event) =>
            onChange({ quietHoursStart: event.currentTarget.value })
          }
          required
          type="time"
          value={draft.quietHoursStart}
        />
        <TextField
          error={errors.quietHoursEnd ?? null}
          label="Quiet hours end"
          onChange={(event) =>
            onChange({ quietHoursEnd: event.currentTarget.value })
          }
          required
          type="time"
          value={draft.quietHoursEnd}
        />
      </div>
      <TextField
        error={errors.minimumWateringDeficitInches ?? null}
        hint="Recommendations below this deficit remain informational. Range: 0.05–2 inches."
        label="Minimum watering deficit"
        max="2"
        min="0.05"
        onChange={(event) =>
          onChange({
            minimumWateringDeficitInches: event.currentTarget.value,
          })
        }
        required
        step="0.05"
        type="number"
        value={draft.minimumWateringDeficitInches}
      />
    </section>
  );
}

interface SettingsFieldsProps {
  draft: SettingsDraft;
  errors: SettingsErrors;
  onChange(update: Partial<SettingsDraft>): void;
}
