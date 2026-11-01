const escapeHtml = (text) =>
  String(text).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );

const describe = (kind, daysLeft) => {
  if (kind === 'overdue') return `overdue by ${-daysLeft} day${-daysLeft === 1 ? '' : 's'}`;
  if (daysLeft === 0) return 'due today';
  if (daysLeft === 1) return 'due tomorrow';
  return `due in ${daysLeft} days`;
};

/** items: [{ title, priority, dueDate, kind, daysLeft }] sorted most urgent first. */
export function buildReminderEmail({ name, items, appUrl }) {
  const subject =
    items.length === 1
      ? `Reminder: "${items[0].title}" is ${describe(items[0].kind, items[0].daysLeft)}`
      : `Task Manager: ${items.length} tasks need your attention`;

  const lines = items.map(
    (i) => `- [${i.priority}] ${i.title} — ${describe(i.kind, i.daysLeft)} (${i.dueDate})`,
  );
  const text = [
    `Hi ${name},`,
    '',
    'These tasks need your attention:',
    ...lines,
    '',
    `Open your tasks: ${appUrl}`,
    '',
    'You can turn these emails off from the dashboard.',
  ].join('\n');

  const rows = items
    .map(
      (i) =>
        `<li><strong>${escapeHtml(i.title)}</strong> &mdash; ${escapeHtml(describe(i.kind, i.daysLeft))} ` +
        `<span style="color:#666">(${escapeHtml(i.priority)} priority, ${escapeHtml(i.dueDate)})</span></li>`,
    )
    .join('');
  const html =
    `<p>Hi ${escapeHtml(name)},</p><p>These tasks need your attention:</p><ul>${rows}</ul>` +
    `<p><a href="${escapeHtml(appUrl)}">Open your tasks</a></p>` +
    `<p style="color:#666;font-size:12px">You can turn these emails off from the dashboard.</p>`;

  return { subject, text, html };
}
