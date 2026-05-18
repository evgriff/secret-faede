import { useId, useState } from 'react';

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
    <section aria-label="One week calendar" className={styles.calendarWrap}>
      <div className={styles.calendar}>
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
                {day.markers.includes('rain') ? (
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
      </div>
      <WateringScheduleHelp />
    </section>
  );
}

function WateringScheduleHelp() {
  const [isOpen, setIsOpen] = useState(false);
  const tooltipId = useId();
  const title = 'How are watering tasks scheduled?';

  return (
    <span
      className={styles.wateringHelp}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button
        aria-describedby={isOpen ? tooltipId : undefined}
        aria-expanded={isOpen}
        aria-label={title}
        className={styles.wateringHelpButton}
        onBlur={() => setIsOpen(false)}
        onClick={() => setIsOpen((current) => !current)}
        onFocus={() => setIsOpen(true)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.stopPropagation();
            setIsOpen(false);
          }
        }}
        type="button"
      >
        ?
      </button>
      {isOpen ? (
        <span
          className={styles.wateringHelpTooltip}
          id={tooltipId}
          role="tooltip"
        >
          <strong>{title}</strong>
          <span>
            Today checks the saved plot, crops, beds, containers, soil, mulch,
            crop stage, heat, and weather.
          </span>
          <span>
            It subtracts recent rain, forecast rain, planting-day watering, and
            watering already logged in Feed.
          </span>
          <span>
            A watering task appears only when the remaining need passes that
            crop or bed threshold.
          </span>
          <span>
            Likely rain can wait until after the NWS rain window is rechecked,
            and nearby beds are grouped into one practical run.
          </span>
        </span>
      ) : null}
    </span>
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
