import cron from 'node-cron';
import { logger } from '../utils/logger.js';

/** Runs the reminder job on the configured cron schedule (REMINDER_CRON, in APP_TIMEZONE). */
export function startReminderScheduler({ config, reminderService }) {
  if (!reminderService.enabled) {
    logger.info('Email reminders are disabled (set SMTP_HOST and SMTP_FROM to enable them)');
    return { stop() {} };
  }

  const task = cron.schedule(
    config.reminders.cron,
    async () => {
      try {
        const summary = await reminderService.run();
        logger.info('Reminder run finished', summary);
      } catch (err) {
        logger.error('Reminder run crashed', { message: err.message });
      }
    },
    { timezone: config.timezone },
  );

  logger.info(`Email reminders scheduled: "${config.reminders.cron}" (${config.timezone})`);
  return { stop: () => task.stop() };
}
