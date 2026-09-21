/* eslint-disable react-hooks/refs */
import { useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import {
  Animated,
  AppState,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useApp } from '@/src/store/AppContext';
import { voicePlayback } from '@/src/services/audioPlayback';
import { feedback } from '@/src/services/feedback';
import { colors } from '@/src/theme';
import type { Message } from '@/src/types';
import { EvoRyzAIService, ChatMessageContext } from '@/src/services/evoryzAI';

const emojis = ['✨', '🔥', '👏', '💪', '🎉', '❤️'];
const formatTime = (seconds = 0) =>
  `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`;
const formatSize = (size?: number) =>
  !size
    ? 'Local file'
    : size < 1024 * 1024
    ? `${Math.round(size / 1024)} KB`
    : `${(size / 1024 / 1024).toFixed(1)} MB`;

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: 'workspace' | 'journal' | 'ai' }>();

  if (id === 'journal') {
    return <JournalComponent />;
  }

  if (id === 'ai') {
    return <AiMentorComponent />;
  }

  return <WorkspaceChatComponent />;
}

// ==============================================================================
// 1. SECURE ENCRYPTED JOURNAL COMPONENT
// ==============================================================================
function JournalComponent() {
  const {
    journalSecurity,
    isJournalUnlocked,
    decryptedJournalEntries,
    unlockJournal,
    lockJournal,
    setupJournalPin,
    resetJournalPin,
    addJournalEntry,
    deleteJournalEntry,
    user,
  } = useApp();

  const [pinInput, setPinInput] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [setupStep, setSetupStep] = useState<'create' | 'confirm'>('create');
  const [entryText, setEntryText] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetModalVisible, setResetModalVisible] = useState(false);
  const [newResetPin, setNewResetPin] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  // Lock journal whenever app transitions to background or unmounts
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState.match(/inactive|background/)) {
        lockJournal();
      }
    });

    return () => {
      lockJournal();
      subscription.remove();
    };
  }, [lockJournal]);

  // Handle PIN unlock
  const handleUnlock = async () => {
    if (pinInput.length < 4) {
      setPinError('PIN must be 4 digits.');
      return;
    }
    setLoading(true);
    setPinError(null);

    const res = await unlockJournal(pinInput);
    setLoading(false);
    setPinInput('');

    if (!res.success) {
      setPinError(res.error || 'Incorrect PIN.');
      feedback.error(true);
    } else {
      feedback.success(true);
    }
  };

  // Handle first-time PIN Setup
  const handleSetupPin = async () => {
    if (setupStep === 'create') {
      if (pinInput.length < 4) {
        setPinError('Please enter a 4-digit PIN.');
        return;
      }
      setConfirmPin(pinInput);
      setPinInput('');
      setSetupStep('confirm');
      setPinError(null);
      feedback.tap(true);
      return;
    }

    if (pinInput !== confirmPin) {
      setPinError('PINs do not match. Please try again.');
      setPinInput('');
      setConfirmPin('');
      setSetupStep('create');
      feedback.error(true);
      return;
    }

    setLoading(true);
    await setupJournalPin(pinInput);
    setLoading(false);
    setPinInput('');
    setConfirmPin('');
    feedback.success(true);
  };

  // Handle Account Reset
  const handleAccountReset = async () => {
    if (newResetPin.length < 4) {
      setPinError('New PIN must be 4 digits.');
      return;
    }
    setLoading(true);
    await resetJournalPin(newResetPin);
    setLoading(false);
    setResetModalVisible(false);
    setNewResetPin('');
    feedback.success(true);
  };

  // Handle Entry Save
  const handleSaveEntry = async () => {
    if (!entryText.trim()) return;
    setLoading(true);
    await addJournalEntry(entryText.trim());
    setEntryText('');
    setLoading(false);
    feedback.tap(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const copyEntry = async (text: string) => {
    feedback.tap(true);
    await Share.share({ message: text });
  };

  // IF LOCKED: Show PIN lock screen
  if (!isJournalUnlocked) {
    const isFirstTime = !journalSecurity;

    return (
      <View style={s.lockRoot}>
        <View style={s.lockHeader}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={s.backBtn}>
            <Ionicons name="chevron-back" size={26} color="white" />
            <Text style={s.backText}>Back</Text>
          </Pressable>
        </View>

        <View style={s.lockBody}>
          <View style={s.lockIconWrapper}>
            <Ionicons name="lock-closed" size={38} color={colors.violetLight} />
          </View>

          <Text style={s.lockTitle}>
            {isFirstTime
              ? setupStep === 'create'
                ? 'Create Journal PIN'
                : 'Confirm Journal PIN'
              : 'Journal Locked'}
          </Text>
          <Text style={s.lockSub}>
            {isFirstTime
              ? 'Protect your personal reflections with zero-knowledge AES-256 encryption.'
              : 'Enter your 4-digit PIN to decrypt your private thoughts.'}
          </Text>

          {/* PIN Digit Indicators */}
          <View style={s.pinDotsRow}>
            {[0, 1, 2, 3].map((idx) => (
              <View
                key={idx}
                style={[
                  s.pinDot,
                  pinInput.length > idx && s.pinDotFilled,
                  Boolean(pinError) && s.pinDotError,
                ]}
              />
            ))}
          </View>

          {pinError ? <Text style={s.pinErrorText}>{pinError}</Text> : null}

          {/* Numeric Keypad */}
          <View style={s.keypad}>
            {[
              ['1', '2', '3'],
              ['4', '5', '6'],
              ['7', '8', '9'],
              ['clear', '0', 'delete'],
            ].map((row, rIdx) => (
              <View key={rIdx} style={s.keypadRow}>
                {row.map((btn) => (
                  <Pressable
                    key={btn}
                    onPress={() => {
                      feedback.tap(true);
                      setPinError(null);
                      if (btn === 'clear') {
                        setPinInput('');
                      } else if (btn === 'delete') {
                        setPinInput((p) => p.slice(0, -1));
                      } else if (pinInput.length < 4) {
                        setPinInput((p) => p + btn);
                      }
                    }}
                    style={s.keypadBtn}
                    accessibilityLabel={btn}
                  >
                    {btn === 'clear' ? (
                      <Text style={s.keypadSpecial}>C</Text>
                    ) : btn === 'delete' ? (
                      <Ionicons name="backspace-outline" size={22} color="white" />
                    ) : (
                      <Text style={s.keypadDigit}>{btn}</Text>
                    )}
                  </Pressable>
                ))}
              </View>
            ))}
          </View>

          {/* Unlock / Set Button */}
          <Pressable
            disabled={pinInput.length < 4 || loading}
            onPress={isFirstTime ? handleSetupPin : handleUnlock}
            style={[s.unlockBtn, (pinInput.length < 4 || loading) && s.unlockBtnDisabled]}
          >
            <Text style={s.unlockBtnText}>
              {loading ? 'Decrypting…' : isFirstTime ? (setupStep === 'create' ? 'Next' : 'Save PIN') : 'Unlock Journal'}
            </Text>
          </Pressable>

          {!isFirstTime && (
            <Pressable
              onPress={() => setResetModalVisible(true)}
              style={s.resetLink}
            >
              <Text style={s.resetLinkText}>Forgot PIN? Reset with account</Text>
            </Pressable>
          )}
        </View>

        {/* PIN Reset Modal via Google Account Verification */}
        <Modal
          visible={resetModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setResetModalVisible(false)}
        >
          <View style={s.modalOverlay}>
            <View style={s.modalSheet}>
              <Text style={s.modalTitle}>Reset Journal PIN</Text>
              <Text style={s.modalBody}>
                Authenticated as: <Text style={{ color: 'white', fontWeight: '700' }}>{user.email || user.name}</Text>
                {'\n\n'}
                Zero-knowledge notice: Resetting your PIN updates your cryptographic key. Past entries encrypted with the previous PIN will be protected and archived.
              </Text>

              <TextInput
                value={newResetPin}
                onChangeText={setNewResetPin}
                placeholder="New 4-digit PIN"
                placeholderTextColor={colors.muted}
                keyboardType="number-pad"
                maxLength={4}
                secureTextEntry
                style={s.modalInput}
              />

              <View style={s.modalActions}>
                <Pressable
                  style={s.modalCancel}
                  onPress={() => {
                    setResetModalVisible(false);
                    setNewResetPin('');
                  }}
                >
                  <Text style={s.modalCancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[s.modalConfirm, newResetPin.length < 4 && { opacity: 0.5 }]}
                  disabled={newResetPin.length < 4 || loading}
                  onPress={handleAccountReset}
                >
                  <Text style={s.modalConfirmText}>Confirm Reset</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // IF UNLOCKED: Show Journal Entries with 2 AM day grouping & composer
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 12}
      style={s.root}
    >
      <View style={s.header}>
        <Pressable hitSlop={10} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={27} color="white" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>🔒 My Journal</Text>
          <Text style={s.sub}>Zero-knowledge AES-256 · Locked on background</Text>
        </View>
        <Pressable
          onPress={() => {
            feedback.tap(true);
            lockJournal();
          }}
          style={s.quickLock}
          accessibilityLabel="Lock Journal"
        >
          <Ionicons name="lock-closed" size={18} color={colors.violetLight} />
          <Text style={s.quickLockText}>Lock</Text>
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        style={s.list}
        contentContainerStyle={s.journalContent}
        keyboardShouldPersistTaps="handled"
      >
        {decryptedJournalEntries.length === 0 ? (
          <View style={s.emptyJournal}>
            <Ionicons name="book-outline" size={48} color={colors.muted} />
            <Text style={s.emptyJournalTitle}>Your reflections are safe.</Text>
            <Text style={s.emptyJournalSub}>
              Zero fake demo entries. Write your thoughts below — each entry is encrypted with your PIN-derived key before saving.
            </Text>
          </View>
        ) : (
          decryptedJournalEntries.map((entry) => (
            <View key={entry.id} style={s.entryCard}>
              <View style={s.entryHeader}>
                <View style={s.dayBadge}>
                  <Text style={s.dayBadgeText}>EvoRyz Day {entry.date}</Text>
                </View>
                <Text style={s.entryTime}>
                  {new Date(entry.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>

              <Text style={s.entryText}>{entry.plaintext}</Text>

              <View style={s.entryActions}>
                <Pressable
                  onPress={() => copyEntry(entry.plaintext)}
                  style={s.entryActionBtn}
                  hitSlop={6}
                >
                  <Ionicons name="copy-outline" size={16} color={colors.muted} />
                  <Text style={s.entryActionText}>Copy</Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    feedback.tap(true);
                    deleteJournalEntry(entry.id);
                  }}
                  style={s.entryActionBtn}
                  hitSlop={6}
                >
                  <Ionicons name="trash-outline" size={16} color={colors.red} />
                  <Text style={[s.entryActionText, { color: colors.red }]}>Delete</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Keyboard-aware entry composer */}
      <View style={s.composer}>
        <TextInput
          value={entryText}
          onChangeText={setEntryText}
          placeholder="Reflect privately… (EvoRyz 2 AM day)"
          placeholderTextColor={colors.muted}
          style={s.input}
          multiline
        />
        <Pressable
          disabled={!entryText.trim() || loading}
          onPress={handleSaveEntry}
          style={[s.send, (!entryText.trim() || loading) && s.sendMuted]}
          accessibilityLabel="Save entry"
        >
          <Ionicons name="arrow-up" color="white" size={20} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

// ==============================================================================
// 2. REAL WORKSPACE CHAT COMPONENT
// ==============================================================================
function WorkspaceChatComponent() {
  const { messages, sendMessage, workspace, user } = useApp();
  const [text, setText] = useState('');
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [viewer, setViewer] = useState<Message | null>(null);
  const scroll = useRef<ScrollView>(null);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 200);

  const send = () => {
    if (text.trim()) {
      sendMessage(text.trim(), 'workspace');
      setText('');
      setEmojiOpen(false);
    }
  };

  const attachMedia = async (kind: 'image' | 'video') => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: kind === 'image' ? ['images'] : ['videos'],
      quality: 0.85,
      videoMaxDuration: 120,
    });
    if (!result.canceled && result.assets[0]) {
      const a = result.assets[0];
      sendMessage(kind === 'image' ? 'Photo' : 'Video', 'workspace', kind, {
        uri: a.uri,
        attachmentName: a.fileName ?? `${kind}.${kind === 'image' ? 'jpg' : 'mp4'}`,
        mimeType: a.mimeType ?? undefined,
        width: a.width,
        height: a.height,
        duration: a.duration ? a.duration / 1000 : undefined,
      });
    }
  };

  const attachFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (!result.canceled && result.assets[0]) {
      const a = result.assets[0];
      sendMessage(a.name, 'workspace', 'file', {
        uri: a.uri,
        attachmentName: a.name,
        mimeType: a.mimeType ?? undefined,
        size: a.size,
      });
    }
  };

  const toggleVoice = async () => {
    try {
      if (recorderState.isRecording) {
        await recorder.stop();
        const uri = recorder.uri;
        if (uri) {
          sendMessage('Voice note', 'workspace', 'voice', {
            uri,
            duration: recorderState.durationMillis / 1000,
            attachmentName: 'voice-note.m4a',
            mimeType: 'audio/m4a',
          });
        }
        return;
      }
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) return;
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      feedback.impact(user.settings.preferences.haptics);
    } catch {
      feedback.success(user.settings.preferences.haptics);
    }
  };

  const title =
    workspace?.mode === 'duo'
      ? 'Duo Workspace Chat'
      : workspace?.name
      ? `${workspace.name} Chat`
      : 'Workspace Chat';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 12}
      style={s.root}
    >
      <View style={s.header}>
        <Pressable hitSlop={10} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={27} color="white" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{title}</Text>
          <Text style={s.sub}>
            {workspace
              ? `${workspace.members.length} members · Live Supabase Realtime`
              : 'Connect Duo or Team to sync shared chat'}
          </Text>
        </View>
      </View>

      <ScrollView
        ref={scroll}
        style={s.list}
        contentContainerStyle={s.messages}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
      >
        {messages.length === 0 ? (
          <View style={s.emptyChat}>
            <Ionicons name="chatbubbles-outline" size={44} color={colors.muted} />
            <Text style={s.emptyChatTitle}>No messages yet</Text>
            <Text style={s.emptyChatSub}>
              Messages sent here are backed by Supabase and update across connected devices in realtime.
            </Text>
          </View>
        ) : (
          messages.map((m, index) => (
            <MessageBubble
              key={m.id}
              message={m}
              mine={m.senderId === user.id || m.senderId === 'me'}
              showMeta={true}
              delay={Math.min(index * 20, 150)}
              onOpen={setViewer}
            />
          ))
        )}
      </ScrollView>

      {emojiOpen && (
        <View style={s.emojiRow}>
          {emojis.map((emoji) => (
            <Pressable
              key={emoji}
              style={s.emoji}
              onPress={() => setText((val) => `${val}${emoji}`)}
            >
              <Text style={s.emojiText}>{emoji}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <View style={s.tools}>
        <Tool icon="image" label="Add photo" onPress={() => void attachMedia('image')} />
        <Tool icon="videocam" label="Add video" onPress={() => void attachMedia('video')} />
        <Tool icon="attach" label="Attach file" onPress={() => void attachFile()} />
        <Tool
          icon={recorderState.isRecording ? 'stop-circle' : 'mic'}
          label={
            recorderState.isRecording
              ? `Stop recording ${formatTime(recorderState.durationMillis / 1000)}`
              : 'Record voice note'
          }
          active={recorderState.isRecording}
          onPress={() => void toggleVoice()}
        />
        <Tool
          icon="happy"
          label="Add emoji"
          active={emojiOpen}
          onPress={() => setEmojiOpen((val) => !val)}
        />
      </View>

      <View style={s.composer}>
        <TextInput
          value={text}
          onChangeText={setText}
          onFocus={() => setEmojiOpen(false)}
          placeholder="Message workspace…"
          placeholderTextColor={colors.muted}
          style={s.input}
          multiline
        />
        <SendButton disabled={!text.trim()} onPress={send} />
      </View>

      <MediaViewer message={viewer} onClose={() => setViewer(null)} />
    </KeyboardAvoidingView>
  );
}

// ==============================================================================
// 3. REAL EVO RYZ AI MENTOR COMPONENT
// ==============================================================================
function AiMentorComponent() {
  const [aiHistory, setAiHistory] = useState<{ role: 'user' | 'model'; content: string }[]>([
    {
      role: 'model',
      content: "Hello! I am your EvoRyz AI Growth Mentor. How can I assist you with your focus, tasks, or habits today?",
    },
  ]);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const askAi = async () => {
    if (!prompt.trim() || loading) return;
    const userPrompt = prompt.trim();
    setPrompt('');
    setAiHistory((prev) => [...prev, { role: 'user', content: userPrompt }]);
    setLoading(true);

    const historyPayload: ChatMessageContext[] = aiHistory.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const result = await EvoRyzAIService.ask(userPrompt, historyPayload);
    setLoading(false);

    setAiHistory((prev) => [
      ...prev,
      { role: 'model', content: result.text },
    ]);

    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={s.root}
    >
      <View style={s.header}>
        <Pressable hitSlop={10} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={27} color="white" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>🤖 EvoRyz AI Mentor</Text>
          <Text style={s.sub}>Edge Function backend · Secure key ownership</Text>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={s.list}
        contentContainerStyle={s.messages}
        keyboardShouldPersistTaps="handled"
      >
        {aiHistory.map((msg, idx) => (
          <View
            key={idx}
            style={[
              s.bubble,
              msg.role === 'user' ? s.mine : s.theirs,
              msg.role === 'model' && { borderColor: colors.border, borderWidth: 1 },
            ]}
          >
            <Text style={s.message}>{msg.content}</Text>
          </View>
        ))}
        {loading && (
          <View style={[s.bubble, s.theirs]}>
            <Text style={[s.message, { fontStyle: 'italic', color: colors.muted }]}>
              EvoRyz AI is thinking…
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={s.composer}>
        <TextInput
          value={prompt}
          onChangeText={setPrompt}
          placeholder="Ask EvoRyz AI for guidance…"
          placeholderTextColor={colors.muted}
          style={s.input}
          multiline
        />
        <SendButton disabled={!prompt.trim() || loading} onPress={askAi} />
      </View>
    </KeyboardAvoidingView>
  );
}

// ------------------------------------------------------------------------------
// Helper Message UI Subcomponents
// ------------------------------------------------------------------------------
function Tool({
  icon,
  label,
  active,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityLabel={label} hitSlop={7} onPress={onPress}>
      <Ionicons name={icon} color={active ? colors.violetLight : colors.muted} size={21} />
    </Pressable>
  );
}

function SendButton({ disabled, onPress }: { disabled: boolean; onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Pressable
      accessibilityLabel="Send message"
      disabled={disabled}
      onPress={() => {
        Animated.sequence([
          Animated.timing(scale, { toValue: 0.88, duration: 70, useNativeDriver: true }),
          Animated.spring(scale, { toValue: 1, useNativeDriver: true }),
        ]).start();
        onPress();
      }}
    >
      <Animated.View style={[s.send, disabled && s.sendMuted, { transform: [{ scale }] }]}>
        <Ionicons name="send" color="white" size={19} />
      </Animated.View>
    </Pressable>
  );
}

function MessageBubble({
  message,
  mine,
  showMeta,
  delay,
  onOpen,
}: {
  message: Message;
  mine: boolean;
  showMeta: boolean;
  delay: number;
  onOpen: (m: Message) => void;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translate = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 200, delay, useNativeDriver: true }),
      Animated.spring(translate, {
        toValue: 0,
        delay,
        damping: 18,
        stiffness: 210,
        useNativeDriver: true,
      }),
    ]).start();
  }, [delay, opacity, translate]);

  return (
    <Animated.View
      style={[
        s.bubble,
        mine ? s.mine : s.theirs,
        { opacity, transform: [{ translateY: translate }] },
      ]}
    >
      {!mine && message.senderName ? (
        <Text style={s.senderLabel}>{message.senderName}</Text>
      ) : null}

      {message.type === 'image' ? (
        <ImageMessage message={message} onOpen={onOpen} />
      ) : message.type === 'video' ? (
        <VideoMessage message={message} onOpen={onOpen} />
      ) : message.type === 'voice' ? (
        <VoiceMessage message={message} />
      ) : message.type === 'file' ? (
        <FileMessage message={message} />
      ) : (
        <Text style={s.message}>{message.content}</Text>
      )}

      <Text style={s.meta}>
        {new Date(message.timestamp).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })}
        {showMeta && mine ? ' · ✓✓' : ''}
      </Text>
    </Animated.View>
  );
}

