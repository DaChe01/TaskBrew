/**
 * Email reminders.
 *  - users.email_reminders lets each user opt out.
 *  - task_reminders records every reminder that was sent. The UNIQUE key includes
 *    due_date, so changing a task's due date automatically makes it eligible for a
 *    fresh set of reminders, and a reminder can never be sent twice.
 */
export const up = (pgm) => {
  pgm.sql(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS email_reminders BOOLEAN NOT NULL DEFAULT TRUE;

    CREATE TABLE IF NOT EXISTS task_reminders (
      id        SERIAL PRIMARY KEY,
      task_id   INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      kind      VARCHAR(20) NOT NULL,
      due_date  DATE NOT NULL,
      sent_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT task_reminders_kind_check CHECK (kind IN ('d-3', 'd-1', 'due', 'overdue')),
      CONSTRAINT task_reminders_unique UNIQUE (task_id, kind, due_date)
    );
  `);
};

export const down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS task_reminders;
    ALTER TABLE users DROP COLUMN IF EXISTS email_reminders;
  `);
};
