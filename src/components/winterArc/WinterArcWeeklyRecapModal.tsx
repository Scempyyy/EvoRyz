import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/src/theme';
import { WinterArcWeeklyRecap } from '@/src/types/winterArc';
import { Card } from '@/src/components/ui';

interface WinterArcWeeklyRecapModalProps {
  recap: WinterArcWeeklyRecap | null;
  onClose: () => void;
}

export function WinterArcWeeklyRecapModal({
  recap,
  onClose,
}: WinterArcWeeklyRecapModalProps) {
  if (!recap) return null;

  return (
    <Modal visible={Boolean(recap)} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.eyebrow}>7-DAY CHECKPOINT</Text>
              <Text style={styles.title}>Week {recap.weekNumber} Execution Recap</Text>
              <Text style={styles.sub}>
                {recap.startDate} → {recap.endDate}
              </Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={colors.muted} />
            </Pressable>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Score & Consistency Cards */}
            <View style={styles.metricsRow}>
              <Card style={styles.metricCard}>
                <Text style={styles.metricLabel}>WEEKLY SCORE</Text>
                <Text style={styles.metricNumber}>{recap.weeklyScore}%</Text>
                <Text style={styles.metricSub}>Average weighted execution</Text>
              </Card>

              <Card style={styles.metricCard}>
                <Text style={styles.metricLabel}>CONSISTENCY</Text>
                <Text style={styles.metricNumber}>{recap.consistencyPercent}%</Text>
                <Text style={styles.metricSub}>Passing days out of 7</Text>
              </Card>
            </View>

            {/* Comparison to Previous Week */}
            <Card style={styles.trendCard}>
              <View style={styles.trendRow}>
                <View style={styles.trendIconBox}>
                  <Ionicons
                    name={
                      recap.progressionTrend === 'improving'
                        ? 'trending-up'
                        : recap.progressionTrend === 'declining'
                        ? 'trending-down'
                        : 'remove-outline'
                    }
                    size={22}
                    color={
                      recap.progressionTrend === 'improving'
                        ? '#00F5D4'
                        : recap.progressionTrend === 'declining'
                        ? '#FF6D7A'
                        : colors.muted
                    }
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.trendTitle}>
                    Trend: {recap.progressionTrend.toUpperCase()}
                  </Text>
                  <Text style={styles.trendSub}>
                    {recap.comparisonToPreviousWeek === null
                      ? 'First baseline week recorded. Comparison will generate on Week 2.'
                      : `${recap.comparisonToPreviousWeek >= 0 ? '+' : ''}${recap.comparisonToPreviousWeek}% score variance vs previous week`}
                  </Text>
                </View>
              </View>
            </Card>

            {/* Habit Performance Highlights */}
            <Text style={styles.sectionTitle}>HABIT HIGHLIGHTS</Text>
            <View style={styles.highlightRow}>
              <View style={styles.highlightCard}>
                <View style={styles.highlightHeader}>
                  <Ionicons name="star" size={16} color="#00F5D4" />
                  <Text style={[styles.highlightType, { color: '#00F5D4' }]}>STRONGEST</Text>
                </View>
                <Text style={styles.highlightHabitTitle}>{recap.strongestRuleTitle}</Text>
                <Text style={styles.highlightHabitSub}>Highest execution consistency</Text>
              </View>

              <View style={styles.highlightCard}>
                <View style={styles.highlightHeader}>
                  <Ionicons name="alert-circle" size={16} color="#FF6D7A" />
                  <Text style={[styles.highlightType, { color: '#FF6D7A' }]}>FOCUS NEEDED</Text>
                </View>
                <Text style={styles.highlightHabitTitle}>{recap.weakestRuleTitle}</Text>
                <Text style={styles.highlightHabitSub}>Target for next 7 days</Text>
              </View>
            </View>

            {/* Summary Text */}
            <Card style={styles.summaryBox}>
              <Text style={styles.summaryLabel}>STRATEGIC SUMMARY</Text>
              <Text style={styles.summaryContent}>{recap.summaryText}</Text>
            </Card>

            <Pressable style={styles.doneBtn} onPress={onClose}>
              <Text style={styles.doneBtnText}>Lock In Next Week</Text>
            </Pressable>

            <View style={{ height: 30 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  content: {
    backgroundColor: '#0F0D17',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderColor: '#29233D',
    borderTopWidth: 1,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomColor: '#1E192E',
    borderBottomWidth: 1,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '800',
    color: '#00F5D4',
    letterSpacing: 1.5,
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    color: 'white',
    marginTop: 2,
  },
  sub: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  body: {
    padding: 20,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    padding: 16,
    backgroundColor: '#151221',
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.muted,
    letterSpacing: 1,
    marginBottom: 6,
  },
  metricNumber: {
    fontSize: 28,
    fontWeight: '900',
    color: 'white',
  },
  metricSub: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 4,
  },
  trendCard: {
    padding: 14,
    backgroundColor: '#151221',
    marginBottom: 20,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  trendIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#1F1A30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  trendTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: 'white',
  },
  trendSub: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.muted,
    letterSpacing: 1,
    marginBottom: 10,
  },
  highlightRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  highlightCard: {
    flex: 1,
    backgroundColor: '#151221',
    borderColor: '#262038',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  highlightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  highlightType: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  highlightHabitTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: 'white',
  },
  highlightHabitSub: {
    fontSize: 10,
    color: colors.muted,
    marginTop: 4,
  },
  summaryBox: {
    backgroundColor: '#181426',
    padding: 16,
    marginBottom: 20,
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#00F5D4',
    letterSpacing: 1,
    marginBottom: 6,
  },
  summaryContent: {
    fontSize: 13,
    color: '#D4CEE8',
    lineHeight: 19,
  },
  doneBtn: {
    backgroundColor: '#00F5D4',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  doneBtnText: {
    color: '#07060B',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
