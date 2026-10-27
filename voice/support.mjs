export function isPhoneNumber(value) {
  return /^\+[1-9]\d{7,14}$/.test(value);
}
