export interface GeocodeResult {
  latitude: number;
  locationName: string;
  longitude: number;
}

export async function geocodeLocation(
  query: string,
  apiKey: string,
): Promise<GeocodeResult> {
  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('address', query);
  url.searchParams.set('key', apiKey);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('Geocoding request failed.');
  }

  const payload = (await response.json()) as {
    results?: Array<{
      formatted_address?: string;
      geometry?: { location?: { lat?: number; lng?: number } };
    }>;
    status?: string;
  };
  const firstResult = payload.results?.[0];
  const latitude = firstResult?.geometry?.location?.lat;
  const longitude = firstResult?.geometry?.location?.lng;

  if (
    payload.status !== 'OK' ||
    !firstResult ||
    typeof latitude !== 'number' ||
    typeof longitude !== 'number'
  ) {
    throw new Error('No geocoding result found.');
  }

  return {
    latitude,
    locationName: firstResult.formatted_address ?? query,
    longitude,
  };
}
