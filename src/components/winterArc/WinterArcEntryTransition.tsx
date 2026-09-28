/* eslint-disable react-hooks/refs */
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { feedback } from '@/src/services/feedback';

interface WinterArcEntryTransitionProps {
  onProceed: () => void;
}

export function WinterArcEntryTransition({ onProceed }: WinterArcEntryTransitionProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const iconRotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    feedback.sound('streakMilestone', true);
    feedback.haptic('heavy');

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 450,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 7,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.loop(
        Animated.sequence([
          Animated.timing(iconRotate, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(iconRotate, {
            toValue: 0,
            duration: 1200,
            useNativeDriver: true,
          }),
        ])
      ),
    ]).start();

    // Auto-proceed after 2.6 seconds if user doesn't tap sooner
    const timer = setTimeout(() => {
      onProceed();
    }, 2800);

    return () => clearTimeout(timer);
  }, [fadeAnim, scaleAnim, iconRotate, onProceed]);

  const rotation = iconRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '90deg'],
  });

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <View style={styles.frostGlow} />

        <View style={styles.iconCircle}>
          <Ionicons name="snow" size={44} color="#00F5D4" />
        </View>

        <Text style={styles.title}>❄️ WINTER ARC</Text>

        <View style={styles.orientationBox}>
          <Animated.View style={{ transform: [{ rotate: rotation }] }}>
            <Ionicons name="phone-landscape-outline" size={32} color="#00F5D4" />
          </Animated.View>
          <Text style={styles.orientationTitle}>Rotate your phone for the best experience.</Text>
          <Text style={styles.orientationSub}>Landscape mode recommended.</Text>
        </View>

        <Pressable
          style={styles.proceedBtn}
          onPress={() => {
            feedback.tap(true);
            onProceed();
          }}
        >
          <Text style={styles.proceedBtnText}>Enter Arc</Text>
          <Ionicons name="arrow-forward" size={16} color="#0A0914" />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#07060B',
    zIndex: 9999,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  content: {
    alignItems: 'center',
    maxWidth: 420,
    width: '100%',
  },
  frostGlow: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: '#00F5D4',
    opacity: 0.12,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#121C27',
    borderColor: '#00F5D4',
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#F7F5FC',
    letterSpacing: 3,
    marginBottom: 24,
  },
  orientationBox: {
    backgroundColor: '#111019',
    borderColor: '#26203D',
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 20,
    paddingHorizontal: 24,
    alignItems: 'center',
    width: '100%',
    marginBottom: 28,
  },
  orientationTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 12,
    textAlign: 'center',
  },
  orientationSub: {
    fontSize: 13,
    fontWeight: '600',
    color: '#00F5D4',
    marginTop: 4,
    textAlign: 'center',
  },
  proceedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#00F5D4',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 14,
  },
  proceedBtnText: {
    color: '#07060B',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
