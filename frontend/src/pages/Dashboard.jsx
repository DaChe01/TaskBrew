import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ReminderSettings from '../components/ReminderSettings.jsx';
import TaskFilters from '../components/tasks/TaskFilters.jsx';
import TaskForm from '../components/tasks/TaskForm.jsx';
import TaskList from '../components/tasks/TaskList.jsx';
import TaskStats from '../components/tasks/TaskStats.jsx';
import { useAuth } from '../hooks/useAuth.js';
import { useDebouncedValue } from '../hooks/useDebouncedValue.js';
import { useTasks } from '../hooks/useTasks.js';

const DEFAULT_FILTERS = {
  status: 'all',
  priority: '',
  sort: 'due_date',
  order: 'asc',
  page: 1,
};

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [searchText, setSearchText] = useState('');
  const q = useDebouncedValue(searchText.trim(), 300);

  const {
    tasks,
    meta,
    stats,
    loading,
    error,
    reload,
    createTask,
    updateTask,
    toggleTask,
    deleteTask,
    clearCompleted,
  } = useTasks({ ...filters, q });

  // Changing a filter always goes back to the first page.
  const changeFilters = useCallback(
    (patch) => setFilters((current) => ({ ...current, ...patch, page: 1 })),
    [],
  );
  const changePage = useCallback((page) => setFilters((current) => ({ ...current, page })), []);

  // Deleting the last task on a page would leave an empty page: step back.
  useEffect(() => {
    if (!loading && meta.totalPages < filters.page) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- corrective state sync
      setFilters((current) => ({ ...current, page: Math.max(1, meta.totalPages) }));
    }
  }, [loading, meta.totalPages, filters.page]);

  // A new search term also returns to page 1.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset page when the search changes
    setFilters((current) => (current.page === 1 ? current : { ...current, page: 1 }));
  }, [q]);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const hasActiveFilters = Boolean(q) || filters.status !== 'all' || Boolean(filters.priority);

  return (
    <div className="dashboard-page">
      <main className="dashboard">
        <header className="dashboard-header">
          <div>
            <h1>Task Manager</h1>
            <p className="greeting">
              {user?.name ? `Hi ${user.name}, ` : ''}let’s get things done.
            </p>
          </div>
          <button type="button" className="btn btn-ghost" onClick={handleLogout}>
            Logout
          </button>
        </header>

        <ReminderSettings />

        <section className="panel" aria-labelledby="add-task-heading">
          <h2 id="add-task-heading">Add a task</h2>
          <TaskForm onSubmit={createTask} submitLabel="Add task" resetOnSuccess />
        </section>

        <TaskStats stats={stats} />

        <TaskFilters
          filters={filters}
          searchText={searchText}
          onSearchChange={setSearchText}
          onChange={changeFilters}
        />

        <section aria-labelledby="task-list-heading">
          <div className="list-heading">
            <h2 id="task-list-heading">Your tasks</h2>
            {stats.completed > 0 && (
              <button
                type="button"
                className="btn btn-ghost btn-small"
                onClick={() => clearCompleted().catch(() => {})}
              >
                Clear completed ({stats.completed})
              </button>
            )}
          </div>
          <TaskList
            tasks={tasks}
            meta={meta}
            loading={loading}
            error={error}
            hasActiveFilters={hasActiveFilters}
            onRetry={reload}
            onPageChange={changePage}
            onToggle={toggleTask}
            onUpdate={updateTask}
            onDelete={deleteTask}
          />
        </section>
      </main>
    </div>
  );
}
