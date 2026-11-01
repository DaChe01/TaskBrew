import { AppError } from '../errors/AppError.js';
import { todayInTimezone } from '../utils/dates.js';

const notFound = () => AppError.notFound('Task not found', 'TASK_NOT_FOUND');

export function createTaskService({ config, taskRepository }) {
  return {
    async list(userId, filters) {
      const { rows, total } = await taskRepository.list(userId, filters);
      return {
        tasks: rows,
        meta: {
          page: filters.page,
          limit: filters.limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / filters.limit)),
        },
      };
    },

    async get(userId, id) {
      const task = await taskRepository.findById(userId, id);
      if (!task) throw notFound();
      return task;
    },

    create(userId, { title, description, priority, due_date }) {
      return taskRepository.create(userId, {
        title,
        description: description ?? '',
        priority: priority ?? 'Medium',
        due_date: due_date ?? null,
      });
    },

    /** PUT: full replacement. Omitted optional fields fall back to their defaults. */
    async replace(userId, id, body) {
      const task = await taskRepository.update(userId, id, {
        title: body.title,
        description: body.description ?? '',
        priority: body.priority ?? 'Medium',
        due_date: body.due_date ?? null,
        completed: body.completed,
      });
      if (!task) throw notFound();
      return task;
    },

    /** PATCH: only the supplied fields change. */
    async patch(userId, id, body) {
      const fields = { ...body };
      if (fields.description === null) fields.description = '';
      const task = await taskRepository.update(userId, id, fields);
      if (!task) throw notFound();
      return task;
    },

    async toggleComplete(userId, id) {
      const task = await taskRepository.toggleComplete(userId, id);
      if (!task) throw notFound();
      return task;
    },

    async remove(userId, id) {
      const removed = await taskRepository.remove(userId, id);
      if (!removed) throw notFound();
    },

    removeCompleted: (userId) => taskRepository.removeCompleted(userId),

    stats: (userId, today) =>
      taskRepository.stats(userId, today ?? todayInTimezone(config.timezone)),
  };
}
