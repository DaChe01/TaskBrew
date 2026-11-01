import pg from 'pg';

// Postgres DATE columns (OID 1082) are returned as plain 'YYYY-MM-DD' strings.
// The default parser builds a JS Date at local midnight, which then serialises
// to UTC and can shift a due date by one day depending on the server timezone.
// This runs on import; every module that reads DATE columns imports it directly
// so it can never be skipped.
pg.types.setTypeParser(1082, (value) => value);
