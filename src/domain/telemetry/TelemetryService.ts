export type AnalyticsEventName =
  | 'garden_setup_complete'
  | 'harvest_logged'
  | 'issue_reported'
  | 'note_added'
  | 'planting_added'
  | 'season_crop_list_updated'
  | 'sign_in_complete'
  | 'structure_added'
  | 'task_completed'
  | 'template_selected'
  | 'warning_shown'
  | 'water_alert_sent'
  | 'watering_recommendation_generated';

export interface AnalyticsEventPayload {
  [key: string]: boolean | number | string | null | undefined;
}

export interface ErrorTelemetryPayload {
  componentStack?: string;
  context?: string;
  message?: string;
}

export interface TelemetryService {
  captureError(error: unknown, payload?: ErrorTelemetryPayload): void;
  trackEvent(name: AnalyticsEventName, payload?: AnalyticsEventPayload): void;
}
