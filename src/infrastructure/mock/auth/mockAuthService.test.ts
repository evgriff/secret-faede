import { MockAuthService } from './mockAuthService';

describe('MockAuthService', () => {
  it('completes a same-device sign-in flow and persists the session', async () => {
    const service = new MockAuthService();
    const request = await service.requestEmailSignIn('gardener@example.com');

    if (!request.completionPath) {
      throw new Error('Expected a completion path for mock sign-in.');
    }

    const user = await service.completeEmailLinkSignIn({
      url: `http://localhost${request.completionPath}`,
    });

    expect(user.email).toBe('gardener@example.com');
    expect(service.getCurrentUser()?.uid).toBe(user.uid);
    expect(service.getStoredEmail()).toBeNull();
  });
});