function ImageMessage({ message, onOpen }: { message: Message; onOpen: (m: Message) => void }) {
  const [failed, setFailed] = useState(false);
  if (!message.uri || failed)
    return (
      <View style={s.mediaFallback}>
        <Ionicons name="image-outline" size={28} color="#ded8ea" />
        <Text style={s.fallbackText}>Image unavailable</Text>
      </View>
    );
  return (
    <Pressable onPress={() => onOpen(message)}>
      <Image
        source={{ uri: message.uri }}
        onError={() => setFailed(true)}
        style={[
          s.image,
          message.width && message.height ? { aspectRatio: message.width / message.height } : undefined,
        ]}
        resizeMode="cover"
        accessibilityLabel="Open image"
      />
    </Pressable>
  );
}

function VideoMessage({ message, onOpen }: { message: Message; onOpen: (m: Message) => void }) {
  return (
    <Pressable style={s.videoPreview} onPress={() => onOpen(message)} accessibilityLabel="Play video">
      <Ionicons name="videocam" size={30} color="white" />
      <View style={s.play}>
        <Ionicons name="play" size={21} color={colors.bg} />
      </View>
      <Text style={s.videoLabel}>{formatTime(message.duration)} · Tap to play</Text>
    </Pressable>
  );
}

function FileMessage({ message }: { message: Message }) {
  const open = async () => {
    if (message.uri && (await Sharing.isAvailableAsync()))
      await Sharing.shareAsync(message.uri, {
        mimeType: message.mimeType,
        dialogTitle: message.attachmentName ?? 'Open attachment',
      });
  };
  return (
    <Pressable style={s.file} onPress={() => void open()}>
      <Ionicons name="document-text" color={colors.violetLight} size={28} />
      <View style={{ flex: 1 }}>
        <Text style={s.fileName} numberOfLines={1}>
          {message.attachmentName ?? message.content}
        </Text>
        <Text style={s.fileMeta}>
          {message.mimeType?.split('/').at(-1)?.toUpperCase() ?? 'FILE'} ·{' '}
          {formatSize(message.size)}
        </Text>
      </View>
      <Ionicons name="share-outline" color="#e4dcff" size={18} />
    </Pressable>
  );
}

