export function sanitizeObject(
  obj: Record<string, unknown>,
  redactKeys: (string | RegExp)[] = [],
  maskCharacter = '*'
): Record<string, unknown> {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (shouldRedactKey(key, redactKeys)) {
      sanitized[key] = maskValue(value, maskCharacter);
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key] = sanitizeObject(value as Record<string, unknown>, redactKeys, maskCharacter);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map((item) =>
        item && typeof item === 'object' && !Array.isArray(item)
          ? sanitizeObject(item as Record<string, unknown>, redactKeys, maskCharacter)
          : item
      );
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

function shouldRedactKey(key: string, redactKeys: (string | RegExp)[]): boolean {
  return redactKeys.some((pattern) => {
    if (typeof pattern === 'string') {
      return key.toLowerCase().includes(pattern.toLowerCase());
    }
    return pattern.test(key);
  });
}

function maskValue(value: unknown, maskCharacter: string): string {
  if (typeof value === 'string') {
    return value.length > 0 ? maskCharacter.repeat(value.length) : '';
  }
  return maskCharacter.repeat(8);
}