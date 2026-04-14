import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { GardenGlyphIcon } from '../../../assets/icons/GardenIcons';
import { PlantPin } from '../../../assets/icons/PlantPins';
import {
  BotanicalDivider,
  FoldedMapIllustration,
} from '../../../assets/illustrations/GardenIllustrations';
import { useServices } from '../../../app/providers';
import type { GardenPlot, GardenSummary } from '../../../domain/gardens/types';
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
  const [plots, setPlots] = useState<GardenPlot[]>([]);
  const [status, setStatus] = useState<'error' | 'idle' | 'loading'>('loading');

  useEffect(() => {
    if (!user || !gardenId) {
      return;
    }

    selectGarden(gardenId);
    setStatus('loading');
    void Promise.all([
      gardenRepository.getById(gardenId, user.uid),
      gardenRepository.listPlots(gardenId, user.uid),
    ])
      .then(([gardenResult, plotResults]) => {
        setGarden(gardenResult);
        setPlots(plotResults);
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
        <div className={styles.heroRow}>
          <div className={styles.heroBadgeRow}>
            <span className={styles.heroBadge}>
              <GardenGlyphIcon
                accentColor="var(--color-plant-green)"
                size={24}
              />
              {garden.memberRole}
            </span>
            <span className={styles.heroBadge}>
              <PlantPin size={28} state="selected" tone="green" />
              {garden.plotCount} plots
            </span>
          </div>
          <BotanicalDivider className={styles.divider} size="100%" />
        </div>
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
        <FoldedMapIllustration
          accentColor="var(--color-plant-marigold)"
          animated
          className={styles.summaryArt}
          title="Folded garden map illustration"
        />
      </div>
      <div className="pageCard stack">
        <h2>Starter plots</h2>
        <BotanicalDivider className={styles.divider} size="100%" />
        {plots.length > 0 ? (
          <ul className={styles.plotList}>
            {plots.map((plot) => (
              <li className={styles.plotItem} key={plot.id}>
                <div>
                  <p className={styles.plotName}>{plot.name}</p>
                  <p className={styles.plotMeta}>
                    {plot.width}×{plot.height} ft at {plot.x},{plot.y}
                  </p>
                </div>
                <span className={styles.plotBadge}>
                  rotation {plot.rotation}°
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.emptyState}>
            No plot fixtures are available for this garden yet.
          </p>
        )}
      </div>
      <div className="pageCard stack">
        <h2>Deliberately deferred</h2>
        <BotanicalDivider className={styles.divider} size="100%" />
        <ul className={styles.list}>
          <li>Plot editing and layout manipulation</li>
          <li>Planting CRUD and germination logic</li>
          <li>Weather, reminders, and collaboration invite flows</li>
        </ul>
      </div>
    </section>
  );
}
