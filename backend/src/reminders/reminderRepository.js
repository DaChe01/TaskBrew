import '../config/pgTypes.js';

/** SQL for the reminder job. */
export function createReminderRepository(pool) {
  return {
    /**
     * Open tasks that could need a reminder, for users who did not opt out.
     * The date window keeps the query small: nothing due later than `maxLeadDays`
     * and nothing overdue by more than `overdueWindowDays`.
     */
    async findCandidates({ today, maxLeadDays, overdueWindowDays }) {
      const { rows } = await pool.query(
        `SELECT t.id, t.title, t.priority, t.due_date AS "dueDate",
                u.id AS "userId", u.name AS "userName", u.email AS "userEmail",
                ARRAY(SELECT r.kind FROM task_reminders r
                      WHERE r.task_id = t.id AND r.due_date = t.due_date) AS "sentKinds"
         FROM tasks t
         JOIN users u ON u.id = t.user_id
         WHERE t.completed = FALSE
           AND t.due_date IS NOT NULL
           AND u.email_reminders = TRUE
           AND t.due_date BETWEEN ($1::date - $3::int) AND ($1::date + $2::int)
         ORDER BY u.id, t.due_date`,
        [today, maxLeadDays, overdueWindowDays],
      );
      return rows;
    },

    async markSent(entries) {
      if (entries.length === 0) return;
      const params = [];
      const tuples = entries.map(({ taskId, kind, dueDate }, i) => {
        params.push(taskId, kind, dueDate);
        return `($${i * 3 + 1}, $${i * 3 + 2}, $${i * 3 + 3}::date)`;
      });
      await pool.query(
        `INSERT INTO task_reminders (task_id, kind, due_date) VALUES ${tuples.join(', ')}
         ON CONFLICT (task_id, kind, due_date) DO NOTHING`,
        params,
      );
    },
  };
}
