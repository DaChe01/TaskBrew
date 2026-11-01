const STATUSES = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
];

const SORT_OPTIONS = [
  { value: 'due_date:asc', label: 'Due date (soonest first)' },
  { value: 'created_at:desc', label: 'Newest first' },
  { value: 'priority:desc', label: 'Priority (high first)' },
  { value: 'title:asc', label: 'Title (A–Z)' },
];

export default function TaskFilters({ filters, searchText, onSearchChange, onChange }) {
  return (
    <section className="filters" aria-label="Filter and sort tasks">
      <div className="field filter-search">
        <label htmlFor="task-search">Search tasks</label>
        <input
          id="task-search"
          type="search"
          value={searchText}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search title or description"
          maxLength={100}
        />
      </div>

      <div className="field">
        <label htmlFor="task-priority-filter">Priority</label>
        <select
          id="task-priority-filter"
          value={filters.priority}
          onChange={(event) => onChange({ priority: event.target.value })}
        >
          <option value="">All priorities</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
      </div>

      <div className="field">
        <label htmlFor="task-sort">Sort by</label>
        <select
          id="task-sort"
          value={`${filters.sort}:${filters.order}`}
          onChange={(event) => {
            const [sort, order] = event.target.value.split(':');
            onChange({ sort, order });
          }}
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="status-tabs" role="group" aria-label="Show tasks">
        {STATUSES.map((status) => (
          <button
            key={status.value}
            type="button"
            className={`chip ${filters.status === status.value ? 'chip-active' : ''}`}
            aria-pressed={filters.status === status.value}
            onClick={() => onChange({ status: status.value })}
          >
            {status.label}
          </button>
        ))}
      </div>
    </section>
  );
}
