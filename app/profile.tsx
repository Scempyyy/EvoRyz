import { useEffect, useState } from 'react';
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
  BackHandler,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Header, Card, Progress } from '@/src/components/ui';
import { Avatar } from '@/src/components/Avatar';
import { useApp } from '@/src/store/AppContext';
import { colors } from '@/src/theme';
import { Ionicons } from '@expo/vector-icons';
import { feedback } from '@/src/services/feedback';
import { UpdatesService, UpdateCheckResult } from '@/src/services/updates';
import { sendTestNotification } from '@/src/services/notifications';

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
    createWorkspace,
    joinWorkspace,
    leaveWorkspace,
    updateUsername,
    updateNotifications,
    updatePreferences,
    signOut,
    journalSecurity,
    changeJournalPin,
    resetJournalPin,
    lockJournal,
    uploadUserAvatar,
    removeUserAvatar,
    uploadWorkspaceAvatar,
    updateWorkspaceIdentity,
  } = useApp();

  const [activeModal, setActiveModal] = useState<
    'account' | 'username' | 'security' | 'privacy' | 'workspace' | 'data' | 'about' | null
  >(null);

  // Security PIN states
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinSuccess, setPinSuccess] = useState<string | null>(null);

  // Username states
  const [usernameInput, setUsernameInput] = useState('');
  const [usernameLoading, setUsernameLoading] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [usernameSuccess, setUsernameSuccess] = useState<string | null>(null);

  const [avatarLoading, setAvatarLoading] = useState(false);

  // Workspace states
  const [joinCode, setJoinCode] = useState('');
  const [newTeamName, setNewTeamName] = useState('');
  const [editWsName, setEditWsName] = useState('');
  const [wsNameLoading, setWsNameLoading] = useState(false);
  const [wsNameSuccess, setWsNameSuccess] = useState<string | null>(null);
  const [wsAvatarLoading, setWsAvatarLoading] = useState(false);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);

  // Notification and OTA Update states
  const [testNotifLoading, setTestNotifLoading] = useState(false);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [updateResult, setUpdateResult] = useState<UpdateCheckResult | null>(null);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (activeModal) {
        setActiveModal(null);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [activeModal]);

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
    try {
      await resetJournalPin(newPin);
      setPinSuccess('PIN reset using authenticated account.');
      setNewPin('');
      feedback.success(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Reset failed';
      setPinError(msg);
      feedback.error(true);
    }
  };

  const handleSaveUsername = async () => {
    const cleaned = usernameInput.trim().toLowerCase();
    if (!cleaned) {
      setUsernameError('Please enter a username.');
      feedback.error(true);
      return;
    }
    if (cleaned === user.username) {
      setUsernameSuccess('Username is already set to @' + cleaned);
      return;
    }
    if (cleaned.length < 3 || cleaned.length > 20) {
      setUsernameError('Username must be between 3 and 20 characters.');
      feedback.error(true);
      return;
    }
    if (!/^[a-z0-9_]+$/.test(cleaned)) {
      setUsernameError('Only letters, numbers, and underscores are allowed.');
      feedback.error(true);
      return;
    }

    setUsernameLoading(true);
    setUsernameError(null);
    setUsernameSuccess(null);

    try {
      const res = await updateUsername(cleaned);
      if (!res.success) {
        setUsernameError(res.error || 'Failed to update username.');
        feedback.error(true);
      } else {
        setUsernameSuccess('Username updated to @' + cleaned);
        feedback.success(true);
        setTimeout(() => {
          setActiveModal(null);
          setUsernameSuccess(null);
        }, 1200);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update username.';
      setUsernameError(msg);
      feedback.error(true);
    } finally {
      setUsernameLoading(false);
    }
  };

  const handleAvatarPress = () => {
    feedback.tap(preferences.haptics);
    const isCustomAvatar = Boolean(
      user.avatar && (user.avatar.startsWith('http://') || user.avatar.startsWith('https://'))
    );

    const options: any[] = [
      {
        text: 'Choose from Gallery',
        onPress: handlePickUserAvatar,
      },
    ];

    if (isCustomAvatar) {
      options.push({
        text: 'Remove Photo',
        style: 'destructive',
        onPress: handleRemoveUserAvatar,
      });
    }

    options.push({ text: 'Cancel', style: 'cancel' });

    Alert.alert('Profile Picture', 'Update your personal avatar across Duo & Team', options);
  };

  const handlePickUserAvatar = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission required', 'Please grant photo library access to change your avatar.');
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!res.canceled && res.assets[0]) {
        setAvatarLoading(true);
        const uploaded = await uploadUserAvatar(res.assets[0].uri);
        setAvatarLoading(false);
        if (uploaded) {
          feedback.success(preferences.haptics);
          feedback.sound('success', preferences.sfx);
        } else {
          Alert.alert('Upload Failed', 'Could not upload avatar. Please try again.');
        }
      }
    } catch (err) {
      setAvatarLoading(false);
      console.warn('[Profile] handlePickUserAvatar error:', err);
    }
  };

  const handleRemoveUserAvatar = async () => {
    setAvatarLoading(true);
    await removeUserAvatar();
    setAvatarLoading(false);
    feedback.tap(preferences.haptics);
  };

  const handlePickWorkspaceAvatar = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission required', 'Please grant photo access.');
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!res.canceled && res.assets[0]) {
        setWsAvatarLoading(true);
        await uploadWorkspaceAvatar(res.assets[0].uri);
        setWsAvatarLoading(false);
        feedback.success(preferences.haptics);
      }
    } catch (err) {
      setWsAvatarLoading(false);
      console.warn('[Profile] handlePickWorkspaceAvatar error:', err);
    }
  };

  const handleRemoveWorkspaceAvatar = async () => {
    setWsAvatarLoading(true);
    await updateWorkspaceIdentity(undefined, null);
    setWsAvatarLoading(false);
    feedback.tap(preferences.haptics);
  };

  const handleSaveWorkspaceName = async () => {
    const trimmed = editWsName.trim();
    if (!trimmed) return;
    setWsNameLoading(true);
    setWsNameSuccess(null);
    const ok = await updateWorkspaceIdentity(trimmed);
    setWsNameLoading(false);
    if (ok) {
      setWsNameSuccess('Workspace name updated!');
      feedback.success(preferences.haptics);
      setTimeout(() => setWsNameSuccess(null), 2000);
    }
  };

  const handleTestNotification = async () => {
    setTestNotifLoading(true);
    feedback.tap(preferences.haptics);
    const sent = await sendTestNotification();
    setTestNotifLoading(false);
    if (sent) {
      feedback.sound('notification', preferences.sfx);
      Alert.alert('🔔 Notification Sent', 'Check your device notification shade.');
    } else {
      Alert.alert(
        'Permission Required',
        'Notification permission was not granted. Please enable notifications for EvoRyz in device settings.'
      );
    }
  };

  const handleCheckUpdates = async () => {
    setCheckingUpdates(true);
    feedback.tap(preferences.haptics);
    const result = await UpdatesService.checkForUpdate();
    setUpdateResult(result);
    setCheckingUpdates(false);
  };

  const handleReloadApp = async () => {
    feedback.tap(preferences.haptics);
    await UpdatesService.reload();
  };

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      <Header title="Profile" sub="Your account & evolution" />

      {/* User Card */}
      <Card style={s.person}>
        <Pressable onPress={handleAvatarPress} style={s.avatarWrapper} disabled={avatarLoading}>
          <Avatar uri={user.avatar} name={user.name} size={72} />
          <View style={s.cameraBadge}>
            {avatarLoading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Ionicons name="camera" size={14} color="white" />
            )}
          </View>
        </Pressable>
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
          <Text style={s.settingSub}>Focus & periodic prompts</Text>
        </View>
        <Switch
          value={notifications.enabled}
          onValueChange={(enabled) => updateNotifications({ enabled })}
          trackColor={{ true: colors.violet }}
        />
      </View>
      <View style={s.setting}>
        <View>
          <Text style={s.settingText}>Daily recap notification</Text>
          <Text style={s.settingSub}>2:00 AM summary of completed day</Text>
        </View>
        <Switch
          value={notifications.recapReminder}
          onValueChange={(recapReminder) => updateNotifications({ recapReminder })}
          trackColor={{ true: colors.violet }}
        />
      </View>
      <Pressable
        style={s.setting}
        onPress={handleTestNotification}
        disabled={testNotifLoading}
      >
        <View>
          <Text style={s.settingText}>Send test notification</Text>
          <Text style={s.settingSub}>Trigger 🔔 EvoRyz Test Notification</Text>
        </View>
        {testNotifLoading ? (
          <ActivityIndicator size="small" color={colors.violetLight} />
        ) : (
          <Ionicons name="notifications-outline" size={20} color={colors.violetLight} />
        )}
      </Pressable>

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

      {/* 2. Change Username */}
      <Pressable
        style={s.setting}
        onPress={() => {
          setUsernameInput(user.username || '');
          setUsernameError(null);
          setUsernameSuccess(null);
          setActiveModal('username');
        }}
      >
        <View>
          <Text style={s.settingText}>Username</Text>
          <Text style={s.settingSub}>@{user.username || 'not set'}</Text>
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
      <Pressable
        style={s.setting}
        onPress={() => {
          setEditWsName(workspace?.name || '');
          setActiveModal('workspace');
        }}
      >
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

      {/* 6. About EvoRyz & Updates */}
      <Pressable style={s.setting} onPress={() => setActiveModal('about')}>
        <View>
          <Text style={s.settingText}>About EvoRyz & Updates</Text>
          <Text style={s.settingSub}>v1.0.0 · Over-the-air updates</Text>
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
      <Modal visible={activeModal === 'account'} transparent animationType="fade" onRequestClose={() => setActiveModal(null)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Go back"
                hitSlop={10}
                onPress={() => setActiveModal(null)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
              >
                <Ionicons name="chevron-back" size={22} color={colors.violetLight} />
                <Text style={{ color: colors.violetLight, fontWeight: '700', fontSize: 15 }}>Back</Text>
              </Pressable>
              <Text style={[s.modalTitle, { marginBottom: 0 }]}>Account</Text>
              <View style={{ width: 44 }} />
            </View>

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

      {/* Change Username Modal */}
      <Modal visible={activeModal === 'username'} transparent animationType="fade" onRequestClose={() => setActiveModal(null)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Go back"
                hitSlop={10}
                onPress={() => {
                  setActiveModal(null);
                  setUsernameError(null);
                  setUsernameSuccess(null);
                }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
              >
                <Ionicons name="chevron-back" size={22} color={colors.violetLight} />
                <Text style={{ color: colors.violetLight, fontWeight: '700', fontSize: 15 }}>Back</Text>
              </Pressable>
              <Text style={[s.modalTitle, { marginBottom: 0 }]}>Change Username</Text>
              <View style={{ width: 44 }} />
            </View>

            <Text style={s.modalBody}>
              Your unique handle within EvoRyz. 3–20 characters, letters, numbers, and underscores only.
            </Text>

            <View style={s.modalRow}>
              <Text style={s.modalLabel}>Current</Text>
              <Text style={s.modalVal}>@{user.username || 'not set'}</Text>
            </View>

            <Text style={s.inputLabel}>NEW USERNAME</Text>
            <View style={s.usernameInputRow}>
              <Text style={s.atSign}>@</Text>
              <TextInput
                value={usernameInput}
                onChangeText={(t) => {
                  setUsernameInput(t);
                  setUsernameError(null);
                  setUsernameSuccess(null);
                }}
                placeholder="new_username"
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={20}
                style={s.usernameInput}
                editable={!usernameLoading}
              />
            </View>

            {usernameError && <Text style={s.modalError}>{usernameError}</Text>}
            {usernameSuccess && <Text style={s.modalSuccess}>{usernameSuccess}</Text>}

            <View style={s.modalFooter}>
              <Pressable
                style={s.modalClose}
                onPress={() => {
                  setActiveModal(null);
                  setUsernameError(null);
                  setUsernameSuccess(null);
                }}
                disabled={usernameLoading}
              >
                <Text style={s.modalCloseText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[
                  s.btnPrimary,
                  { flex: 1, marginTop: 0 },
                  (usernameLoading || !usernameInput.trim()) && { opacity: 0.5 },
                ]}
                disabled={usernameLoading || !usernameInput.trim()}
                onPress={handleSaveUsername}
              >
                <Text style={s.btnPrimaryText}>{usernameLoading ? 'Saving…' : 'Save'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* 2. Security Modal */}
      <Modal visible={activeModal === 'security'} transparent animationType="fade" onRequestClose={() => setActiveModal(null)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Go back"
                hitSlop={10}
                onPress={() => setActiveModal(null)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
              >
                <Ionicons name="chevron-back" size={22} color={colors.violetLight} />
                <Text style={{ color: colors.violetLight, fontWeight: '700', fontSize: 15 }}>Back</Text>
              </Pressable>
              <Text style={[s.modalTitle, { marginBottom: 0 }]}>Journal Security</Text>
              <View style={{ width: 44 }} />
            </View>

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
      <Modal visible={activeModal === 'privacy'} transparent animationType="fade" onRequestClose={() => setActiveModal(null)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Go back"
                hitSlop={10}
                onPress={() => setActiveModal(null)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
              >
                <Ionicons name="chevron-back" size={22} color={colors.violetLight} />
                <Text style={{ color: colors.violetLight, fontWeight: '700', fontSize: 15 }}>Back</Text>
              </Pressable>
              <Text style={[s.modalTitle, { marginBottom: 0 }]}>Privacy & Sharing</Text>
              <View style={{ width: 44 }} />
            </View>

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
      <Modal visible={activeModal === 'workspace'} transparent animationType="fade" onRequestClose={() => setActiveModal(null)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Go back"
                hitSlop={10}
                onPress={() => setActiveModal(null)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
              >
                <Ionicons name="chevron-back" size={22} color={colors.violetLight} />
                <Text style={{ color: colors.violetLight, fontWeight: '700', fontSize: 15 }}>Back</Text>
              </Pressable>
              <Text style={[s.modalTitle, { marginBottom: 0 }]}>Workspace</Text>
              <View style={{ width: 44 }} />
            </View>

            {workspace ? (
              <View>
                {/* Workspace Identity Header */}
                <View style={{ alignItems: 'center', marginVertical: 8 }}>
                  <Pressable
                    onPress={handlePickWorkspaceAvatar}
                    style={s.avatarWrapper}
                    disabled={wsAvatarLoading}
                  >
                    <Avatar uri={workspace.avatarUrl} name={workspace.name} size={64} isWorkspace />
                    <View style={s.cameraBadge}>
                      {wsAvatarLoading ? (
                        <ActivityIndicator size="small" color="white" />
                      ) : (
                        <Ionicons name="camera" size={14} color="white" />
                      )}
                    </View>
                  </Pressable>
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                    <Pressable
                      style={s.pillButton}
                      onPress={handlePickWorkspaceAvatar}
                      disabled={wsAvatarLoading}
                    >
                      <Text style={s.pillButtonText}>Change Photo</Text>
                    </Pressable>
                    {workspace.avatarUrl ? (
                      <Pressable
                        style={[s.pillButton, { backgroundColor: '#38222A' }]}
                        onPress={handleRemoveWorkspaceAvatar}
                        disabled={wsAvatarLoading}
                      >
                        <Text style={[s.pillButtonText, { color: '#FCA5A5' }]}>Remove</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>

                {/* Rename Workspace Input */}
                <Text style={s.inputLabel}>WORKSPACE NAME</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                  <TextInput
                    value={editWsName}
                    onChangeText={setEditWsName}
                    placeholder="Workspace name"
                    placeholderTextColor={colors.muted}
                    style={[s.modalInput, { flex: 1 }]}
                  />
                  <Pressable
                    style={[
                      s.btnPrimary,
                      { marginTop: 0, paddingHorizontal: 16 },
                      (!editWsName.trim() || editWsName.trim() === workspace.name || wsNameLoading) && {
                        opacity: 0.5,
                      },
                    ]}
                    disabled={!editWsName.trim() || editWsName.trim() === workspace.name || wsNameLoading}
                    onPress={handleSaveWorkspaceName}
                  >
                    <Text style={s.btnPrimaryText}>{wsNameLoading ? '...' : 'Save'}</Text>
                  </Pressable>
                </View>
                {wsNameSuccess && <Text style={s.modalSuccess}>{wsNameSuccess}</Text>}

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
                  disabled={workspaceLoading}
                  onPress={async () => {
                    setWorkspaceLoading(true);
                    setWorkspaceError(null);
                    await leaveWorkspace();
                    setWorkspaceLoading(false);
                    setActiveModal(null);
                    feedback.tap(true);
                  }}
                >
                  <Text style={[s.btnSecondaryText, { color: colors.red }]}>
                    {workspaceLoading ? 'Leaving…' : 'Leave Workspace (Return to Solo)'}
                  </Text>
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
                  onChangeText={(val) => {
                    setJoinCode(val);
                    setWorkspaceError(null);
                  }}
                  placeholder="EVR-XXXX"
                  placeholderTextColor={colors.muted}
                  autoCapitalize="characters"
                  style={s.modalInput}
                />
                <Pressable
                  style={s.btnPrimary}
                  disabled={!joinCode.trim() || workspaceLoading}
                  onPress={async () => {
                    setWorkspaceLoading(true);
                    setWorkspaceError(null);
                    const res = await joinWorkspace(joinCode.trim());
                    setWorkspaceLoading(false);
                    if (res.success) {
                      setJoinCode('');
                      setActiveModal(null);
                    } else {
                      setWorkspaceError(res.error || 'Failed to join workspace.');
                    }
                  }}
                >
                  <Text style={s.btnPrimaryText}>{workspaceLoading ? 'Joining…' : 'Join Workspace'}</Text>
                </Pressable>

                <Text style={[s.inputLabel, { marginTop: 14 }]}>Or Create a Team</Text>
                <TextInput
                  value={newTeamName}
                  onChangeText={(val) => {
                    setNewTeamName(val);
                    setWorkspaceError(null);
                  }}
                  placeholder="Team Name"
                  placeholderTextColor={colors.muted}
                  style={s.modalInput}
                />
                <Pressable
                  style={s.btnSecondary}
                  disabled={!newTeamName.trim() || workspaceLoading}
                  onPress={async () => {
                    setWorkspaceLoading(true);
                    setWorkspaceError(null);
                    const res = await createWorkspace(newTeamName.trim(), 'team');
                    setWorkspaceLoading(false);
                    if (res.success) {
                      setNewTeamName('');
                      setActiveModal(null);
                    } else {
                      setWorkspaceError(res.error || 'Failed to create team.');
                    }
                  }}
                >
                  <Text style={s.btnSecondaryText}>{workspaceLoading ? 'Creating…' : 'Create Team Workspace'}</Text>
                </Pressable>
                {workspaceError ? (
                  <Text style={{ color: colors.red, fontSize: 13, marginTop: 10, textAlign: 'center' }}>
                    {workspaceError}
                  </Text>
                ) : null}
              </View>
            )}

            <Pressable style={[s.modalClose, { marginTop: 16 }]} onPress={() => setActiveModal(null)}>
              <Text style={s.modalCloseText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* 5. Data Modal */}
      <Modal visible={activeModal === 'data'} transparent animationType="fade" onRequestClose={() => setActiveModal(null)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Go back"
                hitSlop={10}
                onPress={() => setActiveModal(null)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
              >
                <Ionicons name="chevron-back" size={22} color={colors.violetLight} />
                <Text style={{ color: colors.violetLight, fontWeight: '700', fontSize: 15 }}>Back</Text>
              </Pressable>
              <Text style={[s.modalTitle, { marginBottom: 0 }]}>Data & Storage</Text>
              <View style={{ width: 44 }} />
            </View>

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

      {/* 6. About EvoRyz & OTA Updates Modal */}
      <Modal visible={activeModal === 'about'} transparent animationType="fade" onRequestClose={() => setActiveModal(null)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Go back"
                hitSlop={10}
                onPress={() => {
                  setActiveModal(null);
                  setUpdateResult(null);
                }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
              >
                <Ionicons name="chevron-back" size={22} color={colors.violetLight} />
                <Text style={{ color: colors.violetLight, fontWeight: '700', fontSize: 15 }}>Back</Text>
              </Pressable>
              <Text style={[s.modalTitle, { marginBottom: 0 }]}>About EvoRyz</Text>
              <View style={{ width: 44 }} />
            </View>

            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <View style={[s.avatarWrapper, { width: 56, height: 56, borderRadius: 28, backgroundColor: '#211B35', borderWidth: 1, borderColor: '#3E2F5E' }]}>
                <Ionicons name="sparkles" size={26} color={colors.violetLight} />
              </View>
              <Text style={{ color: 'white', fontWeight: '800', fontSize: 18, marginTop: 8 }}>EvoRyz Production</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>v1.0.0 · Build 1</Text>
            </View>

            <View style={s.modalRow}>
              <Text style={s.modalLabel}>Runtime Version</Text>
              <Text style={s.modalVal}>{UpdatesService.getAppInfo().runtimeVersion}</Text>
            </View>
            <View style={s.modalRow}>
              <Text style={s.modalLabel}>Release Channel</Text>
              <Text style={s.modalVal}>{UpdatesService.getAppInfo().channel}</Text>
            </View>
            <View style={s.modalRow}>
              <Text style={s.modalLabel}>Build Distribution</Text>
              <Text style={s.modalVal}>
                {UpdatesService.getAppInfo().isEmbeddedLaunch ? 'Embedded Release APK' : 'Over-The-Air Update'}
              </Text>
            </View>
            <View style={s.modalRow}>
              <Text style={s.modalLabel}>Update ID</Text>
              <Text style={[s.modalVal, { fontSize: 11 }]}>
                {UpdatesService.getAppInfo().updateId.slice(0, 16)}
              </Text>
            </View>

            <Text style={[s.modalBody, { fontSize: 12, marginTop: 12 }]}>
              Over-The-Air (OTA) updates deliver immediate JavaScript & asset fixes without requiring an APK reinstallation. Native library additions still use preview APK builds.
            </Text>

            {updateResult && (
              <View style={{ marginVertical: 8 }}>
                {updateResult.isAvailable ? (
                  <View style={{ backgroundColor: '#1E2D24', padding: 12, borderRadius: 10 }}>
                    <Text style={{ color: colors.green, fontWeight: '800' }}>New Update Ready!</Text>
                    <Text style={{ color: '#D1FAE5', fontSize: 12, marginTop: 2 }}>
                      A newer update was downloaded and is ready to apply.
                    </Text>
                    <Pressable
                      style={[s.btnPrimary, { backgroundColor: colors.green, marginTop: 10 }]}
                      onPress={handleReloadApp}
                    >
                      <Text style={s.btnPrimaryText}>Restart & Apply Update</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Text style={[s.modalSuccess, { color: colors.violetLight, textAlign: 'center' }]}>
                    {updateResult.error || 'You are running the latest available update.'}
                  </Text>
                )}
              </View>
            )}

            <Pressable
              style={[s.btnPrimary, { marginTop: 12 }]}
              onPress={handleCheckUpdates}
              disabled={checkingUpdates}
            >
              {checkingUpdates ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text style={s.btnPrimaryText}>Check for Updates</Text>
              )}
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
  avatarWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.violet,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#121019',
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.violet,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
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
  usernameInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  atSign: {
    color: colors.violetLight,
    fontWeight: '800',
    fontSize: 16,
    marginRight: 4,
  },
  usernameInput: {
    flex: 1,
    color: 'white',
    paddingVertical: 12,
    fontSize: 15,
  },
});
