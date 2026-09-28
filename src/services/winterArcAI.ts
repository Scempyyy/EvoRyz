import { EvoRyzAIService, EvoRyzAIResult, ChatMessageContext } from './evoryzAI';
import {
  WinterArc,
  WinterArcRule,
  WinterArcDay,
  WinterArcMilestone,
} from '@/src/types/winterArc';

export interface WinterArcAIAnalysisRequest {
  arc: WinterArc;
  rules: WinterArcRule[];
  recentDays: WinterArcDay[];
  milestones: WinterArcMilestone[];
  userQuery?: string;
  conversationHistory?: ChatMessageContext[];
}

/**
 * Builds a disciplined, high-performance coaching prompt with the user's actual Winter Arc metrics.
 */
function buildCoachPrompt(params: WinterArcAIAnalysisRequest): string {
  const { arc, rules, recentDays, milestones, userQuery } = params;

  const currentScore = arc.overallScore;
  const streak = arc.currentStreak;
  const bestStreak = arc.bestStreak;
  const daysRecorded = recentDays.length;

  const ruleSummary = rules
    .filter((r) => r.enabled)
    .map((r) => `- ${r.title} (Target: ${r.target} ${r.unit}, Weight: ${r.weight}/10)`)
    .join('\n');

  const recentPerformance = recentDays.slice(-7).map((d) => {
    return `Day ${d.dayNumber} (${d.date}): Score ${d.score}%, Completed ${d.completedRulesCount}/${d.totalRulesCount} rules${d.streakProtectionUsed ? ' [Protected]' : ''}`;
  }).join('\n');

  const milestoneSummary = milestones.map((m) => `${m.title} (Day ${m.dayNumber})`).join(', ') || 'None yet';

  const systemContext = `
[WINTER ARC METRICS]
Arc Title: ${arc.title}
Status: ${arc.status}
Overall Completion: ${arc.overallCompletion}%
Overall Average Score: ${currentScore}%
Current Streak: ${streak} days | Best Streak: ${bestStreak} days
Days Recorded: ${daysRecorded}
Streak Protection Available: ${arc.streakProtectionAvailable ? 'YES (1/week)' : 'CONSUMED'}
Milestones Achieved: ${milestoneSummary}

[ENABLED RULES]
${ruleSummary}

[RECENT PERFORMANCE (LAST 7 DAYS)]
${recentPerformance || 'No daily logs recorded yet.'}

[COACHING DIRECTIVE]
You are the Winter Arc AI Coach — an elite, stoic, uncompromising yet encouraging discipline mentor for the 92-day Winter Arc.
Analyze my trend, identify weak points, point out patterns, and give concrete, actionable advice to maintain streak and hit 100% completion.
Do NOT give generic fluff. Be direct, motivating, and strategic.
`;

  if (userQuery) {
    return `${systemContext}\n\n[USER QUESTION / THOUGHT]:\n"${userQuery}"`;
  }

  return `${systemContext}\n\nPlease provide your comprehensive Winter Arc tactical review and focus suggestions for today.`;
}

export const WinterArcAIService = {
  /**
   * Generates strategic coaching insight and advice for the current Winter Arc state.
   */
  async getCoachingInsight(params: WinterArcAIAnalysisRequest): Promise<EvoRyzAIResult> {
    const prompt = buildCoachPrompt(params);
    return EvoRyzAIService.ask(prompt, params.conversationHistory || []);
  },
};
