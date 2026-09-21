import { DailySummary, DailyTask } from '@/src/types';
import { displayEvoDay } from './evoryzDay';

export function completionPercent(tasks: DailyTask[]): number {
  return tasks.length ? Math.round((tasks.filter((task) => task.completed).length / tasks.length) * 100) : 0;
}

export function sharedPercent(tasks: DailyTask[]): number {
  return completionPercent(tasks.filter((task) => task.visibility === 'shared'));
}

export function groupPercent(memberPercents: number[]): number { return memberPercents.length ? Math.round(memberPercents.reduce((total, percent) => total + percent, 0) / memberPercents.length) : 0; }

export function dailyRecap(tasks: DailyTask[], day: string, name = 'You', streak = 0): string {
  const shared = tasks.filter((task) => task.visibility === 'shared');
  const percent = completionPercent(tasks);
  return `🌙 DAILY RECAP\n${displayEvoDay(day)}\n\n${name.toUpperCase()}  ${percent}%\n✓ ${tasks.filter((task) => task.completed).length} / ${tasks.length} tasks completed\n🔥 ${streak} day streak${shared.length ? `\n\n${shared.filter((task) => task.completed).length} / ${shared.length} shared tasks completed` : ''}\n\nKeep evolving.`;
}

export function weeklyRecap(summaries: DailySummary[]): { average: number; best: DailySummary | undefined; daysShown: number } {
  return { average: summaries.length ? Math.round(summaries.reduce((total, summary) => total + summary.you, 0) / summaries.length) : 0, best: summaries.reduce<DailySummary | undefined>((best, summary) => !best || summary.you > best.you ? summary : best, undefined), daysShown: summaries.length };
}
