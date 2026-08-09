const US_PHONE_MAX_DIGITS = 10;

export function getPhoneDigits(value: string) {
  const digits = value.replace(/\D/g, '');
  const normalizedDigits =
    digits.length > US_PHONE_MAX_DIGITS && digits.startsWith('1')
      ? digits.slice(1)
      : digits;

  return normalizedDigits.slice(0, US_PHONE_MAX_DIGITS);
}

export function formatUsPhoneNumber(value: string) {
  const digits = getPhoneDigits(value);

  if (digits.length <= 3) {
    return digits;
  }

  if (digits.length <= 6) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  }

  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function hasCompleteUsPhoneNumber(value: string) {
  return value.replace(/\D/g, '').length === US_PHONE_MAX_DIGITS;
}
