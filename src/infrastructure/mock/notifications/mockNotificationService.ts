import type {
  ForegroundPushMessage,
  NotificationService,
  PushRegistrationResult,
} from '../../../domain/notifications/NotificationService';

export class MockNotificationService implements NotificationService {
  async registerWebPush(userId: string): Promise<PushRegistrationResult> {
    void userId;

    return {
      message: 'Web push is unavailable in mock runtime.',
      status: 'unavailable',
      tokenRegisteredAtIso: null,
    };
  }

  subscribeToForegroundMessages(
    onMessage: (message: ForegroundPushMessage) => void,
  ) {
    void onMessage;

    return () => undefined;
  }
}
