export const MIN_PASSWORD_LENGTH = 6;

/** Returns an error message, or null when the password is acceptable. */
export function validatePassword(
  password: string,
  label = "Password",
): string | null {
  return password.length < MIN_PASSWORD_LENGTH
    ? `${label} must be at least ${MIN_PASSWORD_LENGTH} characters`
    : null;
}
