import crypto from 'node:crypto';
import { Router } from 'express';
import { AppError } from '../errors/AppError.js';

const safeEqual = (a, b) => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};

/**
 * POST /api/reminders/run — lets an external scheduler (for example a free cron
 * pinger) trigger the job when the host puts the server to sleep. Disabled
 * unless REMINDER_TRIGGER_SECRET is set.
 */
export function createReminderRoutes({ config, reminderService }) {
  const router = Router();

  router.post('/run', async (req, res) => {
    const secret = config.reminders.triggerSecret;
    if (!secret)
      throw AppError.notFound('Route POST /api/reminders/run not found', 'ROUTE_NOT_FOUND');

    const provided = req.get('x-reminder-secret') ?? '';
    if (!safeEqual(provided, secret)) {
      throw AppError.unauthorized('Invalid reminder trigger secret', 'INVALID_TRIGGER_SECRET');
    }
    res.json({ success: true, data: await reminderService.run() });
  });

  return router;
}
