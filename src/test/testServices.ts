import { MockAuthService } from '../infrastructure/mock/auth/mockAuthService';
import { MockGardenRepository } from '../infrastructure/mock/gardens/mockGardenRepository';
import type { AppServices } from '../infrastructure/runtime/services';
import type { AppEnvironment } from '../shared/config/env';

const testEnvironment: AppEnvironment = {
  authEmulatorPort: 9099,
  emulatorHost: '127.0.0.1',
  fallbackReason: null,
  firebaseConfig: null,
  firestoreEmulatorPort: 8080,
  pwaEnabled: false,
  requestedMode: 'mock',
  runtimeMode: 'mock',
  useFirebaseEmulators: false,
};

export async function createTestServices(options?: {
  signedInEmail?: string;
}): Promise<AppServices> {
  const authService = new MockAuthService();

  if (options?.signedInEmail) {
    const result = await authService.requestEmailSignIn(options.signedInEmail);

    if (!result.completionPath) {
      throw new Error('Mock auth did not return a completion path.');
    }

    await authService.completeEmailLinkSignIn({
      url: `http://localhost${result.completionPath}`,
    });
  }

  return {
    authService,
    environment: testEnvironment,
    gardenRepository: new MockGardenRepository(),
  };
}
