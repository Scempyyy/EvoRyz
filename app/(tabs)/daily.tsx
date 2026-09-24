import { useState } from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet, Modal } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Header, Card, Progress, CreateModal } from '@/src/components/ui';
import { useApp } from '@/src/store/AppContext';
import { colors } from '@/src/theme';
import { feedback } from '@/src/services/feedback';

export default function Daily() {
  const {
    tasks,
    toggleTask,
    addTask,
    deleteTask,
    activities,
    dailyPercent,
    sharedDailyPercent,
    streak,
    workspace,
    workspaceLabel,
    meals,
    summaries,
    habits,
    user,
  } = useApp();

  const [open, setOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showTrends, setShowTrends] = useState(false);

  const complete = tasks.filter((t) => t.completed).length;
  const totalCalories = meals.reduce((acc, m) => acc + m.calories, 0);

  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={s.content}>
        <Header
          title="Daily"
          sub="Your EvoRyz day · resets at 2 AM"
          onProfile={() => router.push('/profile')}
        />

        {/* Hero Today Card */}
        <Card style={s.hero}>
          <Text style={s.eyebrow}>TODAY</Text>
          <View style={s.heroRow}>
            <Text style={s.percent}>{dailyPercent}%</Text>
            <Text style={s.done}>
              {complete} / {tasks.length} completed{'\n'}🔥 {streak} day streak
            </Text>
          </View>
          <Progress value={dailyPercent} />
        </Card>

        {/* Nutrition / Meals Entry Card inside Daily */}
        <Pressable onPress={() => router.push('/(tabs)/meals')}>
          <Card style={s.mealsBanner}>
            <View style={s.mealsIcon}>
              <Ionicons name="nutrition" size={22} color={colors.violetLight} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.mealsTitle}>Daily Nutrition & Meals</Text>
              <Text style={s.mealsSub}>
                {meals.length === 0
                  ? 'No meals logged today · Tap to track'
                  : `${totalCalories} kcal · ${meals.length} meal${meals.length === 1 ? '' : 's'}`}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Card>
        </Pressable>

        {/* Daily Tasks Section Header with History & Trends shortcuts */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>
            DAILY TASKS ({complete}/{tasks.length})
          </Text>
          <View style={s.actionPills}>
            <Pressable
              style={s.actionPill}
              onPress={() => {
                feedback.tap(user.settings.preferences.haptics);
                setShowHistory(true);
              }}
            >
              <Ionicons name="calendar-outline" size={13} color={colors.violetLight} />
              <Text style={s.actionPillText}>History</Text>
            </Pressable>
            <Pressable
              style={s.actionPill}
              onPress={() => {
                feedback.tap(user.settings.preferences.haptics);
                setShowTrends(true);
              }}
            >
              <Ionicons name="stats-chart-outline" size={13} color={colors.violetLight} />
              <Text style={s.actionPillText}>Trends</Text>
            </Pressable>
          </View>
        </View>

        {/* All tasks rendered together with Private/Shared badges */}
        {tasks.map((t) => (
          <View key={t.id} style={s.row}>
            <Pressable
              style={s.rowCheck}
              onPress={() => toggleTask(t.id)}
              hitSlop={8}
            >
              <Ionicons
                name={t.completed ? 'checkmark-circle' : 'ellipse-outline'}
                size={25}
                color={t.completed ? colors.green : colors.muted}
              />
            </Pressable>

            <Pressable
              style={s.rowText}
              onPress={() => toggleTask(t.id)}
            >
              <Text style={[s.task, t.completed && s.strike]}>{t.title}</Text>
              {t.description && <Text style={s.desc}>{t.description}</Text>}
            </Pressable>

            {/* Pill Badge */}
            <View
              style={[
                s.badge,
                t.visibility === 'shared' ? s.sharedBadge : s.privateBadge,
              ]}
            >
              <Ionicons
                name={t.visibility === 'shared' ? 'people' : 'lock-closed'}
                size={11}
                color={t.visibility === 'shared' ? '#60A5FA' : '#C084FC'}
              />
              <Text
                style={[
                  s.badgeText,
                  t.visibility === 'shared' ? s.sharedBadgeText : s.privateBadgeText,
                ]}
              >
                {t.visibility === 'shared' ? 'Shared' : 'Private'}
              </Text>
            </View>

            <Pressable
              onPress={() => {
                feedback.tap(true);
                deleteTask(t.id);
              }}
              hitSlop={8}
              style={s.trashBtn}
              accessibilityLabel="Delete task"
            >
              <Ionicons name="trash-outline" size={16} color={colors.muted} />
            </Pressable>
          </View>
        ))}

        {!tasks.length && (
          <Card>
            <Text style={s.empty}>
              No daily tasks yet. Tap the + button below to create your first task.
            </Text>
          </Card>
        )}

        {/* Workspace Progress & Activity */}
        {workspace && (
          <>
            <Text style={s.section}>
              {workspace.mode === 'duo' ? 'DUO' : 'TEAM'} PROGRESS · {workspaceLabel}
            </Text>
            <Card>
              <View style={s.progressRow}>
                <Text style={s.sharedProgressText}>{sharedDailyPercent}%</Text>
                <Progress value={sharedDailyPercent} color={colors.blue} />
              </View>
              <Text style={s.desc}>
                {workspace.members.length} member{workspace.members.length === 1 ? '' : 's'} ·
                shared completion updates across connected workspace.
              </Text>
            </Card>

            {activities.filter((a) => a.visibility === 'shared').length > 0 && (
              <>
                <Text style={s.section}>SHARED ACTIVITY</Text>
                {activities
                  .filter((a) => a.visibility === 'shared')
                  .slice(0, 3)
                  .map((a) => (
                    <Text style={s.activity} key={a.id}>
                      🔥 Member {a.type === 'completed' ? 'completed ' : 'updated '}
                      {a.title}
                    </Text>
                  ))}
              </>
            )}
          </>
        )}
      </ScrollView>

      {/* Floating Action Button */}
      <Pressable
        style={s.fab}
        onPress={() => setOpen(true)}
        accessibilityLabel="Add Daily Task"
      >
        <Ionicons name="add" color="white" size={28} />
      </Pressable>

      <CreateModal
        visible={open}
        onClose={() => setOpen(false)}
        onAdd={addTask}
        label="Daily Task"
        canShare={Boolean(workspace)}
      />

      {/* Daily History Modal */}
      <Modal visible={showHistory} transparent animationType="fade" onRequestClose={() => setShowHistory(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Daily History & Recaps</Text>
              <Pressable hitSlop={10} onPress={() => setShowHistory(false)}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </Pressable>
            </View>
            <Text style={s.modalSub}>
              Past EvoRyz cycles (resetting at 2:00 AM daily)
            </Text>

            <ScrollView style={{ maxHeight: 320, marginTop: 12 }}>
              {summaries.length === 0 ? (
                <Text style={{ color: colors.muted, textAlign: 'center', paddingVertical: 24 }}>
                  No past completed days yet. Check back after your next 2:00 AM cycle rollover!
                </Text>
              ) : (
                summaries.map((sm) => (
                  <View key={sm.date} style={s.historyRow}>
                    <View>
                      <Text style={s.historyDate}>{sm.date}</Text>
                      <Text style={s.historySub}>
                        {sm.shared !== undefined ? `You: ${sm.you}% · Team: ${sm.shared}%` : `${sm.you}% completed`}
                      </Text>
                    </View>
                    <View style={s.historyPctBadge}>
                      <Text style={s.historyPctText}>{sm.you}%</Text>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>

            <Pressable style={s.modalClose} onPress={() => setShowHistory(false)}>
              <Text style={s.modalCloseText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Progress & Trends Dashboard Modal */}
      <Modal visible={showTrends} transparent animationType="fade" onRequestClose={() => setShowTrends(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Progress & Momentum</Text>
              <Pressable hitSlop={10} onPress={() => setShowTrends(false)}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </Pressable>
            </View>
            <Text style={s.modalSub}>Completion insights and consistency trends</Text>

            <View style={s.trendStatsRow}>
              <View style={s.trendStatBox}>
                <Text style={s.trendStatNum}>🔥 {streak}</Text>
                <Text style={s.trendStatLabel}>Day Streak</Text>
              </View>
              <View style={s.trendStatBox}>
                <Text style={s.trendStatNum}>{dailyPercent}%</Text>
                <Text style={s.trendStatLabel}>Today Done</Text>
              </View>
              <View style={s.trendStatBox}>
                <Text style={s.trendStatNum}>{habits.length}</Text>
                <Text style={s.trendStatLabel}>Habits Tracked</Text>
              </View>
            </View>

            <Text style={[s.eyebrow, { marginTop: 16, marginBottom: 8 }]}>WEEKLY COMPLETION HISTORY</Text>
            <View style={{ gap: 6 }}>
              {summaries.slice(-5).map((sm) => (
                <View key={sm.date} style={{ gap: 3 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: colors.muted, fontSize: 11 }}>{sm.date}</Text>
                    <Text style={{ color: 'white', fontWeight: '700', fontSize: 11 }}>{sm.you}%</Text>
                  </View>
                  <Progress value={sm.you} />
                </View>
              ))}
              {summaries.length === 0 && (
                <Text style={{ color: colors.muted, fontSize: 12, paddingVertical: 10 }}>
                  Active streak is starting today. Trends will graph here across future days.
                </Text>
              )}
            </View>

            <Pressable style={[s.modalClose, { marginTop: 20 }]} onPress={() => setShowTrends(false)}>
              <Text style={s.modalCloseText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 18, paddingBottom: 100 },
  hero: { padding: 20 },
  eyebrow: { fontSize: 11, color: colors.violetLight, fontWeight: '800', letterSpacing: 1 },
  heroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 12,
  },
  percent: { color: 'white', fontWeight: '900', fontSize: 42 },
  done: { color: colors.muted, lineHeight: 20 },
  mealsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
    backgroundColor: '#1E1933',
    borderColor: '#372E5C',
    borderWidth: 1,
  },
  mealsIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#2D234D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mealsTitle: { color: 'white', fontSize: 15, fontWeight: '800' },
  mealsSub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 22,
    marginBottom: 10,
  },
  sectionTitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  actionPills: {
    flexDirection: 'row',
    gap: 6,
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#231B34',
    borderColor: '#3B2966',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  actionPillText: {
    color: colors.violetLight,
    fontSize: 11,
    fontWeight: '700',
  },
  section: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 20,
    marginBottom: 10,
  },
  row: {
    backgroundColor: colors.surface,
    borderRadius: 15,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  rowCheck: {
    justifyContent: 'center',
  },
  rowText: { flex: 1 },
  task: { color: 'white', fontWeight: '700', fontSize: 15 },
  strike: { color: colors.muted, textDecorationLine: 'line-through' },
  desc: { color: colors.muted, fontSize: 12, marginTop: 6, lineHeight: 17 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  privateBadge: {
    backgroundColor: '#2B1A3D',
  },
  sharedBadge: {
    backgroundColor: '#1E2D4A',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  privateBadgeText: {
    color: '#C084FC',
  },
  sharedBadgeText: {
    color: '#60A5FA',
  },
  trashBtn: {
    padding: 6,
  },
  empty: { color: colors.muted },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sharedProgressText: { color: 'white', fontWeight: '800', width: 35 },
  activity: {
    color: '#d9d4e4',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 13,
    marginBottom: 7,
  },
  fab: {
    position: 'absolute',
    right: 21,
    bottom: 21,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.violet,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.violet,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#171329',
    borderColor: '#2F264C',
    borderWidth: 1,
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 380,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '800',
  },
  modalSub: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 4,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  historyDate: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
  },
  historySub: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 2,
  },
  historyPctBadge: {
    backgroundColor: colors.violet,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  historyPctText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '800',
  },
  modalClose: {
    backgroundColor: colors.surface,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 14,
  },
  modalCloseText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 14,
  },
  trendStatsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  trendStatBox: {
    flex: 1,
    backgroundColor: colors.surface,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  trendStatNum: {
    color: 'white',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  trendStatLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
});
