import {
  detroitClimateProfile,
  detroitLocation,
  type ClimateProfile,
  type GardenLocation,
  type MonthDayString,
} from './GardenRepository';

interface KnownClimateProfile {
  aliases: string[];
  averageFirstFrost: MonthDayString;
  averageLastFrost: MonthDayString;
  hardinessZone: string;
  latitude: number;
  locationName: string;
  longitude: number;
  timezone: string;
}

const knownClimateProfiles: KnownClimateProfile[] = [
  {
    aliases: ['detroit', '48201'],
    averageFirstFrost: '10-15',
    averageLastFrost: '04-30',
    hardinessZone: '6b',
    latitude: 42.3314,
    locationName: 'Detroit, MI',
    longitude: -83.0458,
    timezone: 'America/Detroit',
  },
  {
    aliases: ['chicago'],
    averageFirstFrost: '10-15',
    averageLastFrost: '04-25',
    hardinessZone: '6a',
    latitude: 41.8781,
    locationName: 'Chicago, IL',
    longitude: -87.6298,
    timezone: 'America/Chicago',
  },
  {
    aliases: ['minneapolis', 'st paul', 'saint paul'],
    averageFirstFrost: '10-05',
    averageLastFrost: '05-05',
    hardinessZone: '5a',
    latitude: 44.9778,
    locationName: 'Minneapolis, MN',
    longitude: -93.265,
    timezone: 'America/Chicago',
  },
  {
    aliases: ['new york', 'brooklyn', 'queens'],
    averageFirstFrost: '11-10',
    averageLastFrost: '04-05',
    hardinessZone: '7b',
    latitude: 40.7128,
    locationName: 'New York, NY',
    longitude: -74.006,
    timezone: 'America/New_York',
  },
  {
    aliases: ['boston'],
    averageFirstFrost: '11-05',
    averageLastFrost: '04-20',
    hardinessZone: '7a',
    latitude: 42.3601,
    locationName: 'Boston, MA',
    longitude: -71.0589,
    timezone: 'America/New_York',
  },
  {
    aliases: ['atlanta'],
    averageFirstFrost: '11-15',
    averageLastFrost: '03-20',
    hardinessZone: '8a',
    latitude: 33.749,
    locationName: 'Atlanta, GA',
    longitude: -84.388,
    timezone: 'America/New_York',
  },
  {
    aliases: ['austin'],
    averageFirstFrost: '11-25',
    averageLastFrost: '02-20',
    hardinessZone: '9a',
    latitude: 30.2672,
    locationName: 'Austin, TX',
    longitude: -97.7431,
    timezone: 'America/Chicago',
  },
  {
    aliases: ['denver'],
    averageFirstFrost: '10-05',
    averageLastFrost: '05-05',
    hardinessZone: '6a',
    latitude: 39.7392,
    locationName: 'Denver, CO',
    longitude: -104.9903,
    timezone: 'America/Denver',
  },
  {
    aliases: ['seattle'],
    averageFirstFrost: '11-15',
    averageLastFrost: '03-15',
    hardinessZone: '9a',
    latitude: 47.6062,
    locationName: 'Seattle, WA',
    longitude: -122.3321,
    timezone: 'America/Los_Angeles',
  },
  {
    aliases: ['portland'],
    averageFirstFrost: '11-10',
    averageLastFrost: '03-20',
    hardinessZone: '9a',
    latitude: 45.5152,
    locationName: 'Portland, OR',
    longitude: -122.6784,
    timezone: 'America/Los_Angeles',
  },
  {
    aliases: ['san francisco'],
    averageFirstFrost: '12-15',
    averageLastFrost: '01-15',
    hardinessZone: '10a',
    latitude: 37.7749,
    locationName: 'San Francisco, CA',
    longitude: -122.4194,
    timezone: 'America/Los_Angeles',
  },
];

export function createGardenLocationFromInput({
  latitude,
  locationName,
  locationQuery,
  longitude,
  timezone,
}: {
  latitude: number | null;
  locationName: string;
  locationQuery: string;
  longitude: number | null;
  timezone: string;
}): GardenLocation {
  return {
    latitude,
    locationName: locationName.trim() || locationQuery.trim() || 'Garden',
    locationQuery: locationQuery.trim() || locationName.trim() || 'Garden',
    longitude,
    timezone: timezone.trim() || detroitLocation.timezone,
  };
}

export function createClimateProfileForLocation({
  averageFirstFrost,
  averageLastFrost,
  hardinessZone,
  location,
  source = 'user',
}: {
  averageFirstFrost?: MonthDayString;
  averageLastFrost?: MonthDayString;
  hardinessZone?: string;
  location: GardenLocation;
  source?: ClimateProfile['source'];
}): ClimateProfile {
  const estimate = findKnownClimateProfile(location);

  return {
    averageFirstFrost:
      averageFirstFrost ??
      estimate?.averageFirstFrost ??
      detroitClimateProfile.averageFirstFrost,
    averageLastFrost:
      averageLastFrost ??
      estimate?.averageLastFrost ??
      detroitClimateProfile.averageLastFrost,
    editableByUser: true,
    hardinessZone:
      hardinessZone ??
      estimate?.hardinessZone ??
      detroitClimateProfile.hardinessZone,
    locationName: location.locationName,
    source,
    updatedAtIso: new Date().toISOString(),
  };
}

export function findKnownClimateProfile(
  location: GardenLocation,
): KnownClimateProfile | null {
  const query = `${location.locationQuery} ${location.locationName}`
    .trim()
    .toLowerCase();
  const aliasMatch = knownClimateProfiles.find((profile) =>
    profile.aliases.some((alias) => query.includes(alias)),
  );

  if (aliasMatch) {
    return aliasMatch;
  }

  if (location.latitude === null || location.longitude === null) {
    return null;
  }

  const latitude = location.latitude;
  const longitude = location.longitude;
  const nearest = knownClimateProfiles
    .map((profile) => ({
      distance:
        Math.abs(profile.latitude - latitude) +
        Math.abs(profile.longitude - longitude),
      profile,
    }))
    .sort((left, right) => left.distance - right.distance)[0];

  return nearest && nearest.distance <= 1.25 ? nearest.profile : null;
}

export function getKnownClimateProfiles() {
  return knownClimateProfiles;
}
