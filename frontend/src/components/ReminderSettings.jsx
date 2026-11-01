import { useState } from 'react';
import { updateReminderPreference } from '../api/authApi.js';
import { useAuth } from '../hooks/useAuth.js';
import { useToast } from '../hooks/useToast.js';
import { getErrorMessage } from '../utils/errors.js';

/** Lets the user switch email reminders on or off. */
export default function ReminderSettings() {
  const { user, updateUser } = useAuth();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  // Accounts stored before this feature existed have no value: reminders default to on.
  const enabled = user?.email_reminders ?? true;

  const handleChange = async (event) => {
    const next = event.target.checked;
    setSaving(true);
    try {
      const updated = await updateReminderPreference(next);
      updateUser({ ...user, ...updated });
      toast.success(next ? 'Email reminders turned on' : 'Email reminders turned off');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="reminder-settings">
      <label className="reminder-toggle">
        <input type="checkbox" checked={enabled} disabled={saving} onChange={handleChange} />
        <span>Email reminders</span>
      </label>
      <details className="reminder-help">
        <summary>How do reminders work?</summary>
        <ul>
          <li>
            <strong>High:</strong> 3 days before, 1 day before and on the due date
          </li>
          <li>
            <strong>Medium:</strong> 1 day before and on the due date
          </li>
          <li>
            <strong>Low:</strong> on the due date
          </li>
          <li>High and Medium tasks also get one follow-up if they become overdue.</li>
        </ul>
        <p>
          Completed tasks never trigger reminders. You get one email a day listing everything due.
        </p>
      </details>
    </div>
  );
}
