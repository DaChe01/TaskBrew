import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { registerUser, setupTestApp } from './helpers.js';

const { app, pool, reset } = setupTestApp();
let user;

beforeEach(async () => {
  await reset();
  user = await registerUser(app);
});
afterAll(() => pool.end());

const createTask = async (body, who = user) => {
  const res = await who.post('/api/tasks').send(body);
  expect(res.status).toBe(201);
  return res.body.data;
};

describe('creating and reading tasks', () => {
  it('creates a task with defaults and lists it', async () => {
    const task = await createTask({ title: '  Write report  ' });
    expect(task).toMatchObject({
      title: 'Write report',
      description: '',
      priority: 'Medium',
      due_date: null,
      completed: false,
    });
    expect(task.user_id).toBeUndefined();

    const list = await user.get('/api/tasks');
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.meta).toMatchObject({ page: 1, limit: 10, total: 1, totalPages: 1 });
  });

  it('returns due_date as a plain YYYY-MM-DD string (no timezone shift)', async () => {
    const task = await createTask({ title: 'Dated', due_date: '2026-03-01' });
    expect(task.due_date).toBe('2026-03-01');

    const fetched = await user.get(`/api/tasks/${task.id}`);
    expect(fetched.body.data.due_date).toBe('2026-03-01');
  });

  it('keeps the description', async () => {
    const task = await createTask({ title: 'With notes', description: 'Remember the appendix' });
    const fetched = await user.get(`/api/tasks/${task.id}`);
    expect(fetched.body.data.description).toBe('Remember the appendix');
  });
});

describe('validation', () => {
  it.each([
    ['missing title', {}, 'title'],
    ['blank title', { title: '   ' }, 'title'],
    ['title too long', { title: 'x'.repeat(256) }, 'title'],
    ['bad priority', { title: 'a', priority: 'Urgent' }, 'priority'],
    ['non-date due_date', { title: 'a', due_date: 'tomorrow' }, 'due_date'],
    ['impossible date', { title: 'a', due_date: '2026-02-30' }, 'due_date'],
    ['wrong date format', { title: 'a', due_date: '01/03/2026' }, 'due_date'],
    ['description too long', { title: 'a', description: 'x'.repeat(2001) }, 'description'],
  ])('rejects %s', async (_label, body, field) => {
    const res = await user.post('/api/tasks').send(body);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.map((d) => d.field)).toContain(field);
  });

  it.each(['abc', '0', '-5', '1.5', '99999999999'])(
    'rejects invalid task id %s with 400',
    async (id) => {
      for (const call of [
        user.get(`/api/tasks/${id}`),
        user.put(`/api/tasks/${id}`).send({ title: 'x' }),
        user.patch(`/api/tasks/${id}`).send({ title: 'x' }),
        user.patch(`/api/tasks/${id}/complete`),
        user.del(`/api/tasks/${id}`),
      ]) {
        const res = await call;
        expect(res.status).toBe(400);
      }
    },
  );

  it('returns 404 for a well-formed id that does not exist', async () => {
    const res = await user.get('/api/tasks/424242');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('TASK_NOT_FOUND');
  });

  it('never leaks database details on unexpected failures', async () => {
    const res = await user
      .post('/api/tasks')
      .send({ title: 'ok', priority: 'High', due_date: '2026-01-01' });
    expect(JSON.stringify(res.body)).not.toMatch(/select|insert|pg_|relation|stack/i);
  });
});

