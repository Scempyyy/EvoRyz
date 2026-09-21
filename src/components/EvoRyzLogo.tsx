import React from 'react';
import { View, Image, StyleSheet, Text, ViewStyle } from 'react-native';
import { colors } from '@/src/theme';

interface EvoRyzLogoProps {
  size?: number;
  showWordmark?: boolean;
  showTagline?: boolean;
  style?: ViewStyle;
}

export function EvoRyzLogo({
  size = 56,
  showWordmark = false,
  showTagline = false,
  style,
}: EvoRyzLogoProps) {
  return (
    <View style={[styles.container, style]}>
      <View
        style={[
          styles.emblemWrapper,
          {
            width: size,
            height: size,
            borderRadius: Math.round(size * 0.28),
          },
        ]}
      >
        <Image
          source={require('@/assets/images/icon.png')}
          style={{ width: size, height: size, borderRadius: Math.round(size * 0.28) }}
          resizeMode="contain"
          accessibilityLabel="EvoRyz Logo"
        />
      </View>

      {showWordmark && (
        <View style={styles.textContainer}>
          <Text style={[styles.wordmark, { fontSize: Math.max(18, Math.round(size * 0.42)) }]}>
            Evo<Text style={styles.wordmarkAccent}>Ryz</Text>
          </Text>
          {showTagline && (
            <Text style={[styles.tagline, { fontSize: Math.max(10, Math.round(size * 0.16)) }]}>
              EVOLVE · RISE · REPEAT
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emblemWrapper: {
    overflow: 'hidden',
    shadowColor: colors.violetLight,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  textContainer: {
    alignItems: 'center',
    marginTop: 12,
  },
  wordmark: {
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  wordmarkAccent: {
    color: colors.violetLight,
  },
  tagline: {
    color: colors.muted,
    fontWeight: '700',
    letterSpacing: 2.5,
    marginTop: 4,
  },
});
