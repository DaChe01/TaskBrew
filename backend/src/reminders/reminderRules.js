import { daysBetween } from '../utils/dates.js';

/**
 * How early each priority is reminded, in days before the due date.
 * Higher priority tasks get more notice. `overdue` sends one follow-up
 * after the due date has passed.
 */
export const REMINDER_RULES = {
  High: { leadDays: [3, 1, 0], overdue: true },
  Medium: { leadDays: [1, 0], overdue: true },
  Low: { leadDays: [0], overdue: false },
};

/** Overdue follow-ups stop after this many days, so old tasks never flood an inbox. */
export const OVERDUE_WINDOW_DAYS = 7;

export const kindForLeadDays = (days) => (days === 0 ? 'due' : `d-${days}`);

/**
 * Decides which reminder (if any) a task needs right now.
 *
 * Returns null, or { kind, covers } where `kind` is the reminder to send and
 * `covers` lists every reminder kind that is now "used up". Marking them all as
 * sent means a task created two days before its deadline does not later trigger
 * an extra "3 days left" email.
 */
export function evaluateReminder({ priority, dueDate, sentKinds = [] }, today) {
  const rule = REMINDER_RULES[priority];
  if (!rule || !dueDate) return null;

  const daysLeft = daysBetween(today, dueDate);

  if (daysLeft < 0) {
    const overdueDays = -daysLeft;
    if (!rule.overdue || overdueDays > OVERDUE_WINDOW_DAYS) return null;
    if (sentKinds.includes('overdue')) return null;
    return { kind: 'overdue', covers: ['overdue'] };
  }

  const reached = rule.leadDays.filter((lead) => daysLeft <= lead);
  if (reached.length === 0) return null;

  const kind = kindForLeadDays(Math.min(...reached)); // the most urgent one
  if (sentKinds.includes(kind)) return null;
  return { kind, covers: reached.map(kindForLeadDays) };
}
