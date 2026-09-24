import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, StyleProp, ViewStyle, TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/src/theme';

interface AvatarProps {
  name?: string;
  uri?: string | null;
  size?: number;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  isWorkspace?: boolean;
}

export function Avatar({
  name = 'User',
  uri,
  size = 40,
  style,
  textStyle,
  isWorkspace = false,
}: AvatarProps) {
  const [hasError, setHasError] = useState(false);

  // Extract up to 2 uppercase initials
  const cleanName = (name || '').trim();
  const parts = cleanName.split(/\s+/).filter(Boolean);
  let initials = 'U';
  if (parts.length >= 2) {
    initials = `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  } else if (parts.length === 1 && parts[0].length > 0) {
    initials = parts[0].slice(0, Math.min(2, parts[0].length)).toUpperCase();
  }

  const isValidUri = Boolean(
    uri &&
      !hasError &&
      (uri.startsWith('http://') ||
        uri.startsWith('https://') ||
        uri.startsWith('file://') ||
        uri.startsWith('content://'))
  );

  const borderRadius = isWorkspace ? Math.round(size * 0.28) : Math.round(size / 2);
  const fontSize = Math.max(10, Math.round(size * 0.38));

  if (isValidUri) {
    return (
      <View
        style={[
          styles.container,
          {
            width: size,
            height: size,
            borderRadius,
          },
          style,
        ]}
      >
        <Image
          source={{ uri: uri! }}
          style={{
            width: size,
            height: size,
            borderRadius,
          }}
          onError={() => setHasError(true)}
          resizeMode="cover"
        />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius,
          backgroundColor: isWorkspace ? '#2D1B69' : '#1F1B2E',
          borderColor: isWorkspace ? '#4C2882' : '#322B48',
        },
        style,
      ]}
    >
      {isWorkspace && (!cleanName || cleanName === 'Workspace') ? (
        <Ionicons name="people" size={Math.round(size * 0.5)} color={colors.violetLight} />
      ) : (
        <Text
          style={[
            styles.initials,
            {
              fontSize,
              color: isWorkspace ? '#D8B4FE' : '#C4B5FD',
            },
            textStyle,
          ]}
        >
          {initials}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
  },
  initials: {
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
