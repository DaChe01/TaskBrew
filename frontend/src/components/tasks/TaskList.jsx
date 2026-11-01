import { todayString } from '../../utils/dates.js';
import Pagination from './Pagination.jsx';
import TaskItem from './TaskItem.jsx';

export default function TaskList({
  tasks,
  meta,
  loading,
  error,
  hasActiveFilters,
  onRetry,
  onPageChange,
  onToggle,
  onUpdate,
  onDelete,
}) {
  const today = todayString();
  const firstLoad = loading && tasks.length === 0;

  if (firstLoad && !error) {
    return (
      <p className="state-message" role="status">
        <span className="spinner" aria-hidden="true" /> Loading tasks…
      </p>
    );
  }

  if (error && tasks.length === 0) {
    return (
      <div className="state-message state-error" role="alert">
        <p>{error}</p>
        <button type="button" className="btn btn-primary btn-small" onClick={onRetry}>
          Try again
        </button>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="state-message">
        <p className="state-title">
          {hasActiveFilters ? 'No tasks match your filters' : 'No tasks yet'}
        </p>
        <p>
          {hasActiveFilters
            ? 'Try a different search or clear the filters.'
            : 'Add your first task above to get started.'}
        </p>
      </div>
    );
  }

  return (
    <>
      {error && (
        <p className="form-error" role="alert">
          {error}{' '}
          <button type="button" className="link-button" onClick={onRetry}>
            Retry
          </button>
        </p>
      )}
      <ul className={`task-list ${loading ? 'is-refreshing' : ''}`} aria-busy={loading}>
        {tasks.map((task) => (
          <TaskItem
            key={task.id}
            task={task}
            today={today}
            onToggle={onToggle}
            onUpdate={onUpdate}
            onDelete={onDelete}
          />
        ))}
      </ul>
      <Pagination page={meta.page} totalPages={meta.totalPages} onChange={onPageChange} />
    </>
  );
}
