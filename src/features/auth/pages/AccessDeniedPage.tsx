import { useNavigate } from 'react-router-dom';

import { routePaths } from '../../../shared/lib/routes';
import { useAuth } from '../auth-context';
import styles from './AccessDeniedPage.module.css';

export function AccessDeniedPage() {
  const navigate = useNavigate();
  const { clearAccessState, signOut, state } = useAuth();

  async function handleReturnToSignIn() {
    clearAccessState();
    await signOut();
    await navigate(routePaths.signIn, { replace: true });
  }

  return (
    <section className="pageShell" data-route-shell="true">
      <div className="pageCard stack">
        <h1 className="pageTitle">This email address is not authorized.</h1>
        <p className="pageLead">
          This app only allows the configured garden planner accounts.
        </p>
        {state.deniedEmail ? (
          <p className={styles.emailLabel}>
            Attempted email: <span>{state.deniedEmail}</span>
          </p>
        ) : null}
        <div className={styles.actions}>
          <button
            className={styles.button}
            onClick={() => void handleReturnToSignIn()}
            type="button"
          >
            Return to sign-in
          </button>
        </div>
      </div>
    </section>
  );
}
