interface FirebaseAuthLikeError {
  code?: string;
  message?: string;
}

function isFirebaseAuthLikeError(
  error: unknown,
): error is FirebaseAuthLikeError {
  return typeof error === 'object' && error !== null;
}

export function getFirebaseAuthErrorMessage(error: unknown): string {
  if (!isFirebaseAuthLikeError(error)) {
    return 'Unable to complete Firebase authentication. Check the Firebase project setup and try again.';
  }

  switch (error.code) {
    case 'auth/configuration-not-found':
    case 'auth/operation-not-allowed':
      return 'Firebase Authentication is missing required email-link sign-in setup. In Firebase Console, enable Email/Password and Email link sign-in, then try again.';
    case 'auth/unauthorized-domain':
      return 'This domain is not authorized for Firebase Authentication. Add the current app domain, including localhost for local development, to Authorized domains in Firebase Console.';
    default:
      return error.message?.trim()
        ? error.message
        : 'Unable to complete Firebase authentication. Check the Firebase project setup and try again.';
  }
}
