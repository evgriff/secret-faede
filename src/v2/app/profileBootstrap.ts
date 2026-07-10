import type { AuthUser } from '../../domain/auth/types';
import type { UserProfile } from '../domain';
import { createDefaultProfile, type V2Services } from './services';

export async function loadOrCreateProfile(
  services: V2Services,
  user: AuthUser,
) {
  try {
    const profile = await services.userProfileRepository.getProfile(user.uid);
    const correctedProfile = correctPlaceholderIdentity(profile, user);
    if (correctedProfile !== profile) {
      await services.userProfileRepository.saveProfile(correctedProfile);
    }
    return correctedProfile;
  } catch (error) {
    if (!String(error).toLowerCase().includes('missing')) throw error;
    const identity = user.displayName
      ? { displayName: user.displayName, email: user.email }
      : { email: user.email };
    const profile = createDefaultProfile(user.uid, identity);
    await services.userProfileRepository.saveProfile(profile);
    return profile;
  }
}

export function correctPlaceholderIdentity(
  profile: UserProfile,
  user: AuthUser,
) {
  const authDisplayName = user.displayName?.trim() ?? '';
  const authEmail = user.email.trim().toLowerCase();
  const profileEmail = profile.email.trim().toLowerCase();
  const hasPlaceholderEmail =
    !profileEmail ||
    profileEmail === `${profile.userId.toLowerCase()}@example.invalid`;
  const hasPlaceholderName =
    !profile.displayName.trim() ||
    (profile.displayName.trim() === 'Gardener' && hasPlaceholderEmail);
  const displayName =
    hasPlaceholderName && authDisplayName
      ? authDisplayName
      : profile.displayName;
  const email = hasPlaceholderEmail && authEmail ? authEmail : profile.email;

  if (displayName === profile.displayName && email === profile.email) {
    return profile;
  }
  return {
    ...profile,
    displayName,
    email,
    updatedAtIso: new Date().toISOString(),
  };
}
