import { Router } from 'express';
import {
  createTaskRules,
  idParam,
  listTaskRules,
  patchTaskRules,
  replaceTaskRules,
  statsRules,
} from '../validators/taskValidators.js';

export function createTaskRoutes({ taskController: c, protect }) {
  const router = Router();
  router.use(protect); // every task route requires a valid token

  router.get('/', listTaskRules, c.list);
  router.post('/', createTaskRules, c.create);

  // Fixed paths must be declared before "/:id".
  router.get('/stats', statsRules, c.stats);
  router.delete('/completed', c.removeCompleted);

  router.get('/:id', idParam, c.get);
  router.put('/:id', replaceTaskRules, c.replace);
  router.patch('/:id', patchTaskRules, c.patch);
  router.patch('/:id/complete', idParam, c.toggleComplete);
  router.delete('/:id', idParam, c.remove);

  return router;
}
