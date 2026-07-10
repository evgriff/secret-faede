import { LinkButton } from '../../ui';
import styles from './SystemPages.module.css';

export interface NotFoundPageProps {
  returnHref?: string;
  returnLabel?: string;
}

export function NotFoundPage({
  returnHref = '/',
  returnLabel = 'Return to the app',
}: NotFoundPageProps) {
  return (
    <main className={styles.page} data-sf-v2="system">
      <section aria-labelledby="not-found-title" className={styles.card}>
        <div className={styles.heading}>
          <p className={styles.eyebrow}>Page not found</p>
          <h1 className={styles.title} id="not-found-title">
            This path is not in the field book
          </h1>
          <p className={styles.lead}>
            The link may be old or mistyped. Your garden data has not been
            changed.
          </p>
        </div>
        <div className={styles.actions}>
          <LinkButton href={returnHref} variant="primary">
            {returnLabel}
          </LinkButton>
        </div>
      </section>
    </main>
  );
}
