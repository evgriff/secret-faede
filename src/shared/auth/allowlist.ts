const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const defaultAllowedEmails = [
  'primary.gardener@example.com',
  'partner.gardener@example.com',
] as const;

export interface AllowedEmailParseResult {
  allowedEmails: string[];
  error: string | null;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isEmailFormatValid(email: string): boolean {
  return emailPattern.test(normalizeEmail(email));
}

export function parseAllowedEmails(
  rawValue = defaultAllowedEmails.join(','),
): AllowedEmailParseResult {
  const normalizedEmails = rawValue
    .split(',')
    .map((email) => normalizeEmail(email))
    .filter(Boolean);
  const uniqueEmails = [...new Set(normalizedEmails)];

  if (normalizedEmails.length !== 2 || uniqueEmails.length !== 2) {
    return {
      allowedEmails: [],
      error:
        'VITE_ALLOWED_EMAILS must contain exactly two distinct email addresses.',
    };
  }

  if (!uniqueEmails.every(isEmailFormatValid)) {
    return {
      allowedEmails: [],
      error: 'VITE_ALLOWED_EMAILS must contain valid email addresses.',
    };
  }

  return {
    allowedEmails: uniqueEmails,
    error: null,
  };
}

export function isEmailAllowed(
  allowedEmails: string[],
  email: string | null | undefined,
): boolean {
  if (!email) {
    return false;
  }

  return allowedEmails.includes(normalizeEmail(email));
}
