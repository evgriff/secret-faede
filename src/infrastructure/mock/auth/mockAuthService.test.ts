import { MockAuthService } from './mockAuthService';

describe('MockAuthService', () => {
  it('signs in with a password and persists the session', async () => {
    const service = new MockAuthService();
    const user = await service.signInWithPassword({
      email: 'gardener@example.com',
      password: 'password',
      rememberDevice: true,
    });

    expect(user.email).toBe('gardener@example.com');
    expect(service.getCurrentUser()?.uid).toBe(user.uid);
  });

  it('rejects an incorrect password', async () => {
    const service = new MockAuthService();

    await expect(
      service.signInWithPassword({
        email: 'gardener@example.com',
        password: 'wrong',
        rememberDevice: true,
      }),
    ).rejects.toThrow('The email or password is incorrect.');
  });
});
