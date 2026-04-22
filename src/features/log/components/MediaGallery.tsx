import type { JournalEntry } from '../../../domain/gardens/GardenRepository';
import { formatDate } from '../logHelpers';
import cardStyles from './LogCards.module.css';
import pageStyles from '../LogPage.module.css';

export function MediaGallery({ entries }: { entries: JournalEntry[] }) {
  return (
    <section className={pageStyles.panel}>
      <div className={pageStyles.sectionHeader}>
        <div>
          <h2>Media attachments</h2>
          <p className={pageStyles.summary}>
            Photos stay attached to the note, issue, bed, or planting they came
            from.
          </p>
        </div>
      </div>
      {entries.length > 0 ? (
        <div className={cardStyles.mediaGrid}>
          {entries.flatMap((entry) =>
            entry.photos.map((photo) => (
              <figure className={cardStyles.mediaCard} key={photo.id}>
                <img alt={photo.fileName} src={photo.downloadUrl} />
                <figcaption>
                  <strong>{entry.title}</strong>
                  <span>
                    {entry.targetLabel} · {formatDate(entry.occurredOn)}
                  </span>
                </figcaption>
              </figure>
            )),
          )}
        </div>
      ) : (
        <p className={cardStyles.empty}>No photos match the current filters.</p>
      )}
    </section>
  );
}
