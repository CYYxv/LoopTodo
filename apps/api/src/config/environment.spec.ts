import { validateEnvironment } from './environment';

test('uses the star formula for a new deployment by default', () => {
  const environment = validateEnvironment({
    DATABASE_URL: 'postgresql://localhost/looptodo',
    REDIS_URL: 'redis://localhost:6379',
    JWT_ACCESS_SECRET: 'access-secret-for-tests-1234567890',
    JWT_REFRESH_SECRET: 'refresh-secret-for-tests-123456789',
  });

  expect(environment.SCORING_FORMULA_VERSION).toBe('v2-stars');
});
