import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/src/theme';
import { WinterArcStreakProtection } from '@/src/types/winterArc';
import { feedback } from '@/src/services/feedback';

interface WinterArcStreakProtectionBadgeProps {
  available: boolean;
  history: WinterArcStreakProtection[];
  compact?: boolean;
}

export function WinterArcStreakProtectionBadge({
  available,
  history,
  compact = false,
}: WinterArcStreakProtectionBadgeProps) {
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  return (
    <>
      <Pressable
        style={[
          styles.badge,
          compact && styles.badgeCompact,
          available ? styles.badgeAvailable : styles.badgeConsumed,
        ]}
        onPress={() => {
          feedback.tap(true);
          setShowHistoryModal(true);
        }}
        accessibilityLabel={available ? 'Streak Shield Ready' : 'Streak Shield Used'}
        accessibilityRole="button"
      >
        <Ionicons
          name={available ? 'shield-checkmark' : 'shield-outline'}
          size={compact ? 16 : 14}
          color={available ? '#00F5D4' : colors.muted}
        />
        {!compact && (
          <Text
            style={[
              styles.badgeText,
              available ? styles.textAvailable : styles.textConsumed,
            ]}
            numberOfLines={1}
          >
            {available ? 'SHIELD READY' : 'SHIELD USED'}
          </Text>
        )}
      </Pressable>

      <Modal
        visible={showHistoryModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowHistoryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.headerIcon}>
                <Ionicons
                  name={available ? 'shield-checkmark' : 'shield'}
                  size={24}
                  color={available ? '#00F5D4' : '#FFB703'}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Weekly Streak Protection</Text>
                <Text style={styles.modalSub}>
                  {available
                    ? '1 protection ready for this week'
                    : 'Consumed for this week · Replenishes next Monday'}
                </Text>
              </View>
              <Pressable
                onPress={() => setShowHistoryModal(false)}
                style={styles.closeBtn}
              >
                <Ionicons name="close" size={20} color={colors.muted} />
              </Pressable>
            </View>

            <View style={styles.ruleExplainer}>
              <Text style={styles.ruleTitle}>HOW IT WORKS</Text>
              <Text style={styles.ruleText}>
                • You receive exactly ONE streak protection per ISO week.{'\n'}
                • Unused protections do NOT stack indefinitely.{'\n'}
                • If an eligible day has missed rules, protection is consumed automatically to safeguard your streak.{'\n'}
                • Replenishes automatically every Monday at 2:00 AM.
              </Text>
            </View>

            <Text style={styles.historyTitle}>PROTECTION HISTORY ({history.length})</Text>
            {history.length === 0 ? (
              <View style={styles.emptyHistory}>
                <Text style={styles.emptyHistoryText}>
                  No protections consumed yet. Perfect consistency!
                </Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 180 }} showsVerticalScrollIndicator={false}>
                <View style={styles.historyList}>
                  {history.map((item) => (
                    <View key={item.id} style={styles.historyItem}>
                      <Ionicons name="shield-checkmark" size={16} color="#00F5D4" />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.historyWeek}>{item.weekIdentifier}</Text>
                        <Text style={styles.historyDate}>Saved day: {item.consumedForDate}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </ScrollView>
            )}

            <Pressable
              style={styles.doneBtn}
              onPress={() => setShowHistoryModal(false)}
            >
              <Text style={styles.doneBtnText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    flexShrink: 0,
  },
  badgeCompact: {
    width: 36,
    height: 36,
    paddingHorizontal: 0,
    paddingVertical: 0,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
  },
  badgeAvailable: {
    backgroundColor: '#0F2625',
    borderColor: '#00F5D4',
  },
  badgeConsumed: {
    backgroundColor: '#1E1926',
    borderColor: '#302C3B',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  textAvailable: {
    color: '#00F5D4',
  },
  textConsumed: {
    color: colors.muted,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#13111C',
    borderColor: '#29233B',
    borderWidth: 1,
    borderRadius: 20,
    padding: 20,
    maxWidth: 440,
    width: '100%',
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#1C1929',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  modalSub: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  ruleExplainer: {
    backgroundColor: '#1B1729',
    borderColor: '#2D2644',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  ruleTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.violetLight,
    letterSpacing: 1,
    marginBottom: 6,
  },
  ruleText: {
    fontSize: 12,
    color: '#D1CEE0',
    lineHeight: 18,
  },
  historyTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.muted,
    letterSpacing: 1,
    marginBottom: 10,
  },
  emptyHistory: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  emptyHistoryText: {
    fontSize: 12,
    color: colors.muted,
    fontStyle: 'italic',
  },
  historyList: {
    gap: 8,
    marginBottom: 16,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#181524',
    padding: 10,
    borderRadius: 10,
  },
  historyWeek: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700',
  },
  historyDate: {
    color: colors.muted,
    fontSize: 11,
  },
  doneBtn: {
    backgroundColor: colors.surface2,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  doneBtnText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
  },
});
