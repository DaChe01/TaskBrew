import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../src/App.jsx';
import AuthProvider from '../src/context/AuthProvider.jsx';
import ToastProvider from '../src/context/ToastProvider.jsx';
import { todayString } from '../src/utils/dates.js';

const base64Url = (value) =>
  btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** A structurally valid JWT (the frontend only reads exp; the server verifies it). */
export const makeToken = (expiresInSeconds = 3600) =>
  `${base64Url({ alg: 'HS256', typ: 'JWT' })}.${base64Url({
    id: 1,
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
  })}.signature`;

export const TEST_USER = { id: 1, name: 'Asha', email: 'asha@example.com', email_reminders: true };

export const signIn = (user = TEST_USER) => {
  localStorage.setItem('token', makeToken());
  localStorage.setItem('user', JSON.stringify(user));
};

export function renderApp(route = '/') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <ToastProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

/** YYYY-MM-DD for today +/- n days, in the same (local) timezone the UI uses. */
export function dayOffset(n) {
  const date = new Date();
  date.setDate(date.getDate() + n);
  return todayString(date);
}

let nextId = 1;
export const makeTask = (overrides = {}) => ({
  id: nextId++,
  title: 'Sample task',
  description: '',
  priority: 'Medium',
  due_date: null,
  completed: false,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

export const listResult = (tasks, meta = {}) => ({
  tasks,
  meta: { page: 1, limit: 8, total: tasks.length, totalPages: 1, ...meta },
});

export const statsFor = (tasks) => ({
  total: tasks.length,
  active: tasks.filter((t) => !t.completed).length,
  completed: tasks.filter((t) => t.completed).length,
  overdue: 0,
});

export const apiError = (code, message, status = 400, details) => {
  const error = new Error(message);
  error.response = { status, data: { success: false, error: { code, message, details } } };
  return error;
};
