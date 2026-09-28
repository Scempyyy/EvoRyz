import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/src/theme';
import { WinterArcAnalyticsSummary } from '@/src/services/winterArcAnalytics';
import { PASSING_SCORE_THRESHOLD } from '@/src/services/winterArcScoring';
import { feedback } from '@/src/services/feedback';

interface WinterArcGraphsProps {
  analytics: WinterArcAnalyticsSummary;
}

export function WinterArcGraphs({ analytics }: WinterArcGraphsProps) {
  const [activeTab, setActiveTab] = useState<'daily' | 'weekly' | 'rules'>('daily');

  const { dailyScores, weeklyConsistency, ruleBreakdown } = analytics;

  return (
    <View style={styles.card}>
      {/* Tab Switcher */}
      <View style={styles.tabRow}>
        <Pressable
          style={[styles.tabBtn, activeTab === 'daily' && styles.tabBtnActive]}
          onPress={() => {
            feedback.tap(true);
            setActiveTab('daily');
          }}
        >
          <Ionicons
            name="bar-chart"
            size={14}
            color={activeTab === 'daily' ? '#00F5D4' : colors.muted}
          />
          <Text
            style={[styles.tabBtnText, activeTab === 'daily' && styles.tabBtnTextActive]}
          >
            Daily Score
          </Text>
        </Pressable>

        <Pressable
          style={[styles.tabBtn, activeTab === 'weekly' && styles.tabBtnActive]}
          onPress={() => {
            feedback.tap(true);
            setActiveTab('weekly');
          }}
        >
          <Ionicons
            name="trending-up"
            size={14}
            color={activeTab === 'weekly' ? '#00F5D4' : colors.muted}
          />
          <Text
            style={[styles.tabBtnText, activeTab === 'weekly' && styles.tabBtnTextActive]}
          >
            Weekly Trend
          </Text>
        </Pressable>

        <Pressable
          style={[styles.tabBtn, activeTab === 'rules' && styles.tabBtnActive]}
          onPress={() => {
            feedback.tap(true);
            setActiveTab('rules');
          }}
        >
          <Ionicons
            name="pie-chart"
            size={14}
            color={activeTab === 'rules' ? '#00F5D4' : colors.muted}
          />
          <Text
            style={[styles.tabBtnText, activeTab === 'rules' && styles.tabBtnTextActive]}
          >
            Rules
          </Text>
        </Pressable>
      </View>

      {/* 1. DAILY SCORE GRAPH */}
      {activeTab === 'daily' && (
        <View style={styles.graphContainer}>
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#00F5D4' }]} />
              <Text style={styles.legendText}>Passing ({`≥${PASSING_SCORE_THRESHOLD}%`})</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#FF6D7A' }]} />
              <Text style={styles.legendText}>Missed</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#FFB703' }]} />
              <Text style={styles.legendText}>Protected</Text>
            </View>
          </View>

          {dailyScores.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No daily logs recorded yet. Complete today&apos;s rules to graph your score.</Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.barChartScroll}>
              {dailyScores.map((item) => {
                const heightPct = Math.max(8, item.score);
                const barColor = item.streakProtectionUsed
                  ? '#FFB703'
                  : item.isPassing
                  ? '#00F5D4'
                  : '#FF6D7A';

                return (
                  <View key={item.date} style={styles.barColumn}>
                    <Text style={styles.barScoreText}>{Math.round(item.score)}%</Text>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          {
                            height: `${heightPct}%`,
                            backgroundColor: barColor,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.barDayLabel}>D{item.dayNumber}</Text>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      )}

      {/* 2. WEEKLY CONSISTENCY GRAPH */}
      {activeTab === 'weekly' && (
        <View style={styles.graphContainer}>
          <Text style={styles.sectionSub}>7-Day chunk consistency percentages across your Arc:</Text>
          {weeklyConsistency.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Weekly consistency graphs after your first 7 recorded days.</Text>
            </View>
          ) : (
            <View style={styles.weeklyList}>
              {weeklyConsistency.map((w) => (
                <View key={w.week} style={styles.weeklyItem}>
                  <View style={styles.weeklyLabelRow}>
                    <Text style={styles.weekLabel}>WEEK {w.week}</Text>
                    <Text style={styles.weekPct}>{w.consistency}%</Text>
                  </View>
                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressBar,
                        {
                          width: `${w.consistency}%`,
                          backgroundColor: w.consistency >= 70 ? '#00F5D4' : '#FFB703',
                        },
                      ]}
                    />
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* 3. RULE BREAKDOWN */}
      {activeTab === 'rules' && (
        <View style={styles.graphContainer}>
          <Text style={styles.sectionSub}>Execution consistency per configured rule:</Text>
          {ruleBreakdown.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No rules defined yet.</Text>
            </View>
          ) : (
            <View style={styles.ruleBreakdownList}>
              {ruleBreakdown.map((r) => (
                <View key={r.ruleId} style={styles.ruleBreakdownItem}>
                  <View style={styles.ruleLabelRow}>
                    <Text style={styles.ruleTitleText}>{r.title}</Text>
                    <Text style={styles.rulePctText}>{r.percentage}% ({r.completedDays}/{r.totalDays}d)</Text>
                  </View>
                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressBar,
                        {
                          width: `${r.percentage}%`,
                          backgroundColor: r.color || '#00F5D4',
                        },
                      ]}
                    />
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#121019',
    borderColor: '#262038',
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#191624',
  },
  tabBtnActive: {
    backgroundColor: '#1E2833',
    borderColor: '#00F5D4',
    borderWidth: 1,
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.muted,
  },
  tabBtnTextActive: {
    color: '#00F5D4',
  },
  graphContainer: {
    minHeight: 180,
  },
  legendRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 14,
    flexWrap: 'wrap',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
  },
  barChartScroll: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    paddingBottom: 6,
    minHeight: 150,
  },
  barColumn: {
    alignItems: 'center',
    width: 32,
    height: 140,
    justifyContent: 'flex-end',
  },
  barScoreText: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: '700',
    marginBottom: 4,
  },
  barTrack: {
    width: 14,
    height: 100,
    backgroundColor: '#1B1729',
    borderRadius: 7,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderRadius: 7,
  },
  barDayLabel: {
    color: 'white',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 6,
  },
  emptyContainer: {
    paddingVertical: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: colors.muted,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  sectionSub: {
    fontSize: 12,
    color: colors.muted,
    marginBottom: 12,
  },
  weeklyList: {
    gap: 12,
  },
  weeklyItem: {
    gap: 6,
  },
  weeklyLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  weekLabel: {
    color: 'white',
    fontSize: 12,
    fontWeight: '800',
  },
  weekPct: {
    color: '#00F5D4',
    fontSize: 12,
    fontWeight: '800',
  },
  progressTrack: {
    height: 8,
    backgroundColor: '#1A1726',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  ruleBreakdownList: {
    gap: 12,
  },
  ruleBreakdownItem: {
    gap: 6,
  },
  ruleLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  ruleTitleText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700',
  },
  rulePctText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '600',
  },
});
