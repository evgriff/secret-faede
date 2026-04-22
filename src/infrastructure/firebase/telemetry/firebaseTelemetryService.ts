import type {
  AnalyticsEventName,
  AnalyticsEventPayload,
  ErrorTelemetryPayload,
  TelemetryService,
} from '../../../domain/telemetry/TelemetryService';
import type { AppEnvironment } from '../../../shared/config/env';
import { logFirebaseAnalyticsEvent } from '../app';

export class FirebaseTelemetryService implements TelemetryService {
  constructor(private readonly environment: AppEnvironment) {}

  captureError(error: unknown, payload: ErrorTelemetryPayload = {}): void {
    console.error('Unhandled app error', error, payload);
    void logFirebaseAnalyticsEvent(this.environment, 'app_error', {
      context: payload.context ?? null,
      message:
        payload.message ??
        (error instanceof Error ? error.message : String(error)),
    });
  }

  trackEvent(
    name: AnalyticsEventName,
    payload: AnalyticsEventPayload = {},
  ): void {
    void logFirebaseAnalyticsEvent(
      this.environment,
      name,
      sanitizePayload(payload),
    );
  }
}

function sanitizePayload(payload: AnalyticsEventPayload) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined),
  );
}
