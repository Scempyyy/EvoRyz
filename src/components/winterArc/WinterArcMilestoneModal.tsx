/* eslint-disable react-hooks/refs */
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WinterArcMilestone } from '@/src/types/winterArc';
import { feedback } from '@/src/services/feedback';

interface WinterArcMilestoneModalProps {
  milestone: WinterArcMilestone | null;
  onDismiss: () => void;
}

export function WinterArcMilestoneModal({
  milestone,
  onDismiss,
}: WinterArcMilestoneModalProps) {
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const glowAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    if (milestone) {
      feedback.sound('streakMilestone', true);
      feedback.haptic('heavy');

      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 6,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.loop(
          Animated.sequence([
            Animated.timing(glowAnim, {
              toValue: 1,
              duration: 1000,
              useNativeDriver: true,
            }),
            Animated.timing(glowAnim, {
              toValue: 0.4,
              duration: 1000,
              useNativeDriver: true,
            }),
          ])
        ),
      ]).start();
    } else {
      scaleAnim.setValue(0.8);
      glowAnim.setValue(0.4);
    }
  }, [milestone, scaleAnim, glowAnim]);

  if (!milestone) return null;

  return (
    <Modal visible={Boolean(milestone)} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.card,
            {
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <Animated.View style={[styles.glowBackground, { opacity: glowAnim }]} />

          <View style={styles.trophyCircle}>
            <Ionicons name="trophy" size={48} color="#FFB703" />
          </View>

          <Text style={styles.eyebrow}>🏆 MILESTONE UNLOCKED · DAY {milestone.dayNumber}</Text>
          <Text style={styles.title}>{milestone.title}</Text>
          <Text style={styles.description}>{milestone.description}</Text>

          <View style={styles.statsBadge}>
            <Ionicons name="shield-checkmark" size={16} color="#00F5D4" />
            <Text style={styles.statsBadgeText}>Permanent Arc Honor Recorded</Text>
          </View>

          <Pressable
            style={styles.claimBtn}
            onPress={() => {
              feedback.success(true);
              onDismiss();
            }}
          >
            <Text style={styles.claimBtnText}>Continue Execution</Text>
            <Ionicons name="arrow-forward" size={16} color="#07060B" />
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#120F1F',
    borderColor: '#FFB703',
    borderWidth: 1.5,
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    maxWidth: 400,
    width: '100%',
    shadowColor: '#FFB703',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 12,
  },
  glowBackground: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: '#FFB703',
    opacity: 0.12,
  },
  trophyCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#261F13',
    borderColor: '#FFB703',
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FFB703',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: 'white',
    textAlign: 'center',
    marginBottom: 10,
  },
  description: {
    fontSize: 14,
    color: '#D4CEE8',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  statsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#122625',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 24,
  },
  statsBadgeText: {
    color: '#00F5D4',
    fontSize: 12,
    fontWeight: '800',
  },
  claimBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#00F5D4',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
    width: '100%',
  },
  claimBtnText: {
    color: '#07060B',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
