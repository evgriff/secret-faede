import type { CommitOutcome, UserProfile } from '../domain';
import type { KeyValueStorage } from './MockGardenRepository';
import type { WorkspaceSubscription } from './GardenRepository';
import type { UserProfileRepository } from './UserProfileRepository';
import { normalizeStoredUserProfile } from './profileNormalization';
import { assertValidUserProfile } from './profileValidation';

export class MockUserProfileRepository implements UserProfileRepository {
  private readonly listeners = new Map<
    string,
    Set<{ onChange(profile: UserProfile): void; onError(error: Error): void }>
  >();

  constructor(
    private readonly storage: KeyValueStorage,
    private readonly defaults: (userId: string) => UserProfile,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async getProfile(userId: string) {
    const fallback = this.defaults(userId);
    assertValidUserProfile(fallback);
    const raw = this.storage.getItem(key(userId));
    if (!raw) {
      this.storage.setItem(key(userId), JSON.stringify(fallback));
      return fallback;
    }
    let saved: unknown;
    try {
      saved = JSON.parse(raw);
    } catch {
      saved = null;
    }
    const profile = normalizeStoredUserProfile(saved, fallback);
    this.storage.setItem(key(userId), JSON.stringify(profile));
    return profile;
  }

  async saveProfile(profile: UserProfile): Promise<CommitOutcome> {
    assertValidUserProfile(profile);
    this.storage.setItem(key(profile.userId), JSON.stringify(profile));
    for (const listener of this.listeners.get(profile.userId) ?? []) {
      listener.onChange(structuredClone(profile));
    }
    const nowIso = this.now().toISOString();
    return { committedAtIso: nowIso, status: 'committed' } as const;
  }

  subscribe(
    userId: string,
    onChange: (profile: UserProfile) => void,
    onError: (error: Error) => void,
  ): WorkspaceSubscription {
    const listener = { onChange, onError };
    const listeners = this.listeners.get(userId) ?? new Set();
    listeners.add(listener);
    this.listeners.set(userId, listeners);
    void this.getProfile(userId).then(onChange).catch(onError);
    return {
      unsubscribe: () => listeners.delete(listener),
    };
  }
}

function key(userId: string) {
  return `secret-faeries:v2:profile:${userId}`;
}
