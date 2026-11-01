const PUBLIC_COLUMNS = 'id, name, email, email_reminders';

/** All SQL that touches the users table lives here. */
export function createUserRepository(pool) {
  return {
    async findByEmail(email) {
      const { rows } = await pool.query(
        'SELECT id, name, email, email_reminders, password_hash FROM users WHERE email = $1',
        [email],
      );
      return rows[0] ?? null;
    },

    async findPublicById(id) {
      const { rows } = await pool.query(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = $1`, [id]);
      return rows[0] ?? null;
    },

    async create({ name, email, passwordHash }) {
      const { rows } = await pool.query(
        `INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3)
         RETURNING ${PUBLIC_COLUMNS}`,
        [name, email, passwordHash],
      );
      return rows[0];
    },

    async setEmailReminders(id, enabled) {
      const { rows } = await pool.query(
        `UPDATE users SET email_reminders = $2 WHERE id = $1 RETURNING ${PUBLIC_COLUMNS}`,
        [id, enabled],
      );
      return rows[0] ?? null;
    },
  };
}
