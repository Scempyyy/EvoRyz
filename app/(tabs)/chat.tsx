import { useRef, useState } from 'react';
import { router } from 'expo-router';
import { ScrollView, View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator, Modal } from 'react-native';
import { Header, Card } from '@/src/components/ui';
import { Avatar } from '@/src/components/Avatar';
import { useApp } from '@/src/store/AppContext';
import { colors } from '@/src/theme';
import { Ionicons } from '@expo/vector-icons';
import { feedback } from '@/src/services/feedback';

export default function Chat() {
  const {
    messages,
    journal,
    workspace,
    mode,
    user,
    searchUsers,
    directMessages,
    savedMessageIds,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ id: string; name: string; username: string; avatar: string }[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSavedModal, setShowSavedModal] = useState(false);

  const lastMsg = messages.at(-1)?.content ?? 'Start a conversation';
  const isSolo = mode === 'solo' || !workspace;

  const isNavigating = useRef(false);
  const navigateTo = (path: string) => {
    if (isNavigating.current) return;
    isNavigating.current = true;
    router.push(path as any);
    setTimeout(() => {
      isNavigating.current = false;
    }, 500);
  };

  const handleSearchChange = async (q: string) => {
    setSearchQuery(q);
    const cleaned = q.trim();
    if (cleaned.length >= 2) {
      setIsSearching(true);
      try {
        const results = await searchUsers(cleaned);
        // Exclude myself
        setSearchResults(results.filter((u) => u.id !== user.id));
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    } else {
      setSearchResults([]);
      setIsSearching(false);
    }
  };

  // Group direct messages by peer
  const dmsByPeer = new Map<string, { peerId: string; peerName: string; peerAvatar: string; lastMsg: string; timestamp: string }>();
  for (const dm of directMessages) {
    const isMine = dm.senderId === user.id;
    const peerId = isMine ? dm.recipientId : dm.senderId;
    const peerName = isMine ? 'Direct Message' : (dm.senderName || 'Direct Message');
    const peerAvatar = isMine ? 'U' : (dm.senderAvatar || 'U');
    dmsByPeer.set(peerId, {
      peerId,
      peerName,
      peerAvatar,
      lastMsg: dm.content,
      timestamp: dm.createdAt,
    });
  }
  const peerList = Array.from(dmsByPeer.values());

  const savedMessages = messages.filter((m) => savedMessageIds.includes(m.id));

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      <Header
        title="Chats"
        sub={workspace ? `${workspace.name} · Shared & Private` : 'Your private & mentor spaces'}
        onProfile={() => navigateTo('/profile')}
        avatarUri={user?.avatar}
      />

      {/* 1. Direct Message Search Bar */}
      <View style={s.searchRow}>
        <Ionicons name="search" size={17} color={colors.muted} />
        <TextInput
          value={searchQuery}
          onChangeText={handleSearchChange}
          placeholder="Search by @username to start a DM…"
          placeholderTextColor={colors.muted}
          style={s.searchInput}
          autoCapitalize="none"
        />
        {isSearching && <ActivityIndicator size="small" color={colors.violetLight} />}
        {searchQuery ? (
          <Pressable
            hitSlop={8}
            onPress={() => {
              setSearchQuery('');
              setSearchResults([]);
            }}
          >
            <Ionicons name="close-circle" size={18} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>

      {/* User Search Results */}
      {searchResults.length > 0 && (
        <View style={s.searchResultsBox}>
          <Text style={s.searchResultHeader}>USERS FOUND</Text>
          {searchResults.map((u) => (
            <Pressable
              key={u.id}
              style={s.searchResultRow}
              onPress={() => {
                feedback.tap(user.settings.preferences.haptics);
                setSearchQuery('');
                setSearchResults([]);
                navigateTo(`/conversation/dm?peerId=${u.id}&peerName=${encodeURIComponent(u.name)}&peerAvatar=${encodeURIComponent(u.avatar)}`);
              }}
            >
              <Avatar uri={u.avatar} name={u.name} size={36} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={s.searchResultName}>{u.name}</Text>
                <Text style={s.searchResultHandle}>@{u.username}</Text>
              </View>
              <Ionicons name="chatbubble-outline" size={18} color={colors.violetLight} />
            </Pressable>
          ))}
        </View>
      )}

      {/* 2. Private Personal Journal */}
      <Card
        style={s.chat}
        onPress={() => navigateTo('/conversation/journal')}
      >
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

      {/* 3. EvoRyz AI Mentor */}
      <Card
        style={s.chat}
        onPress={() => navigateTo('/conversation/ai')}
      >
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

      {/* 4. Workspace Chat (Duo / Team) */}
      {workspace ? (
        <Card
          style={s.chat}
          onPress={() => navigateTo('/conversation/workspace')}
        >
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
      ) : isSolo ? (
        <Card style={s.soloCard}>
          <View style={s.soloHeader}>
            <Ionicons name="person" size={20} color={colors.violetLight} />
            <Text style={s.soloTitle}>Solo Mode Active</Text>
          </View>
          <Text style={s.soloBody}>
            You are operating in Solo mode. Connect with a partner in Duo mode or form a Team at any time.
          </Text>
          <Pressable
            style={s.addFriendBtn}
            onPress={() => navigateTo('/duo')}
          >
            <Ionicons name="person-add-outline" size={16} color="white" />
            <Text style={s.addFriendBtnText}>Add Friend / Start Duo</Text>
          </Pressable>
        </Card>
      ) : null}

      {/* 5. Direct Messages List */}
      {peerList.length > 0 && (
        <View style={{ marginTop: 14 }}>
          <Text style={s.sectionHeaderTitle}>DIRECT MESSAGES</Text>
          {peerList.map((peer) => (
            <Card
              key={peer.peerId}
              style={s.chat}
              onPress={() =>
                navigateTo(
                  `/conversation/dm?peerId=${peer.peerId}&peerName=${encodeURIComponent(
                    peer.peerName
                  )}&peerAvatar=${encodeURIComponent(peer.peerAvatar)}`
                )
              }
            >
              <Avatar uri={peer.peerAvatar} name={peer.peerName} size={48} />
              <View style={s.info}>
                <View style={s.rowTop}>
                  <Text style={s.name}>{peer.peerName}</Text>
                  <Text style={s.time}>DM</Text>
                </View>
                <Text style={s.preview} numberOfLines={1}>
                  {peer.lastMsg}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </Card>
          ))}
        </View>
      )}

      {/* 6. Saved / Bookmarked Messages Shortcut */}
      {savedMessageIds.length > 0 && (
        <Card
          style={[s.chat, { marginTop: 10, borderColor: '#4C3B78' }]}
          onPress={() => {
            feedback.tap(user.settings.preferences.haptics);
            setShowSavedModal(true);
          }}
        >
          <View style={[s.icon, { backgroundColor: '#2D1B4D' }]}>
            <Ionicons name="bookmark" size={20} color="#FBBF24" />
          </View>
          <View style={s.info}>
            <Text style={s.name}>Saved Messages</Text>
            <Text style={s.preview}>{savedMessageIds.length} bookmarked message{savedMessageIds.length === 1 ? '' : 's'}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Card>
      )}

      <Text style={s.note}>
        Journal is cryptographically encrypted with your PIN. Workspace messages sync across members using Supabase.
      </Text>

      {/* Bookmarks / Saved Messages Modal */}
      <Modal visible={showSavedModal} transparent animationType="fade" onRequestClose={() => setShowSavedModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Saved Messages</Text>
              <Pressable hitSlop={10} onPress={() => setShowSavedModal(false)}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: 350, marginTop: 12 }}>
              {savedMessages.length === 0 ? (
                <Text style={{ color: colors.muted, textAlign: 'center', paddingVertical: 20 }}>
                  No saved messages found in active memory.
                </Text>
              ) : (
                savedMessages.map((m) => (
                  <View key={m.id} style={s.savedMsgCard}>
                    <Text style={s.savedMsgSender}>{m.senderName || 'Member'}</Text>
                    <Text style={s.savedMsgContent}>{m.content}</Text>
                    <Text style={s.savedMsgTime}>
                      {new Date(m.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </Text>
                  </View>
                ))
              )}
            </ScrollView>
            <Pressable style={s.modalClose} onPress={() => setShowSavedModal(false)}>
              <Text style={s.modalCloseText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 18, paddingBottom: 95 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    color: 'white',
    fontSize: 14,
  },
  searchResultsBox: {
    backgroundColor: '#1E1933',
    borderColor: '#372E5C',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
  },
  searchResultHeader: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 8,
  },
  searchResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2B2348',
  },
  searchResultName: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
  },
  searchResultHandle: {
    color: colors.violetLight,
    fontSize: 12,
  },
  sectionHeaderTitle: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 4,
  },
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
  addFriendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.violet,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 12,
  },
  addFriendBtnText: { color: 'white', fontWeight: '700', fontSize: 13 },
  note: { color: colors.muted, textAlign: 'center', fontSize: 11, lineHeight: 16, marginHorizontal: 20, marginTop: 24 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#181329',
    borderColor: '#31274F',
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
  savedMsgCard: {
    backgroundColor: colors.surface,
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  savedMsgSender: {
    color: colors.violetLight,
    fontWeight: '700',
    fontSize: 12,
    marginBottom: 4,
  },
  savedMsgContent: {
    color: 'white',
    fontSize: 14,
    lineHeight: 20,
  },
  savedMsgTime: {
    color: colors.muted,
    fontSize: 10,
    marginTop: 6,
  },
});
