import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  Pressable,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/src/theme';
import {
  WinterArc,
  WinterArcRule,
  WinterArcMilestone,
} from '@/src/types/winterArc';
import { Card, Progress } from '@/src/components/ui';
import { feedback } from '@/src/services/feedback';

interface WinterArcFinalRecapModalProps {
  visible: boolean;
  onClose: () => void;
  arc: WinterArc;
  rules: WinterArcRule[];
  milestones: WinterArcMilestone[];
}

export function WinterArcFinalRecapModal({
  visible,
  onClose,
  arc,
  rules,
  milestones,
}: WinterArcFinalRecapModalProps) {
  const handleShareVictory = async () => {
    feedback.tap(true);
    try {
      await Share.share({
        title: '❄️ Winter Arc Conquered | EvoRyz',
        message: `❄️ I just conquered the 92-Day Winter Arc on EvoRyz!\n\n🔥 Best Streak: ${arc.bestStreak} days\n⚡ Final Execution Score: ${arc.overallScore}%\n🏆 Milestones Achieved: ${milestones.length}/6\n\nDiscipline built in the frost. #WinterArc #EvoRyz`,
      });
    } catch (err) {
      console.warn('[WinterArcFinalRecapModal] share error:', err);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="trophy" size={24} color="#FFB703" />
              <View>
                <Text style={styles.title}>WINTER ARC CONQUERED</Text>
                <Text style={styles.sub}>Official Final Performance Record</Text>
              </View>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={colors.muted} />
            </Pressable>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Shareable Victory Banner */}
            <Card style={styles.victoryCard}>
              <View style={styles.frostBanner}>
                <Ionicons name="snow" size={28} color="#00F5D4" />
                <Text style={styles.victoryTitle}>92 DAYS OF IRON</Text>
              </View>

              <Text style={styles.victorySub}>
                You completed the full Winter Arc challenge. You eliminated distractions, honored every commitment, and proved your capability.
              </Text>

              <View style={styles.metricsGrid}>
                <View style={styles.metricBox}>
                  <Text style={styles.metricVal}>{arc.overallScore}%</Text>
                  <Text style={styles.metricLbl}>FINAL SCORE</Text>
                </View>

                <View style={styles.metricBox}>
                  <Text style={styles.metricVal}>{arc.bestStreak}d</Text>
                  <Text style={styles.metricLbl}>BEST STREAK</Text>
                </View>

                <View style={styles.metricBox}>
                  <Text style={styles.metricVal}>{milestones.length}/6</Text>
                  <Text style={styles.metricLbl}>MILESTONES</Text>
                </View>
              </View>
            </Card>

            {/* Overall Completion Bar */}
            <View style={styles.progressSection}>
              <View style={styles.progressLabelRow}>
                <Text style={styles.progressLabel}>CHALLENGE COMPLETION</Text>
                <Text style={styles.progressValue}>{arc.overallCompletion}%</Text>
              </View>
              <Progress value={arc.overallCompletion} />
            </View>

            {/* Rule Discipline Overview */}
            <Text style={styles.sectionHeader}>RULE DISCIPLINE BREAKDOWN</Text>
            <View style={styles.rulesList}>
              {rules.map((rule) => (
                <View key={rule.id} style={styles.ruleItem}>
                  <Ionicons name="shield-checkmark" size={16} color="#00F5D4" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.ruleTitle}>{rule.title}</Text>
                    <Text style={styles.ruleSub}>
                      Target: {rule.target} {rule.unit} · Weight: {rule.weight}x
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Milestones Unlocked */}
            <Text style={styles.sectionHeader}>HONORS & MILESTONES</Text>
            <View style={styles.milestonesList}>
              {milestones.map((m) => (
                <View key={m.id} style={styles.milestoneItem}>
                  <Ionicons name="trophy" size={18} color="#FFB703" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.milestoneTitle}>{m.title}</Text>
                    <Text style={styles.milestoneSub}>Day {m.dayNumber} · {m.description}</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Share Card Action */}
            <Pressable style={styles.shareBtn} onPress={handleShareVictory}>
              <Ionicons name="share-social-outline" size={18} color="#07060B" />
              <Text style={styles.shareBtnText}>Share Victory Card</Text>
            </Pressable>

            <View style={{ height: 40 }} />
          </ScrollView>
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
    maxHeight: '90%',
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
    fontSize: 16,
    fontWeight: '900',
    color: 'white',
    letterSpacing: 1,
  },
  sub: {
    fontSize: 11,
    color: colors.muted,
  },
  closeBtn: {
    padding: 6,
  },
  body: {
    padding: 20,
  },
  victoryCard: {
    backgroundColor: '#151124',
    borderColor: '#00F5D4',
    borderWidth: 1.5,
    padding: 20,
    marginBottom: 20,
    alignItems: 'center',
  },
  frostBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  victoryTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: 'white',
    letterSpacing: 2,
  },
  victorySub: {
    fontSize: 13,
    color: '#D4CEE8',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20,
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  metricBox: {
    flex: 1,
    backgroundColor: '#1D1730',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  metricVal: {
    fontSize: 22,
    fontWeight: '900',
    color: '#00F5D4',
  },
  metricLbl: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.muted,
    marginTop: 4,
    letterSpacing: 0.5,
  },
  progressSection: {
    marginBottom: 20,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.muted,
    letterSpacing: 1,
  },
  progressValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#00F5D4',
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.muted,
    letterSpacing: 1,
    marginBottom: 10,
    marginTop: 6,
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
  milestonesList: {
    gap: 8,
    marginBottom: 24,
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
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#00F5D4',
    paddingVertical: 14,
    borderRadius: 14,
  },
  shareBtnText: {
    color: '#07060B',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
