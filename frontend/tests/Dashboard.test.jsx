import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  apiError,
  dayOffset,
  listResult,
  makeTask,
  renderApp,
  signIn,
  statsFor,
} from './helpers.jsx';

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

const { updateReminderPreference } = await import('../src/api/authApi.js');
const api = await import('../src/api/tasksApi.js');

/** Makes the mocked API behave like a tiny server holding `tasks`. */
function serve(tasks) {
  api.fetchTasks.mockImplementation(async () => listResult(tasks));
  api.fetchTaskStats.mockImplementation(async () => statsFor(tasks));
}

const openDashboard = async () => {
  signIn();
  renderApp('/tasks');
  await screen.findByRole('heading', { name: 'Task Manager' });
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('loading, empty and error states', () => {
  it('shows a loading indicator and then the tasks', async () => {
    let resolveList;
    api.fetchTasks.mockReturnValue(new Promise((resolve) => (resolveList = resolve)));
    api.fetchTaskStats.mockResolvedValue(statsFor([]));
    await openDashboard();

    expect(screen.getByRole('status')).toHaveTextContent('Loading tasks');

    resolveList(listResult([makeTask({ title: 'Write report' })]));
    expect(await screen.findByText('Write report')).toBeInTheDocument();
    expect(screen.queryByText('Loading tasks…')).not.toBeInTheDocument();
  });

  it('shows a helpful empty state for a new user', async () => {
    serve([]);
    await openDashboard();
    expect(await screen.findByText('No tasks yet')).toBeInTheDocument();
    expect(screen.getByText(/add your first task/i)).toBeInTheDocument();
  });

  it('shows an error with a working retry button when loading fails', async () => {
    const user = userEvent.setup();
    api.fetchTasks.mockRejectedValueOnce(
      apiError('INTERNAL_ERROR', 'Server is having a moment', 500),
    );
    api.fetchTaskStats.mockResolvedValue(statsFor([]));
    await openDashboard();

    expect(await screen.findByRole('alert')).toHaveTextContent('Server is having a moment');

    serve([makeTask({ title: 'Recovered' })]);
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Recovered')).toBeInTheDocument();
  });
});

describe('task display (descriptions and due dates)', () => {
  it('shows the description and due-date status of each task', async () => {
    serve([
      makeTask({ title: 'Late one', description: 'Needs the appendix', due_date: dayOffset(-2) }),
      makeTask({ title: 'Today one', due_date: dayOffset(0) }),
      makeTask({ title: 'Tomorrow one', due_date: dayOffset(1) }),
      makeTask({ title: 'Finished late', due_date: dayOffset(-5), completed: true }),
    ]);
    await openDashboard();

    expect(await screen.findByText('Needs the appendix')).toBeInTheDocument();
    expect(screen.getByText('Overdue by 2 days')).toBeInTheDocument();
    expect(screen.getByText('Due today')).toBeInTheDocument();
    expect(screen.getByText('Due tomorrow')).toBeInTheDocument();
    // A completed task is shown with its date but is never labelled overdue.
    expect(screen.getAllByText(/Overdue by/)).toHaveLength(1);
    expect(screen.getByText(/^Was due /)).toBeInTheDocument();
  });

  it('shows the summary counts from the server', async () => {
    api.fetchTasks.mockResolvedValue(listResult([makeTask()]));
    api.fetchTaskStats.mockResolvedValue({ total: 7, active: 5, completed: 2, overdue: 3 });
    await openDashboard();

    const summary = await screen.findByLabelText('Task summary');
    expect(within(summary).getByText('Overdue').nextSibling).toHaveTextContent('3');
    expect(within(summary).getByText('Total').nextSibling).toHaveTextContent('7');
  });
});

describe('creating tasks', () => {
  it('validates the title before calling the API', async () => {
    const user = userEvent.setup();
    serve([]);
    await openDashboard();

    await user.click(screen.getByRole('button', { name: 'Add task' }));
    expect(await screen.findByText('Title is required')).toBeInTheDocument();
    expect(api.createTaskRequest).not.toHaveBeenCalled();
  });

  it('creates a task, clears the form and reloads the list', async () => {
    const user = userEvent.setup();
    const tasks = [];
    serve(tasks);
    api.createTaskRequest.mockImplementation(async (payload) => {
      const created = makeTask(payload);
      tasks.push(created);
      return created;
    });
    await openDashboard();
    await screen.findByText('No tasks yet');

    const form = screen.getByRole('form', { name: 'Add task' });
    await user.type(within(form).getByLabelText('Title'), '  Buy milk  ');
    await user.type(within(form).getByLabelText(/Description/), 'Two litres');
    await user.selectOptions(within(form).getByLabelText('Priority'), 'High');
    await user.type(within(form).getByLabelText('Due date'), '2030-05-17');
    await user.click(within(form).getByRole('button', { name: 'Add task' }));

    await waitFor(() =>
      expect(api.createTaskRequest).toHaveBeenCalledWith({
        title: 'Buy milk',
        description: 'Two litres',
        priority: 'High',
        due_date: '2030-05-17',
      }),
    );
    expect(await screen.findByText('Buy milk')).toBeInTheDocument();
    expect(await screen.findByText('Task added')).toBeInTheDocument(); // success toast
    expect(within(form).getByLabelText('Title')).toHaveValue('');
  });

  it('keeps what the user typed and shows the error when creation fails', async () => {
    const user = userEvent.setup();
    serve([]);
    api.createTaskRequest.mockRejectedValue(
      apiError('VALIDATION_ERROR', 'Validation failed', 400, [
        { field: 'title', message: 'Title must be between 1 and 255 characters' },
      ]),
    );
    await openDashboard();

    const form = screen.getByRole('form', { name: 'Add task' });
    await user.type(within(form).getByLabelText('Title'), 'Keep me');
    await user.click(within(form).getByRole('button', { name: 'Add task' }));

    expect(
      await within(form).findByText('Title must be between 1 and 255 characters'),
    ).toBeInTheDocument();
    expect(within(form).getByLabelText('Title')).toHaveValue('Keep me');
    expect(await screen.findByText('Validation failed')).toBeInTheDocument(); // error toast
  });

  it('shows a network error toast and keeps the form usable', async () => {
    const user = userEvent.setup();
    serve([]);
    api.createTaskRequest.mockRejectedValue(
      Object.assign(new Error('Network Error'), { request: {} }),
    );
    await openDashboard();

    const form = screen.getByRole('form', { name: 'Add task' });
    await user.type(within(form).getByLabelText('Title'), 'Offline task');
    await user.click(within(form).getByRole('button', { name: 'Add task' }));

    expect((await screen.findAllByText(/cannot reach the server/i)).length).toBeGreaterThan(0);
    expect(within(form).getByLabelText('Title')).toHaveValue('Offline task');
    expect(within(form).getByRole('button', { name: 'Add task' })).toBeEnabled();
  });
});

describe('editing tasks', () => {
  it('pre-fills the existing due date and description, and saves changes', async () => {
    const user = userEvent.setup();
    const tasks = [
      makeTask({
        id: 42,
        title: 'Plan trip',
        description: 'Book flights',
        priority: 'High',
        due_date: '2030-03-01',
      }),
    ];
    serve(tasks);
    api.updateTaskRequest.mockImplementation(async (id, payload) => {
      Object.assign(tasks[0], payload);
      return tasks[0];
    });
    await openDashboard();

    await user.click(await screen.findByRole('button', { name: 'Edit "Plan trip"' }));

    const form = screen.getByRole('form', { name: 'Save changes' });
    // The date input must contain the stored date exactly (no timezone shift).
    expect(within(form).getByLabelText('Due date')).toHaveValue('2030-03-01');
    expect(within(form).getByLabelText(/Description/)).toHaveValue('Book flights');
    expect(within(form).getByLabelText('Priority')).toHaveValue('High');

    await user.clear(within(form).getByLabelText('Title'));
    await user.type(within(form).getByLabelText('Title'), 'Plan the trip');
    await user.click(within(form).getByRole('button', { name: 'Save changes' }));

    await waitFor(() =>
      expect(api.updateTaskRequest).toHaveBeenCalledWith(42, {
        title: 'Plan the trip',
        description: 'Book flights',
        priority: 'High',
        due_date: '2030-03-01',
      }),
    );
    expect(await screen.findByText('Plan the trip')).toBeInTheDocument();
    expect(screen.queryByRole('form', { name: 'Save changes' })).not.toBeInTheDocument();
  });

  it('can clear a due date', async () => {
    const user = userEvent.setup();
    const tasks = [makeTask({ id: 5, title: 'Dated', due_date: '2030-03-01' })];
    serve(tasks);
    api.updateTaskRequest.mockResolvedValue(tasks[0]);
    await openDashboard();

    await user.click(await screen.findByRole('button', { name: 'Edit "Dated"' }));
    const form = screen.getByRole('form', { name: 'Save changes' });
    await user.clear(within(form).getByLabelText('Due date'));
    await user.click(within(form).getByRole('button', { name: 'Save changes' }));

    await waitFor(() =>
      expect(api.updateTaskRequest).toHaveBeenCalledWith(
        5,
        expect.objectContaining({ due_date: null }),
      ),
    );
  });

  it('cancels editing without saving', async () => {
    const user = userEvent.setup();
    serve([makeTask({ title: 'Leave me' })]);
    await openDashboard();

    await user.click(await screen.findByRole('button', { name: 'Edit "Leave me"' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByText('Leave me')).toBeInTheDocument();
    expect(api.updateTaskRequest).not.toHaveBeenCalled();
  });
});

describe('completing and deleting', () => {
  it('toggles completion through an accessibly named checkbox', async () => {
    const user = userEvent.setup();
    const tasks = [makeTask({ id: 9, title: 'Tick me' })];
    serve(tasks);
    api.toggleTaskRequest.mockImplementation(async () => {
      tasks[0].completed = !tasks[0].completed;
      return tasks[0];
    });
    await openDashboard();

    await user.click(await screen.findByRole('checkbox', { name: 'Mark "Tick me" as completed' }));

    await waitFor(() => expect(api.toggleTaskRequest).toHaveBeenCalledWith(9));
    expect(
      await screen.findByRole('checkbox', { name: 'Mark "Tick me" as not completed' }),
    ).toBeChecked();
  });

  it('asks for confirmation before deleting', async () => {
    const user = userEvent.setup();
    const tasks = [makeTask({ id: 3, title: 'Remove me' }), makeTask({ id: 4, title: 'Stay' })];
    serve(tasks);
    api.deleteTaskRequest.mockImplementation(async (id) => {
      tasks.splice(
        tasks.findIndex((t) => t.id === id),
        1,
      );
      return { id };
    });
    await openDashboard();

    await user.click(await screen.findByRole('button', { name: 'Delete "Remove me"' }));
    expect(api.deleteTaskRequest).not.toHaveBeenCalled(); // not yet
    await user.click(screen.getByRole('button', { name: 'Confirm delete "Remove me"' }));

    await waitFor(() => expect(api.deleteTaskRequest).toHaveBeenCalledWith(3));
    await waitFor(() => expect(screen.queryByText('Remove me')).not.toBeInTheDocument());
    expect(screen.getByText('Stay')).toBeInTheDocument();
  });

  it('lets the user back out of a delete', async () => {
    const user = userEvent.setup();
    serve([makeTask({ title: 'Keep me' })]);
    await openDashboard();

    await user.click(await screen.findByRole('button', { name: 'Delete "Keep me"' }));
    await user.click(screen.getByRole('button', { name: 'Keep' }));

    expect(api.deleteTaskRequest).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Edit "Keep me"' })).toBeInTheDocument();
  });

  it('shows an error toast when a task action fails', async () => {
    const user = userEvent.setup();
    serve([makeTask({ id: 1, title: 'Stubborn' })]);
    api.toggleTaskRequest.mockRejectedValue(apiError('TASK_NOT_FOUND', 'Task not found', 404));
    await openDashboard();

    await user.click(await screen.findByRole('checkbox', { name: /Stubborn/ }));
    expect(await screen.findByText('Task not found')).toBeInTheDocument();
  });
});

describe('filtering, searching and paging', () => {
  it('requests the chosen status, priority and sort from the server', async () => {
    const user = userEvent.setup();
    serve([makeTask()]);
    await openDashboard();
    await screen.findByText('Sample task');

    await user.click(screen.getByRole('button', { name: 'Completed' }));
    await waitFor(() =>
      expect(api.fetchTasks).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: 'completed', page: 1 }),
        expect.anything(),
      ),
    );
    expect(screen.getByRole('button', { name: 'Completed' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await user.selectOptions(
      screen.getByLabelText('Priority', { selector: '#task-priority-filter' }),
      'High',
    );
    await waitFor(() =>
      expect(api.fetchTasks).toHaveBeenLastCalledWith(
        expect.objectContaining({ priority: 'High', status: 'completed' }),
        expect.anything(),
      ),
    );

    await user.selectOptions(screen.getByLabelText('Sort by'), 'priority:desc');
    await waitFor(() =>
      expect(api.fetchTasks).toHaveBeenLastCalledWith(
        expect.objectContaining({ sort: 'priority', order: 'desc' }),
        expect.anything(),
      ),
    );
  });

  it('debounces the search box and sends it as q', async () => {
    const user = userEvent.setup();
    serve([makeTask()]);
    await openDashboard();
    await screen.findByText('Sample task');
    api.fetchTasks.mockClear();

    await user.type(screen.getByLabelText('Search tasks'), 'report');

    await waitFor(() =>
      expect(api.fetchTasks).toHaveBeenLastCalledWith(
        expect.objectContaining({ q: 'report' }),
        expect.anything(),
      ),
    );
    // Typing six characters must not cause six requests.
    expect(api.fetchTasks.mock.calls.length).toBeLessThanOrEqual(2);
  });

  it('explains when filters hide every task', async () => {
    const user = userEvent.setup();
    serve([]);
    await openDashboard();
    await user.click(await screen.findByRole('button', { name: 'Completed' }));
    expect(await screen.findByText('No tasks match your filters')).toBeInTheDocument();
  });

  it('pages through results', async () => {
    const user = userEvent.setup();
    api.fetchTasks.mockImplementation(async (params) =>
      listResult([makeTask({ title: `Task on page ${params.page}` })], {
        page: params.page,
        total: 16,
        totalPages: 2,
      }),
    );
    api.fetchTaskStats.mockResolvedValue({ total: 16, active: 16, completed: 0, overdue: 0 });
    await openDashboard();

    expect(await screen.findByText('Page 1 of 2')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('Task on page 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });
});

describe('reminders and session', () => {
  it('turns email reminders off and confirms it', async () => {
    const user = userEvent.setup();
    serve([]);
    updateReminderPreference.mockResolvedValue({
      id: 1,
      name: 'Asha',
      email: 'asha@example.com',
      email_reminders: false,
    });
    await openDashboard();

    const toggle = screen.getByRole('checkbox', { name: 'Email reminders' });
    expect(toggle).toBeChecked();
    await user.click(toggle);

    await waitFor(() => expect(updateReminderPreference).toHaveBeenCalledWith(false));
    expect(await screen.findByText('Email reminders turned off')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Email reminders' })).not.toBeChecked();
  });

  it('explains the priority-based reminder schedule', async () => {
    serve([]);
    await openDashboard();
    expect(screen.getByText(/3 days before, 1 day before and on the due date/)).toBeInTheDocument();
  });

  it('logs out, clears the session and returns to the login page without a reload', async () => {
    const user = userEvent.setup();
    serve([]);
    await openDashboard();

    await user.click(screen.getByRole('button', { name: 'Logout' }));

    expect(await screen.findByRole('heading', { name: 'Welcome Back' })).toBeInTheDocument();
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
  });
});
