import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { useServices } from '../../../app/providers';
import type { GardenSummary } from '../../../domain/gardens/types';
import { routePaths } from '../../../shared/lib/routes';
import { useAuth } from '../../auth/auth-context';
import { useSelectedGarden } from '../garden-context';
import styles from './GardenHomePage.module.css';

export function GardenHomePage() {
  const { gardenId = '' } = useParams();
  const { gardenRepository } = useServices();
  const {
    state: { user },
  } = useAuth();
  const { selectGarden } = useSelectedGarden();
  const [garden, setGarden] = useState<GardenSummary | null>(null);
  const [status, setStatus] = useState<'error' | 'idle' | 'loading'>('loading');

  useEffect(() => {
    if (!user || !gardenId) {
      return;
    }

    selectGarden(gardenId);
    setStatus('loading');
    void gardenRepository
      .getById(gardenId, user.uid)
      .then((result) => {
        setGarden(result);
        setStatus('idle');
      })
      .catch(() => {
        setStatus('error');
      });
  }, [gardenId, gardenRepository, selectGarden, user]);

  if (status === 'loading') {
    return (
      <section className="pageShell" data-route-shell="true">
        <div className="pageCard stack">Loading garden context…</div>
      </section>
    );
  }

  if (status === 'error' || !garden) {
    return (
      <section className="pageShell" data-route-shell="true">
        <div className="pageCard stack">
          <p className="pageLead">Garden unavailable</p>
          <h1 className="pageTitle">This garden could not be loaded.</h1>
          <Link to={routePaths.gardens}>Return to the garden list</Link>
        </div>
      </section>
    );
  }

  return (
    <section className="pageShell" data-route-shell="true">
      <div className="pageCard stack">
        <p className="pageLead">Garden shell</p>
        <h1 className="pageTitle">{garden.name}</h1>
        <p className="pageLead">
          This route proves auth guards, local garden persistence, and
          repository-backed loading without pretending the milestone already
          contains dashboards or editing tools.
        </p>
      </div>
      <div className={`pageCard ${styles.grid}`}>
        <dl className={styles.meta}>
          <div className={styles.metaRow}>
            <dt className={styles.metaLabel}>Role</dt>
            <dd>{garden.memberRole}</dd>
          </div>
          <div className={styles.metaRow}>
            <dt className={styles.metaLabel}>Dimensions</dt>
            <dd>
              {garden.dimensions.width}×{garden.dimensions.height}{' '}
              {garden.dimensions.unit}
            </dd>
          </div>
          <div className={styles.metaRow}>
            <dt className={styles.metaLabel}>Timezone</dt>
            <dd>{garden.timezone}</dd>
          </div>
          <div className={styles.metaRow}>
            <dt className={styles.metaLabel}>Status</dt>
            <dd>{garden.updatedLabel}</dd>
          </div>
        </dl>
      </div>
      <div className="pageCard stack">
        <h2>Deliberately deferred</h2>
        <ul className={styles.list}>
          <li>Plot editing and layout manipulation</li>
          <li>Planting CRUD and germination logic</li>
          <li>Weather, reminders, and collaboration invite flows</li>
        </ul>
      </div>
    </section>
  );
}
