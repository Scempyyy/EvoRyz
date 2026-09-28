import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/src/theme';
import {
  WinterArcSetupConfig,
  WinterArcVisibility,
  WinterArcNotificationLevel,
  DEFAULT_WINTER_ARC_RULES,
  WinterArcRule,
} from '@/src/types/winterArc';
import { feedback } from '@/src/services/feedback';

interface WinterArcSetupModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (config: WinterArcSetupConfig) => Promise<void>;
}

export function WinterArcSetupModal({
  visible,
  onClose,
  onSave,
}: WinterArcSetupModalProps) {
  const [title, setTitle] = useState('Winter Arc 2026');
  const startDate = '2026-10-01';
  const endDate = '2026-12-31';
  const [visibility, setVisibility] = useState<WinterArcVisibility>('public');
  const [notificationLevel, setNotificationLevel] = useState<WinterArcNotificationLevel>('lock_in');

  const [rules, setRules] = useState(
    DEFAULT_WINTER_ARC_RULES.map((r, i) => ({
      ...r,
      orderIndex: i,
    }))
  );

  const [newRuleTitle, setNewRuleTitle] = useState('');
  const [newRuleTarget, setNewRuleTarget] = useState('1');
  const [newRuleUnit, setNewRuleUnit] = useState('times');
  const [newRuleWeight, setNewRuleWeight] = useState('2');
  const [isAddingRule, setIsAddingRule] = useState(false);
  const [saving, setSaving] = useState(false);

  const toggleRule = (index: number) => {
    feedback.tap(true);
    setRules((prev) =>
      prev.map((r, i) => (i === index ? { ...r, enabled: !r.enabled } : r))
    );
  };

  const removeRule = (index: number) => {
    feedback.tap(true);
    setRules((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddCustomRule = () => {
    const trimmed = newRuleTitle.trim();
    if (!trimmed) {
      Alert.alert('Rule Title Required', 'Please enter a title for your custom rule.');
      return;
    }

    const targetNum = Math.max(1, parseFloat(newRuleTarget) || 1);
    const weightNum = Math.min(10, Math.max(1, parseInt(newRuleWeight, 10) || 1));

    const newRule: Omit<WinterArcRule, 'id' | 'winterArcId' | 'userId' | 'createdAt' | 'updatedAt'> = {
      title: trimmed,
      description: 'Custom personal rule',
      target: targetNum,
      unit: newRuleUnit.trim() || 'times',
      weight: weightNum,
      orderIndex: rules.length,
      enabled: true,
      icon: 'snow',
      color: '#00F5D4',
    };

    setRules((prev) => [...prev, newRule]);
    setNewRuleTitle('');
    setNewRuleTarget('1');
    setNewRuleUnit('times');
    setNewRuleWeight('2');
    setIsAddingRule(false);
    feedback.success(true);
  };

  const handleCommitSetup = async () => {
    const enabledRules = rules.filter((r) => r.enabled);
    if (enabledRules.length === 0) {
      Alert.alert('Rules Required', 'Please enable at least one rule for your Winter Arc.');
      return;
    }

    setSaving(true);
    feedback.tap(true);

    try {
      await onSave({
        title: title.trim() || 'Winter Arc 2026',
        startDate,
        endDate,
        visibility,
        notificationLevel,
        rules: enabledRules,
      });
      feedback.success(true);
      onClose();
    } catch (err: any) {
      Alert.alert('Setup Error', err?.message || 'Failed to save Winter Arc.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>❄️ Winter Arc Setup</Text>
              <Text style={styles.sub}>Customize your 92-day challenge</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={colors.muted} />
            </Pressable>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Event Name */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>CHALLENGE TITLE</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="Winter Arc 2026"
                placeholderTextColor={colors.muted}
              />
            </View>

            {/* Visibility Mode */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>PRIVACY & SPECTATING</Text>
              <View style={styles.pillRow}>
                {(['public', 'friends', 'private'] as WinterArcVisibility[]).map((v) => (
                  <Pressable
                    key={v}
                    style={[styles.pill, visibility === v && styles.pillActive]}
                    onPress={() => {
                      feedback.tap(true);
                      setVisibility(v);
                    }}
                  >
                    <Ionicons
                      name={
                        v === 'public'
                          ? 'earth-outline'
                          : v === 'friends'
                          ? 'people-outline'
                          : 'lock-closed-outline'
                      }
                      size={14}
                      color={visibility === v ? '#00F5D4' : colors.muted}
                    />
                    <Text
                      style={[
                        styles.pillText,
                        visibility === v && styles.pillTextActive,
                      ]}
                    >
                      {v.toUpperCase()}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.helperText}>
                {visibility === 'public'
                  ? 'Eligible for Global Leaderboard & public spectating (no private EvoRyz data shared)'
                  : visibility === 'friends'
                  ? 'Visible only to teammates in your shared workspaces'
                  : 'Completely private to you'}
              </Text>
            </View>

            {/* Notification Mode */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>CHECKPOINT NOTIFICATIONS</Text>
              <View style={styles.pillRow}>
                {(['light', 'normal', 'lock_in'] as WinterArcNotificationLevel[]).map((n) => (
                  <Pressable
                    key={n}
                    style={[styles.pill, notificationLevel === n && styles.pillActive]}
                    onPress={() => {
                      feedback.tap(true);
                      setNotificationLevel(n);
                    }}
                  >
                    <Text
                      style={[
                        styles.pillText,
                        notificationLevel === n && styles.pillTextActive,
                      ]}
                    >
                      {n === 'lock_in' ? 'LOCK-IN (6)' : n.toUpperCase()}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.helperText}>
                {notificationLevel === 'lock_in'
                  ? '6 daily checkpoints: 06:30, 09:00, 11:00, 16:00, 20:00, 22:00'
                  : notificationLevel === 'normal'
                  ? '2 daily checkpoints: 08:00 morning & 20:00 evening'
                  : '1 daily morning reminder at 08:00'}
              </Text>
            </View>

            {/* Rules Section */}
            <View style={styles.formGroup}>
              <View style={styles.rulesHeader}>
                <Text style={styles.label}>DAILY RULES & WEIGHTS ({rules.filter((r) => r.enabled).length})</Text>
                <Pressable
                  style={styles.addRulePill}
                  onPress={() => setIsAddingRule(!isAddingRule)}
                >
                  <Ionicons name={isAddingRule ? 'close' : 'add'} size={14} color="#00F5D4" />
                  <Text style={styles.addRuleText}>{isAddingRule ? 'Cancel' : 'Add Rule'}</Text>
                </Pressable>
              </View>

              {/* Add Custom Rule Form */}
              {isAddingRule && (
                <View style={styles.addRuleBox}>
                  <Text style={styles.addRuleBoxTitle}>New Custom Rule</Text>
                  <TextInput
                    style={styles.input}
                    value={newRuleTitle}
                    onChangeText={setNewRuleTitle}
                    placeholder="e.g. Cold Shower, No Social Media"
                    placeholderTextColor={colors.muted}
                  />

                  <View style={styles.addRuleRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.miniLabel}>Target</Text>
                      <TextInput
                        style={styles.inputSmall}
                        value={newRuleTarget}
                        onChangeText={setNewRuleTarget}
                        keyboardType="numeric"
                        placeholder="1"
                        placeholderTextColor={colors.muted}
                      />
                    </View>
                    <View style={{ flex: 1.5 }}>
                      <Text style={styles.miniLabel}>Unit</Text>
                      <TextInput
                        style={styles.inputSmall}
                        value={newRuleUnit}
                        onChangeText={setNewRuleUnit}
                        placeholder="times / mins"
                        placeholderTextColor={colors.muted}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.miniLabel}>Weight (1-10)</Text>
                      <TextInput
                        style={styles.inputSmall}
                        value={newRuleWeight}
                        onChangeText={setNewRuleWeight}
                        keyboardType="numeric"
                        placeholder="2"
                        placeholderTextColor={colors.muted}
                      />
                    </View>
                  </View>

                  <Pressable style={styles.saveRuleBtn} onPress={handleAddCustomRule}>
                    <Text style={styles.saveRuleBtnText}>Save Rule</Text>
                  </Pressable>
                </View>
              )}

              {/* Rules List */}
              <View style={styles.rulesList}>
                {rules.map((rule, idx) => (
                  <View key={idx} style={[styles.ruleCard, !rule.enabled && styles.ruleCardDisabled]}>
                    <Pressable
                      style={styles.ruleToggle}
                      onPress={() => toggleRule(idx)}
                    >
                      <Ionicons
                        name={rule.enabled ? 'checkbox' : 'square-outline'}
                        size={20}
                        color={rule.enabled ? '#00F5D4' : colors.muted}
                      />
                    </Pressable>

                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.ruleTitle,
                          !rule.enabled && styles.ruleTitleDisabled,
                        ]}
                      >
                        {rule.title}
                      </Text>
                      <Text style={styles.ruleSub}>
                        Target: {rule.target} {rule.unit} · Weight: {rule.weight}x
                      </Text>
                    </View>

                    <Pressable
                      style={styles.ruleRemoveBtn}
                      onPress={() => removeRule(idx)}
                    >
                      <Ionicons name="trash-outline" size={16} color={colors.muted} />
                    </Pressable>
                  </View>
                ))}
              </View>
            </View>
          </ScrollView>

          {/* Footer Submit */}
          <View style={styles.footer}>
            <Pressable
              style={[styles.startBtn, saving && { opacity: 0.6 }]}
              onPress={handleCommitSetup}
              disabled={saving}
            >
              <Text style={styles.startBtnText}>
                {saving ? 'LOCKING IN...' : 'LOCK IN WINTER ARC'}
              </Text>
              <Ionicons name="flame" size={18} color="#0A0914" />
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
  modalContent: {
    backgroundColor: '#0F0D17',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderColor: '#29233D',
    borderTopWidth: 1,
    maxHeight: '90%',
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomColor: '#1E192E',
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: 'white',
    letterSpacing: 0.5,
  },
  sub: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  body: {
    padding: 20,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.muted,
    letterSpacing: 1,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#171424',
    borderColor: '#2E2745',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  pillRow: {
    flexDirection: 'row',
    gap: 8,
  },
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#171424',
    borderColor: '#2E2745',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
  },
  pillActive: {
    backgroundColor: '#132A29',
    borderColor: '#00F5D4',
  },
  pillText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.muted,
  },
  pillTextActive: {
    color: '#00F5D4',
  },
  helperText: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 6,
    lineHeight: 16,
  },
  rulesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  addRulePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1A2928',
    borderColor: '#00F5D4',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  addRuleText: {
    color: '#00F5D4',
    fontSize: 11,
    fontWeight: '700',
  },
  addRuleBox: {
    backgroundColor: '#191529',
    borderColor: '#372E5C',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  addRuleBoxTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: 'white',
    marginBottom: 10,
  },
  addRuleRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  miniLabel: {
    fontSize: 10,
    color: colors.muted,
    fontWeight: '700',
    marginBottom: 4,
  },
  inputSmall: {
    backgroundColor: '#13111E',
    borderColor: '#2E2745',
    borderWidth: 1,
    borderRadius: 10,
    padding: 8,
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  saveRuleBtn: {
    backgroundColor: '#00F5D4',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  saveRuleBtnText: {
    color: '#07060B',
    fontSize: 13,
    fontWeight: '800',
  },
  rulesList: {
    gap: 8,
  },
  ruleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#161324',
    borderColor: '#29223D',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  ruleCardDisabled: {
    opacity: 0.45,
  },
  ruleToggle: {
    padding: 4,
  },
  ruleTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: 'white',
  },
  ruleTitleDisabled: {
    textDecorationLine: 'line-through',
    color: colors.muted,
  },
  ruleSub: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
  },
  ruleRemoveBtn: {
    padding: 6,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#00F5D4',
    paddingVertical: 14,
    borderRadius: 14,
  },
  startBtnText: {
    color: '#07060B',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 1,
  },
});
