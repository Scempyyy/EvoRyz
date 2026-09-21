import { useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  Pressable,
  StyleSheet,
  Modal,
  TextInput,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Header, Card, Progress, Privacy } from '@/src/components/ui';
import { useApp } from '@/src/store/AppContext';
import { colors } from '@/src/theme';
import { Habit, Visibility } from '@/src/types';
import { feedback } from '@/src/services/feedback';

export default function Habits() {
  const { habits, toggleHabit, addHabit, deleteHabit, workspace } = useApp();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<Habit['type']>('build');
  const [visibility, setVisibility] = useState<Visibility>('private');

  const create = () => {
    if (name.trim()) {
      feedback.tap(true);
      addHabit(name.trim(), type, visibility);
      setName('');
      setOpen(false);
    }
  };

  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <Header
          title="Habits"
          sub="Small actions, compounding daily"
          onProfile={() => router.push('/profile')}
        />

        {(['build', 'avoid'] as const).map((kind) => {
          const kindHabits = habits.filter((h) => h.type === kind);
          return (
            <View key={kind}>
              <Text style={s.section}>{kind === 'build' ? 'BUILD' : 'AVOID'}</Text>
              {kindHabits.map((h) => (
                <Card key={h.id} style={s.card}>
                  <View style={s.top}>
                    <View style={s.nameWrap}>
                      <Text style={s.name} numberOfLines={2}>
                        {h.name}
                      </Text>
                      <Text style={s.streak}>
                        🔥 {h.currentStreak} DAYS{' '}
                        <Text style={s.best}> · best {h.bestStreak}</Text>
                      </Text>
                    </View>
                    <Privacy value={h.visibility} />
                    <Pressable
                      onPress={() => {
                        feedback.tap(true);
                        deleteHabit(h.id);
                      }}
                      hitSlop={8}
                      style={s.trash}
                      accessibilityLabel="Delete habit"
                    >
                      <Ionicons name="trash-outline" size={16} color={colors.muted} />
                    </Pressable>
                  </View>

                  <Pressable style={s.check} onPress={() => toggleHabit(h.id)}>
                    <Ionicons
                      name={h.completedToday ? 'checkmark-circle' : 'ellipse-outline'}
                      size={22}
                      color={h.completedToday ? colors.green : colors.muted}
                    />
                    <Text style={s.checkText}>
                      {h.completedToday
                        ? kind === 'avoid'
                          ? 'Avoided today'
                          : 'Completed today'
                        : kind === 'avoid'
                        ? 'Mark avoided'
                        : 'Mark complete'}
                    </Text>
                  </Pressable>
                  <Progress
                    value={Math.min(h.currentStreak * 7, 100)}
                    color={kind === 'avoid' ? colors.orange : colors.green}
                  />
                </Card>
              ))}

              {!kindHabits.length && (
                <Text style={s.emptyKind}>No {kind} habits yet.</Text>
              )}
            </View>
          );
        })}
      </ScrollView>

      <Pressable
        style={s.fab}
        onPress={() => setOpen(true)}
        accessibilityLabel="Create Habit"
      >
        <Ionicons name="add" size={28} color="white" />
      </Pressable>

      <Modal
        transparent
        visible={open}
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <View style={s.overlay}>
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>Create Habit</Text>
            <TextInput
              style={s.input}
              value={name}
              onChangeText={setName}
              placeholder="Habit name"
              placeholderTextColor={colors.muted}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={create}
            />
            <View style={s.options}>
              {(['build', 'avoid'] as const).map((x) => (
                <Pressable key={x} onPress={() => setType(x)}>
                  <Text style={[s.option, type === x && s.selected]}>
                    {x === 'build' ? 'Build' : 'Avoid'}
                  </Text>
                </Pressable>
              ))}
              {(['private', 'shared'] as const).map((x) => (
                <Pressable
                  key={x}
                  disabled={x === 'shared' && !workspace}
                  onPress={() => setVisibility(x)}
                >
                  <Text
                    style={[
                      s.option,
                      visibility === x && s.selected,
                      x === 'shared' && !workspace && { opacity: 0.3 },
                    ]}
                  >
                    {x}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Pressable style={s.create} onPress={create}>
              <Text style={s.createText}>Create Habit</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 18, paddingBottom: 95 },
  section: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 15,
    marginBottom: 10,
  },
  card: { marginBottom: 12 },
  top: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' },
  nameWrap: { flex: 1 },
  name: { color: 'white', fontSize: 17, fontWeight: '800' },
  trash: { padding: 4 },
  streak: { color: colors.orange, fontWeight: '800', fontSize: 13, marginTop: 7 },
  best: { color: colors.muted, fontWeight: '500' },
  check: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 14 },
  checkText: { color: '#d8d3e2', fontSize: 13, fontWeight: '600' },
  emptyKind: { color: colors.muted, fontSize: 12, fontStyle: 'italic', marginBottom: 12 },
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
  overlay: { flex: 1, backgroundColor: '#000a', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    padding: 22,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  sheetTitle: { color: 'white', fontSize: 22, fontWeight: '800', marginBottom: 16 },
  input: { backgroundColor: colors.surface2, color: 'white', borderRadius: 13, padding: 15 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 16 },
  option: {
    color: colors.muted,
    backgroundColor: colors.surface2,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    textTransform: 'capitalize',
  },
  selected: { color: 'white', backgroundColor: colors.violet },
  create: {
    backgroundColor: colors.violet,
    borderRadius: 13,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  createText: { color: 'white', fontWeight: '800' },
});
