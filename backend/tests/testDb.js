import pg from 'pg';

/**
 * Refuses to run against anything that does not look like a test database,
 * so a wrong env var can never wipe development data.
 */
export function assertTestDatabase(url) {
  const name = new URL(url).pathname.replace('/', '');
  if (!/test/i.test(name)) {
    throw new Error(
      `Refusing to run tests: database "${name}" does not contain "test" in its name. ` +
        'Set TEST_DATABASE_URL to a dedicated test database.',
    );
  }
}

export const createTestPool = () => {
  assertTestDatabase(process.env.DATABASE_URL);
  return new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
};

export const resetDatabase = (pool) =>
  pool.query('TRUNCATE task_reminders, tasks, users RESTART IDENTITY CASCADE');