function VoiceMessage({ message }: { message: Message }) {
  const player = useAudioPlayer(message.uri ?? null, { updateInterval: 160 });
  const status = useAudioPlayerStatus(player);
  const duration = message.duration ?? status.duration ?? 0;
  const progress = duration ? Math.min(1, status.currentTime / duration) : 0;

  useEffect(() => () => voicePlayback.clear(message.id), [message.id]);

  const toggle = () => {
    if (status.playing) {
      player.pause();
      voicePlayback.clear(message.id);
    } else {
      voicePlayback.activate(message.id, () => player.pause());
      player.play();
    }
  };

  return (
    <View style={s.voice}>
      <Pressable style={s.voicePlay} onPress={toggle}>
        <Ionicons name={status.playing ? 'pause' : 'play'} size={19} color={colors.bg} />
      </Pressable>
      <View style={s.wave}>
        {Array.from({ length: 18 }, (_, i) => (
          <View
            key={i}
            style={[
              s.bar,
              {
                height: 7 + ((i * 11) % 18),
                backgroundColor: i / 18 <= progress ? '#fff' : '#d1c6ff88',
              },
            ]}
          />
        ))}
      </View>
      <Text style={s.voiceTime}>{formatTime(status.currentTime || duration)}</Text>
    </View>
  );
}

