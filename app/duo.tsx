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
  const { configureMode, workspace } = useApp();

  const generatedCode = workspace?.inviteCode || 'EVR-DUO1';

  const connect = () => {
    if (!code.trim()) {
      setError('Enter an invite code, or create your duo below.');
      feedback.error(true);
      return;
    }
    feedback.success(true);
    configureMode('duo', 'Duo Workspace');
    router.replace('/(tabs)/daily');
  };

  const create = () => {
    feedback.success(true);
    configureMode('duo', 'My Duo');
    router.replace('/(tabs)/daily');
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
          <Text style={s.label}>YOUR INVITE CODE</Text>
          <Text style={s.code}>{generatedCode}</Text>
          <Text style={s.hint}>Share it with the one person joining you</Text>
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
        <Pressable style={s.secondary} onPress={create}>
          <Text style={s.secondaryText}>Create duo</Text>
        </Pressable>
        <Pressable style={s.button} onPress={connect}>
          <Text style={s.buttonText}>Join duo</Text>
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
  code: { color: 'white', fontWeight: '900', fontSize: 30, letterSpacing: 3, marginVertical: 10 },
  hint: { color: colors.muted, fontSize: 13 },
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
