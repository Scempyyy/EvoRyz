/* eslint-disable react-hooks/set-state-in-effect */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  useWindowDimensions,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/src/theme';
import {
  WinterArc,
  WinterArcRule,
  WinterArcDay,
  WinterArcRuleCompletion,
  WinterArcMilestone,
  WinterArcWeeklyRecap,
  WinterArcStreakProtection,
  WinterArcSetupConfig,
} from '@/src/types/winterArc';
import { winterArcRepo } from '@/src/services/winterArcRepository';
import {
  calculateDailyScore,
  evaluateStreaksAndProtection,
  calculateOverallProgress,
} from '@/src/services/winterArcScoring';
import {
  checkNewMilestones,
  generateWeeklyRecap,
  buildWinterArcAnalytics,
} from '@/src/services/winterArcAnalytics';
import { WinterArcNotificationService } from '@/src/services/winterArcNotificationService';
import { evoryzDay, previousEvoDay } from '@/src/services/evoryzDay';
import { feedback } from '@/src/services/feedback';
import { Card, Progress } from '@/src/components/ui';

// Subcomponents
import { WinterArcGraphs } from './WinterArcGraphs';
import { WinterArcStreakProtectionBadge } from './WinterArcStreakProtectionBadge';
import { WinterArcSetupModal } from './WinterArcSetupModal';
import { WinterArcLeaderboard } from './WinterArcLeaderboard';
import { WinterArcSpectateModal } from './WinterArcSpectateModal';
import { WinterArcMilestoneModal } from './WinterArcMilestoneModal';
import { WinterArcWeeklyRecapModal } from './WinterArcWeeklyRecapModal';
import { WinterArcAICoachModal } from './WinterArcAICoachModal';
import { WinterArcFinalRecapModal } from './WinterArcFinalRecapModal';

interface WinterArcDashboardProps {
  userId: string;
  onExit: () => void;
}

