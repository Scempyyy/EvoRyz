/* eslint-disable react-hooks/refs */
import { ReactNode, useEffect, useRef, useState } from 'react';
import {
  Animated,
  View,
  Text,
  Pressable,
  StyleSheet,
  Modal,
  TextInput,
  Image,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/src/theme';
import { useApp } from '@/src/store/AppContext';

export function Card({
  children,
  style,
  onPress,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  if (!onPress) {
    return <View style={[s.card, style]}>{children}</View>;
  }

  return (
    <Animated.View style={[{ transform: [{ scale }] }]}>
      <Pressable
        onPress={onPress}
        onPressIn={() => Animated.spring(scale, { toValue: 0.985, useNativeDriver: true }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, friction: 5, useNativeDriver: true }).start()}
        style={[s.card, style]}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

export function Progress({ value, color = colors.violet }: { value: number; color?: string }) {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(progress, {
      toValue: Math.max(0, Math.min(100, value)),
      duration: 420,
      useNativeDriver: false,
    }).start();
  }, [progress, value]);
  return (
    <View style={s.track}>
      <Animated.View
        style={[
          s.fill,
          {
            width: progress.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }),
            backgroundColor: color,
          },
        ]}
      />
    </View>
  );
}

export function Privacy({ value }: { value: 'private' | 'shared' }) {
  return (
    <View style={[s.privacy, { backgroundColor: value === 'private' ? '#272331' : '#163227' }]}>
      <Ionicons
        name={value === 'private' ? 'lock-closed' : 'people'}
        size={12}
        color={value === 'private' ? '#c2b9d3' : colors.green}
      />
      <Text style={s.privacyText}>{value === 'private' ? 'Private' : 'Shared'}</Text>
    </View>
  );
}

export function Header({
  title,
  sub,
  onProfile,
  avatarUri,
}: {
  title: string;
  sub?: string;
  onProfile?: () => void;
  avatarUri?: string;
}) {
  const { user } = useApp();
  const [imgError, setImgError] = useState(false);
  const effectiveUri = avatarUri ?? user?.avatar;
  const isUrl = Boolean(
    effectiveUri && (effectiveUri.startsWith('http://') || effectiveUri.startsWith('https://'))
  );
  const initial = (user?.name || user?.username || 'E').charAt(0).toUpperCase();

  return (
    <View style={s.header}>
      <View>
        <Text style={s.headerTitle}>{title}</Text>
        {sub && <Text style={s.sub}>{sub}</Text>}
      </View>
      {onProfile && (
        <Pressable style={s.avatar} onPress={onProfile}>
          {isUrl && !imgError ? (
            <Image
              source={{ uri: effectiveUri }}
              style={{ width: 38, height: 38, borderRadius: 19 }}
              onError={() => setImgError(true)}
            />
          ) : (
            <Text style={s.avatarText}>{initial}</Text>
          )}
        </Pressable>
      )}
    </View>
  );
}

export function CreateModal({
  visible,
  onClose,
  onAdd,
  label,
  canShare = true,
}: {
  visible: boolean;
  onClose: () => void;
  onAdd: (title: string, visibility: 'private' | 'shared') => void;
  label: string;
  canShare?: boolean;
}) {
  const [title, setTitle] = useState('');
  const [visibility, setVisibility] = useState<'private' | 'shared'>('private');
  const choices = canShare ? (['private', 'shared'] as const) : (['private'] as const);
  const rise = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    if (visible) Animated.spring(rise, { toValue: 0, damping: 20, stiffness: 220, useNativeDriver: true }).start();
  }, [rise, visible]);

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <Animated.View style={[s.sheet, { transform: [{ translateY: rise }] }]}>
          <Text style={s.sheetTitle}>Create {label}</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            autoFocus
            placeholder="Name"
            placeholderTextColor={colors.muted}
            style={s.input}
          />
          <Text style={s.choiceTitle}>VISIBILITY</Text>
          <View style={s.choices}>
            {choices.map((v) => (
              <Pressable
                key={v}
                onPress={() => setVisibility(v)}
                style={[s.choice, visibility === v && s.selected]}
              >
                <Privacy value={v} />
                <Text style={s.choiceText}>
                  {v === 'private' ? 'Only you can see this' : 'Your workspace can see this'}
                </Text>
              </Pressable>
            ))}
          </View>
          {!canShare && (
            <Text style={s.soloHint}>Connect a duo or team later to create shared items.</Text>
          )}
          <Pressable
            style={s.create}
            onPress={() => {
              if (title.trim()) {
                onAdd(title.trim(), visibility);
                setTitle('');
                onClose();
              }
            }}
          >
            <Text style={s.createText}>Create</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  track: { height: 8, backgroundColor: '#302C38', borderRadius: 8, overflow: 'hidden', flex: 1 },
  fill: { height: '100%', borderRadius: 8 },
  privacy: {
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 5,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
  },
  privacyText: { color: '#ded8ea', fontSize: 11, fontWeight: '700' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headerTitle: { color: 'white', fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  sub: { color: colors.muted, fontSize: 13, marginTop: 3 },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.violet,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarText: { color: 'white', fontWeight: '800' },
  overlay: { flex: 1, backgroundColor: '#000a', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#1B1823', padding: 22, borderTopLeftRadius: 26, borderTopRightRadius: 26 },
  sheetTitle: { color: 'white', fontSize: 22, fontWeight: '800', marginBottom: 18 },
  input: { backgroundColor: colors.surface2, color: 'white', fontSize: 16, borderRadius: 13, padding: 15 },
  choiceTitle: { color: colors.muted, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginTop: 20, marginBottom: 10 },
  choices: { gap: 8 },
  choice: { backgroundColor: colors.surface2, padding: 12, borderRadius: 12 },
  selected: { borderWidth: 1, borderColor: colors.violet },
  choiceText: { color: colors.muted, fontSize: 12, marginTop: 6 },
  soloHint: { color: colors.muted, fontSize: 12, marginTop: 10 },
  create: { backgroundColor: colors.violet, padding: 16, borderRadius: 13, alignItems: 'center', marginTop: 22 },
  createText: { color: 'white', fontWeight: '800' },
});

export { Avatar } from './Avatar';

