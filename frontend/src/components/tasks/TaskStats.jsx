export default function TaskStats({ stats }) {
  const items = [
    { key: 'total', label: 'Total', value: stats.total },
    { key: 'active', label: 'Active', value: stats.active },
    { key: 'completed', label: 'Done', value: stats.completed },
    { key: 'overdue', label: 'Overdue', value: stats.overdue, alert: stats.overdue > 0 },
  ];

  return (
    <dl className="stats" aria-label="Task summary">
      {items.map((item) => (
        <div key={item.key} className={`stat ${item.alert ? 'stat-alert' : ''}`}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
