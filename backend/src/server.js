import { createApp } from './app.js';
import { createPool } from './config/db.js';
import { loadConfig, loadDotenv } from './config/env.js';
import { createMailer } from './reminders/mailer.js';
import { startReminderScheduler } from './reminders/scheduler.js';
import { logger } from './utils/logger.js';


async function main() {
  loadDotenv();

  let config;
  try {
    config = loadConfig();
  } catch (err) {
    logger.error(err.message);
    process.exit(1);
  }

  const pool = createPool(config);

  // Do not accept traffic until the database is reachable.
  try {
    await pool.query('SELECT 1');
    logger.info('Database connection established');
  } catch (err) {
    // err.message can contain host details but never the password.
    logger.error(
      `Could not connect to the database (${err.code ?? err.name}). Check DATABASE_URL.`,
    );
    await pool.end().catch(() => {});
    process.exit(1);
  }

  const { app, reminderService } = createApp({ config, pool, mailer: createMailer(config) });
  const scheduler = startReminderScheduler({ config, reminderService });

  const server = app.listen(config.port, () => {
    logger.info(`API listening on port ${config.port} (${config.nodeEnv})`);
  });

  let shuttingDown = false;
  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`${signal} received, shutting down`);
    scheduler.stop();
    server.close(async () => {
      await pool.end().catch(() => {});
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref(); // force exit if connections hang
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main();
