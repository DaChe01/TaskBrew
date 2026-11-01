/**
 * Minimal logger. Silent during tests. Callers pass short messages and error
 * metadata only — never request bodies, headers, tokens or connection strings.
 */
const silent = () => process.env.NODE_ENV === 'test';

export const logger = {
  info: (...args) => !silent() && console.log('[info]', ...args),
  warn: (...args) => !silent() && console.warn('[warn]', ...args),
  error: (...args) => !silent() && console.error('[error]', ...args),
};
