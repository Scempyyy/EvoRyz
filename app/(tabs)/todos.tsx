import { useState } from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Header, Card, Progress, Privacy, CreateModal } from '@/src/components/ui';
import { useApp } from '@/src/store/AppContext';
import { colors } from '@/src/theme';
import { feedback } from '@/src/services/feedback';

export default function Todos() {
  const { goals, addGoal, toggleMilestone, deleteGoal, workspace } = useApp();
  const [open, setOpen] = useState(false);

  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={s.content}>
        <Header
          title="To Do's"
          sub="Long-term vision & milestones"
          onProfile={() => router.push('/profile')}
        />

        {goals.map((g) => (
          <Card key={g.id} style={s.card}>
            <View style={s.top}>
              <View style={{ flex: 1 }}>
                <Text style={s.title}>{g.title}</Text>
                {g.description ? <Text style={s.desc}>{g.description}</Text> : null}
              </View>
              <Privacy value={g.visibility} />
              <Pressable
                onPress={() => {
                  feedback.tap(true);
                  deleteGoal(g.id);
                }}
                hitSlop={8}
                style={s.trash}
                accessibilityLabel="Delete goal"
              >
                <Ionicons name="trash-outline" size={16} color={colors.muted} />
              </Pressable>
            </View>

            <View style={s.progress}>
              <Text style={s.value}>{g.progress}%</Text>
              <Progress
                value={g.progress}
                color={g.visibility === 'shared' ? colors.blue : colors.violet}
              />
            </View>

            {g.milestones.length ? (
              g.milestones.map((m) => (
                <Pressable
                  key={m.id}
                  onPress={() => toggleMilestone(g.id, m.id)}
                  style={s.milestoneRow}
                >
                  <Ionicons
                    name={m.complete ? 'checkbox' : 'square-outline'}
                    size={18}
                    color={m.complete ? colors.green : colors.muted}
                  />
                  <Text style={[s.milestone, m.complete && s.done]}>{m.title}</Text>
                </Pressable>
              ))
            ) : (
              <Text style={s.empty}>Break down this goal into milestones.</Text>
            )}

            <Text style={s.deadline}>
              Deadline · {g.deadline} · {g.priority} priority
            </Text>
          </Card>
        ))}

        {!goals.length && (
          <Card>
            <Text style={s.empty}>
              No goals tracked yet. Use + below to add your first goal and milestones.
            </Text>
          </Card>
        )}
      </ScrollView>

      <Pressable
        style={s.fab}
        onPress={() => setOpen(true)}
        accessibilityLabel="Add Goal"
      >
        <Ionicons name="add" size={28} color="white" />
      </Pressable>

      <CreateModal
        visible={open}
        onClose={() => setOpen(false)}
        onAdd={addGoal}
        label="Goal"
        canShare={Boolean(workspace)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 18, paddingBottom: 95 },
  card: { marginBottom: 12 },
  top: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  title: { color: 'white', fontWeight: '800', fontSize: 18 },
  desc: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 4 },
  trash: { padding: 4 },
  progress: { gap: 8, marginVertical: 14 },
  value: { color: colors.violetLight, fontWeight: '900', fontSize: 24 },
  milestoneRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 4 },
  milestone: { color: '#dad5e3', fontSize: 14 },
  done: { color: colors.muted, textDecorationLine: 'line-through' },
  empty: { color: colors.muted, fontSize: 13, fontStyle: 'italic', marginVertical: 6 },
  deadline: { color: colors.muted, fontSize: 12, marginTop: 14 },
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
