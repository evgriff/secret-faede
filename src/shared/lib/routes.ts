export const routePaths = {
  root: '/',
  signIn: '/sign-in',
  authComplete: '/auth/complete',
  gardens: '/gardens',
} as const;

export function buildGardenPath(gardenId: string): string {
  return `${routePaths.gardens}/${gardenId}`;
}
