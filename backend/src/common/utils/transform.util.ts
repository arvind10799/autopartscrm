export function trimString(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim();
}

export function trimToUndefined(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
}

export function trimToLowerCaseEmail(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim().toLowerCase();

  return trimmed.length > 0 ? trimmed : undefined;
}

export function trimToUpperCase(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim().toUpperCase();

  return trimmed.length > 0 ? trimmed : undefined;
}
