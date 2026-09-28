import {
  evoryzDay,
  getNext2amBoundaryDate,
  getTimeUntilNext2amBoundary,
} from '../src/services/evoryzDay';
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

  test('getNext2amBoundaryDate correctly returns today 2 AM when called before 2 AM', () => {
    const before2am = new Date(2026, 8, 21, 1, 15, 0);
    const next2am = getNext2amBoundaryDate(before2am);
    expect(next2am.getFullYear()).toBe(2026);
    expect(next2am.getMonth()).toBe(8);
    expect(next2am.getDate()).toBe(21);
    expect(next2am.getHours()).toBe(2);
    expect(next2am.getMinutes()).toBe(0);
  });

  test('getNext2amBoundaryDate correctly returns tomorrow 2 AM when called after 2 AM', () => {
    const after2am = new Date(2026, 8, 21, 14, 30, 0);
    const next2am = getNext2amBoundaryDate(after2am);
    expect(next2am.getFullYear()).toBe(2026);
    expect(next2am.getMonth()).toBe(8);
    expect(next2am.getDate()).toBe(22);
    expect(next2am.getHours()).toBe(2);
    expect(next2am.getMinutes()).toBe(0);
  });

  test('getTimeUntilNext2amBoundary returns positive milliseconds', () => {
    const now = new Date(2026, 8, 21, 12, 0, 0);
    const diffMs = getTimeUntilNext2amBoundary(now);
    // 14 hours until 2 AM tomorrow = 14 * 3600 * 1000 = 50,400,000 ms
    expect(diffMs).toBe(14 * 60 * 60 * 1000);
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