export function WinterArcDashboard({ userId, onExit }: WinterArcDashboardProps) {
  const insets = useSafeAreaInsets();
  const { width, height, fontScale } = useWindowDimensions();
  const isLandscape = width > height;
  const isCompactHeader = width < 420 || fontScale > 1.05;

  const todayStr = evoryzDay();
  const [selectedDate, setSelectedDate] = useState(todayStr);

  const [loading, setLoading] = useState(true);
  const [arc, setArc] = useState<WinterArc | null>(null);
  const [rules, setRules] = useState<WinterArcRule[]>([]);
  const [days, setDays] = useState<WinterArcDay[]>([]);
  const [completions, setCompletions] = useState<WinterArcRuleCompletion[]>([]);
  const [milestones, setMilestones] = useState<WinterArcMilestone[]>([]);
  const [protections, setProtections] = useState<WinterArcStreakProtection[]>([]);
  const [weeklyRecaps, setWeeklyRecaps] = useState<WinterArcWeeklyRecap[]>([]);

  // Modal states
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [spectateUserId, setSpectateUserId] = useState<string | null>(null);
  const [activeMilestone, setActiveMilestone] = useState<WinterArcMilestone | null>(null);
  const [activeRecap, setActiveRecap] = useState<WinterArcWeeklyRecap | null>(null);
  const [showAICoach, setShowAICoach] = useState(false);
  const [showFinalRecap, setShowFinalRecap] = useState(false);

  // Load Arc Data
  const loadArcData = useCallback(async () => {
    setLoading(true);
    try {
      const active = await winterArcRepo.getActiveWinterArc(userId);
      if (!active) {
        setArc(null);
        setRules([]);
        setShowSetupModal(true);
        return;
      }

      setArc(active.arc);
      setRules(active.rules);

      const [loadedDays, loadedComps, loadedMilestones, loadedProtections, loadedRecaps] = await Promise.all([
        winterArcRepo.getDaysHistory(active.arc.id),
        winterArcRepo.getAllCompletions(active.arc.id),
        winterArcRepo.getMilestones(active.arc.id),
        winterArcRepo.getStreakProtections(active.arc.id),
        winterArcRepo.getWeeklyRecaps(active.arc.id),
      ]);

      setDays(loadedDays);
      setCompletions(loadedComps);
      setMilestones(loadedMilestones);
      setProtections(loadedProtections);
      setWeeklyRecaps(loadedRecaps);
    } catch (err) {
      console.warn('[WinterArcDashboard] loadArcData error:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadArcData();
  }, [loadArcData]);

  // Date day number relative to Arc start
  const getDayNumberForDate = (dateStr: string) => {
    if (!arc) return 1;
    const startMs = new Date(`${arc.startDate}T00:00:00Z`).getTime();
    const currMs = new Date(`${dateStr}T00:00:00Z`).getTime();
    const diff = Math.floor((currMs - startMs) / 86400000);
    return Math.max(1, diff + 1);
  };

  // Dynamic total days calculation based on actual arc start and end dates
  const getTotalDaysInArc = () => {
    if (!arc) return 92;
    const startMs = new Date(`${arc.startDate}T00:00:00Z`).getTime();
    const endMs = new Date(`${arc.endDate}T00:00:00Z`).getTime();
    const diff = Math.floor((endMs - startMs) / 86400000);
    return Math.max(1, diff + 1);
  };

  // Toggle rule completion
  const handleToggleRule = async (rule: WinterArcRule) => {
    if (!arc) return;
    if (selectedDate > todayStr) {
      feedback.sound('error', true);
      Alert.alert('Future Date Locked', 'You cannot log rule completions for future dates.');
      return;
    }

    feedback.tap(true);

    const existingComp = completions.find(
      (c) => c.ruleId === rule.id && c.date === selectedDate
    );

    const isCurrentlyDone = existingComp?.completed || false;
    const nextCompleted = !isCurrentlyDone;
    const nextVal = nextCompleted ? rule.target : 0;

    // 1. Optimistic completions update
    let updatedCompletions: WinterArcRuleCompletion[];
    if (existingComp) {
      updatedCompletions = completions.map((c) =>
        c.ruleId === rule.id && c.date === selectedDate
          ? { ...c, completed: nextCompleted, value: nextVal }
          : c
      );
    } else {
      const newComp: WinterArcRuleCompletion = {
        id: `comp-${rule.id}-${selectedDate}`,
        winterArcId: arc.id,
        ruleId: rule.id,
        userId,
        date: selectedDate,
        value: nextVal,
        completed: nextCompleted,
      };
      updatedCompletions = [...completions, newComp];
    }
    setCompletions(updatedCompletions);

    // 2. Recalculate daily score
    const dayNumber = getDayNumberForDate(selectedDate);
    const dayScoreResult = calculateDailyScore(
      rules,
      updatedCompletions,
      selectedDate,
      dayNumber
    );

    // 3. Update days array
    let updatedDays: WinterArcDay[];
    const dayIndex = days.findIndex((d) => d.date === selectedDate);
    if (dayIndex >= 0) {
      updatedDays = days.map((d, i) =>
        i === dayIndex
          ? {
              ...d,
              score: dayScoreResult.score,
              completedRulesCount: dayScoreResult.completedRulesCount,
              totalRulesCount: dayScoreResult.totalRulesCount,
              weightedCompletion: dayScoreResult.weightedCompletion,
            }
          : d
      );
    } else {
      const newDay: WinterArcDay = {
        id: `day-${arc.id}-${selectedDate}`,
        winterArcId: arc.id,
        userId,
        date: selectedDate,
        dayNumber,
        score: dayScoreResult.score,
        completedRulesCount: dayScoreResult.completedRulesCount,
        totalRulesCount: dayScoreResult.totalRulesCount,
        weightedCompletion: dayScoreResult.weightedCompletion,
        streakProtectionUsed: false,
      };
      updatedDays = [...days, newDay].sort((a, b) => a.date.localeCompare(b.date));
    }
    setDays(updatedDays);

    // 4. Recalculate streak & protection
    const streakResult = evaluateStreaksAndProtection(
      updatedDays,
      todayStr,
      protections
    );

    // 5. Overall progress
    const totalDaysInArc = getTotalDaysInArc();
    const progressResult = calculateOverallProgress(updatedDays, totalDaysInArc);

    const updatedArc: WinterArc = {
      ...arc,
      currentStreak: streakResult.currentStreak,
      bestStreak: streakResult.bestStreak,
      streakProtectionAvailable: streakResult.streakProtectionAvailable,
      overallScore: progressResult.overallScore,
      overallCompletion: progressResult.overallCompletion,
    };
    setArc(updatedArc);

    if (nextCompleted) {
      feedback.sound('habitComplete', true);
      feedback.haptic('medium');
    }

    // 6. Check for newly unlocked milestones
    const newMilestones = checkNewMilestones(dayNumber, milestones, arc.id, userId, totalDaysInArc);
    if (newMilestones.length > 0) {
      setMilestones((prev) => [...prev, ...newMilestones]);
      setActiveMilestone(newMilestones[0]);
      void winterArcRepo.saveMilestones(newMilestones);
      void WinterArcNotificationService.notifyMilestoneAchieved(newMilestones[0]);
    }

    // 7. Check for weekly recap (every 7 days)
    if (dayNumber % 7 === 0 && dayScoreResult.isPassing) {
      const weekNum = Math.floor(dayNumber / 7);
      const daysInWeek = updatedDays.slice(Math.max(0, (weekNum - 1) * 7), weekNum * 7);
      const prevRecap = weeklyRecaps.find((r) => r.weekNumber === weekNum - 1) || null;

      const recap = generateWeeklyRecap(
        weekNum,
        daysInWeek,
        rules,
        updatedCompletions,
        prevRecap,
        arc.id,
        userId
      );
      if (recap && !weeklyRecaps.some((r) => r.weekNumber === weekNum)) {
        setWeeklyRecaps((prev) => [...prev, recap]);
        setActiveRecap(recap);
        void winterArcRepo.saveWeeklyRecap(recap);
        void WinterArcNotificationService.notifyWeeklyRecapAvailable(recap);
      }
    }

    // 8. Persist to database in background
    void winterArcRepo.recordRuleCompletion({
      winterArcId: arc.id,
      ruleId: rule.id,
      userId,
      date: selectedDate,
      value: nextVal,
      completed: nextCompleted,
    });

    void winterArcRepo.saveDailyScore({
      winterArcId: arc.id,
      userId,
      date: selectedDate,
      dayNumber,
      score: dayScoreResult.score,
      completedRulesCount: dayScoreResult.completedRulesCount,
      totalRulesCount: dayScoreResult.totalRulesCount,
      weightedCompletion: dayScoreResult.weightedCompletion,
      streakProtectionUsed: false,
    });

    void winterArcRepo.updateWinterArc(arc.id, {
      currentStreak: streakResult.currentStreak,
      bestStreak: streakResult.bestStreak,
      streakProtectionAvailable: streakResult.streakProtectionAvailable,
      overallScore: progressResult.overallScore,
      overallCompletion: progressResult.overallCompletion,
    });
  };

  // Setup save handler
  const handleSaveSetup = async (config: WinterArcSetupConfig) => {
    const created = await winterArcRepo.createWinterArc(userId, config);
    setArc(created.arc);
    setRules(created.rules);
    setShowSetupModal(false);
    feedback.success(true);
    void loadArcData();
  };

  // Analytics summary for graphs
  const analyticsSummary = useMemo(() => {
    return buildWinterArcAnalytics(days, rules, completions);
  }, [days, rules, completions]);

  // Selected date's daily score
  const selectedDayRecord = days.find((d) => d.date === selectedDate);
  const selectedDayScore = selectedDayRecord ? selectedDayRecord.score : 0;
  const currentDayNum = getDayNumberForDate(selectedDate);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00F5D4" />
        <Text style={styles.loadingText}>Initializing Winter Arc...</Text>
      </View>
    );
  }

  if (!arc) {
    return (
      <View style={styles.noArcContainer}>
        <Ionicons name="snow" size={56} color="#00F5D4" />
        <Text style={styles.noArcTitle}>WINTER ARC 2026</Text>
        <Text style={styles.noArcSub}>
          Individual solo challenge. 92 days to build iron discipline and shatter old limits.
        </Text>
        <Pressable
          style={styles.createBtn}
          onPress={() => setShowSetupModal(true)}
        >
          <Text style={styles.createBtnText}>Setup Your Winter Arc</Text>
          <Ionicons name="flame" size={18} color="#07060B" />
        </Pressable>
        <Pressable style={styles.exitBtn} onPress={onExit}>
          <Text style={styles.exitBtnText}>Return to EvoRyz</Text>
        </Pressable>

        <WinterArcSetupModal
          visible={showSetupModal}
          onClose={() => {
            setShowSetupModal(false);
            if (!arc) onExit();
          }}
          onSave={handleSaveSetup}
        />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* Top Header Bar */}
      <View
        style={[
          styles.topBar,
          { paddingTop: Math.max(insets.top, 14) + 6 },
        ]}
      >
        <View style={styles.topBarLeft}>
          <Pressable
            style={styles.backBtn}
            onPress={() => {
              feedback.tap(true);
              onExit();
            }}
            accessibilityLabel="Exit Winter Arc"
            accessibilityRole="button"
          >
            <Ionicons name="arrow-back" size={20} color="white" />
          </Pressable>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Ionicons name="snow" size={15} color="#00F5D4" />
              <Text style={styles.topBarTitle} numberOfLines={1} ellipsizeMode="tail">
                WINTER ARC
              </Text>
            </View>
            <Text style={styles.topBarSub} numberOfLines={1} ellipsizeMode="tail">
              Day {currentDayNum} of {getTotalDaysInArc()} · Resets 2 AM
            </Text>
          </View>
        </View>

        <View style={styles.topBarRight}>
          <WinterArcStreakProtectionBadge
            available={arc.streakProtectionAvailable}
            history={protections}
            compact={isCompactHeader}
          />

          <Pressable
            style={styles.actionIconBtn}
            onPress={() => {
              feedback.tap(true);
              setShowAICoach(true);
            }}
            accessibilityLabel="AI Coach"
            accessibilityRole="button"
          >
            <Ionicons name="sparkles" size={17} color="#00F5D4" />
          </Pressable>

          <Pressable
            style={[styles.actionIconBtn, styles.topBarLeaderboardBtn]}
            onPress={() => {
              feedback.tap(true);
              setShowLeaderboard(true);
            }}
            accessibilityLabel="Leaderboard"
            accessibilityRole="button"
          >
            <Ionicons name="trophy" size={17} color="#FFB703" />
          </Pressable>

          <Pressable
            style={styles.actionIconBtn}
            onPress={() => {
              feedback.tap(true);
              setShowSetupModal(true);
            }}
            accessibilityLabel="Winter Arc Settings"
            accessibilityRole="button"
          >
            <Ionicons name="settings-outline" size={18} color={colors.muted} />
          </Pressable>
        </View>
      </View>

      {/* Main Content Area */}
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          isLandscape && styles.scrollContentLandscape,
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Landscape Left Column / Portrait Top Section */}
        <View style={[styles.mainColumn, isLandscape && styles.landscapeLeft]}>
          {/* Hero Performance Card */}
          <Card style={styles.heroCard}>
            <View style={styles.heroRow}>
              <View>
                <Text style={styles.heroEyebrow}>DAY {currentDayNum} SCORE</Text>
                <Text style={styles.heroScore}>{Math.round(selectedDayScore)}%</Text>
              </View>

              <View style={styles.streakBadgeBox}>
                <View style={styles.streakRow}>
                  <Ionicons name="flame" size={24} color="#FF6D7A" />
                  <Text style={styles.streakNum}>{arc.currentStreak}d</Text>
                </View>
                <Text style={styles.streakSub}>Best: {arc.bestStreak} days</Text>
              </View>
            </View>

            <View style={styles.progressRow}>
              <Text style={styles.progressLabel}>OVERALL ARC COMPLETION</Text>
              <Text style={styles.progressValue}>{arc.overallCompletion}%</Text>
            </View>
            <Progress value={arc.overallCompletion} />
          </Card>

          {/* Date Selector Strip */}
          <View style={styles.dateStripContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateStrip}>
              {[-3, -2, -1, 0].map((offset) => {
                let targetDate = todayStr;
                for (let i = 0; i < Math.abs(offset); i++) {
                  targetDate = previousEvoDay(targetDate);
                }
                const isSelected = selectedDate === targetDate;
                const isToday = targetDate === todayStr;

                return (
                  <Pressable
                    key={targetDate}
                    style={[
                      styles.datePill,
                      isSelected && styles.datePillSelected,
                    ]}
                    onPress={() => {
                      feedback.tap(true);
                      setSelectedDate(targetDate);
                    }}
                  >
                    <Text
                      style={[
                        styles.datePillLabel,
                        isSelected && styles.datePillLabelSelected,
                      ]}
                    >
                      {isToday ? 'TODAY' : targetDate.slice(5)}
                    </Text>
                    <Text
                      style={[
                        styles.datePillDayNum,
                        isSelected && styles.datePillDayNumSelected,
                      ]}
                    >
                      D{getDayNumberForDate(targetDate)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* Global Leaderboard & Spectate Action Banner */}
          <Pressable
            style={styles.leaderboardBanner}
            onPress={() => {
              feedback.tap(true);
              setShowLeaderboard(true);
            }}
            accessibilityLabel="Open Winter Arc Leaderboard"
            accessibilityRole="button"
          >
            <View style={styles.leaderboardBannerLeft}>
              <View style={styles.leaderboardTrophyBox}>
                <Ionicons name="trophy" size={20} color="#FFB703" />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={styles.leaderboardBannerTitleRow}>
                  <Text style={styles.leaderboardBannerTitle} numberOfLines={1}>
                    LEADERBOARD
                  </Text>
                  <View style={styles.liveBadge}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveBadgeText}>LIVE</Text>
                  </View>
                </View>
                <Text style={styles.leaderboardBannerSub} numberOfLines={2}>
                  Global & friends rankings · Spectate protocols
                </Text>
              </View>
            </View>
            <View style={styles.leaderboardBannerArrow}>
              <Text style={styles.leaderboardBannerOpenText}>View</Text>
              <Ionicons name="chevron-forward" size={16} color="#FFB703" />
            </View>
          </Pressable>

          {/* Daily Rules Checklist */}
          <View style={styles.rulesSection}>
            <View style={styles.rulesSectionHeader}>
              <Text style={styles.rulesSectionTitle}>DAILY RULES CHECKLIST</Text>
              <Text style={styles.rulesSectionCount}>
                {rules.filter((r) => r.enabled).length} RULES
              </Text>
            </View>

            <View style={styles.rulesList}>
              {rules
                .filter((r) => r.enabled)
                .map((rule) => {
                  const comp = completions.find(
                    (c) => c.ruleId === rule.id && c.date === selectedDate
                  );
                  const isDone = comp?.completed || false;

                  return (
                    <Pressable
                      key={rule.id}
                      style={[styles.ruleCard, isDone && styles.ruleCardDone]}
                      onPress={() => handleToggleRule(rule)}
                    >
                      <View style={styles.ruleCheckbox}>
                        <Ionicons
                          name={isDone ? 'checkbox' : 'square-outline'}
                          size={24}
                          color={isDone ? '#00F5D4' : colors.muted}
                        />
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.ruleTitle,
                            isDone && styles.ruleTitleDone,
                          ]}
                        >
                          {rule.title}
                        </Text>
                        <Text style={styles.ruleDetails}>
                          Target: {rule.target} {rule.unit} · Importance: {rule.weight}x
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.ruleWeightBadge,
                          isDone && styles.ruleWeightBadgeDone,
                        ]}
                      >
                        <Text
                          style={[
                            styles.ruleWeightText,
                            isDone && styles.ruleWeightTextDone,
                          ]}
                        >
                          +{rule.weight * 10}pts
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
            </View>
          </View>
        </View>

        {/* Landscape Right Column / Portrait Bottom Section */}
        <View style={[styles.mainColumn, isLandscape && styles.landscapeRight]}>
          {/* Interactive Graphs */}
          <WinterArcGraphs analytics={analyticsSummary} />

          {/* Milestones Achieved Quick View */}
          <Card style={styles.milestonesCard}>
            <Pressable
              style={styles.milestonesHeader}
              onPress={() => {
                feedback.tap(true);
                setShowLeaderboard(true);
              }}
              accessibilityLabel="View Leaderboard from Milestones"
              accessibilityRole="button"
            >
              <Ionicons name="trophy" size={18} color="#FFB703" />
              <Text style={styles.milestonesTitle}>
                MILESTONES ({milestones.length}/6 UNLOCKED)
              </Text>
              <View style={{ flex: 1 }} />
              <Text style={styles.milestonesLeaderboardLink}>Leaderboard &gt;</Text>
            </Pressable>
            <View style={styles.milestonesRow}>
              {['day_7', 'day_14', 'day_30', 'day_50', 'day_75', 'completed'].map((key) => {
                const unlocked = milestones.some((m) => m.milestoneKey === key);
                const label = key === 'completed' ? 'CONQUERED' : key.replace('_', ' ').toUpperCase();
                return (
                  <View
                    key={key}
                    style={[
                      styles.milestoneMiniPill,
                      unlocked && styles.milestoneMiniPillUnlocked,
                    ]}
                  >
                    <Ionicons
                      name={unlocked ? 'checkmark-circle' : 'lock-closed'}
                      size={12}
                      color={unlocked ? '#00F5D4' : colors.muted}
                    />
                    <Text
                      style={[
                        styles.milestoneMiniText,
                        unlocked && styles.milestoneMiniTextUnlocked,
                      ]}
                    >
                      {label}
                    </Text>
                  </View>
                );
              })}
            </View>
          </Card>

          {/* Final Recap Button (if near/at completion) */}
          <Pressable
            style={styles.finalRecapTrigger}
            onPress={() => {
              feedback.tap(true);
              setShowFinalRecap(true);
            }}
          >
            <Ionicons name="shield-checkmark" size={18} color="#00F5D4" />
            <Text style={styles.finalRecapTriggerText}>View Full Arc Performance Card</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.muted} />
          </Pressable>
        </View>
      </ScrollView>

      {/* Modals */}
      <WinterArcSetupModal
        visible={showSetupModal}
        onClose={() => setShowSetupModal(false)}
        onSave={handleSaveSetup}
      />

      <Modal visible={showLeaderboard} animationType="slide" onRequestClose={() => setShowLeaderboard(false)}>
        <WinterArcLeaderboard
          currentUserId={userId}
          onSelectUserForSpectate={(targetId) => {
            setShowLeaderboard(false);
            setSpectateUserId(targetId);
          }}
          onClose={() => setShowLeaderboard(false)}
        />
      </Modal>

      <WinterArcSpectateModal
        targetUserId={spectateUserId}
        onClose={() => setSpectateUserId(null)}
      />

      <WinterArcMilestoneModal
        milestone={activeMilestone}
        onDismiss={() => setActiveMilestone(null)}
      />

      <WinterArcWeeklyRecapModal
        recap={activeRecap}
        onClose={() => setActiveRecap(null)}
      />

      <WinterArcAICoachModal
        visible={showAICoach}
        onClose={() => setShowAICoach(false)}
        arc={arc}
        rules={rules}
        recentDays={days}
        milestones={milestones}
      />

      <WinterArcFinalRecapModal
        visible={showFinalRecap}
        onClose={() => setShowFinalRecap(false)}
        arc={arc}
        rules={rules}
        milestones={milestones}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#07060B',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#07060B',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: colors.muted,
    fontSize: 13,
  },
  noArcContainer: {
    flex: 1,
    backgroundColor: '#07060B',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 16,
  },
  noArcTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: 'white',
    letterSpacing: 2,
  },
  noArcSub: {
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 360,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#00F5D4',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
    marginTop: 8,
  },
  createBtnText: {
    color: '#07060B',
    fontSize: 15,
    fontWeight: '900',
  },
  exitBtn: {
    padding: 10,
  },
  exitBtnText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderBottomColor: '#1A1629',
    borderBottomWidth: 1,
    backgroundColor: '#0D0B14',
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
    marginRight: 6,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#181426',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  topBarTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: 'white',
    letterSpacing: 0.8,
  },
  topBarSub: {
    fontSize: 11,
    color: colors.muted,
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  actionIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#181426',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  topBarLeaderboardBtn: {
    backgroundColor: '#261F12',
    borderColor: '#7A5812',
    borderWidth: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 80,
  },
  scrollContentLandscape: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'flex-start',
  },
  mainColumn: {
    width: '100%',
  },
  landscapeLeft: {
    flex: 1.1,
  },
  landscapeRight: {
    flex: 1,
  },
  heroCard: {
    backgroundColor: '#120F1F',
    borderColor: '#241D3B',
    borderWidth: 1,
    padding: 18,
    marginBottom: 16,
  },
  heroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 12,
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    color: '#00F5D4',
    letterSpacing: 1,
  },
  heroScore: {
    fontSize: 42,
    fontWeight: '900',
    color: 'white',
    marginTop: 2,
  },
  streakBadgeBox: {
    alignItems: 'flex-end',
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  streakNum: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FF6D7A',
  },
  streakSub: {
    fontSize: 11,
    color: colors.muted,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.muted,
    letterSpacing: 1,
  },
  progressValue: {
    fontSize: 12,
    fontWeight: '800',
    color: '#00F5D4',
  },
  dateStripContainer: {
    marginBottom: 16,
  },
  dateStrip: {
    flexDirection: 'row',
    gap: 8,
  },
  datePill: {
    backgroundColor: '#13101E',
    borderColor: '#241D38',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  datePillSelected: {
    backgroundColor: '#152928',
    borderColor: '#00F5D4',
  },
  datePillLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
  },
  datePillLabelSelected: {
    color: '#00F5D4',
  },
  datePillDayNum: {
    color: 'white',
    fontSize: 13,
    fontWeight: '900',
    marginTop: 2,
  },
  datePillDayNumSelected: {
    color: '#00F5D4',
  },
  rulesSection: {
    marginBottom: 16,
  },
  rulesSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    flexWrap: 'wrap',
    gap: 8,
  },
  rulesSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.muted,
    letterSpacing: 1,
  },
  rulesSectionCount: {
    fontSize: 11,
    fontWeight: '800',
    color: '#00F5D4',
  },
  rulesList: {
    gap: 8,
  },
  ruleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#120F1D',
    borderColor: '#211B33',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  ruleCardDone: {
    borderColor: '#00F5D4',
    backgroundColor: '#0F1E1E',
  },
  ruleCheckbox: {
    justifyContent: 'center',
  },
  ruleTitle: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
  },
  ruleTitleDone: {
    color: '#00F5D4',
  },
  ruleDetails: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 3,
  },
  ruleWeightBadge: {
    backgroundColor: '#1D172E',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  ruleWeightBadgeDone: {
    backgroundColor: '#1A3330',
  },
  ruleWeightText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  ruleWeightTextDone: {
    color: '#00F5D4',
  },
  milestonesCard: {
    backgroundColor: '#120F1F',
    borderColor: '#241D3B',
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  milestonesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  milestonesTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.muted,
    letterSpacing: 1,
  },
  milestonesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  milestoneMiniPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#181426',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  milestoneMiniPillUnlocked: {
    backgroundColor: '#152E2B',
  },
  milestoneMiniText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.muted,
  },
  milestoneMiniTextUnlocked: {
    color: '#00F5D4',
  },
  finalRecapTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#131020',
    borderColor: '#2E2647',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
  },
  finalRecapTriggerText: {
    flex: 1,
    color: 'white',
    fontSize: 13,
    fontWeight: '800',
  },
  leaderboardBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#14101A',
    borderColor: '#3D2F1B',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
    gap: 10,
  },
  leaderboardBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  leaderboardTrophyBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#261F12',
    borderColor: '#7A5812',
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  leaderboardBannerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  leaderboardBannerTitle: {
    color: '#FFB703',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1C3322',
    paddingVertical: 1,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#00F5D4',
  },
  liveBadgeText: {
    color: '#00F5D4',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  leaderboardBannerSub: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 2,
  },
  leaderboardBannerArrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
    backgroundColor: '#261F12',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  leaderboardBannerOpenText: {
    color: '#FFB703',
    fontSize: 12,
    fontWeight: '800',
  },
  milestonesLeaderboardLink: {
    color: '#FFB703',
    fontSize: 11,
    fontWeight: '700',
  },
});
