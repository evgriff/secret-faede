import type { AuthService } from '../../domain/auth/AuthService';
import type { GardenRepository } from '../../domain/gardens/GardenRepository';
import type { AppEnvironment } from '../../shared/config/env';
import { resolveAppEnvironment } from '../../shared/config/env';
import { FirebaseAuthService } from '../firebase/auth/firebaseAuthService';
import { FirebaseGardenRepository } from '../firebase/gardens/firebaseGardenRepository';
import { MockAuthService } from '../mock/auth/mockAuthService';
import { MockGardenRepository } from '../mock/gardens/mockGardenRepository';

export interface AppServices {
  authService: AuthService;
  environment: AppEnvironment;
  gardenRepository: GardenRepository;
}

export function createRuntimeServices(
  environment: AppEnvironment = resolveAppEnvironment(),
): AppServices {
  if (environment.runtimeMode === 'firebase') {
    return {
      authService: new FirebaseAuthService(environment),
      environment,
      gardenRepository: new FirebaseGardenRepository(environment),
    };
  }

  return {
    authService: new MockAuthService(),
    environment,
    gardenRepository: new MockGardenRepository(),
  };
}
