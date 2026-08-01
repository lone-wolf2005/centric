export function toSnakeKey(key: string): string {
  return key
    .replace(/([A-Z])/g, '_$1')
    .replace(/__/g, '_')
    .toLowerCase();
}

export function toCamelKey(key: string): string {
  return key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

export function keysToSnake<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => keysToSnake(item)) as T;
  }
  if (value instanceof Date) {
    return value.toISOString() as T;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[toSnakeKey(k)] = keysToSnake(v);
    }
    return out as T;
  }
  return value;
}

export function keysToCamel<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => keysToCamel(item)) as T;
  }
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[toCamelKey(k)] = keysToCamel(v);
    }
    return out as T;
  }
  return value;
}

export function randomCode(prefix: string): string {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${stamp}-${rand}`;
}

export const CENTERING_MATERIALS = [
  'Centering Sheet',
  'Adjustment Sheet',
  'Aluminium Channel',
  'Adjustable Props',
  'Adjustable Span',
];

export function inclusiveDays(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  return Math.max(1, Math.round(ms / 86400000) + 1);
}
