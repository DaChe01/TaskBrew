/**
 * Hardens the original schema without losing data:
 *  - cleans legacy values that would violate the new constraints
 *  - adds CHECK / NOT NULL rules for priority, completed, title and email
 *  - converts instants (created_at / updated_at) to TIMESTAMPTZ; due_date stays a DATE
 *  - adds indexes that match the real query patterns
 *  - moves updated_at maintenance into a trigger
 *
 * ASSUMPTION: legacy TIMESTAMP values were written in UTC (the default on managed
 * Postgres hosts such as Render, Railway and Supabase). If your server used another
 * session timezone, change the AT TIME ZONE 'UTC' clauses below before running.
 */
export const up = (pgm) => {
  pgm.sql(`
    -- 1. Refuse to continue if lower-casing emails would merge two accounts.
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM users GROUP BY lower(trim(email)) HAVING count(*) > 1
      ) THEN
        RAISE EXCEPTION 'Duplicate accounts differ only by email case/whitespace. Merge or remove them, then re-run this migration.';
      END IF;
    END $$;

    -- 2. Clean legacy data.
    UPDATE users SET email = lower(trim(email));
    UPDATE tasks SET priority = CASE lower(trim(coalesce(priority, '')))
                                  WHEN 'high' THEN 'High'
                                  WHEN 'low'  THEN 'Low'
                                  ELSE 'Medium'
                                END
      WHERE priority IS NULL OR priority NOT IN ('Low', 'Medium', 'High');
    UPDATE tasks SET completed = FALSE WHERE completed IS NULL;
    UPDATE tasks SET description = '' WHERE description IS NULL;
    UPDATE tasks SET title = 'Untitled task' WHERE char_length(trim(title)) = 0;

    -- 3. Constraints.
    ALTER TABLE users
      ADD CONSTRAINT users_email_lowercase CHECK (email = lower(email));

    ALTER TABLE tasks
      ALTER COLUMN priority SET DEFAULT 'Medium',
      ALTER COLUMN priority SET NOT NULL,
      ALTER COLUMN completed SET DEFAULT FALSE,
      ALTER COLUMN completed SET NOT NULL,
      ALTER COLUMN description SET DEFAULT '',
      ALTER COLUMN description SET NOT NULL,
      ADD CONSTRAINT tasks_priority_check CHECK (priority IN ('Low', 'Medium', 'High')),
      ADD CONSTRAINT tasks_title_not_blank CHECK (char_length(trim(title)) > 0);

    -- 4. Real timestamps.
    ALTER TABLE users
      ALTER COLUMN created_at DROP DEFAULT,
      ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
      ALTER COLUMN created_at SET DEFAULT NOW(),
      ALTER COLUMN created_at SET NOT NULL;

    ALTER TABLE tasks
      ALTER COLUMN created_at DROP DEFAULT,
      ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
      ALTER COLUMN created_at SET DEFAULT NOW(),
      ALTER COLUMN created_at SET NOT NULL,
      ALTER COLUMN updated_at DROP DEFAULT,
      ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC',
      ALTER COLUMN updated_at SET DEFAULT NOW(),
      ALTER COLUMN updated_at SET NOT NULL;

    -- 5. Indexes that match the list / stats / reminder queries.
    DROP INDEX IF EXISTS idx_tasks_user_id;  -- prefix of the composite indexes below
    CREATE INDEX IF NOT EXISTS idx_tasks_user_completed ON tasks (user_id, completed);
    CREATE INDEX IF NOT EXISTS idx_tasks_user_created_at ON tasks (user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_tasks_open_due_date ON tasks (due_date) WHERE completed = FALSE AND due_date IS NOT NULL;

    -- 6. updated_at is maintained by the database.
    CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER tasks_set_updated_at
      BEFORE UPDATE ON tasks
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `);
};

export const down = (pgm) => {
  pgm.sql(`
    DROP TRIGGER IF EXISTS tasks_set_updated_at ON tasks;
    DROP FUNCTION IF EXISTS set_updated_at();

    DROP INDEX IF EXISTS idx_tasks_open_due_date;
    DROP INDEX IF EXISTS idx_tasks_user_created_at;
    DROP INDEX IF EXISTS idx_tasks_user_completed;
    CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks (user_id);

    ALTER TABLE tasks
      ALTER COLUMN created_at TYPE TIMESTAMP USING created_at AT TIME ZONE 'UTC',
      ALTER COLUMN updated_at TYPE TIMESTAMP USING updated_at AT TIME ZONE 'UTC',
      ALTER COLUMN created_at DROP NOT NULL,
      ALTER COLUMN updated_at DROP NOT NULL,
      DROP CONSTRAINT IF EXISTS tasks_title_not_blank,
      DROP CONSTRAINT IF EXISTS tasks_priority_check,
      ALTER COLUMN description DROP NOT NULL,
      ALTER COLUMN completed DROP NOT NULL,
      ALTER COLUMN priority DROP NOT NULL;

    ALTER TABLE users
      ALTER COLUMN created_at TYPE TIMESTAMP USING created_at AT TIME ZONE 'UTC',
      ALTER COLUMN created_at DROP NOT NULL,
      DROP CONSTRAINT IF EXISTS users_email_lowercase;
  `);
};
