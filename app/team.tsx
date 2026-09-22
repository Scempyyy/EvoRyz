import { useState } from 'react';
import { router } from 'expo-router';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '@/src/store/AppContext';
import { colors } from '@/src/theme';
import { feedback } from '@/src/services/feedback';

export default function Team() {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { createWorkspace, joinWorkspace } = useApp();

  const handleCreate = async () => {
    setLoading(true);
    setError('');
    const teamName = name.trim() || 'My Team';
    const res = await createWorkspace(teamName, 'team');
    setLoading(false);
    if (res.success) {
      router.replace('/(tabs)/daily');
    } else {
      setError(res.error || 'Failed to create team.');
    }
  };

  const handleJoin = async () => {
    if (!code.trim()) {
      setError('Enter a team invite code to join.');
      feedback.error(true);
      return;
    }
    setLoading(true);
    setError('');
    const res = await joinWorkspace(code.trim());
    setLoading(false);
    if (res.success) {
      router.replace('/(tabs)/daily');
    } else {
      setError(res.error || 'Failed to join team workspace.');
    }
  };

  return (
    <SafeAreaView style={s.root}>
      <View>
        <Text style={s.brand}>EvoRyz</Text>
        <Text style={s.title}>Set up your team</Text>
        <Text style={s.copy}>
          Teams are shared workspaces for collaborative accountability and daily momentum. Shared tasks and workspace messages synchronize across all connected members.
        </Text>

        <Text style={s.label}>CREATE A TEAM</Text>
        <TextInput
          value={name}
          onChangeText={(val) => {
            setName(val);
            setError('');
          }}
          placeholder="Team name"
          placeholderTextColor={colors.muted}
          style={s.input}
        />
        <Pressable style={s.button} disabled={loading} onPress={handleCreate}>
          <Text style={s.buttonText}>{loading ? 'Creating…' : 'Create team'}</Text>
        </Pressable>

        <Text style={s.or}>or join with a team code</Text>
        <TextInput
          value={code}
          onChangeText={(val) => {
            setCode(val);
            setError('');
          }}
          autoCapitalize="characters"
          placeholder="EVR-XXXX"
          placeholderTextColor={colors.muted}
          style={s.input}
        />
        <Pressable style={s.secondary} disabled={loading} onPress={handleJoin}>
          <Text style={s.secondaryText}>{loading ? 'Joining…' : 'Join team'}</Text>
        </Pressable>

        {error ? <Text style={s.error}>{error}</Text> : null}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, padding: 24 },
  brand: { color: colors.violetLight, fontWeight: '800', fontSize: 22, marginTop: 32 },
  title: { color: 'white', fontWeight: '800', fontSize: 34, marginTop: 20 },
  copy: { color: colors.muted, lineHeight: 23, fontSize: 15, marginTop: 10, marginBottom: 30 },
  label: { color: colors.muted, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 9 },
  input: {
    backgroundColor: colors.surface,
    color: 'white',
    borderRadius: 14,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  button: {
    backgroundColor: colors.violet,
    padding: 17,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: { color: 'white', fontWeight: '800', fontSize: 16 },
  or: { color: colors.muted, textAlign: 'center', marginVertical: 24 },
  secondary: {
    backgroundColor: colors.surface,
    padding: 17,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryText: { color: colors.violetLight, fontWeight: '800', fontSize: 16 },
  error: { color: colors.red, fontSize: 13, marginTop: 14, textAlign: 'center' },
});
