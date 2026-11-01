import client from './client.js';

/** Returns { tasks, meta } for the given filters. */
export const fetchTasks = (params, signal) =>
  client.get('/tasks', { params, signal }).then((res) => ({
    tasks: res.data.data,
    meta: res.data.meta,
  }));

export const fetchTaskStats = (today, signal) =>
  client.get('/tasks/stats', { params: { today }, signal }).then((res) => res.data.data);

export const createTaskRequest = (payload) =>
  client.post('/tasks', payload).then((res) => res.data.data);

export const updateTaskRequest = (id, payload) =>
  client.patch(`/tasks/${id}`, payload).then((res) => res.data.data);

export const toggleTaskRequest = (id) =>
  client.patch(`/tasks/${id}/complete`).then((res) => res.data.data);

export const deleteTaskRequest = (id) => client.delete(`/tasks/${id}`).then((res) => res.data.data);

export const clearCompletedRequest = () =>
  client.delete('/tasks/completed').then((res) => res.data.data);
