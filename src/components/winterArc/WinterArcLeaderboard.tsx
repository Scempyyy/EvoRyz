/* eslint-disable react-hooks/set-state-in-effect */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/src/theme';
import { WinterArcLeaderboardEntry } from '@/src/types/winterArc';
import { winterArcRepo } from '@/src/services/winterArcRepository';
import { feedback } from '@/src/services/feedback';
import { Avatar } from '@/src/components/Avatar';

interface WinterArcLeaderboardProps {
  currentUserId?: string;
  onSelectUserForSpectate: (userId: string) => void;
  onClose: () => void;
}

export function WinterArcLeaderboard({
  currentUserId,
  onSelectUserForSpectate,
  onClose,
}: WinterArcLeaderboardProps) {
  const insets = useSafeAreaInsets();
  const [filterMode, setFilterMode] = useState<'global' | 'friends'>('global');
  const [entries, setEntries] = useState<WinterArcLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLeaderboard = async (mode: 'global' | 'friends') => {
    setLoading(true);
    try {
      const data = await winterArcRepo.getLeaderboard(mode, 50);
      setEntries(data);
    } catch (err) {
      console.warn('[WinterArcLeaderboard] fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard(filterMode);
  }, [filterMode]);

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 16) + 8 }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
          <Text style={styles.title} numberOfLines={1}>🏆 Solo Leaderboard</Text>
          <Text style={styles.sub} numberOfLines={1}>Individual Winter Arc execution ranking</Text>
        </View>
        <Pressable onPress={onClose} style={styles.closeBtn} accessibilityLabel="Close Leaderboard">
          <Ionicons name="close" size={22} color={colors.muted} />
        </Pressable>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        <Pressable
          style={[styles.tab, filterMode === 'global' && styles.tabActive]}
          onPress={() => {
            feedback.tap(true);
            setFilterMode('global');
          }}
        >
          <Ionicons
            name="earth-outline"
            size={15}
            color={filterMode === 'global' ? '#00F5D4' : colors.muted}
          />
          <Text
            style={[styles.tabText, filterMode === 'global' && styles.tabTextActive]}
          >
            GLOBAL
          </Text>
        </Pressable>

        <Pressable
          style={[styles.tab, filterMode === 'friends' && styles.tabActive]}
          onPress={() => {
            feedback.tap(true);
            setFilterMode('friends');
          }}
        >
          <Ionicons
            name="people-outline"
            size={15}
            color={filterMode === 'friends' ? '#00F5D4' : colors.muted}
          />
          <Text
            style={[styles.tabText, filterMode === 'friends' && styles.tabTextActive]}
          >
            FRIENDS & DUOS
          </Text>
        </Pressable>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color="#00F5D4" />
          <Text style={styles.loadingText}>Loading rankings...</Text>
        </View>
      ) : entries.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="snow-outline" size={44} color={colors.muted} />
          <Text style={styles.emptyTitle}>No Arc Participants Yet</Text>
          <Text style={styles.emptySub}>
            {filterMode === 'friends'
              ? 'None of your workspace teammates have an active public/friends Winter Arc yet.'
              : 'Be the first warrior to lock in and climb the global leaderboard.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.winterArcId}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const isMe = item.userId === currentUserId;
            return (
              <Pressable
                style={[styles.rankRow, isMe && styles.rankRowMe]}
                onPress={() => {
                  if (!isMe) {
                    feedback.tap(true);
                    onSelectUserForSpectate(item.userId);
                  }
                }}
              >
                {/* Rank Badge */}
                <View
                  style={[
                    styles.rankBadge,
                    item.rank === 1
                      ? styles.goldRank
                      : item.rank === 2
                      ? styles.silverRank
                      : item.rank === 3
                      ? styles.bronzeRank
                      : null,
                  ]}
                >
                  <Text style={styles.rankNum}>#{item.rank}</Text>
                </View>

                {/* Avatar */}
                <Avatar uri={item.avatarUrl} size={38} name={item.name} />

                {/* Info */}
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.userName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    {isMe && <Text style={styles.youBadge}>YOU</Text>}
                  </View>
                  <Text style={styles.userHandle}>@{item.username}</Text>
                </View>

                {/* Stats */}
                <View style={styles.statsRight}>
                  <View style={styles.streakPill}>
                    <Ionicons name="flame" size={13} color="#FF6D7A" />
                    <Text style={styles.streakText}>{item.currentStreak}d</Text>
                  </View>
                  <Text style={styles.scoreText}>{item.overallScore}%</Text>
                </View>

                {/* Spectate Arrow */}
                {!isMe && (
                  <Ionicons name="chevron-forward" size={16} color={colors.muted} style={{ marginLeft: 6 }} />
                )}
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0813',
    padding: 18,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: 'white',
  },
  sub: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  tab: {
    flex: 1,
    minWidth: 120,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#161324',
  },
  tabActive: {
    backgroundColor: '#142928',
    borderColor: '#00F5D4',
    borderWidth: 1,
  },
  tabText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.muted,
  },
  tabTextActive: {
    color: '#00F5D4',
  },
  centerLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: colors.muted,
    fontSize: 13,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: 'white',
    marginTop: 8,
  },
  emptySub: {
    fontSize: 12,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 18,
  },
  listContent: {
    gap: 8,
    paddingBottom: 40,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141120',
    borderColor: '#241D35',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  rankRowMe: {
    borderColor: '#00F5D4',
    backgroundColor: '#112224',
  },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#1C1929',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  goldRank: {
    backgroundColor: '#FFB703',
  },
  silverRank: {
    backgroundColor: '#ADB5BD',
  },
  bronzeRank: {
    backgroundColor: '#D4A373',
  },
  rankNum: {
    color: '#0A0813',
    fontWeight: '900',
    fontSize: 12,
  },
  userName: {
    color: 'white',
    fontSize: 14,
    fontWeight: '800',
    flexShrink: 1,
  },
  userHandle: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 1,
  },
  youBadge: {
    backgroundColor: '#00F5D4',
    color: '#0A0813',
    fontSize: 9,
    fontWeight: '900',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  statsRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#261720',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  streakText: {
    color: '#FF6D7A',
    fontSize: 11,
    fontWeight: '800',
  },
  scoreText: {
    color: '#00F5D4',
    fontSize: 14,
    fontWeight: '900',
  },
});