describe('updating tasks', () => {
  it('PUT replaces fields and resets omitted optional fields to defaults', async () => {
    const task = await createTask({
      title: 'Old',
      description: 'd',
      priority: 'High',
      due_date: '2026-05-05',
    });
    const res = await user.put(`/api/tasks/${task.id}`).send({ title: 'New' });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      title: 'New',
      description: '',
      priority: 'Medium',
      due_date: null,
    });
  });

  it('PATCH changes only the supplied fields', async () => {
    const task = await createTask({
      title: 'Keep',
      description: 'stay',
      priority: 'High',
      due_date: '2026-05-05',
    });
    const res = await user.patch(`/api/tasks/${task.id}`).send({ completed: true });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      title: 'Keep',
      description: 'stay',
      priority: 'High',
      due_date: '2026-05-05',
      completed: true,
    });
  });

  it('PATCH can clear the due date with null', async () => {
    const task = await createTask({ title: 'Dated', due_date: '2026-05-05' });
    const res = await user.patch(`/api/tasks/${task.id}`).send({ due_date: null });
    expect(res.status).toBe(200);
    expect(res.body.data.due_date).toBeNull();
  });

  it('PATCH rejects an empty body and unknown-only fields', async () => {
    const task = await createTask({ title: 'x' });
    expect((await user.patch(`/api/tasks/${task.id}`).send({})).status).toBe(400);
    expect((await user.patch(`/api/tasks/${task.id}`).send({ hacker: 1 })).status).toBe(400);
  });

  it('cannot change ownership through the body', async () => {
    const task = await createTask({ title: 'Mine' });
    await user.patch(`/api/tasks/${task.id}`).send({ title: 'Still mine', user_id: 999 });
    const { rows } = await pool.query('SELECT user_id FROM tasks WHERE id = $1', [task.id]);
    expect(rows[0].user_id).toBe(user.user.id);
  });

  it('toggles completion both ways', async () => {
    const task = await createTask({ title: 'Toggle' });
    const on = await user.patch(`/api/tasks/${task.id}/complete`);
    expect(on.body.data.completed).toBe(true);
    const off = await user.patch(`/api/tasks/${task.id}/complete`);
    expect(off.body.data.completed).toBe(false);
  });

  it('maintains updated_at through the database trigger', async () => {
    const task = await createTask({ title: 'Trigger' });
    await new Promise((r) => setTimeout(r, 20));
    const res = await user.patch(`/api/tasks/${task.id}`).send({ title: 'Trigger 2' });
    expect(new Date(res.body.data.updated_at).getTime()).toBeGreaterThan(
      new Date(task.updated_at).getTime(),
    );
  });
});

describe('deleting tasks', () => {
  it('deletes one task', async () => {
    const task = await createTask({ title: 'Bye' });
    expect((await user.del(`/api/tasks/${task.id}`)).status).toBe(200);
    expect((await user.get(`/api/tasks/${task.id}`)).status).toBe(404);
    expect((await user.del(`/api/tasks/${task.id}`)).status).toBe(404);
  });

  it('clears only completed tasks', async () => {
    const a = await createTask({ title: 'done' });
    await createTask({ title: 'open' });
    await user.patch(`/api/tasks/${a.id}`).send({ completed: true });

    const res = await user.del('/api/tasks/completed');
    expect(res.body.data.deleted).toBe(1);
    const list = await user.get('/api/tasks');
    expect(list.body.data.map((t) => t.title)).toEqual(['open']);
  });
});

describe('listing: pagination, filters, search and sorting', () => {
  beforeEach(async () => {
    await createTask({ title: 'Alpha report', priority: 'High', due_date: '2026-01-10' });
    await createTask({ title: 'Beta call', priority: 'Low', due_date: '2026-01-05' });
    await createTask({
      title: 'Gamma review',
      description: 'quarterly REPORT',
      priority: 'Medium',
    });
    const done = await createTask({ title: 'Delta', priority: 'High', due_date: '2026-01-20' });
    await user.patch(`/api/tasks/${done.id}`).send({ completed: true });
  });

  const titles = (res) => res.body.data.map((t) => t.title);

  it('paginates and reports totals', async () => {
    const page1 = await user.get('/api/tasks?limit=3&page=1&sort=title&order=asc');
    expect(titles(page1)).toEqual(['Alpha report', 'Beta call', 'Delta']);
    expect(page1.body.meta).toMatchObject({ total: 4, totalPages: 2, limit: 3 });

    const page2 = await user.get('/api/tasks?limit=3&page=2&sort=title&order=asc');
    expect(titles(page2)).toEqual(['Gamma review']);
  });

  it('caps the page size', async () => {
    expect((await user.get('/api/tasks?limit=1000')).status).toBe(400);
    expect((await user.get('/api/tasks?page=0')).status).toBe(400);
  });

  it('filters by status', async () => {
    expect(titles(await user.get('/api/tasks?status=completed'))).toEqual(['Delta']);
    expect(await user.get('/api/tasks?status=active').then((r) => r.body.meta.total)).toBe(3);
    expect((await user.get('/api/tasks?status=weird')).status).toBe(400);
  });

  it('filters by priority', async () => {
    const res = await user.get('/api/tasks?priority=High&sort=title&order=asc');
    expect(titles(res)).toEqual(['Alpha report', 'Delta']);
  });

  it('searches title and description case-insensitively', async () => {
    const res = await user.get('/api/tasks?q=report&sort=title&order=asc');
    expect(titles(res)).toEqual(['Alpha report', 'Gamma review']);
  });

  it('treats % and _ in search text literally', async () => {
    expect(titles(await user.get('/api/tasks?q=%25'))).toEqual([]);
    expect(titles(await user.get('/api/tasks?q=_'))).toEqual([]);
  });

  it('sorts by due date with undated tasks last', async () => {
    const res = await user.get('/api/tasks?sort=due_date&order=asc');
    expect(titles(res)).toEqual(['Beta call', 'Alpha report', 'Delta', 'Gamma review']);
  });

  it('sorts by priority, highest first with desc', async () => {
    const res = await user.get('/api/tasks?sort=priority&order=desc&status=active');
    expect(res.body.data.map((t) => t.priority)).toEqual(['High', 'Medium', 'Low']);
  });

  it('rejects sort fields outside the allowlist (no SQL injection path)', async () => {
    const res = await user.get('/api/tasks?sort=title;DROP TABLE tasks');
    expect(res.status).toBe(400);
    const { rowCount } = await pool.query('SELECT 1 FROM tasks');
    expect(rowCount).toBe(4);
  });

  it('combines filters', async () => {
    const res = await user.get('/api/tasks?status=active&priority=High&q=alpha');
    expect(titles(res)).toEqual(['Alpha report']);
  });
});

