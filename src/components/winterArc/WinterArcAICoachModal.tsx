import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/src/theme';
import {
  WinterArc,
  WinterArcRule,
  WinterArcDay,
  WinterArcMilestone,
} from '@/src/types/winterArc';
import { WinterArcAIService } from '@/src/services/winterArcAI';
import { ChatMessageContext } from '@/src/services/evoryzAI';
import { feedback } from '@/src/services/feedback';

interface WinterArcAICoachModalProps {
  visible: boolean;
  onClose: () => void;
  arc: WinterArc;
  rules: WinterArcRule[];
  recentDays: WinterArcDay[];
  milestones: WinterArcMilestone[];
}

export function WinterArcAICoachModal({
  visible,
  onClose,
  arc,
  rules,
  recentDays,
  milestones,
}: WinterArcAICoachModalProps) {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'model'; text: string }[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSendPrompt = async (overridePrompt?: string) => {
    const textToSend = overridePrompt || query.trim();
    if (!textToSend || loading) return;

    feedback.tap(true);
    const newMsg = { role: 'user' as const, text: textToSend };
    const updatedHistory = [...messages, newMsg];
    setMessages(updatedHistory);
    if (!overridePrompt) setQuery('');
    setLoading(true);

    try {
      const historyContext: ChatMessageContext[] = updatedHistory.map((m) => ({
        role: m.role,
        content: m.text,
      }));

      const res = await WinterArcAIService.getCoachingInsight({
        arc,
        rules,
        recentDays,
        milestones,
        userQuery: textToSend,
        conversationHistory: historyContext,
      });

      setMessages((prev) => [
        ...prev,
        { role: 'model', text: res.text || 'Stay locked in. Keep executing your daily habits.' },
      ]);
      feedback.sound('messageReceived', true);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'model', text: 'EvoRyz AI is temporarily unavailable. Stay disciplined and keep executing.' },
      ]);
      feedback.error(true);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickInsight = () => {
    handleSendPrompt('Give me a strategic tactical review of my Winter Arc performance so far, pointing out weak points and today’s top focus.');
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={styles.coachIconCircle}>
                <Ionicons name="sparkles" size={18} color="#00F5D4" />
              </View>
              <View>
                <Text style={styles.title}>Winter Arc AI Coach</Text>
                <Text style={styles.sub}>Stoic Tactical Performance Mentor</Text>
              </View>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={colors.muted} />
            </Pressable>
          </View>

          {/* Chat Messages */}
          <ScrollView
            style={styles.messagesList}
            contentContainerStyle={styles.messagesScroll}
            showsVerticalScrollIndicator={false}
          >
            {messages.length === 0 && (
              <View style={styles.welcomeBox}>
                <Ionicons name="snow" size={36} color="#00F5D4" />
                <Text style={styles.welcomeTitle}>Welcome to the Frost, Warrior.</Text>
                <Text style={styles.welcomeSub}>
                  I have full context on your {arc.currentStreak}-day streak, {arc.overallScore}% score, and active rules. Ask me for tactical adjustments, discipline checks, or habit strategies.
                </Text>

                <Pressable style={styles.quickPromptBtn} onPress={handleQuickInsight}>
                  <Ionicons name="flash" size={14} color="#07060B" />
                  <Text style={styles.quickPromptText}>Generate Tactical Review</Text>
                </Pressable>
              </View>
            )}

            {messages.map((m, idx) => (
              <View
                key={idx}
                style={[
                  styles.messageBubble,
                  m.role === 'user' ? styles.userBubble : styles.modelBubble,
                ]}
              >
                <Text
                  style={[
                    styles.messageText,
                    m.role === 'user' ? styles.userMessageText : styles.modelMessageText,
                  ]}
                >
                  {m.text}
                </Text>
              </View>
            ))}

            {loading && (
              <View style={[styles.messageBubble, styles.modelBubble, { flexDirection: 'row', gap: 8, alignItems: 'center' }]}>
                <ActivityIndicator size="small" color="#00F5D4" />
                <Text style={{ color: colors.muted, fontSize: 13 }}>Analyzing metrics...</Text>
              </View>
            )}
          </ScrollView>

          {/* Input Box */}
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.textInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Ask your AI coach..."
              placeholderTextColor={colors.muted}
              multiline
            />
            <Pressable
              style={[styles.sendBtn, (!query.trim() || loading) && { opacity: 0.5 }]}
              onPress={() => handleSendPrompt()}
              disabled={!query.trim() || loading}
            >
              <Ionicons name="arrow-up" size={18} color="#07060B" />
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  content: {
    backgroundColor: '#0F0D17',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderColor: '#29233D',
    borderTopWidth: 1,
    height: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 18,
    borderBottomColor: '#1E192E',
    borderBottomWidth: 1,
  },
  coachIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#142928',
    borderColor: '#00F5D4',
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '900',
    color: 'white',
  },
  sub: {
    fontSize: 11,
    color: colors.muted,
  },
  closeBtn: {
    padding: 6,
  },
  messagesList: {
    flex: 1,
  },
  messagesScroll: {
    padding: 18,
    gap: 12,
  },
  welcomeBox: {
    backgroundColor: '#141122',
    borderColor: '#26203D',
    borderWidth: 1,
    borderRadius: 18,
    padding: 22,
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
  welcomeTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: 'white',
  },
  welcomeSub: {
    fontSize: 12,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 18,
  },
  quickPromptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#00F5D4',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginTop: 8,
  },
  quickPromptText: {
    color: '#07060B',
    fontSize: 12,
    fontWeight: '800',
  },
  messageBubble: {
    maxWidth: '85%',
    padding: 14,
    borderRadius: 16,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#7357F6',
    borderBottomRightRadius: 4,
  },
  modelBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#181526',
    borderColor: '#29223D',
    borderWidth: 1,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 13,
    lineHeight: 19,
  },
  userMessageText: {
    color: 'white',
    fontWeight: '600',
  },
  modelMessageText: {
    color: '#E3E0F2',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderTopColor: '#1E192E',
    borderTopWidth: 1,
    gap: 10,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#161324',
    borderColor: '#2B2342',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: 'white',
    fontSize: 14,
    maxHeight: 90,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#00F5D4',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
