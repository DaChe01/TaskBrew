import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiError, listResult, renderApp, statsFor, makeToken, TEST_USER } from './helpers.jsx';

vi.mock('../src/api/authApi.js', () => ({
  loginRequest: vi.fn(),
  registerRequest: vi.fn(),
  updateReminderPreference: vi.fn(),
}));
vi.mock('../src/api/tasksApi.js', () => ({
  fetchTasks: vi.fn(),
  fetchTaskStats: vi.fn(),
  createTaskRequest: vi.fn(),
  updateTaskRequest: vi.fn(),
  toggleTaskRequest: vi.fn(),
  deleteTaskRequest: vi.fn(),
  clearCompletedRequest: vi.fn(),
}));

const { loginRequest, registerRequest } = await import('../src/api/authApi.js');
const { fetchTasks, fetchTaskStats } = await import('../src/api/tasksApi.js');

beforeEach(() => {
  vi.clearAllMocks();
  fetchTasks.mockResolvedValue(listResult([]));
  fetchTaskStats.mockResolvedValue(statsFor([]));
});

describe('login form', () => {
  it('shows field-level validation and does not call the API', async () => {
    const user = userEvent.setup();
    renderApp('/login');

    await user.type(screen.getByLabelText('Email'), 'not-an-email');
    await user.click(screen.getByRole('button', { name: 'Login' }));

    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
    expect(loginRequest).not.toHaveBeenCalled();
  });

  it('shows a clear message when the credentials are wrong', async () => {
    const user = userEvent.setup();
    loginRequest.mockRejectedValue(
      apiError('INVALID_CREDENTIALS', 'Invalid email or password', 401),
    );
    renderApp('/login');

    await user.type(screen.getByLabelText('Email'), 'asha@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Login' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');
    expect(localStorage.getItem('token')).toBeNull();
    expect(screen.getByLabelText('Email')).toHaveValue('asha@example.com'); // input kept
  });

  it('explains a network failure instead of failing silently', async () => {
    const user = userEvent.setup();
    loginRequest.mockRejectedValue(Object.assign(new Error('Network Error'), { request: {} }));
    renderApp('/login');

    await user.type(screen.getByLabelText('Email'), 'asha@example.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Login' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/cannot reach the server/i);
  });

  it('logs in, stores the session and opens the dashboard', async () => {
    const user = userEvent.setup();
    const token = makeToken();
    loginRequest.mockResolvedValue({ token, user: TEST_USER });
    renderApp('/login');

    await user.type(screen.getByLabelText('Email'), 'asha@example.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Login' }));

    expect(await screen.findByRole('heading', { name: 'Task Manager' })).toBeInTheDocument();
    expect(screen.getByText(/Hi Asha/)).toBeInTheDocument();
    expect(localStorage.getItem('token')).toBe(token);
  });

  it('prevents a double submit while the request is running', async () => {
    const user = userEvent.setup();
    let resolveLogin;
    loginRequest.mockReturnValue(new Promise((resolve) => (resolveLogin = resolve)));
    renderApp('/login');

    await user.type(screen.getByLabelText('Email'), 'asha@example.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Login' }));

    const busyButton = await screen.findByRole('button', { name: /logging in/i });
    expect(busyButton).toBeDisabled();
    await user.click(busyButton);
    expect(loginRequest).toHaveBeenCalledTimes(1);

    resolveLogin({ token: makeToken(), user: TEST_USER });
    await screen.findByRole('heading', { name: 'Task Manager' });
  });
});

describe('register form', () => {
  it('validates name, email and password length', async () => {
    const user = userEvent.setup();
    renderApp('/register');

    await user.type(screen.getByLabelText('Password'), 'short');
    await user.click(screen.getByRole('button', { name: 'Register' }));

    expect(await screen.findByText('Name is required')).toBeInTheDocument();
    expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
    expect(registerRequest).not.toHaveBeenCalled();
  });

  it('shows a duplicate-email error next to the email field', async () => {
    const user = userEvent.setup();
    registerRequest.mockRejectedValue(
      apiError('EMAIL_TAKEN', 'An account with this email already exists', 409),
    );
    renderApp('/register');

    await user.type(screen.getByLabelText('Name'), 'Asha');
    await user.type(screen.getByLabelText('Email'), 'asha@example.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Register' }));

    expect(
      await screen.findByText('An account with this email already exists'),
    ).toBeInTheDocument();
  });
});

describe('route protection', () => {
  it('sends anonymous visitors from /tasks to the login page', async () => {
    renderApp('/tasks');
    expect(await screen.findByRole('heading', { name: 'Welcome Back' })).toBeInTheDocument();
  });

  it('ignores an expired stored token', async () => {
    localStorage.setItem('token', makeToken(-60));
    renderApp('/tasks');
    expect(await screen.findByRole('heading', { name: 'Welcome Back' })).toBeInTheDocument();
    await waitFor(() => expect(localStorage.getItem('token')).toBeNull());
  });
});
