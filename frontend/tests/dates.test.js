import { describe, expect, it } from 'vitest';
import { daysBetween, formatDueDate, getDueStatus, todayString } from '../src/utils/dates.js';

describe('date helpers', () => {
  it('formats a date-only string without any timezone shift', () => {
    expect(formatDueDate('2026-03-01')).toBe('1 Mar 2026');
    expect(formatDueDate('2026-12-31')).toBe('31 Dec 2026');
    expect(formatDueDate(null)).toBe('');
  });

  it('counts whole days across month ends and leap days', () => {
    expect(daysBetween('2026-01-30', '2026-02-02')).toBe(3);
    expect(daysBetween('2024-02-28', '2024-03-01')).toBe(2);
    expect(daysBetween('2026-05-05', '2026-05-01')).toBe(-4);
  });

  it('builds today from local calendar parts', () => {
    expect(todayString(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(todayString(new Date(2026, 11, 31, 0, 1))).toBe('2026-12-31');
  });
});

describe('getDueStatus', () => {
  const today = '2026-06-10';
  const status = (due_date, completed = false) => getDueStatus({ due_date, completed }, today);

  it('flags open tasks past their due date as overdue', () => {
    expect(status('2026-06-08')).toMatchObject({ state: 'overdue', label: 'Overdue by 2 days' });
    expect(status('2026-06-09').label).toBe('Overdue by 1 day');
  });

  it('never calls a completed task overdue', () => {
    expect(status('2026-06-01', true)).toMatchObject({
      state: 'completed',
      label: 'Was due 1 Jun 2026',
    });
  });

  it('distinguishes today, tomorrow, soon and upcoming', () => {
    expect(status('2026-06-10')).toMatchObject({ state: 'today', label: 'Due today' });
    expect(status('2026-06-11')).toMatchObject({ state: 'tomorrow', label: 'Due tomorrow' });
    expect(status('2026-06-13')).toMatchObject({ state: 'soon', label: 'Due in 3 days' });
    expect(status('2026-06-20')).toMatchObject({ state: 'upcoming', label: 'Due 20 Jun 2026' });
  });

  it('handles tasks without a due date', () => {
    expect(status(null).state).toBe('none');
  });
});
