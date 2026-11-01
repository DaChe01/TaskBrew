import { daysBetween, todayInTimezone } from '../utils/dates.js';
import { logger } from '../utils/logger.js';
import { buildReminderEmail } from './reminderEmail.js';
import { evaluateReminder, OVERDUE_WINDOW_DAYS, REMINDER_RULES } from './reminderRules.js';

const MAX_LEAD_DAYS = Math.max(...Object.values(REMINDER_RULES).flatMap((r) => r.leadDays));
const PRIORITY_ORDER = { High: 0, Medium: 1, Low: 2 };

/**
 * Sends one digest email per user listing every task that needs a reminder.
 * Reminders are only recorded as sent after the email succeeded, so a failed
 * delivery is retried on the next run.
 */
export function createReminderService({ config, reminderRepository, mailer }) {
  return {
    get enabled() {
      return Boolean(mailer);
    },

    async run(now = new Date()) {
      const summary = { usersNotified: 0, tasksIncluded: 0, failures: 0 };
      if (!mailer) return { ...summary, skipped: 'Email reminders are not configured' };

      const today = todayInTimezone(config.timezone, now);
      const candidates = await reminderRepository.findCandidates({
        today,
        maxLeadDays: MAX_LEAD_DAYS,
        overdueWindowDays: OVERDUE_WINDOW_DAYS,
      });

      // Decide what each task needs, grouped by user.
      const byUser = new Map();
      for (const task of candidates) {
        const decision = evaluateReminder(task, today);
        if (!decision) continue;
        if (!byUser.has(task.userId)) {
          byUser.set(task.userId, {
            name: task.userName,
            email: task.userEmail,
            items: [],
            records: [],
          });
        }
        const group = byUser.get(task.userId);
        group.items.push({
          title: task.title,
          priority: task.priority,
          dueDate: task.dueDate,
          kind: decision.kind,
          daysLeft: daysBetween(today, task.dueDate),
        });
        for (const kind of decision.covers) {
          group.records.push({ taskId: task.id, kind, dueDate: task.dueDate });
        }
      }

      for (const group of byUser.values()) {
        group.items.sort(
          (a, b) =>
            PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || a.daysLeft - b.daysLeft,
        );
        try {
          const email = buildReminderEmail({
            name: group.name,
            items: group.items,
            appUrl: config.reminders.appUrl,
          });
          await mailer.sendMail({ to: group.email, ...email });
          await reminderRepository.markSent(group.records);
          summary.usersNotified += 1;
          summary.tasksIncluded += group.items.length;
        } catch (err) {
          summary.failures += 1;
          logger.error('Reminder email failed', { message: err.message }); // no addresses or content
        }
      }
      return summary;
    },
  };
}
