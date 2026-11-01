import pg from 'pg';
import './pgTypes.js';

/**
 * Creates a connection pool from validated configuration.
 * The caller (server.js or the tests) owns the pool, so importing a module
 * never opens a database connection as a side effect.
 */
export function createPool(config) {
  const ssl = config.databaseSsl
    ? { rejectUnauthorized: config.databaseSslRejectUnauthorized }
    : false;

  return new pg.Pool({
    connectionString: config.databaseUrl,
    ssl,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
}
