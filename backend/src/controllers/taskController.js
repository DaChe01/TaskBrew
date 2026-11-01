import { matchedData } from 'express-validator';

const DEFAULT_QUERY = { page: 1, limit: 10, status: 'all', sort: 'created_at', order: 'desc' };

export function createTaskController({ taskService }) {
  const send = (res, data, status = 200) => res.status(status).json({ success: true, data });
  // matchedData drops unknown fields, so only validated values reach the service.
  // includeOptionals keeps an explicit null (e.g. clearing a due date); fields the
  // client did not send come back as undefined and are ignored by the repository.
  const bodyOf = (req) => matchedData(req, { locations: ['body'], includeOptionals: true });

  return {
    async list(req, res) {
      const filters = { ...DEFAULT_QUERY, ...matchedData(req, { locations: ['query'] }) };
      const { tasks, meta } = await taskService.list(req.user.id, filters);
      res.json({ success: true, data: tasks, meta });
    },

    async stats(req, res) {
      const { today } = matchedData(req, { locations: ['query'] });
      send(res, await taskService.stats(req.user.id, today));
    },

    async get(req, res) {
      send(res, await taskService.get(req.user.id, req.params.id));
    },

    async create(req, res) {
      send(res, await taskService.create(req.user.id, bodyOf(req)), 201);
    },

    async replace(req, res) {
      send(res, await taskService.replace(req.user.id, req.params.id, bodyOf(req)));
    },

    async patch(req, res) {
      send(res, await taskService.patch(req.user.id, req.params.id, bodyOf(req)));
    },

    async toggleComplete(req, res) {
      send(res, await taskService.toggleComplete(req.user.id, req.params.id));
    },

    async remove(req, res) {
      await taskService.remove(req.user.id, req.params.id);
      send(res, { id: req.params.id });
    },

    async removeCompleted(req, res) {
      send(res, { deleted: await taskService.removeCompleted(req.user.id) });
    },
  };
}