describe('GET /api/tasks/stats', () => {
  it('counts total, active, completed and overdue for the given day', async () => {
    await createTask({ title: 'late', due_date: '2026-01-01' });
    await createTask({ title: 'today', due_date: '2026-01-10' });
    await createTask({ title: 'later', due_date: '2026-02-01' });
    const done = await createTask({ title: 'done late', due_date: '2026-01-01' });
    await user.patch(`/api/tasks/${done.id}`).send({ completed: true });

    const res = await user.get('/api/tasks/stats?today=2026-01-10');
    expect(res.body.data).toEqual({ total: 4, active: 3, completed: 1, overdue: 1 });
  });

  it('validates the today parameter', async () => {
    expect((await user.get('/api/tasks/stats?today=nope')).status).toBe(400);
  });
});

describe("authorization: users cannot touch each other's tasks", () => {
  let other;
  let task;

  beforeEach(async () => {
    other = await registerUser(app);
    task = await createTask({ title: 'Private' });
  });

  it("cannot read another user's task", async () => {
    expect((await other.get(`/api/tasks/${task.id}`)).status).toBe(404);
  });

  it("does not list another user's tasks", async () => {
    const res = await other.get('/api/tasks');
    expect(res.body.data).toEqual([]);
    expect(res.body.meta.total).toBe(0);
  });

  it("cannot update (PUT/PATCH/toggle) another user's task", async () => {
    expect((await other.put(`/api/tasks/${task.id}`).send({ title: 'hacked' })).status).toBe(404);
    expect((await other.patch(`/api/tasks/${task.id}`).send({ title: 'hacked' })).status).toBe(404);
    expect((await other.patch(`/api/tasks/${task.id}/complete`)).status).toBe(404);
  });

  it("cannot delete another user's task, nor clear their completed tasks", async () => {
    await user.patch(`/api/tasks/${task.id}`).send({ completed: true });
    expect((await other.del(`/api/tasks/${task.id}`)).status).toBe(404);
    expect((await other.del('/api/tasks/completed')).body.data.deleted).toBe(0);

    const stillThere = await user.get(`/api/tasks/${task.id}`);
    expect(stillThere.body.data).toMatchObject({ title: 'Private', completed: true });
  });

  it('keeps stats separate per user', async () => {
    const res = await other.get('/api/tasks/stats');
    expect(res.body.data.total).toBe(0);
  });

  it('rejects anonymous access to every task route', async () => {
    for (const call of [
      request(app).get('/api/tasks'),
      request(app).post('/api/tasks').send({ title: 'x' }),
      request(app).get(`/api/tasks/${task.id}`),
      request(app).delete(`/api/tasks/${task.id}`),
    ]) {
      expect((await call).status).toBe(401);
    }
  });
});
