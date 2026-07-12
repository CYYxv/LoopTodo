export type Environment = {
  NODE_ENV: string;
  PORT: number;
  DATABASE_URL: string;
  REDIS_URL: string;
  JWT_ACCESS_SECRET: string;
  JWT_REFRESH_SECRET: string;
  JWT_ACCESS_TTL_SECONDS: number;
  JWT_REFRESH_TTL_SECONDS: number;
  SCORING_FORMULA_VERSION: string;
  SCORING_DURATION_WEIGHT: number;
  SCORING_STREAK_POINTS_PER_DAY: number;
  SCORING_HIGH_TRUST_POINTS: number;
  SCORING_NORMAL_TRUST_POINTS: number;
  SCORING_UNTIMED_POINTS: number;
  SCORING_EMERGENCY_EXIT_PENALTY: number;
  RANK_THRESHOLDS_JSON: string;
  TEAM_AVERAGE_WEIGHT: number;
  TEAM_TOTAL_BONUS_WEIGHT: number;
  PAYMENT_PROVIDER: string;
  PAYMENT_API_URL: string;
  PAYMENT_API_KEY: string;
  PAYMENT_WEBHOOK_SECRET: string;
  REWARD_ADDRESS_ENCRYPTION_KEY: string;
  ADMIN_EMAILS: string;
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
    SCORING_FORMULA_VERSION: String(input.SCORING_FORMULA_VERSION ?? 'v1'),
    SCORING_DURATION_WEIGHT: finiteNumber(input.SCORING_DURATION_WEIGHT ?? 0.6, 'SCORING_DURATION_WEIGHT'),
    SCORING_STREAK_POINTS_PER_DAY: finiteNumber(input.SCORING_STREAK_POINTS_PER_DAY ?? 3, 'SCORING_STREAK_POINTS_PER_DAY'),
    SCORING_HIGH_TRUST_POINTS: finiteNumber(input.SCORING_HIGH_TRUST_POINTS ?? 10, 'SCORING_HIGH_TRUST_POINTS'),
    SCORING_NORMAL_TRUST_POINTS: finiteNumber(input.SCORING_NORMAL_TRUST_POINTS ?? 7, 'SCORING_NORMAL_TRUST_POINTS'),
    SCORING_UNTIMED_POINTS: finiteNumber(input.SCORING_UNTIMED_POINTS ?? 5, 'SCORING_UNTIMED_POINTS'),
    SCORING_EMERGENCY_EXIT_PENALTY: finiteNumber(input.SCORING_EMERGENCY_EXIT_PENALTY ?? -30, 'SCORING_EMERGENCY_EXIT_PENALTY'),
    RANK_THRESHOLDS_JSON: rankThresholds(input.RANK_THRESHOLDS_JSON ?? '[0,500,1500,3000,5000,8000]'),
    TEAM_AVERAGE_WEIGHT: finiteNumber(input.TEAM_AVERAGE_WEIGHT ?? 0.7, 'TEAM_AVERAGE_WEIGHT'),
    TEAM_TOTAL_BONUS_WEIGHT: finiteNumber(input.TEAM_TOTAL_BONUS_WEIGHT ?? 0.3, 'TEAM_TOTAL_BONUS_WEIGHT'),
    PAYMENT_PROVIDER: String(input.PAYMENT_PROVIDER ?? 'test'),
    PAYMENT_API_URL: String(input.PAYMENT_API_URL ?? ''),
    PAYMENT_API_KEY: String(input.PAYMENT_API_KEY ?? ''),
    PAYMENT_WEBHOOK_SECRET: String(input.PAYMENT_WEBHOOK_SECRET ?? 'development-payment-webhook-secret'),
    REWARD_ADDRESS_ENCRYPTION_KEY: String(input.REWARD_ADDRESS_ENCRYPTION_KEY ?? 'development-reward-address-key'),
    ADMIN_EMAILS: String(input.ADMIN_EMAILS ?? ''),
  };
  if (!['http', 'test'].includes(environment.PAYMENT_PROVIDER)) throw new Error('PAYMENT_PROVIDER must be http or test');
  if (environment.NODE_ENV === 'production' && environment.PAYMENT_PROVIDER === 'test') throw new Error('PAYMENT_PROVIDER=test is not allowed in production');
  if (environment.NODE_ENV === 'production' && environment.PAYMENT_WEBHOOK_SECRET.length < 32) throw new Error('PAYMENT_WEBHOOK_SECRET must be at least 32 characters in production');
  if (environment.NODE_ENV === 'production' && environment.REWARD_ADDRESS_ENCRYPTION_KEY.length < 32) throw new Error('REWARD_ADDRESS_ENCRYPTION_KEY must be at least 32 characters in production');
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

function finiteNumber(value: unknown, name: string) {
  const normalized = Number(value);
  if (!Number.isFinite(normalized)) throw new Error(`${name} must be a finite number`);
  return normalized;
}

function rankThresholds(value: unknown) {
  const normalized = String(value);
  let parsed: unknown;
  try { parsed = JSON.parse(normalized); } catch { throw new Error('RANK_THRESHOLDS_JSON must be valid JSON'); }
  if (!Array.isArray(parsed) || parsed.length !== 6 || !parsed.every((item) => Number.isFinite(item))) throw new Error('RANK_THRESHOLDS_JSON must contain six numeric thresholds');
  if (parsed.some((item, index) => index > 0 && item <= parsed[index - 1])) throw new Error('RANK_THRESHOLDS_JSON thresholds must be strictly increasing');
  return normalized;
}
