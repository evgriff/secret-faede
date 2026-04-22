import styles from './FirstRunSetupWizard.module.css';

export function FirstRunTemplateOption({
  checked,
  description,
  name,
  onChange,
  summary,
  value,
}: {
  checked: boolean;
  description: string;
  name: string;
  onChange(): void;
  summary: string;
  value: string;
}) {
  return (
    <label className={`${styles.template} ${checked ? styles.selected : ''}`}>
      <input checked={checked} onChange={onChange} type="radio" value={value} />
      <span>
        <strong>{name}</strong>
        <small>{summary}</small>
        <em>{description}</em>
      </span>
    </label>
  );
}
