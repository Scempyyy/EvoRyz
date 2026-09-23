import { useState } from 'react';
import { router } from 'expo-router';
import { View, Text, TextInput, Pressable, StyleSheet, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '@/src/store/AppContext';
import { colors } from '@/src/theme';
import { feedback } from '@/src/services/feedback';

export default function Duo() {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { createWorkspace, joinWorkspace, leaveWorkspace, workspace } = useApp();

  const isCurrentDuo = workspace?.mode === 'duo';

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
      router.replace('/(tabs)/chat');
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
      router.replace('/(tabs)/chat');
    } else {
      setError(res.error || 'Failed to create duo workspace.');
    }
  };

  const shareCode = async () => {
    if (workspace?.inviteCode) {
      feedback.tap(true);
      await Share.share({
        message: `Join my EvoRyz Duo workspace with invite code: ${workspace.inviteCode}`,
      });
    }
  };

  return (
    <SafeAreaView style={s.root}>
      <View>
        <View style={s.topNav}>
          <Pressable hitSlop={10} onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="chevron-back" size={24} color="white" />
            <Text style={s.backText}>Back</Text>
          </Pressable>
          <Text style={s.brand}>EvoRyz Duo</Text>
        </View>

        {isCurrentDuo ? (
          <View>
            <Text style={s.title}>{workspace.name}</Text>
            <Text style={s.copy}>
              Your Duo workspace is active. Members share tasks and private realtime workspace chat.
            </Text>

            <View style={s.card}>
              <Text style={s.label}>YOUR DUO INVITE CODE</Text>
              <Text style={s.code}>{workspace.inviteCode}</Text>
              <Pressable style={s.shareBtn} onPress={shareCode}>
                <Ionicons name="share-outline" size={18} color="white" />
                <Text style={s.shareBtnText}>Share Invite Code with Partner</Text>
              </Pressable>
              <Text style={s.hint}>
                {workspace.members.length >= 2
                  ? 'Both duo spots are filled.'
                  : 'Send this code to your partner to join your Duo.'}
              </Text>
            </View>

            <View style={{ marginTop: 24 }}>
              <Text style={s.label}>MEMBERS ({workspace.members.length}/2)</Text>
              {workspace.members.map((m) => (
                <View key={m.id} style={s.memberRow}>
                  <View style={s.avatarBadge}>
                    <Text style={s.avatarText}>{m.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <Text style={s.memberName}>{m.name}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <View>
            <Text style={s.title}>Set up your duo</Text>
            <Text style={s.copy}>
              A duo workspace has exactly two members. Invite a partner now or share your code later.
            </Text>

            <View style={s.card}>
              <Text style={s.label}>CREATE NEW DUO</Text>
              <Text style={s.hint}>
                Generate a unique invite code and invite your accountability partner.
              </Text>
              <Pressable style={[s.button, { marginTop: 14, width: '100%' }]} disabled={loading} onPress={create}>
                <Text style={s.buttonText}>{loading ? 'Creating…' : 'Create Duo Workspace'}</Text>
              </Pressable>
            </View>

            <Text style={s.or}>{"or enter friend's invite code"}</Text>
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
            <Pressable style={[s.secondary, { marginTop: 12 }]} disabled={loading || !code.trim()} onPress={connect}>
              <Text style={s.secondaryText}>{loading ? 'Joining…' : 'Join Duo'}</Text>
            </Pressable>
          </View>
        )}
      </View>

      {isCurrentDuo && (
        <Pressable
          style={s.leaveBtn}
          onPress={async () => {
            await leaveWorkspace();
            router.replace('/(tabs)/daily');
          }}
        >
          <Text style={s.leaveBtnText}>Leave Duo Workspace</Text>
        </Pressable>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, padding: 24, justifyContent: 'space-between' },
  topNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: { color: 'white', fontWeight: '700', fontSize: 16 },
  brand: { color: colors.violetLight, fontWeight: '800', fontSize: 18 },
  title: { color: 'white', fontWeight: '800', fontSize: 30, marginTop: 12 },
  copy: { color: colors.muted, lineHeight: 22, fontSize: 14, marginTop: 8 },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    marginTop: 24,
  },
  label: { color: colors.muted, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 8 },
  code: { color: 'white', fontWeight: '900', fontSize: 28, letterSpacing: 2, marginVertical: 8 },
  hint: { color: colors.muted, fontSize: 13, textAlign: 'center', marginTop: 4 },
  or: { color: colors.muted, textAlign: 'center', marginVertical: 18 },
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
  button: {
    backgroundColor: colors.violet,
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  secondary: {
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonText: { color: 'white', fontWeight: '800', fontSize: 16 },
  secondaryText: { color: colors.violetLight, fontWeight: '800', fontSize: 16 },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.violet,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 8,
  },
  shareBtnText: { color: 'white', fontWeight: '700', fontSize: 14 },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  avatarBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: 'white', fontWeight: '800', fontSize: 15 },
  memberName: { color: 'white', fontWeight: '700', fontSize: 15 },
  leaveBtn: {
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.red,
  },
  leaveBtnText: { color: colors.red, fontWeight: '700', fontSize: 15 },
});
