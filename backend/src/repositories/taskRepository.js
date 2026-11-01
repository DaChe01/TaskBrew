import '../config/pgTypes.js';

const TASK_COLUMNS =
  'id, title, description, priority, due_date, completed, created_at, updated_at';

// Sorting is chosen from this allowlist; user input is never placed in SQL text.
const SORT_EXPRESSIONS = {
  created_at: 'created_at',
  due_date: 'due_date',
  title: 'lower(title)',
  // High = 3, Medium = 2, Low = 1, so "desc" means "highest priority first".
  priority: "CASE priority WHEN 'High' THEN 3 WHEN 'Medium' THEN 2 ELSE 1 END",
};
const SORT_DIRECTIONS = { asc: 'ASC', desc: 'DESC' };

// Only these columns can ever appear in a dynamic UPDATE.
const UPDATABLE_COLUMNS = ['title', 'description', 'priority', 'due_date', 'completed'];

const escapeLike = (text) => text.replace(/[\\%_]/g, '\\$&');

/** All SQL that touches the tasks table lives here. Every query is scoped by user_id. */
export function createTaskRepository(pool) {
  return {
    async list(userId, { status, priority, q, sort, order, page, limit }) {
      const conditions = ['user_id = $1'];
      const params = [userId];

      if (status === 'active') conditions.push('completed = FALSE');
      if (status === 'completed') conditions.push('completed = TRUE');
      if (priority) {
        params.push(priority);
        conditions.push(`priority = $${params.length}`);
      }
      if (q) {
        params.push(`%${escapeLike(q)}%`);
        conditions.push(`(title ILIKE $${params.length} OR description ILIKE $${params.length})`);
      }
      const where = conditions.join(' AND ');

      const sortExpression = SORT_EXPRESSIONS[sort] ?? SORT_EXPRESSIONS.created_at;
      const direction = SORT_DIRECTIONS[order] ?? 'DESC';
      const nulls = sort === 'due_date' ? ' NULLS LAST' : '';

      const pageParams = [...params, limit, (page - 1) * limit];
      const [rowsResult, countResult] = await Promise.all([
        pool.query(
          `SELECT ${TASK_COLUMNS} FROM tasks WHERE ${where}
           ORDER BY ${sortExpression} ${direction}${nulls}, id DESC
           LIMIT $${pageParams.length - 1} OFFSET $${pageParams.length}`,
          pageParams,
        ),
        pool.query(`SELECT COUNT(*)::int AS total FROM tasks WHERE ${where}`, params),
      ]);

      return { rows: rowsResult.rows, total: countResult.rows[0].total };
    },

    async findById(userId, id) {
      const { rows } = await pool.query(
        `SELECT ${TASK_COLUMNS} FROM tasks WHERE id = $1 AND user_id = $2`,
        [id, userId],
      );
      return rows[0] ?? null;
    },

    async create(userId, { title, description, priority, due_date }) {
      const { rows } = await pool.query(
        `INSERT INTO tasks (user_id, title, description, priority, due_date)
         VALUES ($1, $2, $3, $4, $5) RETURNING ${TASK_COLUMNS}`,
        [userId, title, description, priority, due_date],
      );
      return rows[0];
    },

    /** Updates only the provided fields (keys from UPDATABLE_COLUMNS). */
    async update(userId, id, fields) {
      const columns = UPDATABLE_COLUMNS.filter((column) => fields[column] !== undefined);
      if (columns.length === 0) return this.findById(userId, id);

      const assignments = columns.map((column, index) => `${column} = $${index + 3}`);
      const values = columns.map((column) => fields[column]);

      const { rows } = await pool.query(
        `UPDATE tasks SET ${assignments.join(', ')}
         WHERE id = $1 AND user_id = $2 RETURNING ${TASK_COLUMNS}`,
        [id, userId, ...values],
      );
      return rows[0] ?? null;
    },

    async toggleComplete(userId, id) {
      const { rows } = await pool.query(
        `UPDATE tasks SET completed = NOT completed
         WHERE id = $1 AND user_id = $2 RETURNING ${TASK_COLUMNS}`,
        [id, userId],
      );
      return rows[0] ?? null;
    },

    async remove(userId, id) {
      const { rowCount } = await pool.query('DELETE FROM tasks WHERE id = $1 AND user_id = $2', [
        id,
        userId,
      ]);
      return rowCount > 0;
    },

    async removeCompleted(userId) {
      const { rowCount } = await pool.query(
        'DELETE FROM tasks WHERE user_id = $1 AND completed = TRUE',
        [userId],
      );
      return rowCount;
    },

    async stats(userId, today) {
      const { rows } = await pool.query(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE completed = FALSE)::int AS active,
                COUNT(*) FILTER (WHERE completed = TRUE)::int AS completed,
                COUNT(*) FILTER (WHERE completed = FALSE AND due_date < $2::date)::int AS overdue
         FROM tasks WHERE user_id = $1`,
        [userId, today],
      );
      return rows[0];
    },
  };
}
