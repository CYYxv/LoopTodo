export type Environment = {
  NODE_ENV: string;
  PORT: number;
  DATABASE_URL: string;
  REDIS_URL: string;
  JWT_ACCESS_SECRET: string;
  JWT_REFRESH_SECRET: string;
  JWT_ACCESS_TTL_SECONDS: number;
  JWT_REFRESH_TTL_SECONDS: number;
};

export function validateEnvironment(input: Record<string, unknown>): Environment {
  const environment: Environment = {
    NODE_ENV: String(input.NODE_ENV ?? 'development'),
    PORT: positiveInteger(input.PORT ?? 3000, 'PORT'),
    DATABASE_URL: required(input.DATABASE_URL, 'DATABASE_URL'),
    REDIS_URL: required(input.REDIS_URL, 'REDIS_URL'),
    JWT_ACCESS_SECRET: secret(input.JWT_ACCESS_SECRET, 'JWT_ACCESS_SECRET'),
    JWT_REFRESH_SECRET: secret(input.JWT_REFRESH_SECRET, 'JWT_REFRESH_SECRET'),
    JWT_ACCESS_TTL_SECONDS: positiveInteger(input.JWT_ACCESS_TTL_SECONDS ?? 900, 'JWT_ACCESS_TTL_SECONDS'),
    JWT_REFRESH_TTL_SECONDS: positiveInteger(input.JWT_REFRESH_TTL_SECONDS ?? 2_592_000, 'JWT_REFRESH_TTL_SECONDS'),
  };
  return environment;
}

function required(value: unknown, name: string) {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw new Error(`${name} is required`);
  return normalized;
}

function secret(value: unknown, name: string) {
  const normalized = required(value, name);
  if (normalized.length < 32) throw new Error(`${name} must be at least 32 characters`);
  return normalized;
}

function positiveInteger(value: unknown, name: string) {
  const normalized = Number(value);
  if (!Number.isInteger(normalized) || normalized <= 0) throw new Error(`${name} must be a positive integer`);
  return normalized;
}
