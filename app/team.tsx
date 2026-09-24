import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Share,
  BackHandler,
  ScrollView,
  Modal,
  Alert,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '@/src/store/AppContext';
import { colors } from '@/src/theme';
import { feedback } from '@/src/services/feedback';
import { WorkspaceTheme, WorkspaceMember } from '@/src/types';
import { Progress } from '@/src/components/ui';

export default function Team() {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Team Goals modal state
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [goalTitle, setGoalTitle] = useState('');
  const [goalTarget, setGoalTarget] = useState('10');
  const [goalUnit, setGoalUnit] = useState('times');

  // Member management sheet state
  const [selectedMember, setSelectedMember] = useState<WorkspaceMember | null>(null);

  const {
    createWorkspace,
    joinWorkspace,
    leaveWorkspace,
    workspace,
    user,
    changeTheme,
    setMemberRole,
    setMemberMuted,
    removeMember,
    toggleWorkspaceNotifications,
    teamGoals,
    createTeamGoal,
    updateTeamGoal,
    deleteTeamGoal,
  } = useApp();

  const isCurrentTeam = workspace?.mode === 'team';

  const myMember = workspace?.members.find((m) => m.id === user.id);
  const isOwnerOrAdmin =
    myMember?.role === 'owner' ||
    myMember?.role === 'admin' ||
    workspace?.members[0]?.id === user.id;

  const currentTheme: WorkspaceTheme = workspace?.theme || 'default';

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/daily');
    }
  };

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBack();
      return true;
    });
    return () => sub.remove();
  }, []);

  const handleCreate = async () => {
    setLoading(true);
    setError('');
    const teamName = name.trim() || 'My Team';
    const res = await createWorkspace(teamName, 'team');
    setLoading(false);
    if (res.success) {
      router.replace('/(tabs)/chat');
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
      router.replace('/(tabs)/chat');
    } else {
      setError(res.error || 'Failed to join team workspace.');
    }
  };

  const shareCode = async () => {
    if (workspace?.inviteCode) {
      feedback.tap(true);
      await Share.share({
        message: `Join my EvoRyz Team workspace with invite code: ${workspace.inviteCode}`,
      });
    }
  };

  const handleCreateGoal = async () => {
    if (!goalTitle.trim()) return;
    const targetNum = parseInt(goalTarget, 10) || 10;
    feedback.tap(user.settings.preferences.haptics);
    await createTeamGoal(goalTitle.trim(), targetNum, goalUnit.trim() || undefined);
    setGoalTitle('');
    setGoalModalOpen(false);
  };

  return (
    <SafeAreaView style={s.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <View style={s.topNav}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={10}
            onPress={handleBack}
            style={s.backBtn}
          >
            <Ionicons name="chevron-back" size={24} color="white" />
            <Text style={s.backText}>Back</Text>
          </Pressable>
          <Text style={s.brand}>EvoRyz Team</Text>
        </View>

        {isCurrentTeam ? (
          <View>
            <Text style={s.title}>{workspace.name}</Text>
            <Text style={s.copy}>
              Your Team workspace is active. Members share collaborative goals, accountability tasks, and live realtime chat.
            </Text>

            {/* Invite Code Card */}
            <View style={s.card}>
              <Text style={s.label}>TEAM INVITE CODE</Text>
              <Text style={s.code}>{workspace.inviteCode}</Text>
              <Pressable style={s.shareBtn} onPress={shareCode}>
                <Ionicons name="share-outline" size={18} color="white" />
                <Text style={s.shareBtnText}>Share Invite Code with Team</Text>
              </Pressable>
              <Text style={s.hint}>
                Send this code to colleagues or friends to join your Team.
              </Text>
            </View>

            {/* Chat Theme Picker */}
            <View style={[s.card, { marginTop: 16 }]}>
              <Text style={s.label}>WORKSPACE CHAT THEME</Text>
              <Text style={s.hint}>
                Synchronizes custom visual ambience across all members:
              </Text>
              <View style={s.themeRow}>
                {[
                  { id: 'default' as const, label: 'Standard Dark' },
                  { id: 'harry_potter' as const, label: 'Harry Potter' },
                  { id: 'stranger_things' as const, label: 'Stranger Things' },
                ].map((th) => {
                  const isActive = currentTheme === th.id;
                  return (
                    <Pressable
                      key={th.id}
                      style={[s.themePill, isActive && s.themePillActive]}
                      onPress={() => {
                        feedback.tap(user.settings.preferences.haptics);
                        void changeTheme(th.id);
                      }}
                    >
                      <Ionicons
                        name={isActive ? 'checkmark-circle' : 'color-palette-outline'}
                        size={15}
                        color={isActive ? 'white' : colors.muted}
                      />
                      <Text style={[s.themePillText, isActive && s.themePillTextActive]}>
                        {th.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Notifications Mute Toggle */}
            <View style={[s.card, { marginTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={s.label}>NOTIFICATIONS</Text>
                <Text style={{ color: 'white', fontWeight: '700', fontSize: 14 }}>Mute Team Chat Notifications</Text>
                <Text style={s.hint}>Silence alerts from peer messages in this workspace</Text>
              </View>
              <Switch
                value={Boolean(myMember?.notificationsMuted)}
                onValueChange={(val) => {
                  feedback.tap(user.settings.preferences.haptics);
                  void toggleWorkspaceNotifications(val);
                }}
                trackColor={{ true: colors.violet }}
              />
            </View>

            {/* Team Goals & Challenges */}
            <View style={{ marginTop: 24 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={s.label}>TEAM GOALS & CHALLENGES ({teamGoals.length})</Text>
                <Pressable
                  style={s.addGoalBtn}
                  onPress={() => {
                    feedback.tap(user.settings.preferences.haptics);
                    setGoalModalOpen(true);
                  }}
                >
                  <Ionicons name="add" size={16} color="white" />
                  <Text style={s.addGoalBtnText}>New Goal</Text>
                </Pressable>
              </View>

              {teamGoals.length === 0 ? (
                <View style={[s.card, { padding: 18, alignItems: 'center' }]}>
                  <Ionicons name="trophy-outline" size={32} color={colors.muted} />
                  <Text style={{ color: 'white', fontWeight: '700', marginTop: 8 }}>No team goals yet</Text>
                  <Text style={[s.hint, { textAlign: 'center', marginTop: 4 }]}>
                    Create shared targets (e.g. &quot;Run 50km together&quot;, &quot;Ship master update&quot;)
                  </Text>
                </View>
              ) : (
                teamGoals.map((g) => {
                  const pct = Math.min(100, Math.round((g.current / (g.target || 1)) * 100));
                  return (
                    <View key={g.id} style={s.goalCard}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={s.goalTitle}>{g.title}</Text>
                        <Text style={s.goalPct}>{g.current} / {g.target} {g.unit || ''}</Text>
                      </View>
                      <View style={{ marginVertical: 8 }}>
                        <Progress value={pct} color={pct >= 100 ? colors.green : colors.violet} />
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Pressable
                          style={s.goalIncBtn}
                          onPress={() => {
                            feedback.tap(user.settings.preferences.haptics);
                            void updateTeamGoal(g.id, g.current + 1);
                          }}
                        >
                          <Ionicons name="add" size={14} color="white" />
                          <Text style={s.goalIncBtnText}>+1 Progress</Text>
                        </Pressable>
                        {isOwnerOrAdmin && (
                          <Pressable
                            hitSlop={8}
                            onPress={() => {
                              feedback.tap(true);
                              Alert.alert('Delete Team Goal', `Remove "${g.title}"?`, [
                                { text: 'Cancel', style: 'cancel' },
                                { text: 'Delete', style: 'destructive', onPress: () => void deleteTeamGoal(g.id) },
                              ]);
                            }}
                          >
                            <Ionicons name="trash-outline" size={16} color={colors.muted} />
                          </Pressable>
                        )}
                      </View>
                    </View>
                  );
                })
              )}
            </View>

            {/* Team Members List & Presence */}
            <View style={{ marginTop: 24 }}>
              <Text style={s.label}>MEMBERS & PRESENCE ({workspace.members.length})</Text>
              {workspace.members.map((m) => {
                const isMe = m.id === user.id;
                const isOnline = Boolean(m.isOnline);
                return (
                  <Pressable
                    key={m.id}
                    style={s.memberRow}
                    onPress={() => {
                      if (isOwnerOrAdmin && !isMe) {
                        feedback.tap(user.settings.preferences.haptics);
                        setSelectedMember(m);
                      }
                    }}
                  >
                    <View style={s.avatarBadge}>
                      <Text style={s.avatarText}>{m.name.charAt(0).toUpperCase()}</Text>
                      <View style={[s.presenceDot, isOnline ? s.presenceOnline : s.presenceOffline]} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={s.memberName}>{m.name}</Text>
                        {isMe && <Text style={s.youTag}>(You)</Text>}
                        {m.role && (
                          <View style={s.roleTag}>
                            <Text style={s.roleTagText}>{m.role.toUpperCase()}</Text>
                          </View>
                        )}
                        {m.isMuted && (
                          <View style={[s.roleTag, { backgroundColor: '#451A1A' }]}>
                            <Text style={[s.roleTagText, { color: '#F87171' }]}>MUTED</Text>
                          </View>
                        )}
                      </View>
                      <Text style={s.presenceText}>
                        {isOnline ? '🟢 Online now' : '⚪ Active recently'}
                      </Text>
                    </View>
                    {isOwnerOrAdmin && !isMe && (
                      <Ionicons name="ellipsis-horizontal" size={18} color={colors.muted} />
                    )}
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              style={[s.leaveBtn, { marginTop: 32 }]}
              onPress={async () => {
                feedback.tap(true);
                Alert.alert('Leave Team', 'Are you sure you want to leave this team workspace and return to Solo mode?', [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Leave',
                    style: 'destructive',
                    onPress: async () => {
                      await leaveWorkspace();
                      router.replace('/(tabs)/daily');
                    },
                  },
                ]);
              }}
            >
              <Text style={s.leaveBtnText}>Leave Team Workspace</Text>
            </Pressable>
          </View>
        ) : (
          <View>
            <Text style={s.title}>Set up your team</Text>
            <Text style={s.copy}>
              Teams are shared workspaces for collaborative accountability and daily momentum. Shared tasks and workspace messages synchronize across all connected members.
            </Text>

            <View style={s.card}>
              <Text style={s.label}>CREATE A TEAM</Text>
              <TextInput
                value={name}
                onChangeText={(val) => {
                  setName(val);
                  setError('');
                }}
                placeholder="Team name"
                placeholderTextColor={colors.muted}
                style={[s.input, { width: '100%' }]}
              />
              <Pressable
                style={[s.primaryBtn, { marginTop: 12 }]}
                disabled={loading}
                onPress={handleCreate}
              >
                <Text style={s.primaryBtnText}>{loading ? 'Creating…' : 'Create New Team'}</Text>
              </Pressable>
            </View>

            <View style={[s.card, { marginTop: 18 }]}>
              <Text style={s.label}>JOIN AN EXISTING TEAM</Text>
              <TextInput
                value={code}
                onChangeText={(val) => {
                  setCode(val.toUpperCase());
                  setError('');
                }}
                placeholder="EVR-XXXX"
                placeholderTextColor={colors.muted}
                autoCapitalize="characters"
                style={[s.input, { width: '100%' }]}
              />
              <Pressable
                style={[s.secondaryBtn, { marginTop: 12 }]}
                disabled={loading}
                onPress={handleJoin}
              >
                <Text style={s.secondaryBtnText}>{loading ? 'Joining…' : 'Join with Code'}</Text>
              </Pressable>
            </View>

            {error ? <Text style={s.errorText}>{error}</Text> : null}
          </View>
        )}
      </ScrollView>

      {/* New Team Goal Modal */}
      <Modal visible={goalModalOpen} transparent animationType="fade" onRequestClose={() => setGoalModalOpen(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Add Team Goal</Text>
            <Text style={s.modalSub}>Set a milestone for the whole team to accomplish together</Text>

            <Text style={[s.label, { marginTop: 14 }]}>GOAL TITLE</Text>
            <TextInput
              value={goalTitle}
              onChangeText={setGoalTitle}
              placeholder="e.g. 100 Focus Sessions"
              placeholderTextColor={colors.muted}
              style={s.modalInput}
            />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>TARGET NUMBER</Text>
                <TextInput
                  value={goalTarget}
                  onChangeText={setGoalTarget}
                  keyboardType="numeric"
                  placeholder="10"
                  placeholderTextColor={colors.muted}
                  style={s.modalInput}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>UNIT</Text>
                <TextInput
                  value={goalUnit}
                  onChangeText={setGoalUnit}
                  placeholder="times / km"
                  placeholderTextColor={colors.muted}
                  style={s.modalInput}
                />
              </View>
            </View>

            <Pressable style={s.primaryBtn} onPress={handleCreateGoal}>
              <Text style={s.primaryBtnText}>Create Team Goal</Text>
            </Pressable>
            <Pressable style={s.modalCloseBtn} onPress={() => setGoalModalOpen(false)}>
              <Text style={s.modalCloseBtnText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Member Management Sheet / Modal */}
      <Modal visible={Boolean(selectedMember)} transparent animationType="fade" onRequestClose={() => setSelectedMember(null)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>{selectedMember?.name}</Text>
            <Text style={s.modalSub}>Manage role and permissions in this team</Text>

            <View style={{ marginTop: 16, gap: 10 }}>
              {selectedMember?.role === 'admin' ? (
                <Pressable
                  style={s.actionRow}
                  onPress={async () => {
                    if (selectedMember) {
                      await setMemberRole(selectedMember.id, 'member');
                      setSelectedMember(null);
                    }
                  }}
                >
                  <Ionicons name="arrow-down" size={18} color={colors.violetLight} />
                  <Text style={s.actionRowText}>Demote to Member</Text>
                </Pressable>
              ) : (
                <Pressable
                  style={s.actionRow}
                  onPress={async () => {
                    if (selectedMember) {
                      await setMemberRole(selectedMember.id, 'admin');
                      setSelectedMember(null);
                    }
                  }}
                >
                  <Ionicons name="shield-checkmark" size={18} color={colors.violetLight} />
                  <Text style={s.actionRowText}>Promote to Admin</Text>
                </Pressable>
              )}

              <Pressable
                style={s.actionRow}
                onPress={async () => {
                  if (selectedMember) {
                    await setMemberMuted(selectedMember.id, !selectedMember.isMuted);
                    setSelectedMember(null);
                  }
                }}
              >
                <Ionicons
                  name={selectedMember?.isMuted ? 'volume-high' : 'volume-mute'}
                  size={18}
                  color={selectedMember?.isMuted ? colors.green : '#F87171'}
                />
                <Text style={s.actionRowText}>
                  {selectedMember?.isMuted ? 'Unmute in Team Chat' : 'Mute in Team Chat'}
                </Text>
              </Pressable>

              <Pressable
                style={[s.actionRow, { borderColor: colors.red }]}
                onPress={async () => {
                  if (selectedMember) {
                    Alert.alert('Remove Member', `Remove ${selectedMember.name} from the team?`, [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Remove',
                        style: 'destructive',
                        onPress: async () => {
                          await removeMember(selectedMember.id);
                          setSelectedMember(null);
                        },
                      },
                    ]);
                  }
                }}
              >
                <Ionicons name="person-remove" size={18} color={colors.red} />
                <Text style={[s.actionRowText, { color: colors.red }]}>Remove from Team</Text>
              </Pressable>
            </View>

            <Pressable style={s.modalCloseBtn} onPress={() => setSelectedMember(null)}>
              <Text style={s.modalCloseBtnText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 20 },
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    marginBottom: 8,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: { color: 'white', fontSize: 16, fontWeight: '700' },
  brand: { color: colors.violetLight, fontWeight: '900', fontSize: 15, letterSpacing: 0.5 },
  title: { color: 'white', fontSize: 28, fontWeight: '800', marginBottom: 8 },
  copy: { color: colors.muted, fontSize: 14, lineHeight: 22, marginBottom: 20 },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
  },
  label: { color: colors.muted, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 8 },
  code: { color: 'white', fontSize: 32, fontWeight: '900', letterSpacing: 2, marginVertical: 8 },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.violet,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 6,
  },
  shareBtnText: { color: 'white', fontWeight: '800', fontSize: 14 },
  hint: { color: colors.muted, fontSize: 12, marginTop: 8, lineHeight: 18 },
  themeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  themePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface2,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  themePillActive: {
    backgroundColor: colors.violet,
    borderColor: colors.violet,
  },
  themePillText: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  themePillTextActive: { color: 'white' },
  addGoalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.violet,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  addGoalBtnText: { color: 'white', fontWeight: '800', fontSize: 12 },
  goalCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  goalTitle: { color: 'white', fontWeight: '800', fontSize: 15 },
  goalPct: { color: colors.violetLight, fontWeight: '800', fontSize: 13 },
  goalIncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#261F38',
    borderColor: '#3D2F5A',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  goalIncBtnText: { color: colors.violetLight, fontWeight: '700', fontSize: 11 },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
  },
  avatarBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarText: { color: 'white', fontWeight: '800', fontSize: 15 },
  presenceDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    position: 'absolute',
    bottom: -1,
    right: -1,
    borderWidth: 2,
    borderColor: colors.bg,
  },
  presenceOnline: { backgroundColor: colors.green },
  presenceOffline: { backgroundColor: '#6B7280' },
  memberName: { color: 'white', fontWeight: '800', fontSize: 15 },
  youTag: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  roleTag: {
    backgroundColor: '#241E38',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  roleTagText: { color: colors.violetLight, fontSize: 9, fontWeight: '900' },
  presenceText: { color: colors.muted, fontSize: 11, marginTop: 2 },
  input: {
    backgroundColor: colors.surface2,
    borderRadius: 12,
    padding: 14,
    color: 'white',
    fontSize: 15,
    borderWidth: 1,
    borderColor: colors.border,
  },
  primaryBtn: {
    backgroundColor: colors.violet,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  primaryBtnText: { color: 'white', fontWeight: '800', fontSize: 14 },
  secondaryBtn: {
    backgroundColor: colors.surface2,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  secondaryBtnText: { color: 'white', fontWeight: '700', fontSize: 14 },
  leaveBtn: {
    borderColor: '#7F1D1D',
    borderWidth: 1,
    backgroundColor: '#2A1215',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  leaveBtnText: { color: '#FCA5A5', fontWeight: '800', fontSize: 14 },
  errorText: { color: colors.red, fontSize: 13, marginTop: 12, textAlign: 'center' },
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
  modalTitle: { color: 'white', fontSize: 18, fontWeight: '800' },
  modalSub: { color: colors.muted, fontSize: 12, marginTop: 4, marginBottom: 12 },
  modalInput: {
    backgroundColor: colors.surface2,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    color: 'white',
    fontSize: 14,
    marginBottom: 10,
  },
  modalCloseBtn: {
    backgroundColor: colors.surface,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  modalCloseBtnText: { color: colors.muted, fontWeight: '700', fontSize: 13 },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface2,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  actionRowText: { color: 'white', fontWeight: '700', fontSize: 14 },
});
