export type PushRegistrationStatus =
  | 'denied'
  | 'registered'
  | 'unsupported'
  | 'unavailable';

export interface PushRegistrationResult {
  message: string;
  status: PushRegistrationStatus;
  tokenRegisteredAtIso: string | null;
}

export interface ForegroundPushMessage {
  body: string;
  link: string;
  title: string;
  type: string;
}

export interface NotificationService {
  registerNativePush(userId: string): Promise<PushRegistrationResult>;
  registerWebPush(userId: string): Promise<PushRegistrationResult>;
  subscribeToForegroundMessages(
    onMessage: (message: ForegroundPushMessage) => void,
  ): () => void;
}
