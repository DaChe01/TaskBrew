import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config/env.js';
import { buildReminderEmail } from '../src/reminders/reminderEmail.js';
import { evaluateReminder } from '../src/reminders/reminderRules.js';
import { daysBetween, isValidDateOnly, todayInTimezone } from '../src/utils/dates.js';
import { registerUser } from './helpers.js';
import { createTestPool, resetDatabase } from './testDb.js';

describe('date utilities', () => {
  it('validates real calendar dates only', () => {
    expect(isValidDateOnly('2026-02-28')).toBe(true);
    expect(isValidDateOnly('2024-02-29')).toBe(true);
    expect(isValidDateOnly('2026-02-29')).toBe(false);
    expect(isValidDateOnly('2026-13-01')).toBe(false);
    expect(isValidDateOnly('2026-1-1')).toBe(false);
    expect(isValidDateOnly(20260101)).toBe(false);
  });

  it('counts whole days across month ends and DST changes', () => {
    expect(daysBetween('2026-01-30', '2026-02-02')).toBe(3);
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2);
    expect(daysBetween('2026-05-05', '2026-05-01')).toBe(-4);
  });

  it('finds "today" in a given timezone', () => {
    const instant = new Date('2026-06-15T20:00:00Z'); // already the 16th in Kolkata
    expect(todayInTimezone('UTC', instant)).toBe('2026-06-15');
    expect(todayInTimezone('Asia/Kolkata', instant)).toBe('2026-06-16');
  });
});

describe('evaluateReminder (priority + due date rules)', () => {
  const today = '2026-06-10';
  const eval_ = (priority, dueDate, sentKinds = []) =>
    evaluateReminder({ priority, dueDate, sentKinds }, today);

  it('High priority: reminders at 3 days, 1 day and on the due date', () => {
    expect(eval_('High', '2026-06-13')?.kind).toBe('d-3');
    expect(eval_('High', '2026-06-11')?.kind).toBe('d-1');
    expect(eval_('High', '2026-06-10')?.kind).toBe('due');
  });

  it('High priority: nothing earlier than 3 days out', () => {
    expect(eval_('High', '2026-06-14')).toBeNull();
  });

  it('Medium priority: 1 day before and on the due date only', () => {
    expect(eval_('Medium', '2026-06-13')).toBeNull();
    expect(eval_('Medium', '2026-06-12')).toBeNull();
    expect(eval_('Medium', '2026-06-11')?.kind).toBe('d-1');
    expect(eval_('Medium', '2026-06-10')?.kind).toBe('due');
  });

  it('Low priority: only on the due date, never overdue', () => {
    expect(eval_('Low', '2026-06-11')).toBeNull();
    expect(eval_('Low', '2026-06-10')?.kind).toBe('due');
    expect(eval_('Low', '2026-06-09')).toBeNull();
  });

  it('sends one overdue follow-up for High and Medium, within 7 days', () => {
    expect(eval_('High', '2026-06-09')?.kind).toBe('overdue');
    expect(eval_('Medium', '2026-06-03')?.kind).toBe('overdue');
    expect(eval_('Medium', '2026-06-02')).toBeNull(); // 8 days overdue: too old
    expect(eval_('High', '2026-06-09', ['overdue'])).toBeNull();
  });

  it('never repeats a reminder that was already sent', () => {
    expect(eval_('High', '2026-06-11', ['d-1'])).toBeNull();
  });

  it('marks skipped earlier reminders as covered (no late "3 days left" email)', () => {
    const decision = eval_('High', '2026-06-11'); // created 1 day before the deadline
    expect(decision.kind).toBe('d-1');
    expect(decision.covers).toEqual(expect.arrayContaining(['d-3', 'd-1']));
  });

  it('ignores tasks without a due date or with an unknown priority', () => {
    expect(eval_('High', null)).toBeNull();
    expect(eval_('Urgent', '2026-06-10')).toBeNull();
  });
});

