import { formatMonthDay, formatWeekday } from '../todayFormatters';
import styles from '../TodayPage.module.css';

export function TodayCalendarStrip({
  days,
  onSelectDate,
  selectedDate,
  todayDate,
}: {
  days: Array<{ count: number; date: string }>;
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
          <small>
            {day.count} {day.count === 1 ? 'task' : 'tasks'}
          </small>
        </button>
      ))}
    </section>
  );
}
