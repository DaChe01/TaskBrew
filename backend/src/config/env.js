import dotenv from 'dotenv';
import cron from 'node-cron';

const isValidTimezone = (tz) => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

const toBool = (value, fallback) => {
  if (value === undefined || value === '') return fallback;
  return ['true', '1', 'yes'].includes(String(value).toLowerCase());
};

/** Loads .env for local development. The test run supplies its own environment. */
export function loadDotenv() {
  if (process.env.NODE_ENV !== 'test') dotenv.config({ quiet: true });
}

/**
 * Reads and validates environment variables once, at startup.
 * Throws a readable error listing every problem, so a misconfigured
 * deployment fails immediately instead of at the first request.
 */
export function loadConfig(env = process.env) {
  const nodeEnv = env.NODE_ENV || 'development';
  const isProduction = nodeEnv === 'production';
  const problems = [];

  if (!env.DATABASE_URL) problems.push('DATABASE_URL is required');

  if (!env.JWT_SECRET) {
    problems.push('JWT_SECRET is required');
  } else if (env.JWT_SECRET.length < 32 && nodeEnv !== 'test') {
    problems.push('JWT_SECRET must be at least 32 characters long');
  }

  const port = Number(env.PORT || 5000);
  if (!Number.isInteger(port) || port <= 0) problems.push('PORT must be a positive integer');

  const timezone = env.APP_TIMEZONE || 'UTC';
  if (!isValidTimezone(timezone)) {
    problems.push(`APP_TIMEZONE "${timezone}" is not a valid IANA timezone`);
  }

  // Reminders are optional and need SMTP credentials to do anything.
  const smtpConfigured = Boolean(env.SMTP_HOST && env.SMTP_FROM);
  const remindersEnabled = toBool(env.REMINDERS_ENABLED, true) && smtpConfigured;
  const reminderCron = env.REMINDER_CRON || '0 9 * * *';
  if (remindersEnabled && !cron.validate(reminderCron)) {
    problems.push(`REMINDER_CRON "${reminderCron}" is not a valid cron expression`);
  }

  if (problems.length > 0) {
    throw new Error(`Invalid environment configuration:\n - ${problems.join('\n - ')}`);
  }

  const smtpPort = Number(env.SMTP_PORT || 587);
  const frontendUrls = (env.FRONTEND_URL || 'http://localhost:5173')
    .split(',')
    .map((url) => url.trim().replace(/\/$/, ''))
    .filter(Boolean);

  return Object.freeze({
    nodeEnv,
    isProduction,
    isTest: nodeEnv === 'test',
    port,
    databaseUrl: env.DATABASE_URL,
    // TLS certificate verification stays ON unless explicitly disabled.
    databaseSsl: toBool(env.DATABASE_SSL, isProduction),
    databaseSslRejectUnauthorized: toBool(env.DATABASE_SSL_REJECT_UNAUTHORIZED, true),
    jwtSecret: env.JWT_SECRET,
    jwtExpiresIn: env.JWT_EXPIRES_IN || '7d',
    // bcrypt cost factor is never below 12 outside of the automated test run.
    bcryptRounds: nodeEnv === 'test' ? 4 : 12,
    frontendUrls,
    trustProxy: env.TRUST_PROXY ? Number(env.TRUST_PROXY) : false,
    authRateLimitMax: Number(env.AUTH_RATE_LIMIT_MAX || (nodeEnv === 'test' ? 10000 : 20)),
    timezone,
    reminders: Object.freeze({
      enabled: remindersEnabled,
      smtpConfigured,
      cron: reminderCron,
      triggerSecret: env.REMINDER_TRIGGER_SECRET || null,
      appUrl: frontendUrls[0],
      smtp: Object.freeze({
        host: env.SMTP_HOST,
        port: smtpPort,
        secure: smtpPort === 465,
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
        from: env.SMTP_FROM,
      }),
    }),
  });
}
