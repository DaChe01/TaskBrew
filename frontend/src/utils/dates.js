// Due dates are date-only values ("YYYY-MM-DD"). They are never turned into
// JavaScript Date objects in the local timezone, which is what used to shift
// them by one day. All arithmetic below uses UTC midnights, so daylight-saving
// changes cannot interfere.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const parts = (value) => value.split('-').map(Number);

/** Today's date in the user's local timezone, as YYYY-MM-DD. */
export function todayString(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function daysBetween(from, to) {
  const [fy, fm, fd] = parts(from);
  const [ty, tm, td] = parts(to);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000);
}

/** "2026-03-01" -> "1 Mar 2026" */
export function formatDueDate(value) {
  if (!value) return '';
  const [y, m, d] = parts(value);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * Describes how urgent a task's due date is.
 * state: 'none' | 'completed' | 'overdue' | 'today' | 'tomorrow' | 'soon' | 'upcoming'
 * Completed tasks are never reported as overdue.
 */
export function getDueStatus(task, today = todayString()) {
  if (!task.due_date) return { state: 'none', label: 'No due date' };
  const date = formatDueDate(task.due_date);
  if (task.completed) return { state: 'completed', label: `Was due ${date}` };

  const days = daysBetween(today, task.due_date);
  if (days < 0) return { state: 'overdue', days, label: `Overdue by ${plural(-days, 'day')}` };
  if (days === 0) return { state: 'today', days, label: 'Due today' };
  if (days === 1) return { state: 'tomorrow', days, label: 'Due tomorrow' };
  if (days <= 3) return { state: 'soon', days, label: `Due in ${days} days` };
  return { state: 'upcoming', days, label: `Due ${date}` };
}
