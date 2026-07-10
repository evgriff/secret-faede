import {
  forwardRef,
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
} from 'react';

import './foundation.css';
import styles from './components.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  busyLabel?: string;
  isBusy?: boolean;
  variant?: ButtonVariant;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      busyLabel,
      children,
      className = '',
      disabled,
      isBusy = false,
      type = 'button',
      variant = 'primary',
      ...props
    },
    ref,
  ) {
    return (
      <button
        {...props}
        aria-busy={isBusy}
        className={`${styles.button} ${styles[variant]} ${className}`.trim()}
        disabled={disabled || isBusy}
        ref={ref}
        type={type}
      >
        {isBusy ? <span aria-hidden="true" className={styles.spinner} /> : null}
        <span>{isBusy && busyLabel ? busyLabel : children}</span>
      </button>
    );
  },
);

export interface LinkButtonProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: ButtonVariant;
}

export const LinkButton = forwardRef<HTMLAnchorElement, LinkButtonProps>(
  function LinkButton(
    { children, className = '', variant = 'secondary', ...props },
    ref,
  ) {
    return (
      <a
        {...props}
        className={`${styles.linkButton} ${styles[variant]} ${className}`.trim()}
        ref={ref}
      >
        {children}
      </a>
    );
  },
);
