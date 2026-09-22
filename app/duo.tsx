import { useState } from 'react';
import { router } from 'expo-router';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '@/src/store/AppContext';
import { colors } from '@/src/theme';
import { feedback } from '@/src/services/feedback';

export default function Duo() {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { createWorkspace, joinWorkspace, workspace } = useApp();

  const connect = async () => {
    if (!code.trim()) {
      setError('Enter an invite code, or create your duo below.');
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
      setError(res.error || 'Failed to join duo workspace.');
    }
  };

  const create = async () => {
    setLoading(true);
    setError('');
    const res = await createWorkspace('My Duo', 'duo');
    setLoading(false);
    if (res.success) {
      router.replace('/(tabs)/daily');
    } else {
      setError(res.error || 'Failed to create duo workspace.');
    }
  };

  return (
    <SafeAreaView style={s.root}>
      <View>
        <Text style={s.brand}>EvoRyz</Text>
        <Text style={s.title}>Set up your duo</Text>
        <Text style={s.copy}>
          A duo workspace has exactly two members. Invite a partner now or share your code later.
        </Text>

        <View style={s.card}>
          <Text style={s.label}>INVITE CODE</Text>
          <Text style={s.code}>{workspace?.inviteCode || 'Tap Create Below'}</Text>
          <Text style={s.hint}>
            {workspace?.inviteCode
              ? 'Share this code with your partner to join you'
              : 'Create your duo to generate a unique invite code'}
          </Text>
        </View>

        <Text style={s.or}>or join with their code</Text>
        <TextInput
          value={code}
          onChangeText={(value) => {
            setCode(value);
            setError('');
          }}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder="EVR-XXXX"
          placeholderTextColor={colors.muted}
          style={s.input}
        />
        {error ? <Text style={s.error}>{error}</Text> : null}
      </View>

      <View style={s.buttons}>
        <Pressable style={s.secondary} disabled={loading} onPress={create}>
          <Text style={s.secondaryText}>{loading ? 'Creating…' : 'Create duo'}</Text>
        </Pressable>
        <Pressable style={s.button} disabled={loading} onPress={connect}>
          <Text style={s.buttonText}>{loading ? 'Joining…' : 'Join duo'}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, padding: 24, justifyContent: 'space-between' },
  brand: { color: colors.violetLight, fontWeight: '800', fontSize: 22, marginTop: 32 },
  title: { color: 'white', fontWeight: '800', fontSize: 34, marginTop: 20 },
  copy: { color: colors.muted, lineHeight: 23, fontSize: 15, marginTop: 10 },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 20,
    padding: 22,
    alignItems: 'center',
    marginTop: 32,
  },
  label: { color: colors.muted, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  code: { color: 'white', fontWeight: '900', fontSize: 28, letterSpacing: 2, marginVertical: 10 },
  hint: { color: colors.muted, fontSize: 13, textAlign: 'center' },
  or: { color: colors.muted, textAlign: 'center', marginVertical: 22 },
  input: {
    backgroundColor: colors.surface,
    color: 'white',
    borderRadius: 14,
    padding: 16,
    textAlign: 'center',
    fontWeight: '800',
    letterSpacing: 2,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  error: { color: colors.red, fontSize: 12, marginTop: 8, textAlign: 'center' },
  buttons: { flexDirection: 'row', gap: 10 },
  button: {
    backgroundColor: colors.violet,
    padding: 17,
    borderRadius: 14,
    alignItems: 'center',
    flex: 1,
  },
  secondary: {
    backgroundColor: colors.surface,
    padding: 17,
    borderRadius: 14,
    alignItems: 'center',
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonText: { color: 'white', fontWeight: '800', fontSize: 16 },
  secondaryText: { color: colors.violetLight, fontWeight: '800', fontSize: 16 },
});
