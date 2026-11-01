import { useState } from 'react';
import { getDueStatus } from '../../utils/dates.js';
import TaskForm from './TaskForm.jsx';

export default function TaskItem({ task, today, onToggle, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const due = getDueStatus(task, today);

  // Runs an action while the row's buttons are disabled. Errors are already shown
  // as toasts by useTasks, so they are swallowed here.
  const run = async (action) => {
    setBusy(true);
    try {
      await action();
      return true;
    } catch {
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (editing) {
    return (
      <li className="task-item task-item-editing">
        <TaskForm
          initialValues={task}
          submitLabel="Save changes"
          onSubmit={async (values) => {
            await onUpdate(task.id, values);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      </li>
    );
  }

  const classes = [
    'task-item',
    `priority-${task.priority.toLowerCase()}`,
    task.completed ? 'is-completed' : '',
    due.state === 'overdue' ? 'is-overdue' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <li className={classes}>
      <div className="task-main">
        <input
          type="checkbox"
          className="task-checkbox"
          checked={task.completed}
          disabled={busy}
          onChange={() => run(() => onToggle(task.id))}
          aria-label={`Mark "${task.title}" as ${task.completed ? 'not completed' : 'completed'}`}
        />
        <div className="task-body">
          <div className="task-heading">
            <span className="task-title">{task.title}</span>
            <span className={`badge badge-${task.priority.toLowerCase()}`}>{task.priority}</span>
          </div>
          {task.description && <p className="task-description">{task.description}</p>}
          {task.due_date && <p className={`due due-${due.state}`}>{due.label}</p>}
        </div>
      </div>

      <div className="task-actions">
        {confirmingDelete ? (
          <>
            <span className="confirm-text">Delete this task?</span>
            <button
              type="button"
              className="btn btn-danger btn-small"
              disabled={busy}
              onClick={() => run(() => onDelete(task.id))}
              aria-label={`Confirm delete "${task.title}"`}
            >
              Yes, delete
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-small"
              onClick={() => setConfirmingDelete(false)}
              disabled={busy}
            >
              Keep
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="btn btn-ghost btn-small"
              onClick={() => setEditing(true)}
              disabled={busy}
              aria-label={`Edit "${task.title}"`}
            >
              Edit
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-small"
              onClick={() => setConfirmingDelete(true)}
              disabled={busy}
              aria-label={`Delete "${task.title}"`}
            >
              Delete
            </button>
          </>
        )}
      </div>
    </li>
  );
}
