export type WeatherProviderId = 'nationalWeatherService' | 'tomorrowIo';

export interface WeatherLocation {
  latitude: number;
  locationName: string;
  longitude: number;
  timezone: string;
}

export interface WeatherCurrentConditions {
  capturedAtIso: string;
  conditionSummary: string;
  feelsLikeF: number | null;
  humidityPercent: number | null;
  observationTimeIso: string | null;
  precipitationLastHourIn: number | null;
  providerId: WeatherProviderId;
  sourceLabel: string;
  temperatureF: number | null;
  windMph: number | null;
}

export interface WeatherForecastPeriod {
  endIso: string;
  isDaytime: boolean | null;
  precipitationAmountIn: number | null;
  precipitationChancePercent: number | null;
  shortForecast: string;
  startIso: string;
  temperatureF: number | null;
}

export interface WeatherForecast {
  dailyHighF: number | null;
  generatedAtIso: string;
  next24hPrecipIn: number;
  next48hPrecipIn: number;
  nextRainIso: string | null;
  overnightLowF: number | null;
  periods: WeatherForecastPeriod[];
  providerId: WeatherProviderId;
  summary: string;
}

export interface WeatherAlert {
  description: string;
  endIso: string | null;
  event: string;
  headline: string;
  id: string;
  instruction: string;
  severity: string;
  source: string;
  startIso: string | null;
  urgency: string;
}

export interface PrecipitationObservation {
  observedAtIso: string;
  precipitationIn: number;
}

export interface RecentPrecipitation {
  generatedAtIso: string;
  hours: number;
  last24hIn: number;
  last72hIn: number;
  observations: PrecipitationObservation[];
  providerId: WeatherProviderId;
  totalIn: number;
}

export interface OptionalAgricultureMetrics {
  evapotranspirationIn: number | null;
  evapotranspirationNext24hIn: number | null;
  generatedAtIso: string;
  notes: string[];
  providerId: WeatherProviderId;
}

export interface WeatherProvider {
  getCurrentConditions(
    location: WeatherLocation,
  ): Promise<WeatherCurrentConditions>;
  getForecast(location: WeatherLocation): Promise<WeatherForecast>;
  getOptionalAgricultureMetrics(
    location: WeatherLocation,
  ): Promise<OptionalAgricultureMetrics>;
  getRecentPrecipitation(
    location: WeatherLocation,
    hours: number,
  ): Promise<RecentPrecipitation>;
  getWeatherAlerts(location: WeatherLocation): Promise<WeatherAlert[]>;
  id: WeatherProviderId;
  label: string;
}
