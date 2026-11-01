import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { registerUser, setupTestApp } from './helpers.js';

const { app, pool, reset } = setupTestApp();
beforeEach(reset);
afterAll(() => pool.end());

const valid = { name: 'Asha', email: 'asha@example.com', password: 'longenough1' };

describe('POST /api/auth/register', () => {
  it('creates an account, returns a token and hashes the password', async () => {
    const res = await request(app).post('/api/auth/register').send(valid);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toEqual(expect.any(String));
    expect(res.body.data.user).toMatchObject({ name: 'Asha', email: 'asha@example.com' });
    expect(res.body.data.user.password_hash).toBeUndefined();

    const { rows } = await pool.query('SELECT password_hash FROM users');
    expect(rows[0].password_hash).not.toBe(valid.password);
    expect(rows[0].password_hash).toMatch(/^\$2[aby]\$/);
  });

  it('normalises email (trim + lowercase) before storing', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...valid, email: '  Asha@Example.COM ' });
    expect(res.status).toBe(201);
    expect(res.body.data.user.email).toBe('asha@example.com');
  });

  it('rejects a duplicate email with 409, even when the case differs', async () => {
    await request(app).post('/api/auth/register').send(valid);
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...valid, email: 'ASHA@example.com' });

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ success: false, error: { code: 'EMAIL_TAKEN' } });
  });

  it('handles two simultaneous registrations of one email without a 500', async () => {
    const results = await Promise.all([
      request(app).post('/api/auth/register').send(valid),
      request(app).post('/api/auth/register').send(valid),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
  });

  it.each([
    ['invalid email', { email: 'not-an-email' }, 'email'],
    ['short password', { password: 'short' }, 'password'],
    ['missing name', { name: '   ' }, 'name'],
    ['password over 72 bytes', { password: 'a'.repeat(73) }, 'password'],
  ])('rejects %s with field-level details', async (_label, override, field) => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...valid, ...override });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.map((d) => d.field)).toContain(field);
  });

  it('returns 400 for malformed JSON instead of crashing', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .set('Content-Type', 'application/json')
      .send('{"name": ');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await request(app).post('/api/auth/register').send(valid);
  });

  it('logs in with correct credentials (email is case-insensitive)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ASHA@example.com', password: valid.password });

    expect(res.status).toBe(200);
    expect(res.body.data.token).toEqual(expect.any(String));
    expect(res.body.data.user.email).toBe('asha@example.com');
  });

  it('rejects a wrong password with a generic message', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: valid.email, password: 'wrong-password' });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatchObject({
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid email or password',
    });
  });

  it('gives the same answer for an unknown email (no account enumeration)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'whatever123' });
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Invalid email or password');
  });

  it('validates the payload', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'bad' });
    expect(res.status).toBe(400);
  });
});

describe('authentication middleware', () => {
  it('rejects requests without a token', async () => {
    const res = await request(app).get('/api/tasks');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_REQUIRED');
  });

  it('rejects a malformed or tampered token', async () => {
    const res = await request(app).get('/api/tasks').set('Authorization', 'Bearer not.a.token');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });

  it('rejects a token signed with another secret', async () => {
    const forged = jwt.sign({ id: 1 }, 'some-other-secret-value-1234567890');
    const res = await request(app).get('/api/tasks').set('Authorization', `Bearer ${forged}`);
    expect(res.status).toBe(401);
  });

  it('reports an expired token distinctly', async () => {
    const user = await registerUser(app);
    const expired = jwt.sign({ id: user.user.id }, process.env.JWT_SECRET, { expiresIn: -10 });
    const res = await request(app).get('/api/tasks').set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');
  });

  it('rejects a valid token whose user no longer exists', async () => {
    const user = await registerUser(app);
    await pool.query('DELETE FROM users WHERE id = $1', [user.user.id]);
    const res = await user.get('/api/tasks');
    expect(res.status).toBe(401);
  });

  it('rejects a non-Bearer scheme', async () => {
    const user = await registerUser(app);
    const res = await request(app).get('/api/tasks').set('Authorization', `Token ${user.token}`);
    expect(res.status).toBe(401);
  });
});

describe('GET/PATCH /api/auth/me', () => {
  it('returns the profile and lets the user opt out of email reminders', async () => {
    const user = await registerUser(app);

    const me = await user.get('/api/auth/me');
    expect(me.body.data.user).toMatchObject({
      email: user.credentials.email,
      email_reminders: true,
    });

    const off = await user.patch('/api/auth/me').send({ email_reminders: false });
    expect(off.status).toBe(200);
    expect(off.body.data.user.email_reminders).toBe(false);

    const bad = await user.patch('/api/auth/me').send({ email_reminders: 'nope' });
    expect(bad.status).toBe(400);
  });
});

describe('API basics', () => {
  it('responds to the health check', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
  });

  it('returns a JSON 404 for unknown routes', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ROUTE_NOT_FOUND');
  });
});
