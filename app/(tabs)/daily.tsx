import { useState } from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Header, Card, Progress, Privacy, CreateModal } from '@/src/components/ui';
import { useApp } from '@/src/store/AppContext';
import { colors } from '@/src/theme';
import { Visibility } from '@/src/types';
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
  } = useApp();

  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<Visibility>('private');

  const shown = tasks.filter((t) => t.visibility === scope);
  const complete = shown.filter((t) => t.completed).length;

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
              {tasks.filter((t) => t.completed).length} / {tasks.length} completed{'\n'}🔥{' '}
              {streak} day streak
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

        {/* Scope Picker: Private vs Shared */}
        <View style={s.scope}>
          {(['private', 'shared'] as const).map((v) => (
            <Pressable
              key={v}
              disabled={v === 'shared' && !workspace}
              onPress={() => setScope(v)}
              style={[
                s.scopeButton,
                scope === v && s.scopeActive,
                v === 'shared' && !workspace && s.disabled,
              ]}
            >
              <Ionicons
                name={v === 'private' ? 'lock-closed' : 'people'}
                size={14}
                color={scope === v ? 'white' : colors.muted}
              />
              <Text style={[s.scopeText, scope === v && s.scopeTextActive]}>
                {v === 'private' ? 'Private' : 'Shared'}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={s.section}>
          {scope === 'private' ? 'PRIVATE TASKS' : 'SHARED TASKS'} · {complete}/{shown.length}
        </Text>

        {shown.map((t) => (
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

            <Privacy value={t.visibility} />

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

        {!shown.length && (
          <Card>
            <Text style={s.empty}>
              {scope === 'shared'
                ? 'No shared tasks yet. Use + to create one for your workspace.'
                : 'No private tasks yet. Use + to add one.'}
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
                <Text style={s.sharedText}>{sharedDailyPercent}%</Text>
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
  scope: { flexDirection: 'row', gap: 8, marginTop: 18 },
  scopeButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 7,
    padding: 11,
    backgroundColor: colors.surface,
    borderRadius: 11,
  },
  scopeActive: { backgroundColor: colors.violet },
  disabled: { opacity: 0.42 },
  scopeText: { color: colors.muted, fontWeight: '800' },
  scopeTextActive: { color: 'white' },
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
  trashBtn: {
    padding: 6,
  },
  empty: { color: colors.muted },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sharedText: { color: 'white', fontWeight: '800', width: 35 },
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
});
