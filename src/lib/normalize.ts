export function getStringValue(value: any, fallback = ''): string {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'object') {
    if ('name' in value && typeof value.name === 'string' && value.name.trim() !== '') {
      return value.name;
    }
    if ('id' in value && typeof value.id === 'string' && value.id.trim() !== '') {
      return value.id;
    }
  }
  return fallback;
}
