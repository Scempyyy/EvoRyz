import { evoryzDay } from '../src/services/evoryzDay';
import { completionPercent, sharedPercent } from '../src/services/recaps';
import { DailyTask } from '../src/types';

describe('EvoRyz Day Boundary (02:00 -> 01:59)', () => {
  test('returns previous calendar day when time is between midnight and 01:59', () => {
    // 2026-09-21 01:30 AM should belong to 2026-09-20
    const earlyMorning = new Date(2026, 8, 21, 1, 30, 0);
    const day = evoryzDay(earlyMorning);
    expect(day).toBe('2026-09-20');
  });

  test('returns current calendar day when time is 02:00 or later', () => {
    // 2026-09-21 02:00 AM should belong to 2026-09-21
    const rollTime = new Date(2026, 8, 21, 2, 0, 0);
    const day = evoryzDay(rollTime);
    expect(day).toBe('2026-09-21');

    // 2026-09-21 11:45 PM should belong to 2026-09-21
    const nightTime = new Date(2026, 8, 21, 23, 45, 0);
    expect(evoryzDay(nightTime)).toBe('2026-09-21');
  });
});

describe('Recaps & Completion Calculation', () => {
  const mockTasks: DailyTask[] = [
    { id: '1', ownerId: 'u1', title: 'Task 1', visibility: 'private', date: '2026-09-21', completed: true },
    { id: '2', ownerId: 'u1', title: 'Task 2', visibility: 'private', date: '2026-09-21', completed: false },
    { id: '3', ownerId: 'u1', title: 'Task 3', visibility: 'shared', date: '2026-09-21', completed: true },
    { id: '4', ownerId: 'u1', title: 'Task 4', visibility: 'shared', date: '2026-09-21', completed: true },
  ];

  test('calculates total completion percentage', () => {
    expect(completionPercent(mockTasks)).toBe(75); // 3 of 4 = 75%
  });

  test('calculates shared completion percentage', () => {
    expect(sharedPercent(mockTasks)).toBe(100); // 2 of 2 shared = 100%
  });

  test('returns 0 when task list is empty', () => {
    expect(completionPercent([])).toBe(0);
    expect(sharedPercent([])).toBe(0);
  });
});
