/** Command Center sign-in is limited to the owner. */
export const OWNER_EMAIL = 'caseylsims@gmail.com';

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function assertOwnerEmail(value: string): string {
  const email = normalizeEmail(value);
  if (email !== OWNER_EMAIL) {
    throw new Error('Sign-up and sign-in are limited to caseylsims@gmail.com.');
  }
  return email;
}

export function assertPassword(value: string): string {
  if (value.length < 8 || value.length > 200) {
    throw new Error('Use at least 8 characters.');
  }
  return value;
}
