import { useEffect, useState } from 'react';
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';

import { getFirestoreClient } from '../../infrastructure/firebase/app';
import type { NotificationDeliveryHistoryItem } from '../routes/settings';
import { useV2Services } from './V2ServicesContext';

export function useDeliveryHistory(userId: string | null) {
  const services = useV2Services();
  const [items, setItems] = useState<NotificationDeliveryHistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId || services.environment.runtimeMode !== 'firebase') {
      setItems([]);
      setError(null);
      return;
    }
    const db = getFirestoreClient(services.environment);
    return onSnapshot(
      query(
        collection(db, 'users', userId, 'notificationDeliveries'),
        orderBy('createdAtIso', 'desc'),
        limit(50),
      ),
      (snapshot) => {
        try {
          setItems(
            snapshot.docs.map((entry) => mapDelivery(entry.id, entry.data())),
          );
          setError(null);
        } catch (caught) {
          setError(message(caught));
        }
      },
      (caught) => setError(message(caught)),
    );
  }, [services.environment, userId]);

  return { error, items };
}

export function mapDelivery(
  id: string,
  value: Record<string, unknown>,
): NotificationDeliveryHistoryItem {
  const reason = text(value.decisionReason) || text(value.errorMessage) || null;
  const createdAtIso = text(value.createdAtIso);
  if (!Number.isFinite(Date.parse(createdAtIso))) {
    throw new Error('A notification delivery has an invalid timestamp.');
  }
  return {
    body:
      text(value.body) ||
      text(value.message) ||
      reason ||
      'Garden alert delivery decision.',
    channel: mapChannel(value.channel),
    createdAtIso,
    id,
    kind: mapKind(value.type),
    reason,
    status: mapStatus(value.status),
    title: text(value.title) || humanize(text(value.type) || 'Garden alert'),
  };
}

function mapChannel(value: unknown) {
  return value === 'push' || value === 'local' ? value : 'inApp';
}

function mapKind(value: unknown): NotificationDeliveryHistoryItem['kind'] {
  const normalized = text(value);
  if (normalized === 'frost') return 'frost';
  if (normalized === 'heat' || normalized === 'heatStress') return 'heat';
  if (normalized === 'severeWeather') return 'severeWeather';
  if (normalized === 'taskDue') return 'taskDue';
  return 'watering';
}

function mapStatus(value: unknown): NotificationDeliveryHistoryItem['status'] {
  if (value === 'sent') return 'sent';
  if (value === 'failed') return 'failed';
  if (value === 'skipped') return 'suppressed';
  return 'queued';
}

function message(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : 'Notification delivery history could not be loaded.';
}

function text(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function humanize(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (letter) => letter.toUpperCase());
}
