import { useState, type FormEvent } from 'react';

import type { Task } from '../../../domain/gardens/GardenRepository';
import { formatTaskType } from '../todayFormatters';
import styles from './TodayManualTaskForm.module.css';

export interface TodayManualTaskInput {
  dueDate: string;
  notes: string;
  title: string;
  type: Task['type'];
}

export function TodayManualTaskForm({
  onAddTask,
  todayDate,
}: {
  onAddTask(input: TodayManualTaskInput): Promise<boolean>;
  todayDate: string;
}) {
  const [date, setDate] = useState(todayDate);
  const [notes, setNotes] = useState('');
  const [title, setTitle] = useState('');
  const [type, setType] = useState<Task['type']>('other');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!title.trim()) {
      return;
    }

    const saved = await onAddTask({
      dueDate: date || todayDate,
      notes: notes.trim(),
      title: title.trim(),
      type,
    });

    if (saved) {
      setDate(todayDate);
      setNotes('');
      setTitle('');
      setType('other');
    }
  }

  return (
    <section className={styles.quickAdd} aria-label="Quick add task">
      <form onSubmit={(event) => void handleSubmit(event)}>
        <label>
          <span>Task</span>
          <input
            onChange={(event) => setTitle(event.currentTarget.value)}
            placeholder="Add a field task"
            value={title}
          />
        </label>
        <label>
          <span>Type</span>
          <select
            onChange={(event) =>
              setType(event.currentTarget.value as Task['type'])
            }
            value={type}
          >
            {taskTypes.map((taskType) => (
              <option key={taskType} value={taskType}>
                {formatTaskType(taskType)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Due</span>
          <input
            onChange={(event) => setDate(event.currentTarget.value)}
            type="date"
            value={date}
          />
        </label>
        <label>
          <span>Notes</span>
          <input
            onChange={(event) => setNotes(event.currentTarget.value)}
            placeholder="Optional"
            value={notes}
          />
        </label>
        <button type="submit">Add task</button>
      </form>
    </section>
  );
}

const taskTypes: Task['type'][] = [
  'other',
  'water',
  'weed',
  'inspect',
  'harvest',
  'fertilize',
  'prune',
  'mulch',
];
