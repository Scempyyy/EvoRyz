/* eslint-disable react-hooks/set-state-in-effect */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/src/theme';
import { SpectateWinterArcData } from '@/src/types/winterArc';
import { winterArcRepo } from '@/src/services/winterArcRepository';
import { Avatar } from '@/src/components/Avatar';
import { Card, Progress } from '@/src/components/ui';

interface WinterArcSpectateModalProps {
  targetUserId: string | null;
  onClose: () => void;
}

export function WinterArcSpectateModal({
  targetUserId,
  onClose,
}: WinterArcSpectateModalProps) {
  const [data, setData] = useState<SpectateWinterArcData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!targetUserId) return;
    setLoading(true);
    winterArcRepo
      .getSpectateData(targetUserId)
      .then(setData)
      .finally(() => setLoading(false));
  }, [targetUserId]);

  if (!targetUserId) return null;

  return (
    <Modal visible={Boolean(targetUserId)} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Ionicons name="eye-outline" size={22} color="#00F5D4" />
              <View>
                <Text style={styles.headerTitle}>Spectate Winter Arc</Text>
                <Text style={styles.headerSub}>Public / Shared Participant View</Text>
              </View>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={colors.muted} />
            </Pressable>
          </View>

          {loading ? (
            <View style={styles.centerLoading}>
              <ActivityIndicator size="large" color="#00F5D4" />
              <Text style={styles.loadingText}>Loading participant data...</Text>
            </View>
          ) : !data ? (
            <View style={styles.emptyState}>
              <Ionicons name="lock-closed" size={44} color={colors.muted} />
              <Text style={styles.emptyTitle}>Winter Arc Unavailable</Text>
              <Text style={styles.emptySub}>
                This participant has set their Winter Arc to private or has not started one.
              </Text>
              <Pressable style={styles.doneBtn} onPress={onClose}>
                <Text style={styles.doneBtnText}>Close</Text>
              </Pressable>
            </View>
          ) : (
            <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
              {/* User Hero */}
              <View style={styles.profileRow}>
                <Avatar
                  uri={data.ownerProfile.avatarUrl}
                  size={54}
                  name={data.ownerProfile.name}
                />
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={styles.nameText}>{data.ownerProfile.name}</Text>
                  <Text style={styles.handleText}>@{data.ownerProfile.username}</Text>
                  <View style={styles.badgeRow}>
                    <View style={styles.statusBadge}>
                      <Ionicons name="snow" size={12} color="#00F5D4" />
                      <Text style={styles.statusText}>{data.winterArc.status.toUpperCase()}</Text>
                    </View>
                    <View style={styles.privacyBadge}>
                      <Text style={styles.privacyText}>{data.winterArc.visibility.toUpperCase()}</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Score / Streak Cards */}
              <View style={styles.statsGrid}>
                <Card style={styles.statCard}>
                  <Text style={styles.statLabel}>OVERALL SCORE</Text>
                  <Text style={styles.statNumber}>{data.winterArc.overallScore}%</Text>
                  <Progress value={data.winterArc.overallScore} />
                </Card>

                <Card style={styles.statCard}>
                  <Text style={styles.statLabel}>CURRENT STREAK</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginVertical: 6 }}>
                    <Ionicons name="flame" size={24} color="#FF6D7A" />
                    <Text style={styles.statNumber}>{data.winterArc.currentStreak}d</Text>
                  </View>
                  <Text style={styles.statSub}>Best: {data.winterArc.bestStreak} days</Text>
                </Card>
              </View>

              {/* Configured Rules */}
              <Text style={styles.sectionTitle}>PARTICIPANT RULES ({data.rules.length})</Text>
              <View style={styles.rulesList}>
                {data.rules.map((rule) => (
                  <View key={rule.id} style={styles.ruleItem}>
                    <Ionicons name="checkmark-circle" size={18} color="#00F5D4" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.ruleTitle}>{rule.title}</Text>
                      <Text style={styles.ruleSub}>
                        Target: {rule.target} {rule.unit} · Weight: {rule.weight}x
                      </Text>
                    </View>
                  </View>
                ))}
              </View>

              {/* Milestones Achieved */}
              <Text style={styles.sectionTitle}>
                MILESTONES ACHIEVED ({data.milestones.length})
              </Text>
              {data.milestones.length === 0 ? (
                <Text style={styles.emptyMilestones}>No milestones reached yet.</Text>
              ) : (
                <View style={styles.milestonesList}>
                  {data.milestones.map((m) => (
                    <View key={m.id} style={styles.milestoneItem}>
                      <Ionicons name="trophy" size={18} color="#FFB703" />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.milestoneTitle}>{m.title}</Text>
                        <Text style={styles.milestoneSub}>Day {m.dayNumber} · {m.description}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* Privacy Notice */}
              <View style={styles.privacyNoticeBox}>
                <Ionicons name="shield-checkmark-outline" size={16} color={colors.muted} />
                <Text style={styles.privacyNoticeText}>
                  Zero private data exposed. Tasks, personal habits, nutrition meals, journal entries, and private chats are strictly confidential.
                </Text>
              </View>

              <View style={{ height: 40 }} />
            </ScrollView>
          )}
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
    maxHeight: '88%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomColor: '#1E192E',
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: 'white',
  },
  headerSub: {
    fontSize: 11,
    color: colors.muted,
  },
  closeBtn: {
    padding: 6,
  },
  centerLoading: {
    padding: 60,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: colors.muted,
    fontSize: 13,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
    gap: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: 'white',
  },
  emptySub: {
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 18,
  },
  doneBtn: {
    backgroundColor: colors.surface2,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 10,
  },
  doneBtnText: {
    color: 'white',
    fontWeight: '700',
  },
  body: {
    padding: 20,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  nameText: {
    fontSize: 18,
    fontWeight: '900',
    color: 'white',
  },
  handleText: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#122B28',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  statusText: {
    color: '#00F5D4',
    fontSize: 10,
    fontWeight: '800',
  },
  privacyBadge: {
    backgroundColor: '#1C1929',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  privacyText: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 22,
  },
  statCard: {
    flex: 1,
    padding: 14,
    backgroundColor: '#141120',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.muted,
    letterSpacing: 1,
    marginBottom: 6,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '900',
    color: 'white',
    marginBottom: 6,
  },
  statSub: {
    fontSize: 11,
    color: colors.muted,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.muted,
    letterSpacing: 1,
    marginBottom: 10,
    marginTop: 10,
  },
  rulesList: {
    gap: 8,
    marginBottom: 20,
  },
  ruleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#161324',
    padding: 12,
    borderRadius: 12,
  },
  ruleTitle: {
    color: 'white',
    fontSize: 13,
    fontWeight: '700',
  },
  ruleSub: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 2,
  },
  emptyMilestones: {
    color: colors.muted,
    fontSize: 12,
    fontStyle: 'italic',
    marginBottom: 20,
  },
  milestonesList: {
    gap: 8,
    marginBottom: 20,
  },
  milestoneItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#1B1724',
    borderColor: '#3D311A',
    borderWidth: 1,
    padding: 12,
    borderRadius: 12,
  },
  milestoneTitle: {
    color: '#FFB703',
    fontSize: 13,
    fontWeight: '800',
  },
  milestoneSub: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 2,
  },
  privacyNoticeBox: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#121019',
    borderColor: '#241D35',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  privacyNoticeText: {
    flex: 1,
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
  },
});
