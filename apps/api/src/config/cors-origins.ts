export function parseCorsOrigins(value: unknown): string[] | false {
  const origins = String(value ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  return origins.length > 0 ? [...new Set(origins)] : false;
}
