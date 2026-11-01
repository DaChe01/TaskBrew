import { useCallback, useEffect, useRef, useState } from 'react';
import {
  clearCompletedRequest,
  createTaskRequest,
  deleteTaskRequest,
  fetchTaskStats,
  fetchTasks,
  toggleTaskRequest,
  updateTaskRequest,
} from '../api/tasksApi.js';
import { getErrorMessage, isCanceled } from '../utils/errors.js';
import { todayString } from '../utils/dates.js';
import { useToast } from './useToast.js';

const EMPTY_STATS = { total: 0, active: 0, completed: 0, overdue: 0 };
const PAGE_SIZE = 8;

/**
 * Loads the current page of tasks (plus summary counts) for the given filters and
 * exposes the create / update / toggle / delete actions.
 *
 * Every action reloads the list afterwards, so the screen always matches the
 * server (correct pagination, sorting and counts) without fragile local patching.
 * Failed actions show an error toast and re-throw, so forms can keep their input.
 */
export function useTasks({ page, status, priority, q, sort, order }) {
  const toast = useToast();
  const [tasks, setTasks] = useState([]);
  const [meta, setMeta] = useState({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 });
  const [stats, setStats] = useState(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const controllerRef = useRef(null);

  const load = useCallback(async () => {
    controllerRef.current?.abort(); // a newer request replaces the one in flight
    const controller = new AbortController();
    controllerRef.current = controller;

    setLoading(true);
    setError('');
    try {
      const params = { page, limit: PAGE_SIZE, status, sort, order };
      if (priority) params.priority = priority;
      if (q) params.q = q;

      const [list, summary] = await Promise.all([
        fetchTasks(params, controller.signal),
        fetchTaskStats(todayString(), controller.signal),
      ]);
      setTasks(list.tasks);
      setMeta(list.meta);
      setStats(summary);
      setLoading(false);
    } catch (err) {
      if (isCanceled(err)) return; // superseded by a newer request
      setError(getErrorMessage(err, 'Could not load your tasks.'));
      setLoading(false);
    }
  }, [page, status, priority, q, sort, order]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetching on mount/filter change
    load();
    return () => controllerRef.current?.abort();
  }, [load]);

  const perform = useCallback(
    async (action, successMessage) => {
      try {
        const result = await action();
        if (successMessage) toast.success(successMessage);
        await load();
        return result;
      } catch (err) {
        toast.error(getErrorMessage(err));
        throw err;
      }
    },
    [load, toast],
  );

  return {
    tasks,
    meta,
    stats,
    loading,
    error,
    reload: load,
    createTask: (values) => perform(() => createTaskRequest(values), 'Task added'),
    updateTask: (id, values) => perform(() => updateTaskRequest(id, values), 'Task updated'),
    toggleTask: (id) => perform(() => toggleTaskRequest(id)),
    deleteTask: (id) => perform(() => deleteTaskRequest(id), 'Task deleted'),
    clearCompleted: () =>
      perform(() => clearCompletedRequest(), null).then((result) => {
        toast.success(
          result.deleted === 1
            ? 'Removed 1 completed task'
            : `Removed ${result.deleted} completed tasks`,
        );
        return result;
      }),
  };
}
