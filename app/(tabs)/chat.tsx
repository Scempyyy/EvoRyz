import { router } from 'expo-router';
import { ScrollView, View, Text, Pressable, StyleSheet } from 'react-native';
import { Header, Card } from '@/src/components/ui';
import { useApp } from '@/src/store/AppContext';
import { colors } from '@/src/theme';
import { Ionicons } from '@expo/vector-icons';

export default function Chat() {
  const { messages, journal, workspace, mode } = useApp();
  const lastMsg = messages.at(-1)?.content ?? 'Start a conversation';
  const isSolo = mode === 'solo' || !workspace;

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      <Header
        title="Chats"
        sub={workspace ? `${workspace.name} · Shared & Private` : 'Your private & mentor spaces'}
        onProfile={() => router.push('/profile')}
      />

      {/* 1. Private Personal Journal */}
      <Pressable onPress={() => router.push('/conversation/journal')}>
        <Card style={s.chat}>
          <View style={[s.icon, { backgroundColor: '#291F38' }]}>
            <Ionicons name="lock-closed" size={22} color={colors.violetLight} />
          </View>
          <View style={s.info}>
            <View style={s.rowTop}>
              <Text style={s.name}>My Journal</Text>
              <View style={s.privateBadge}>
                <Text style={s.privateBadgeText}>Zero-knowledge</Text>
              </View>
            </View>
            <Text style={s.preview}>
              AES-256 encrypted · PIN protected · {journal.length} entries
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Card>
      </Pressable>

      {/* 2. EvoRyz AI Mentor (Always available in Solo or as an assistant) */}
      <Pressable onPress={() => router.push('/conversation/ai' as never)}>
        <Card style={s.chat}>
          <View style={[s.icon, { backgroundColor: '#1E293B' }]}>
            <Ionicons name="sparkles" size={22} color="#38BDF8" />
          </View>
          <View style={s.info}>
            <View style={s.rowTop}>
              <Text style={s.name}>EvoRyz AI Mentor</Text>
              <View style={[s.privateBadge, { backgroundColor: '#0C2D48' }]}>
                <Text style={[s.privateBadgeText, { color: '#38BDF8' }]}>AI Assistant</Text>
              </View>
            </View>
            <Text style={s.preview} numberOfLines={1}>
              Habits, focus & reflection guidance
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Card>
      </Pressable>

      {/* 3. Workspace Chat (Duo / Team) */}
      {workspace ? (
        <Pressable onPress={() => router.push('/conversation/workspace')}>
          <Card style={s.chat}>
            <View style={[s.icon, { backgroundColor: colors.blue }]}>
              <Text style={{ color: 'white', fontWeight: '900', fontSize: 18 }}>
                {workspace.mode === 'duo' ? 'D' : 'T'}
              </Text>
            </View>
            <View style={s.info}>
              <View style={s.rowTop}>
                <Text style={s.name}>{workspace.name}</Text>
                <Text style={s.time}>Realtime</Text>
              </View>
              <Text style={s.preview} numberOfLines={1}>
                {workspace.members.length} members · {lastMsg}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Card>
        </Pressable>
      ) : isSolo ? (
        <Card style={s.soloCard}>
          <View style={s.soloHeader}>
            <Ionicons name="person" size={20} color={colors.violetLight} />
            <Text style={s.soloTitle}>Solo Mode Active</Text>
          </View>
          <Text style={s.soloBody}>
            You are operating in Solo mode. No fake members are fabricated. Connect with a partner in Duo mode or form a Team at any time from Settings.
          </Text>
        </Card>
      ) : null}

      <Text style={s.note}>
        Journal is cryptographically encrypted with your PIN. Workspace messages sync across members using Supabase.
      </Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 18, paddingBottom: 95 },
  chat: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  icon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  name: { color: 'white', fontSize: 16, fontWeight: '800' },
  preview: { color: colors.muted, fontSize: 13 },
  time: { color: colors.muted, fontSize: 11 },
  privateBadge: {
    backgroundColor: '#261F38',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  privateBadgeText: { color: colors.violetLight, fontSize: 10, fontWeight: '800' },
  soloCard: {
    padding: 16,
    marginBottom: 12,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
  },
  soloHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  soloTitle: { color: 'white', fontSize: 15, fontWeight: '800' },
  soloBody: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  note: { color: colors.muted, textAlign: 'center', fontSize: 11, lineHeight: 16, marginHorizontal: 20, marginTop: 24 },
});
