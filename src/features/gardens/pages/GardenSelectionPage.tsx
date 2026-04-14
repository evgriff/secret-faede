import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useServices } from '../../../app/providers';
import type { GardenSummary } from '../../../domain/gardens/types';
import { buildGardenPath } from '../../../shared/lib/routes';
import { useAuth } from '../../auth/auth-context';
import { GardenCard } from '../components/GardenCard';
import { useSelectedGarden } from '../garden-context';
import styles from './GardenSelectionPage.module.css';

export function GardenSelectionPage() {
  const navigate = useNavigate();
  const { gardenRepository } = useServices();
  const {
    state: { user },
  } = useAuth();
  const { selectedGardenId, selectGarden } = useSelectedGarden();
  const [gardens, setGardens] = useState<GardenSummary[]>([]);
  const [status, setStatus] = useState<'error' | 'idle' | 'loading'>('loading');

  useEffect(() => {
    if (!user) {
      return;
    }

    setStatus('loading');
    void gardenRepository
      .listForUser(user.uid)
      .then((results) => {
        setGardens(results);
        setStatus('idle');
      })
      .catch(() => {
        setStatus('error');
      });
  }, [gardenRepository, user]);

  function handleSelect(gardenId: string) {
    selectGarden(gardenId);
    void navigate(buildGardenPath(gardenId));
  }

  return (
    <section className="pageShell" data-route-shell="true">
      <div className="pageCard stack">
        <p className="pageLead">Garden selection</p>
        <h1 className="pageTitle">
          Choose the garden context for this session.
        </h1>
        <p className="pageLead">
          Selection is stored locally per signed-in user so the app root can
          redirect back into the correct garden shell.
        </p>
      </div>
      <div className="pageCard stack">
        {status === 'loading' ? (
          <p className={styles.state}>Loading gardens…</p>
        ) : null}
        {status === 'error' ? (
          <p className={styles.state}>
            Unable to load gardens for the current account.
          </p>
        ) : null}
        {status === 'idle' ? (
          <div className={styles.list}>
            {gardens.map((garden) => (
              <GardenCard
                garden={garden}
                isSelected={selectedGardenId === garden.id}
                key={garden.id}
                onSelect={handleSelect}
              />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
