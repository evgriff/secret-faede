import { createDefaultUserProfile } from '../../domain/gardens/GardenRepository';
import type { Garden } from '../../domain/gardens/GardenRepository';
import type { GardenSetupRequest } from '../../domain/gardens/gardenTemplates';
import type { UserProfileRepository } from '../../domain/users/UserProfileRepository';
import type { PlanWarning } from '../garden/gardenPlanning';

export async function syncSetupProfile({
  authUser,
  request,
  userProfileRepository,
}: {
  authUser: { email: string; uid: string } | null;
  request: GardenSetupRequest;
  userProfileRepository: UserProfileRepository;
}) {
  if (!authUser) {
    return;
  }

  const savedProfile = await userProfileRepository.getUserProfile(
    authUser.uid,
    authUser.email,
  );
  const baseProfile =
    savedProfile ?? createDefaultUserProfile(authUser.uid, authUser.email);
  const updatedAtIso = new Date().toISOString();

  await userProfileRepository.saveUserProfile({
    ...baseProfile,
    alertLocationQuery: request.location.locationQuery,
    climateProfile: request.climateProfile,
    notificationPreference: {
      ...baseProfile.notificationPreference,
      timezone: request.location.timezone,
    },
    timezone: request.location.timezone,
    updatedAtIso,
  });
}

export function getWarningSelection(garden: Garden, warning: PlanWarning) {
  for (const id of warning.itemIds) {
    if (garden.plantings.some((planting) => planting.id === id)) {
      return { id, type: 'planting' as const };
    }

    if (garden.structures.some((structure) => structure.id === id)) {
      return { id, type: 'structure' as const };
    }
  }

  return null;
}
