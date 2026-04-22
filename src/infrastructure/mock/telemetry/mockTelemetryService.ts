import type {
  AnalyticsEventName,
  AnalyticsEventPayload,
  ErrorTelemetryPayload,
  TelemetryService,
} from '../../../domain/telemetry/TelemetryService';

export class MockTelemetryService implements TelemetryService {
  captureError(error: unknown, payload?: ErrorTelemetryPayload): void {
    if (shouldLogTelemetry()) {
      console.error('Telemetry error', error, payload);
    }
  }

  trackEvent(name: AnalyticsEventName, payload?: AnalyticsEventPayload): void {
    if (shouldLogTelemetry()) {
      console.info('Telemetry event', name, payload ?? {});
    }
  }
}

function shouldLogTelemetry() {
  return import.meta.env.DEV && import.meta.env.MODE !== 'test';
}