function MediaViewer({ message, onClose }: { message: Message | null; onClose: () => void }) {
  return (
    <Modal visible={Boolean(message)} transparent animationType="fade" onRequestClose={onClose}>
      {message && (
        <View style={s.viewer}>
          <Pressable style={s.close} onPress={onClose}>
            <Ionicons name="close" size={28} color="white" />
          </Pressable>
          {message.type === 'video' ? (
            <VideoPlayer uri={message.uri} />
          ) : (
            <Image source={{ uri: message.uri }} style={s.fullImage} resizeMode="contain" />
          )}
        </View>
      )}
    </Modal>
  );
}

function VideoPlayer({ uri }: { uri?: string }) {
  const player = useVideoPlayer(uri ?? null, (p) => {
    p.loop = false;
  });
  return <VideoView style={s.fullVideo} player={player} nativeControls contentFit="contain" />;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingTop: 55,
    paddingHorizontal: 18,
    paddingBottom: 15,
    flexDirection: 'row',
    gap: 13,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  title: { color: 'white', fontWeight: '800', fontSize: 17 },
  sub: { color: colors.muted, fontSize: 11, marginTop: 3 },
  quickLock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#262038',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  quickLockText: { color: colors.violetLight, fontWeight: '700', fontSize: 12 },
  list: { flex: 1 },
  messages: { padding: 16, gap: 9, flexGrow: 1 },
  journalContent: { padding: 16, gap: 12, flexGrow: 1 },
  bubble: { maxWidth: '84%', padding: 12, borderRadius: 16 },
  mine: { backgroundColor: colors.violet, alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  theirs: { backgroundColor: colors.surface2, alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  senderLabel: { color: colors.violetLight, fontSize: 11, fontWeight: '700', marginBottom: 3 },
  message: { color: 'white', fontSize: 15, lineHeight: 21 },
  meta: { color: '#d8d0ff', fontSize: 10, marginTop: 5 },
  emptyChat: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 80,
    paddingHorizontal: 30,
  },
  emptyChatTitle: { color: 'white', fontWeight: '800', fontSize: 18, marginTop: 12 },
  emptyChatSub: { color: colors.muted, fontSize: 13, textAlign: 'center', marginTop: 6, lineHeight: 18 },
  emptyJournal: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 80,
    paddingHorizontal: 30,
  },
  emptyJournalTitle: { color: 'white', fontWeight: '800', fontSize: 18, marginTop: 12 },
  emptyJournalSub: { color: colors.muted, fontSize: 13, textAlign: 'center', marginTop: 6, lineHeight: 19 },
  entryCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  dayBadge: {
    backgroundColor: '#262038',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  dayBadgeText: { color: colors.violetLight, fontSize: 11, fontWeight: '800' },
  entryTime: { color: colors.muted, fontSize: 11 },
  entryText: { color: 'white', fontSize: 15, lineHeight: 23 },
  entryActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#252136',
    paddingTop: 10,
  },
  entryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  entryActionText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  image: { width: 238, maxHeight: 310, borderRadius: 12, backgroundColor: '#282331' },
  mediaFallback: {
    width: 220,
    height: 145,
    borderRadius: 12,
    backgroundColor: '#292534',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  fallbackText: { color: '#ded8ea', fontSize: 12 },
  videoPreview: {
    width: 238,
    height: 150,
    borderRadius: 12,
    backgroundColor: '#242033',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  play: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  videoLabel: { color: '#e5dfff', fontSize: 11, position: 'absolute', bottom: 10 },
  file: {
    minWidth: 225,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#ffffff12',
    padding: 10,
    borderRadius: 12,
  },
  fileName: { color: 'white', fontWeight: '700', fontSize: 13 },
  fileMeta: { color: '#ded8ea', fontSize: 10, marginTop: 3 },
  voice: { minWidth: 235, flexDirection: 'row', alignItems: 'center', gap: 9 },
  voicePlay: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wave: { flex: 1, height: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bar: { width: 3, borderRadius: 3 },
  voiceTime: { color: '#e5dfff', fontSize: 10, width: 30 },
  tools: { flexDirection: 'row', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 3, gap: 20 },
  emojiRow: { flexDirection: 'row', paddingHorizontal: 14, paddingTop: 8, gap: 5 },
  emoji: { backgroundColor: colors.surface2, borderRadius: 16, padding: 7 },
  emojiText: { fontSize: 18 },
  composer: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 28 : 14,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    backgroundColor: colors.surface2,
    borderRadius: 20,
    color: 'white',
    paddingHorizontal: 15,
    paddingVertical: 10,
    maxHeight: 100,
    fontSize: 15,
  },
  send: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.violet,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendMuted: { opacity: 0.48 },
  viewer: { flex: 1, backgroundColor: '#050507', justifyContent: 'center', alignItems: 'center' },
  close: {
    position: 'absolute',
    top: 52,
    right: 18,
    zIndex: 2,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#ffffff24',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullImage: { width: '100%', height: '86%' },
  fullVideo: { width: '100%', height: '75%' },

  // Lock Screen Styles
  lockRoot: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 24 },
  lockHeader: { paddingTop: 52, paddingBottom: 16 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: { color: 'white', fontSize: 16, fontWeight: '600' },
  lockBody: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 30 },
  lockIconWrapper: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#241D3B',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  lockTitle: { color: 'white', fontSize: 24, fontWeight: '800', marginBottom: 8 },
  lockSub: { color: colors.muted, fontSize: 13, textAlign: 'center', maxWidth: 280, lineHeight: 19, marginBottom: 24 },
  pinDotsRow: { flexDirection: 'row', gap: 18, marginBottom: 18 },
  pinDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: colors.border },
  pinDotFilled: { backgroundColor: colors.violetLight, borderColor: colors.violetLight },
  pinDotError: { borderColor: colors.red, backgroundColor: colors.red },
  pinErrorText: { color: colors.red, fontSize: 13, fontWeight: '700', marginBottom: 12, textAlign: 'center' },
  keypad: { width: 270, gap: 14, marginVertical: 14 },
  keypadRow: { flexDirection: 'row', justifyContent: 'space-between' },
  keypadBtn: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keypadDigit: { color: 'white', fontSize: 24, fontWeight: '700' },
  keypadSpecial: { color: colors.muted, fontSize: 18, fontWeight: '700' },
  unlockBtn: {
    backgroundColor: colors.violet,
    width: '100%',
    maxWidth: 270,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  unlockBtnDisabled: { opacity: 0.5 },
  unlockBtnText: { color: 'white', fontWeight: '800', fontSize: 16 },
  resetLink: { marginTop: 18 },
  resetLinkText: { color: colors.violetLight, fontSize: 13, fontWeight: '700' },
  modalOverlay: {
    flex: 1,
    backgroundColor: '#000000cc',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: { color: 'white', fontSize: 19, fontWeight: '800', marginBottom: 10 },
  modalBody: { color: colors.muted, fontSize: 13, lineHeight: 19, marginBottom: 16 },
  modalInput: {
    backgroundColor: colors.surface2,
    color: 'white',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    textAlign: 'center',
    letterSpacing: 4,
    marginBottom: 18,
  },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalCancel: { flex: 1, padding: 14, borderRadius: 10, alignItems: 'center', backgroundColor: colors.surface2 },
  modalCancelText: { color: colors.muted, fontWeight: '700' },
  modalConfirm: { flex: 1, padding: 14, borderRadius: 10, alignItems: 'center', backgroundColor: colors.violet },
  modalConfirmText: { color: 'white', fontWeight: '800' },
});
