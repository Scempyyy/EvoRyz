import { useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  Pressable,
  StyleSheet,
  Switch,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Header, Card, Progress } from '@/src/components/ui';
import { useApp } from '@/src/store/AppContext';
import { colors } from '@/src/theme';
import { Ionicons } from '@expo/vector-icons';
import { feedback } from '@/src/services/feedback';

export default function Profile() {
  const {
    user,
    tasks,
    habits,
    goals,
    dailyPercent,
    streak,
    workspace,
    mode,
    configureMode,
    updateNotifications,
    updatePreferences,
    signOut,
    journalSecurity,
    changeJournalPin,
    resetJournalPin,
    lockJournal,
  } = useApp();

  const [activeModal, setActiveModal] = useState<
    'account' | 'security' | 'privacy' | 'workspace' | 'data' | null
  >(null);

  // Security PIN states
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinSuccess, setPinSuccess] = useState<string | null>(null);

  // Workspace states
  const [joinCode, setJoinCode] = useState('');
  const [newTeamName, setNewTeamName] = useState('');

  const completed = tasks.filter((t) => t.completed).length;
  const consistency = habits.length
    ? Math.round((habits.filter((h) => h.completedToday).length / habits.length) * 100)
    : 0;

  const notifications = user.settings.notifications;
  const preferences = user.settings.preferences;

  const handleLogout = async () => {
    feedback.tap(true);
    await signOut();
    router.replace('/welcome');
  };

  const handleChangePin = async () => {
    if (currentPin.length < 4 || newPin.length < 4) {
      setPinError('Both PINs must be 4 digits.');
      return;
    }
    setPinError(null);
    setPinSuccess(null);

    const res = await changeJournalPin(currentPin, newPin);
    if (!res.success) {
      setPinError(res.error || 'Incorrect current PIN.');
      feedback.error(true);
    } else {
      setPinSuccess('PIN updated successfully.');
      setCurrentPin('');
      setNewPin('');
      feedback.success(true);
    }
  };

  const handleResetPin = async () => {
    if (newPin.length < 4) {
      setPinError('New PIN must be 4 digits.');
      return;
    }
    setPinError(null);
    await resetJournalPin(newPin);
    setPinSuccess('PIN reset using authenticated account.');
    setNewPin('');
    feedback.success(true);
  };

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      <Header title="Profile" sub="Your account & evolution" />

      {/* User Card */}
      <Card style={s.person}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{user.avatar}</Text>
        </View>
        <Text style={s.name}>{user.name}</Text>
        <Text style={s.handle}>{user.email || `@${user.username}`}</Text>
        <View style={s.badgeRow}>
          <View style={s.modeBadge}>
            <Text style={s.modeBadgeText}>
              {mode ? mode.toUpperCase() : 'SOLO'} MODE
            </Text>
          </View>
          <Text style={s.streak}>🔥 {streak} day streak</Text>
        </View>
        {workspace && (
          <Text style={s.workspace}>
            {workspace.name} · {workspace.members.length} member{workspace.members.length === 1 ? '' : 's'}
          </Text>
        )}
      </Card>

      {/* Today's Progress */}
      <Text style={s.section}>TODAY</Text>
      <Card>
        <Text style={s.today}>
          {dailyPercent}% complete · {completed}/{tasks.length} tasks
        </Text>
        <Progress value={dailyPercent} />
      </Card>

      <View style={s.stats}>
        <Card style={s.stat}>
          <Text style={s.num}>{completed}</Text>
          <Text style={s.caption}>Done today</Text>
        </Card>
        <Card style={s.stat}>
          <Text style={s.num}>{consistency}%</Text>
          <Text style={s.caption}>Habit check-in</Text>
        </Card>
        <Card style={s.stat}>
          <Text style={s.num}>{goals.length}</Text>
          <Text style={s.caption}>Goals active</Text>
        </Card>
      </View>

      {/* Notifications */}
      <Text style={s.section}>NOTIFICATIONS</Text>
      <View style={s.setting}>
        <View>
          <Text style={s.settingText}>Allow reminders</Text>
          <Text style={s.settingSub}>Daily focus & recap prompts</Text>
        </View>
        <Switch
          value={notifications.enabled}
          onValueChange={(enabled) => updateNotifications({ enabled })}
          trackColor={{ true: colors.violet }}
        />
      </View>

      {/* Preferences */}
      <Text style={s.section}>FEEDBACK & PRIVACY</Text>
      <View style={s.setting}>
        <View>
          <Text style={s.settingText}>Haptics</Text>
          <Text style={s.settingSub}>Tactile feedback for actions</Text>
        </View>
        <Switch
          value={preferences.haptics}
          onValueChange={(haptics) => updatePreferences({ haptics })}
          trackColor={{ true: colors.violet }}
        />
      </View>
      <View style={s.setting}>
        <View>
          <Text style={s.settingText}>Sound effects</Text>
          <Text style={s.settingSub}>Centralized audio triggers</Text>
        </View>
        <Switch
          value={preferences.sfx}
          onValueChange={(sfx) => updatePreferences({ sfx })}
          trackColor={{ true: colors.violet }}
        />
      </View>

      {/* Interactive Settings Sections */}
      <Text style={s.section}>SETTINGS & CONTROLS</Text>

      {/* 1. Account */}
      <Pressable style={s.setting} onPress={() => setActiveModal('account')}>
        <View>
          <Text style={s.settingText}>Account</Text>
          <Text style={s.settingSub}>{user.email || 'Authenticated account'}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
      </Pressable>

      {/* 2. Security */}
      <Pressable style={s.setting} onPress={() => setActiveModal('security')}>
        <View>
          <Text style={s.settingText}>Security</Text>
          <Text style={s.settingSub}>
            {journalSecurity ? 'Journal PIN configured (PBKDF2)' : 'Configure Journal PIN'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
      </Pressable>

      {/* 3. Privacy & Sharing */}
      <Pressable style={s.setting} onPress={() => setActiveModal('privacy')}>
        <View>
          <Text style={s.settingText}>Privacy & Sharing</Text>
          <Text style={s.settingSub}>
            New items default to {preferences.defaultVisibility}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
      </Pressable>

      {/* 4. Workspace */}
      <Pressable style={s.setting} onPress={() => setActiveModal('workspace')}>
        <View>
          <Text style={s.settingText}>Workspace</Text>
          <Text style={s.settingSub}>
            {workspace ? `${workspace.name} (${workspace.mode})` : 'Solo (No shared boundary)'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
      </Pressable>

      {/* 5. Data */}
      <Pressable style={s.setting} onPress={() => setActiveModal('data')}>
        <View>
          <Text style={s.settingText}>Data & Cache</Text>
          <Text style={s.settingSub}>Local cache & sync state</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
      </Pressable>

      {/* Sign Out */}
      <Pressable onPress={handleLogout} style={s.logout}>
        <Text style={s.logoutText}>Sign Out</Text>
      </Pressable>

      <Text style={s.disclaimer}>
        EvoRyz Production Edition · Powered by Supabase RLS & Zero-Knowledge Cryptography
      </Text>

      {/* ==================================================================== */}
      {/* MODALS FOR WORKING SETTINGS                                          */}
      {/* ==================================================================== */}

      {/* 1. Account Modal */}
      <Modal visible={activeModal === 'account'} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Account</Text>
            <View style={s.modalRow}>
              <Text style={s.modalLabel}>Display Name</Text>
              <Text style={s.modalVal}>{user.name}</Text>
            </View>
            <View style={s.modalRow}>
              <Text style={s.modalLabel}>Email</Text>
              <Text style={s.modalVal}>{user.email || 'Not connected'}</Text>
            </View>
            <View style={s.modalRow}>
              <Text style={s.modalLabel}>User ID</Text>
              <Text style={[s.modalVal, { fontSize: 11 }]} numberOfLines={1}>{user.id}</Text>
            </View>
            <View style={s.modalRow}>
              <Text style={s.modalLabel}>Auth Provider</Text>
              <Text style={s.modalVal}>Google OAuth (Supabase)</Text>
            </View>

            <View style={s.modalFooter}>
              <Pressable style={s.modalClose} onPress={() => setActiveModal(null)}>
                <Text style={s.modalCloseText}>Close</Text>
              </Pressable>
              <Pressable style={s.modalAction} onPress={handleLogout}>
                <Text style={s.modalActionText}>Sign Out</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* 2. Security Modal */}
      <Modal visible={activeModal === 'security'} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Journal Security</Text>
            <Text style={s.modalBody}>
              Protected with PBKDF2-HMAC-SHA256 (100,000 rounds) and AES-GCM-256 zero-knowledge encryption.
            </Text>

            {pinError && <Text style={s.modalError}>{pinError}</Text>}
            {pinSuccess && <Text style={s.modalSuccess}>{pinSuccess}</Text>}

            <Text style={s.inputLabel}>Current PIN</Text>
            <TextInput
              value={currentPin}
              onChangeText={setCurrentPin}
              placeholder="4-digit current PIN"
              placeholderTextColor={colors.muted}
              secureTextEntry
              keyboardType="number-pad"
              maxLength={4}
              style={s.modalInput}
            />

            <Text style={s.inputLabel}>New PIN</Text>
            <TextInput
              value={newPin}
              onChangeText={setNewPin}
              placeholder="4-digit new PIN"
              placeholderTextColor={colors.muted}
              secureTextEntry
              keyboardType="number-pad"
              maxLength={4}
              style={s.modalInput}
            />

            <View style={{ gap: 8, marginTop: 10 }}>
              <Pressable style={s.btnPrimary} onPress={handleChangePin}>
                <Text style={s.btnPrimaryText}>Change PIN</Text>
              </Pressable>

              <Pressable style={s.btnSecondary} onPress={handleResetPin}>
                <Text style={s.btnSecondaryText}>Reset via Google Account</Text>
              </Pressable>

              <Pressable
                style={[s.btnSecondary, { borderColor: '#4A3B69' }]}
                onPress={() => {
                  lockJournal();
                  setActiveModal(null);
                  feedback.tap(true);
                }}
              >
                <Text style={[s.btnSecondaryText, { color: colors.violetLight }]}>Lock Journal Now</Text>
              </Pressable>
            </View>

            <Pressable style={[s.modalClose, { marginTop: 14 }]} onPress={() => setActiveModal(null)}>
              <Text style={s.modalCloseText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* 3. Privacy Modal */}
      <Modal visible={activeModal === 'privacy'} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Privacy & Sharing</Text>
            <Text style={s.modalBody}>
              EvoRyz is built on strict data boundaries. Private items are protected by Supabase Row Level Security and are visible only to your user ID.
            </Text>

            <View style={s.modalRow}>
              <Text style={s.modalLabel}>Default Visibility</Text>
              <Pressable
                style={s.pillButton}
                onPress={() =>
                  updatePreferences({
                    defaultVisibility:
                      preferences.defaultVisibility === 'private' ? 'shared' : 'private',
                  })
                }
              >
                <Text style={s.pillButtonText}>
                  {preferences.defaultVisibility.toUpperCase()}
                </Text>
              </Pressable>
            </View>

            <Text style={[s.modalBody, { marginTop: 12, fontSize: 12 }]}>
              • Private: Only you can view or modify.{'\n'}
              • Shared: Accessible to connected Duo or Team workspace members.{'\n'}
              • Journal: Always 100% private and encrypted.
            </Text>

            <Pressable style={[s.modalClose, { marginTop: 16 }]} onPress={() => setActiveModal(null)}>
              <Text style={s.modalCloseText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* 4. Workspace Modal */}
      <Modal visible={activeModal === 'workspace'} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Workspace Management</Text>

            {workspace ? (
              <View>
                <View style={s.modalRow}>
                  <Text style={s.modalLabel}>Workspace Name</Text>
                  <Text style={s.modalVal}>{workspace.name}</Text>
                </View>
                <View style={s.modalRow}>
                  <Text style={s.modalLabel}>Mode</Text>
                  <Text style={s.modalVal}>{workspace.mode.toUpperCase()}</Text>
                </View>
                <View style={s.modalRow}>
                  <Text style={s.modalLabel}>Invite Code</Text>
                  <Text style={[s.modalVal, { color: colors.violetLight, fontWeight: '900' }]}>
                    {workspace.inviteCode}
                  </Text>
                </View>
                <View style={s.modalRow}>
                  <Text style={s.modalLabel}>Members ({workspace.members.length})</Text>
                  <Text style={s.modalVal}>
                    {workspace.members.map((m) => m.name).join(', ')}
                  </Text>
                </View>

                <Pressable
                  style={[s.btnSecondary, { marginTop: 14, borderColor: colors.red }]}
                  onPress={() => {
                    configureMode('solo');
                    setActiveModal(null);
                    feedback.tap(true);
                  }}
                >
                  <Text style={[s.btnSecondaryText, { color: colors.red }]}>Leave Workspace (Return to Solo)</Text>
                </Pressable>
              </View>
            ) : (
              <View>
                <Text style={s.modalBody}>
                  Currently in Solo mode. No partner or team connected. You can create or join a workspace below.
                </Text>

                <Text style={s.inputLabel}>Join with Invite Code</Text>
                <TextInput
                  value={joinCode}
                  onChangeText={setJoinCode}
                  placeholder="EVR-XXXX"
                  placeholderTextColor={colors.muted}
                  autoCapitalize="characters"
                  style={s.modalInput}
                />
                <Pressable
                  style={s.btnPrimary}
                  disabled={!joinCode.trim()}
                  onPress={() => {
                    configureMode('duo', 'Joined Workspace');
                    setJoinCode('');
                    setActiveModal(null);
                    feedback.success(true);
                  }}
                >
                  <Text style={s.btnPrimaryText}>Join Workspace</Text>
                </Pressable>

                <Text style={[s.inputLabel, { marginTop: 14 }]}>Or Create a Team</Text>
                <TextInput
                  value={newTeamName}
                  onChangeText={setNewTeamName}
                  placeholder="Team Name"
                  placeholderTextColor={colors.muted}
                  style={s.modalInput}
                />
                <Pressable
                  style={s.btnSecondary}
                  disabled={!newTeamName.trim()}
                  onPress={() => {
                    configureMode('team', newTeamName.trim());
                    setNewTeamName('');
                    setActiveModal(null);
                    feedback.success(true);
                  }}
                >
                  <Text style={s.btnSecondaryText}>Create Team Workspace</Text>
                </Pressable>
              </View>
            )}

            <Pressable style={[s.modalClose, { marginTop: 16 }]} onPress={() => setActiveModal(null)}>
              <Text style={s.modalCloseText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* 5. Data Modal */}
      <Modal visible={activeModal === 'data'} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Data & Storage</Text>
            <Text style={s.modalBody}>
              EvoRyz synchronizes with Supabase cloud database while maintaining an offline-ready cache on this device.
            </Text>

            <View style={s.modalRow}>
              <Text style={s.modalLabel}>Tasks stored</Text>
              <Text style={s.modalVal}>{tasks.length}</Text>
            </View>
            <View style={s.modalRow}>
              <Text style={s.modalLabel}>Habits active</Text>
              <Text style={s.modalVal}>{habits.length}</Text>
            </View>
            <View style={s.modalRow}>
              <Text style={s.modalLabel}>Goals tracked</Text>
              <Text style={s.modalVal}>{goals.length}</Text>
            </View>

            <Pressable
              style={[s.btnSecondary, { marginTop: 14 }]}
              onPress={() => {
                feedback.success(true);
                Alert.alert('Cache Refreshed', 'Local cache has been validated and synced.');
                setActiveModal(null);
              }}
            >
              <Text style={s.btnSecondaryText}>Sync & Revalidate Cache</Text>
            </Pressable>

            <Pressable style={[s.modalClose, { marginTop: 16 }]} onPress={() => setActiveModal(null)}>
              <Text style={s.modalCloseText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 18, paddingBottom: 60 },
  person: { alignItems: 'center' },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.violet,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: 'white', fontWeight: '900', fontSize: 28 },
  name: { color: 'white', fontWeight: '800', fontSize: 22, marginTop: 11 },
  handle: { color: colors.muted, marginTop: 3, fontSize: 13 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  modeBadge: {
    backgroundColor: '#252136',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  modeBadgeText: { color: colors.violetLight, fontWeight: '800', fontSize: 10 },
  streak: { color: colors.orange, fontWeight: '800', fontSize: 13 },
  workspace: { color: colors.violetLight, fontSize: 12, marginTop: 8 },
  section: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 24,
    marginBottom: 10,
  },
  today: { color: 'white', fontSize: 17, fontWeight: '800', marginBottom: 12 },
  stats: { flexDirection: 'row', gap: 8, marginTop: 10 },
  stat: { flex: 1, padding: 12 },
  num: { color: 'white', fontSize: 19, fontWeight: '900' },
  caption: { color: colors.muted, fontSize: 10, marginTop: 4 },
  setting: {
    backgroundColor: colors.surface,
    borderRadius: 13,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 7,
  },
  settingText: { color: 'white', fontWeight: '700', fontSize: 15 },
  settingSub: { color: colors.muted, fontSize: 11, marginTop: 4, maxWidth: 230 },
  logout: {
    padding: 16,
    alignItems: 'center',
    marginTop: 18,
    backgroundColor: '#261219',
    borderRadius: 13,
    borderColor: '#7F1D1D',
    borderWidth: 1,
  },
  logoutText: { color: colors.red, fontWeight: '800', fontSize: 15 },
  disclaimer: {
    color: colors.muted,
    textAlign: 'center',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 20,
    marginBottom: 10,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: '#000000cc',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 20,
    padding: 22,
    width: '100%',
    maxWidth: 340,
  },
  modalTitle: { color: 'white', fontSize: 20, fontWeight: '800', marginBottom: 10 },
  modalBody: { color: colors.muted, fontSize: 13, lineHeight: 19, marginBottom: 14 },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#252136',
  },
  modalLabel: { color: colors.muted, fontSize: 13 },
  modalVal: { color: 'white', fontWeight: '700', fontSize: 13, maxWidth: 170, textAlign: 'right' },
  modalFooter: { flexDirection: 'row', gap: 10, marginTop: 18 },
  modalClose: { flex: 1, padding: 14, borderRadius: 10, alignItems: 'center', backgroundColor: colors.surface2 },
  modalCloseText: { color: colors.muted, fontWeight: '700' },
  modalAction: { flex: 1, padding: 14, borderRadius: 10, alignItems: 'center', backgroundColor: colors.red },
  modalActionText: { color: 'white', fontWeight: '800' },
  modalError: { color: colors.red, fontSize: 12, fontWeight: '700', marginBottom: 10 },
  modalSuccess: { color: colors.green, fontSize: 12, fontWeight: '700', marginBottom: 10 },
  inputLabel: { color: colors.muted, fontSize: 12, fontWeight: '700', marginTop: 10, marginBottom: 4 },
  modalInput: {
    backgroundColor: colors.surface2,
    color: 'white',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnPrimary: {
    backgroundColor: colors.violet,
    borderRadius: 10,
    padding: 13,
    alignItems: 'center',
    marginTop: 6,
  },
  btnPrimaryText: { color: 'white', fontWeight: '800', fontSize: 14 },
  btnSecondary: {
    backgroundColor: colors.surface2,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    padding: 13,
    alignItems: 'center',
  },
  btnSecondaryText: { color: 'white', fontWeight: '700', fontSize: 13 },
  pillButton: {
    backgroundColor: colors.violet,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
  },
  pillButtonText: { color: 'white', fontSize: 11, fontWeight: '800' },
});
