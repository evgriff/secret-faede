import { PlantIcon } from '../../garden/PlantIcon';
import { formatMonthDay, formatWeekday } from '../todayFormatters';
import styles from '../TodayPage.module.css';

export function TodayCalendarStrip({
  days,
  onSelectDate,
  selectedDate,
  todayDate,
}: {
  days: Array<{ count: number; date: string; markers: string[] }>;
  onSelectDate(date: string): void;
  selectedDate: string;
  todayDate: string;
}) {
  return (
    <section aria-label="Two week calendar" className={styles.calendar}>
      {days.map((day) => (
        <button
          aria-pressed={day.date === selectedDate}
          className={`${styles.calendarDay} ${
            day.date === todayDate ? styles.today : ''
          } ${day.date === selectedDate ? styles.selectedDay : ''}`}
          key={day.date}
          onClick={() => onSelectDate(day.date)}
          type="button"
        >
          <span>
            {day.date === todayDate ? 'Today' : formatWeekday(day.date)}
          </span>
          <strong>{formatMonthDay(day.date)}</strong>
          {day.markers.length > 0 ? (
            <span className={styles.calendarMarkers}>
              {day.markers.includes('watering') ? (
                <WaterDropIcon className={styles.calendarMarkerIcon} />
              ) : null}
              {day.markers.includes('plant') ? (
                <PlantIcon className={styles.calendarMarkerIcon} title="" />
              ) : null}
              {day.markers.includes('alert') ? (
                <AlertIcon className={styles.calendarMarkerIcon} />
              ) : null}
            </span>
          ) : null}
          <small>
            {day.count} {day.count === 1 ? 'task' : 'tasks'}
          </small>
        </button>
      ))}
    </section>
  );
}

function WaterDropIcon({ className }: { className?: string | undefined }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      focusable="false"
      viewBox="0 0 20 20"
    >
      <path
        d="M10 2.8c2.6 3.2 4.6 5.8 4.6 8.4a4.6 4.6 0 1 1-9.2 0c0-2.6 2-5.2 4.6-8.4Z"
        fill="currentColor"
      />
    </svg>
  );
}

function AlertIcon({ className }: { className?: string | undefined }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      focusable="false"
      viewBox="0 0 20 20"
    >
      <path
        d="M10 3.1 17 16H3L10 3.1Zm0 4.1a.9.9 0 0 0-.9.9v3.4a.9.9 0 1 0 1.8 0V8.1a.9.9 0 0 0-.9-.9Zm0 7.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
        fill="currentColor"
      />
    </svg>
  );
}
