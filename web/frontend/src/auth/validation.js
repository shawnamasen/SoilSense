export const EMAIL_REGEX = /^[a-z0-9._%+-]+@(gmail\.com|phinmaed\.com|soilsense\.com)$/;
export const NAME_REGEX = /^[A-Za-z]+(?:[ '-][A-Za-z]+)+$/;
export const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_\-+=])[^\s]{8,64}$/;
export function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}
export function validatePassword(value) {
  if (!PASSWORD_REGEX.test(value)) {
    return 'Use 8–64 characters with uppercase, lowercase, number, and special character.';
  }
  return '';
}
