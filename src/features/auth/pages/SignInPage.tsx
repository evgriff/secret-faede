import { useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';

import { SeedPinLogo } from '../../../assets/brand/BrandMarks';
import {
  BotanicalDivider,
  FoldedMapIllustration,
} from '../../../assets/illustrations/GardenIllustrations';
import { routePaths } from '../../../shared/lib/routes';
import { useAuth } from '../auth-context';
import styles from './SignInPage.module.css';

function isEmail(value: string): boolean {
  return /\S+@\S+\.\S+/.test(value);
}

export function SignInPage() {
  const { requestEmailSignIn, state } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sentState, setSentState] = useState<{
    completionPath?: string;
    delivery: 'email' | 'mock-link';
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (state.user) {
    return <Navigate replace to={routePaths.root} />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();

    if (!isEmail(normalizedEmail)) {
      setError('Enter a valid email address to receive the sign-in link.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const result = await requestEmailSignIn(normalizedEmail);
      setSentState(result);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : 'Unable to send the sign-in link.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="pageShell" data-route-shell="true">
      <div className="pageCard stack">
        <p className="pageLead">Milestone 1 foundation</p>
        <h1 className="pageTitle">Sign in with an email link.</h1>
        <p className="pageLead">
          The app defaults to mock mode so local work and CI stay independent
          from live Firebase resources.
        </p>
        <div className={styles.hero}>
          <div className={styles.heroRow}>
            <SeedPinLogo
              accentColor="var(--color-plant-green)"
              animated
              className={styles.heroMark}
              size={64}
              title="Seed pin logo"
            />
            <span className={styles.heroTag}>
              Quiet utility, mock-first workflow
            </span>
          </div>
          <BotanicalDivider className={styles.divider} size="100%" />
        </div>
        {sentState ? (
          <div className="stack">
            <p className="pageLead">
              Check your email for a sign-in link. On the same device, the
              stored email can finish the flow automatically.
            </p>
            {sentState.delivery === 'mock-link' && sentState.completionPath ? (
              <Link
                className={`inkButton ${styles.button}`}
                to={sentState.completionPath}
              >
                Use mock sign-in link
              </Link>
            ) : null}
            <button
              className={`paperButton ${styles.secondaryButton}`}
              onClick={() => setSentState(null)}
              type="button"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form
            className={styles.form}
            onSubmit={(event) => void handleSubmit(event)}
          >
            <div className={styles.field}>
              <label className={styles.label} htmlFor="email">
                Email
              </label>
              <input
                autoComplete="email"
                className={styles.input}
                id="email"
                inputMode="email"
                name="email"
                onChange={(event) => setEmail(event.currentTarget.value)}
                placeholder="you@example.com"
                type="email"
                value={email}
              />
              <p className={styles.hint}>
                No passwords and no email in query params. Same-device
                completion uses local storage only.
              </p>
            </div>
            {error ? (
              <p className={styles.error} role="alert">
                {error}
              </p>
            ) : null}
            <div className={styles.actions}>
              <button
                className={`inkButton ${styles.button}`}
                disabled={isSubmitting}
                type="submit"
              >
                {isSubmitting ? 'Sending link…' : 'Send sign-in link'}
              </button>
            </div>
          </form>
        )}
      </div>

      <div className={`pageCard ${styles.supportCard}`}>
        <div className="stack">
          <h2>What this milestone includes</h2>
          <ul className={styles.helperList}>
            <li>Mock-first auth and garden data providers</li>
            <li>
              Firebase Auth and Firestore seams behind explicit interfaces
            </li>
            <li>Local selection persistence and guarded routing</li>
          </ul>
        </div>
        <FoldedMapIllustration
          accentColor="var(--color-plant-marigold)"
          animated
          className={styles.supportArt}
          title="Folded map illustration"
        />
      </div>
    </section>
  );
}
