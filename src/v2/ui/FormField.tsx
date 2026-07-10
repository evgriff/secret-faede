import { useId, type InputHTMLAttributes, type ReactNode } from 'react';

import './foundation.css';
import styles from './components.module.css';

export interface TextFieldProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'id'
> {
  error?: string | null;
  hint?: ReactNode;
  id?: string;
  label: ReactNode;
}

export function TextField({
  'aria-describedby': describedBy,
  className = '',
  error,
  hint,
  id,
  label,
  required,
  ...props
}: TextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? `sf2-field-${generatedId.replaceAll(':', '')}`;
  const hintId = hint ? `${inputId}-hint` : null;
  const errorId = error ? `${inputId}-error` : null;
  const descriptionIds = [describedBy, hintId, errorId]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={inputId}>
        {label}{' '}
        {required ? (
          <span className={styles.required} aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      <input
        {...props}
        aria-describedby={descriptionIds || undefined}
        aria-invalid={Boolean(error)}
        className={`${styles.input} ${error ? styles.invalid : ''} ${className}`.trim()}
        id={inputId}
        required={required}
      />
      {hint ? (
        <p className={styles.hint} id={hintId ?? undefined}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className={styles.fieldError} id={errorId ?? undefined} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export interface CheckboxFieldProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type'
> {
  children: ReactNode;
}

export function CheckboxField({
  children,
  className = '',
  ...props
}: CheckboxFieldProps) {
  return (
    <label className={`${styles.checkbox} ${className}`.trim()}>
      <input {...props} type="checkbox" />
      <span>{children}</span>
    </label>
  );
}
