import { useId, useRef, useState } from 'react';
import { getErrorMessage, getFieldErrors } from '../../utils/errors.js';

const PRIORITIES = ['Low', 'Medium', 'High'];
const EMPTY = { title: '', description: '', priority: 'Medium', due_date: '' };

function validate(values) {
  const errors = {};
  if (!values.title.trim()) errors.title = 'Title is required';
  else if (values.title.trim().length > 255) errors.title = 'Title must be at most 255 characters';
  if (values.description.length > 2000) {
    errors.description = 'Description must be at most 2000 characters';
  }
  return errors;
}

/**
 * One form for both creating and editing a task.
 * Input is kept when the request fails, so nothing the user typed is lost.
 */
export default function TaskForm({
  initialValues = EMPTY,
  submitLabel = 'Add task',
  onSubmit,
  onCancel,
  resetOnSuccess = false,
}) {
  const formId = useId();
  const [values, setValues] = useState({
    title: initialValues.title ?? '',
    description: initialValues.description ?? '',
    priority: initialValues.priority ?? 'Medium',
    due_date: initialValues.due_date ?? '', // already "YYYY-MM-DD", which date inputs accept
  });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false); // blocks double submits before state has re-rendered

  const setField = (field) => (event) => {
    setValues((current) => ({ ...current, [field]: event.target.value }));
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (inFlight.current) return;

    const problems = validate(values);
    setErrors(problems);
    setFormError('');
    if (Object.keys(problems).length > 0) return;

    inFlight.current = true;
    setSubmitting(true);
    try {
      await onSubmit({
        title: values.title.trim(),
        description: values.description.trim(),
        priority: values.priority,
        due_date: values.due_date || null,
      });
      if (resetOnSuccess) setValues(EMPTY);
    } catch (err) {
      // Toast is shown by the caller; here we mark the offending fields.
      const fieldErrors = getFieldErrors(err);
      setErrors(fieldErrors);
      if (Object.keys(fieldErrors).length === 0) setFormError(getErrorMessage(err));
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  const id = (name) => `${formId}-${name}`;

  return (
    <form className="task-form" onSubmit={handleSubmit} noValidate aria-label={submitLabel}>
      <div className="field field-wide">
        <label htmlFor={id('title')}>Title</label>
        <input
          id={id('title')}
          type="text"
          value={values.title}
          onChange={setField('title')}
          placeholder="What needs to be done?"
          maxLength={255}
          aria-invalid={Boolean(errors.title)}
          aria-describedby={errors.title ? id('title-error') : undefined}
          autoComplete="off"
        />
        {errors.title && (
          <p className="field-error" id={id('title-error')}>
            {errors.title}
          </p>
        )}
      </div>

      <div className="field field-wide">
        <label htmlFor={id('description')}>Description (optional)</label>
        <textarea
          id={id('description')}
          value={values.description}
          onChange={setField('description')}
          placeholder="Add some details"
          rows={2}
          aria-invalid={Boolean(errors.description)}
          aria-describedby={errors.description ? id('description-error') : undefined}
        />
        {errors.description && (
          <p className="field-error" id={id('description-error')}>
            {errors.description}
          </p>
        )}
      </div>

      <div className="field">
        <label htmlFor={id('priority')}>Priority</label>
        <select id={id('priority')} value={values.priority} onChange={setField('priority')}>
          {PRIORITIES.map((priority) => (
            <option key={priority} value={priority}>
              {priority}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor={id('due')}>Due date</label>
        <input id={id('due')} type="date" value={values.due_date} onChange={setField('due_date')} />
        {errors.due_date && <p className="field-error">{errors.due_date}</p>}
      </div>

      {formError && (
        <p className="form-error field-wide" role="alert">
          {formError}
        </p>
      )}

      <div className="form-actions field-wide">
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Saving…' : submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
