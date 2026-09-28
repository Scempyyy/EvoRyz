import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/src/theme';
import { useApp } from '@/src/store/AppContext';
import { evoryzDay } from '@/src/services/evoryzDay';
import {
  getWinterArcMonths,
  isWinterArcDateLocked,
} from '@/src/services/winterArc';
import { WinterArcHabit, WinterArcNotificationLevel } from '@/src/types';
import { feedback } from '@/src/services/feedback';
import { Avatar } from '@/src/components/Avatar';

interface WinterArcTrackerModalProps {
  visible: boolean;
  onClose: () => void;
}

const MONTHS = getWinterArcMonths();

export function WinterArcTrackerModal({ visible, onClose }: WinterArcTrackerModalProps) {
  const {
    winterArc,
    addWinterArcHabit,
    deleteWinterArcHabit,
    toggleWinterArcDay,
    setWinterArcNotificationLevel,
    workspace,
    user,
  } = useApp();

  const [selectedMonthIndex, setSelectedMonthIndex] = useState(0);
  const [newHabitTitle, setNewHabitTitle] = useState('');
  const [isAddingHabit, setIsAddingHabit] = useState(false);

  const currentMonth = MONTHS[selectedMonthIndex];
  const todayStr = evoryzDay();
  const habitsToRender: WinterArcHabit[] = Array.isArray(winterArc?.habits)
    ? winterArc.habits
    : [];

  const handleToggleCell = (habitId: string, dateStr: string) => {
    if (isWinterArcDateLocked(dateStr)) {
      feedback.sound('error', user.settings.preferences.sfx);
      feedback.haptic('warning');
      Alert.alert(
        'Date Locked',
        dateStr > todayStr
          ? `You cannot check off future dates. Lock in one day at a time.`
          : `Date is outside the Winter Arc 2026 window.`
      );
      return;
    }

    toggleWinterArcDay(habitId, dateStr);
  };

  const handleAddHabit = () => {
    if (!newHabitTitle.trim()) return;
    addWinterArcHabit(newHabitTitle.trim(), 'flame', '#00F5D4');
    setNewHabitTitle('');
    setIsAddingHabit(false);
  };

  const handleDeleteHabit = (habit: WinterArcHabit) => {
    Alert.alert('Delete Habit', `Remove "${habit.title}" from your Winter Arc?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteWinterArcHabit(habit.id),
      },
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <View style={styles.titleRow}>
                <Ionicons name="snow" size={20} color="#00F5D4" />
                <Text style={styles.title}>WINTER ARC 2026</Text>
              </View>
              <Text style={styles.subTitle}>92 Days of Relentless Focus · Oct 1 - Dec 31</Text>
            </View>
            <Pressable
              style={styles.closeButton}
              onPress={() => {
                feedback.tap(user.settings.preferences.haptics);
                onClose();
              }}
            >
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
          </View>

          {/* Month Selector Tabs */}
          <View style={styles.monthTabs}>
            {MONTHS.map((m, idx) => {
              const isSelected = idx === selectedMonthIndex;
              return (
                <Pressable
                  key={m.name}
                  style={[styles.monthTab, isSelected && styles.monthTabActive]}
                  onPress={() => {
                    feedback.tap(user.settings.preferences.haptics);
                    setSelectedMonthIndex(idx);
                  }}
                >
                  <Text style={[styles.monthTabText, isSelected && styles.monthTabTextActive]}>
                    {m.name.toUpperCase()} ({m.totalDays}d)
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Horizontal Habit Grid */}
          <View style={styles.gridContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.gridScroll}>
              <View>
                {/* Header Row: Habit Title Column + Day Numbers */}
                <View style={styles.gridHeaderRow}>
                  <View style={styles.habitColumnHeader}>
                    <Text style={styles.columnHeaderText}>HABIT ({habitsToRender.length})</Text>
                  </View>
                  {currentMonth.dates.map((dateStr, idx) => {
                    const dayNum = idx + 1;
                    const isToday = dateStr === todayStr;
                    return (
                      <View key={dateStr} style={[styles.dayHeaderCell, isToday && styles.todayHeaderCell]}>
                        <Text style={[styles.dayHeaderText, isToday && styles.todayHeaderText]}>
                          {dayNum}
                        </Text>
                      </View>
                    );
                  })}
                </View>

                {/* Habit Rows */}
                <ScrollView style={styles.habitRowsScroll} nestedScrollEnabled>
                  {habitsToRender.map((habit) => {
                    return (
                      <View key={habit.id} style={styles.habitRow}>
                        {/* Pinned habit title on the left */}
                        <View style={styles.habitCell}>
                          <View style={styles.habitInfo}>
                            <Ionicons name={habit.icon as any || 'flame'} size={14} color="#00F5D4" />
                            <Text style={styles.habitTitle} numberOfLines={1}>
                              {habit.title}
                            </Text>
                          </View>
                          <Pressable
                            style={styles.deleteHabitBtn}
                            onPress={() => handleDeleteHabit(habit)}
                          >
                            <Ionicons name="trash-outline" size={14} color={colors.muted} />
                          </Pressable>
                        </View>

                        {/* Day cells */}
                        {currentMonth.dates.map((dateStr) => {
                          const isLocked = isWinterArcDateLocked(dateStr);
                          const isCompleted = habit.completedDays.includes(dateStr);
                          const isToday = dateStr === todayStr;

                          return (
                            <Pressable
                              key={dateStr}
                              style={[
                                styles.dayCell,
                                isLocked && styles.dayCellLocked,
                                isCompleted && styles.dayCellCompleted,
                                isToday && !isCompleted && styles.dayCellToday,
                              ]}
                              onPress={() => handleToggleCell(habit.id, dateStr)}
                            >
                              {isCompleted ? (
                                <Ionicons name="checkmark" size={14} color="#0C0B12" />
                              ) : isLocked ? (
                                <Ionicons name="lock-closed" size={10} color="#374151" />
                              ) : (
                                <View style={styles.uncompletedDot} />
                              )}
                            </Pressable>
                          );
                        })}
                      </View>
                    );
                  })}

                  {/* Add Habit Row */}
                  {isAddingHabit ? (
                    <View style={styles.addHabitInputRow}>
                      <TextInput
                        style={styles.addHabitInput}
                        placeholder="Habit title (e.g. 5 AM Run, Deep Work)..."
                        placeholderTextColor={colors.muted}
                        value={newHabitTitle}
                        onChangeText={setNewHabitTitle}
                        autoFocus
                      />
                      <Pressable style={styles.saveHabitBtn} onPress={handleAddHabit}>
                        <Text style={styles.saveHabitBtnText}>Add</Text>
                      </Pressable>
                      <Pressable
                        style={styles.cancelHabitBtn}
                        onPress={() => setIsAddingHabit(false)}
                      >
                        <Text style={styles.cancelHabitBtnText}>Cancel</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable
                      style={styles.addHabitButton}
                      onPress={() => {
                        feedback.tap(user.settings.preferences.haptics);
                        setIsAddingHabit(true);
                      }}
                    >
                      <Ionicons name="add-circle-outline" size={16} color="#00F5D4" />
                      <Text style={styles.addHabitText}>+ Add Winter Arc Habit</Text>
                    </Pressable>
                  )}
                </ScrollView>
              </View>
            </ScrollView>
          </View>

          {/* Notifications Checkpoints */}
          <View style={styles.notificationSection}>
            <Text style={styles.sectionHeading}>NOTIFICATION CHECKPOINTS</Text>
            <View style={styles.notificationLevels}>
              {(['light', 'normal', 'lock_in'] as WinterArcNotificationLevel[]).map((lvl) => {
                const isSelected = winterArc?.notificationLevel === lvl;
                const label =
                  lvl === 'light' ? 'Light (8 AM)' : lvl === 'normal' ? 'Normal (8A, 8P)' : 'Lock-In (6 checkpoints)';
                return (
                  <Pressable
                    key={lvl}
                    style={[styles.notifLevelPill, isSelected && styles.notifLevelPillActive]}
                    onPress={() => {
                      feedback.tap(user.settings.preferences.haptics);
                      setWinterArcNotificationLevel(lvl);
                    }}
                  >
                    <Text
                      style={[styles.notifLevelText, isSelected && styles.notifLevelTextActive]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Teammates Section (only in shared Duo/Team workspaces) */}
          {workspace && Array.isArray(workspace.members) && (
            <View style={styles.teamSection}>
              <Text style={styles.sectionHeading}>TEAMMATES IN WINTER ARC</Text>
              {(() => {
                const teammatesInArc = workspace.members.filter(
                  (member) => member.id !== user.id && Boolean(member.acceptedWinterArc)
                );

                if (teammatesInArc.length === 0) {
                  return (
                    <Text style={styles.noTeammatesText}>
                      No teammates have joined Winter Arc yet.
                    </Text>
                  );
                }

                return (
                  <View style={styles.teamMembersRow}>
                    {teammatesInArc.map((member) => (
                      <View key={member.id} style={styles.memberChip}>
                        <Avatar uri={member.avatar} name={member.name} size={24} />
                        <Text style={styles.memberName} numberOfLines={1}>
                          {member.name}
                        </Text>
                      </View>
                    ))}
                  </View>
                );
              })()}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: '#000000B0',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingHorizontal: 16,
    paddingBottom: 36,
    maxHeight: '92%',
    borderWidth: 1,
    borderColor: '#00F5D430',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    color: '#F7F5FC',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  subTitle: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 4,
  },
  closeButton: {
    padding: 6,
    backgroundColor: '#1E293B',
    borderRadius: 20,
  },
  monthTabs: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  monthTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  monthTabActive: {
    backgroundColor: '#00F5D4',
  },
  monthTabText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  monthTabTextActive: {
    color: '#0C0B12',
    fontWeight: '800',
  },
  gridContainer: {
    backgroundColor: '#111827',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1F2937',
    marginBottom: 16,
    maxHeight: 280,
  },
  gridScroll: {
    flexGrow: 0,
  },
  gridHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
    paddingBottom: 8,
    marginBottom: 8,
  },
  habitColumnHeader: {
    width: 140,
  },
  columnHeaderText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  dayHeaderCell: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayHeaderCell: {
    backgroundColor: '#00F5D420',
    borderRadius: 6,
  },
  dayHeaderText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '600',
  },
  todayHeaderText: {
    color: '#00F5D4',
    fontWeight: '800',
  },
  habitRowsScroll: {
    maxHeight: 200,
  },
  habitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  habitCell: {
    width: 140,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 8,
  },
  habitInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  habitTitle: {
    color: '#F7F5FC',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  deleteHabitBtn: {
    padding: 4,
  },
  dayCell: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#374151',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 1,
    backgroundColor: '#1E293B40',
  },
  dayCellLocked: {
    borderColor: '#1F2937',
    backgroundColor: '#111827',
    opacity: 0.5,
  },
  dayCellCompleted: {
    backgroundColor: '#00F5D4',
    borderColor: '#00F5D4',
  },
  dayCellToday: {
    borderColor: '#00F5D480',
  },
  uncompletedDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#4B5563',
  },
  addHabitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingVertical: 6,
  },
  addHabitText: {
    color: '#00F5D4',
    fontSize: 12,
    fontWeight: '600',
  },
  addHabitInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  addHabitInput: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: '#F7F5FC',
    fontSize: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  saveHabitBtn: {
    backgroundColor: '#00F5D4',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  saveHabitBtnText: {
    color: '#0C0B12',
    fontWeight: '700',
    fontSize: 12,
  },
  cancelHabitBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  cancelHabitBtnText: {
    color: colors.muted,
    fontSize: 12,
  },
  notificationSection: {
    marginBottom: 16,
  },
  sectionHeading: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  notificationLevels: {
    flexDirection: 'row',
    gap: 8,
  },
  notifLevelPill: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#374151',
  },
  notifLevelPillActive: {
    borderColor: '#00F5D4',
    backgroundColor: '#00F5D420',
  },
  notifLevelText: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '600',
  },
  notifLevelTextActive: {
    color: '#00F5D4',
    fontWeight: '800',
  },
  teamSection: {
    marginTop: 4,
  },
  teamMembersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  memberChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  noTeammatesText: {
    color: colors.muted,
    fontSize: 12,
    fontStyle: 'italic',
    paddingVertical: 4,
  },
  memberName: {
    color: '#F7F5FC',
    fontSize: 12,
    fontWeight: '500',
  },
});