describe('reminder email', () => {
  it('escapes HTML in user-provided titles', () => {
    const { html, subject } = buildReminderEmail({
      name: '<b>Eve</b>',
      appUrl: 'http://localhost:5173',
      items: [
        {
          title: '<script>alert(1)</script>',
          priority: 'High',
          dueDate: '2026-06-10',
          kind: 'due',
          daysLeft: 0,
        },
      ],
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(subject).toContain('due today');
  });
});

describe('reminder job (integration)', () => {
  const pool = createTestPool();
  const sent = [];
  const mailer = { sendMail: vi.fn(async (mail) => void sent.push(mail)) };
  const config = loadConfig({
    ...process.env,
    SMTP_HOST: 'smtp.test',
    SMTP_FROM: 'Task Manager <noreply@test>',
    REMINDER_TRIGGER_SECRET: 'trigger-secret-for-tests',
  });
  const { app, reminderService } = createApp({ config, pool, mailer });
  const now = new Date('2026-06-10T09:00:00Z');

  const addTask = (user, body) => user.post('/api/tasks').send(body);

  beforeEach(async () => {
    await resetDatabase(pool);
    sent.length = 0;
    mailer.sendMail.mockClear();
    mailer.sendMail.mockImplementation(async (mail) => void sent.push(mail));
  });
  afterAll(() => pool.end());

  it('sends one digest per user, most urgent first, and only once', async () => {
    const user = await registerUser(app, { email: 'ravi@example.com', name: 'Ravi' });
    await addTask(user, { title: 'Ship release', priority: 'High', due_date: '2026-06-10' });
    await addTask(user, { title: 'Water plants', priority: 'Low', due_date: '2026-06-10' });
    await addTask(user, { title: 'Far away', priority: 'High', due_date: '2026-07-30' });
    await addTask(user, { title: 'No date', priority: 'High' });

    const first = await reminderService.run(now);
    expect(first).toMatchObject({ usersNotified: 1, tasksIncluded: 2, failures: 0 });
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe('ravi@example.com');
    expect(sent[0].text.indexOf('Ship release')).toBeLessThan(sent[0].text.indexOf('Water plants'));
    expect(sent[0].text).not.toContain('Far away');

    // Running again the same day sends nothing new.
    const second = await reminderService.run(now);
    expect(second.usersNotified).toBe(0);
    expect(sent).toHaveLength(1);
  });

  it('skips completed tasks and users who opted out', async () => {
    const quiet = await registerUser(app);
    await quiet.patch('/api/auth/me').send({ email_reminders: false });
    await addTask(quiet, { title: 'Opted out', priority: 'High', due_date: '2026-06-10' });

    const busy = await registerUser(app);
    const done = await addTask(busy, {
      title: 'Already done',
      priority: 'High',
      due_date: '2026-06-10',
    });
    await busy.patch(`/api/tasks/${done.body.data.id}`).send({ completed: true });

    expect((await reminderService.run(now)).usersNotified).toBe(0);
    expect(sent).toHaveLength(0);
  });

  it('progresses through reminders on later days without repeating', async () => {
    const user = await registerUser(app);
    await addTask(user, { title: 'Big deadline', priority: 'High', due_date: '2026-06-13' });

    const day = (d) => new Date(`2026-06-${d}T09:00:00Z`);
    expect((await reminderService.run(day('10'))).usersNotified).toBe(1); // d-3
    expect((await reminderService.run(day('11'))).usersNotified).toBe(0); // 2 days left: nothing new
    expect((await reminderService.run(day('12'))).usersNotified).toBe(1); // d-1
    expect((await reminderService.run(day('13'))).usersNotified).toBe(1); // due
    expect((await reminderService.run(day('14'))).usersNotified).toBe(1); // overdue
    expect((await reminderService.run(day('15'))).usersNotified).toBe(0); // only once
    expect(sent).toHaveLength(4);
  });

  it('retries after a failed delivery instead of losing the reminder', async () => {
    const user = await registerUser(app);
    await addTask(user, { title: 'Flaky mail', priority: 'High', due_date: '2026-06-10' });

    mailer.sendMail.mockRejectedValueOnce(new Error('SMTP down'));
    const failed = await reminderService.run(now);
    expect(failed).toMatchObject({ failures: 1, usersNotified: 0 });

    const retry = await reminderService.run(now);
    expect(retry.usersNotified).toBe(1);
  });

  it('sends fresh reminders when the due date is moved', async () => {
    const user = await registerUser(app);
    const created = await addTask(user, {
      title: 'Moved',
      priority: 'Medium',
      due_date: '2026-06-10',
    });
    await reminderService.run(now);
    expect(sent).toHaveLength(1);

    await user.patch(`/api/tasks/${created.body.data.id}`).send({ due_date: '2026-06-11' });
    const res = await reminderService.run(now); // now 1 day before the new date
    expect(res.usersNotified).toBe(1);
  });

  it('is a safe no-op when email is not configured', async () => {
    const { reminderService: disabled } = createApp({ config, pool, mailer: null });
    expect(disabled.enabled).toBe(false);
    expect((await disabled.run(now)).skipped).toMatch(/not configured/);
  });

  describe('POST /api/reminders/run', () => {
    it('requires the trigger secret', async () => {
      expect((await request(app).post('/api/reminders/run')).status).toBe(401);
      const wrong = await request(app).post('/api/reminders/run').set('x-reminder-secret', 'nope');
      expect(wrong.status).toBe(401);
    });

    it('runs the job with the correct secret', async () => {
      const res = await request(app)
        .post('/api/reminders/run')
        .set('x-reminder-secret', 'trigger-secret-for-tests');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('usersNotified');
    });

    it('does not exist when no secret is configured', async () => {
      const bare = loadConfig({ ...process.env, REMINDER_TRIGGER_SECRET: '' });
      const { app: noSecretApp } = createApp({ config: bare, pool, mailer });
      expect((await request(noSecretApp).post('/api/reminders/run')).status).toBe(404);
    });
  });
});

describe('configuration', () => {
  it('fails fast and lists every missing required variable', () => {
    expect(() => loadConfig({ NODE_ENV: 'production' })).toThrow(/DATABASE_URL is required/);
    expect(() => loadConfig({ NODE_ENV: 'production' })).toThrow(/JWT_SECRET is required/);
  });

  it('rejects a weak JWT secret outside tests', () => {
    expect(() =>
      loadConfig({ NODE_ENV: 'production', DATABASE_URL: 'postgres://x/y', JWT_SECRET: 'short' }),
    ).toThrow(/at least 32/);
  });

  it('keeps TLS certificate verification on by default in production', () => {
    const config = loadConfig({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgres://x/y',
      JWT_SECRET: 'x'.repeat(40),
    });
    expect(config.databaseSsl).toBe(true);
    expect(config.databaseSslRejectUnauthorized).toBe(true);
    expect(config.bcryptRounds).toBeGreaterThanOrEqual(12);
  });

  it('rejects an invalid reminder cron expression', () => {
    expect(() =>
      loadConfig({
        NODE_ENV: 'development',
        DATABASE_URL: 'postgres://x/y',
        JWT_SECRET: 'x'.repeat(40),
        SMTP_HOST: 'h',
        SMTP_FROM: 'f',
        REMINDER_CRON: 'not a cron',
      }),
    ).toThrow(/REMINDER_CRON/);
  });
});
