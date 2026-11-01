import request from 'supertest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config/env.js';
import { createTestPool, resetDatabase } from './testDb.js';

export function setupTestApp({ mailer = null } = {}) {
  const config = loadConfig();
  const pool = createTestPool();
  const { app, reminderService } = createApp({ config, pool, mailer });
  return { app, pool, config, reminderService, reset: () => resetDatabase(pool) };
}

let counter = 0;

/** Registers a fresh user and returns their token plus a pre-authenticated request helper. */
export async function registerUser(app, overrides = {}) {
  counter += 1;
  const credentials = {
    name: 'Test User',
    email: `user${counter}@example.com`,
    password: 'password123',
    ...overrides,
  };
  const res = await request(app).post('/api/auth/register').send(credentials);
  if (res.status !== 201)
    throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);

  const token = res.body.data.token;
  const auth = (req) => req.set('Authorization', `Bearer ${token}`);
  return {
    token,
    user: res.body.data.user,
    credentials,
    get: (url) => auth(request(app).get(url)),
    post: (url) => auth(request(app).post(url)),
    put: (url) => auth(request(app).put(url)),
    patch: (url) => auth(request(app).patch(url)),
    del: (url) => auth(request(app).delete(url)),
  };
}
