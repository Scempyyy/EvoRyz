import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Progress } from '@/src/components/ui';
import { colors } from '@/src/theme';
import { useApp } from '@/src/store/AppContext';
import { evoryzDay } from '@/src/services/evoryzDay';
import {
  getWinterArcDayNumber,
  getDaysUntilWinterArc,
  calculateWinterArcStats,
} from '@/src/services/winterArc';
import { feedback } from '@/src/services/feedback';

interface WinterArcBannerProps {
  onOpenTracker: () => void;
}

export function WinterArcBanner({ onOpenTracker }: WinterArcBannerProps) {
  const { winterArc, acceptWinterArc, user } = useApp();

  const todayStr = evoryzDay();
  const dayNumber = getWinterArcDayNumber(todayStr);
  const daysUntil = getDaysUntilWinterArc(todayStr);
  const stats = calculateWinterArcStats(winterArc?.habits || [], todayStr);

  if (!winterArc?.accepted) {
    return (
      <Card style={styles.bannerCard}>
        <View style={styles.headerRow}>
          <View style={styles.badge}>
            <Ionicons name="snow" size={14} color="#00F5D4" />
            <Text style={styles.badgeText}>SEASONAL EVENT · 92 DAYS</Text>
          </View>
          <Text style={styles.dateRange}>OCT 1 – DEC 31</Text>
        </View>

        <Text style={styles.title}>WINTER ARC 2026</Text>
        <Text style={styles.subtitle}>
          The final quarter of 2026. Eliminate distractions, build iron discipline, and evolve into your highest self.
        </Text>

        <View style={styles.rulesList}>
          <View style={styles.ruleItem}>
            <Ionicons name="checkmark-circle" size={16} color="#00F5D4" />
            <Text style={styles.ruleText}>Daily custom habit tracking across all 92 days</Text>
          </View>
          <View style={styles.ruleItem}>
            <Ionicons name="lock-closed" size={16} color="#00F5D4" />
            <Text style={styles.ruleText}>Strict future-date locking — no cheating ahead</Text>
          </View>
          <View style={styles.ruleItem}>
            <Ionicons name="flame" size={16} color="#FF6D7A" />
            <Text style={styles.ruleText}>Aligned with 2:00 AM EvoRyz reset boundary</Text>
          </View>
        </View>

        <Pressable
          style={styles.acceptButton}
          onPress={() => {
            feedback.tap(user.settings.preferences.haptics);
            acceptWinterArc();
            onOpenTracker();
          }}
        >
          <Ionicons name="shield-checkmark" size={18} color="#0C0B12" />
          <Text style={styles.acceptButtonText}>ACCEPT THE ARC</Text>
        </Pressable>
      </Card>
    );
  }

  // Active Winter Arc state
  return (
    <Card style={styles.activeCard}>
      <View style={styles.activeHeader}>
        <View style={styles.titleRow}>
          <Ionicons name="snow" size={18} color="#00F5D4" />
          <Text style={styles.activeTitle}>WINTER ARC 2026</Text>
        </View>

        {daysUntil > 0 ? (
          <View style={styles.countdownPill}>
            <Text style={styles.countdownText}>STARTS IN {daysUntil} DAY{daysUntil === 1 ? '' : 'S'}</Text>
          </View>
        ) : dayNumber ? (
          <View style={styles.dayPill}>
            <Text style={styles.dayPillText}>DAY {dayNumber} / 92</Text>
          </View>
        ) : (
          <View style={styles.dayPill}>
            <Text style={styles.dayPillText}>COMPLETED</Text>
          </View>
        )}
      </View>

      <Text style={styles.activeSub}>
        {daysUntil > 0
          ? 'Phase: Preparation · Setup your habits and lock in before October 1.'
          : `${(winterArc?.habits || []).length} Habit${(winterArc?.habits || []).length === 1 ? '' : 's'} · ${stats.currentStreak} Day Streak`}
      </Text>

      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{stats.overallPercent}%</Text>
          <Text style={styles.statLabel}>Completion</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{stats.currentStreak}d</Text>
          <Text style={styles.statLabel}>Streak</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{stats.daysCompleted}</Text>
          <Text style={styles.statLabel}>Checkmarks</Text>
        </View>
      </View>

      <View style={styles.progressContainer}>
        <Progress value={stats.overallPercent} color="#00F5D4" />
      </View>

      <Pressable
        style={styles.openTrackerButton}
        onPress={() => {
          feedback.tap(user.settings.preferences.haptics);
          onOpenTracker();
        }}
      >
        <Ionicons name="snow" size={16} color="#00F5D4" />
        <Text style={styles.openTrackerText}>ENTER WINTER ARC</Text>
        <Ionicons name="chevron-forward" size={16} color="#00F5D4" />
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  bannerCard: {
    backgroundColor: '#111827',
    borderWidth: 1.5,
    borderColor: '#00F5D440',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#00F5D418',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#00F5D430',
  },
  badgeText: {
    color: '#00F5D4',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  dateRange: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  title: {
    color: '#F7F5FC',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
  },
  rulesList: {
    gap: 8,
    marginBottom: 16,
  },
  ruleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ruleText: {
    color: '#E5E7EB',
    fontSize: 13,
    fontWeight: '500',
  },
  acceptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00F5D4',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  acceptButtonText: {
    color: '#0C0B12',
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 1,
  },
  activeCard: {
    backgroundColor: '#13192B',
    borderWidth: 1,
    borderColor: '#00F5D450',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
  },
  activeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activeTitle: {
    color: '#F7F5FC',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  countdownPill: {
    backgroundColor: '#3B82F625',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3B82F650',
  },
  countdownText: {
    color: '#60A5FA',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  dayPill: {
    backgroundColor: '#00F5D420',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#00F5D450',
  },
  dayPillText: {
    color: '#00F5D4',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  activeSub: {
    color: colors.muted,
    fontSize: 12,
    marginBottom: 14,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#0B1120',
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  statBox: {
    alignItems: 'center',
  },
  statValue: {
    color: '#F7F5FC',
    fontSize: 18,
    fontWeight: '800',
  },
  statLabel: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.border,
  },
  progressContainer: {
    marginBottom: 14,
  },
  openTrackerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00F5D415',
    borderWidth: 1,
    borderColor: '#00F5D440',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  openTrackerText: {
    color: '#00F5D4',
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 0.5,
  },
});
