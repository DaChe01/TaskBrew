import { runner } from 'node-pg-migrate';
import { assertTestDatabase } from './testDb.js';

/** Applies every migration to the test database once, before the test run. */
export default async function setup() {
  const url =
    process.env.TEST_DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5432/taskmanager_test';
  assertTestDatabase(url);

  await runner({
    databaseUrl: url,
    dir: 'migrations',
    direction: 'up',
    migrationsTable: 'pgmigrations',
    log: () => {},
  });
}
