/* eslint-disable react-hooks/set-state-in-effect */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors } from '@/src/theme';
import { Avatar } from '@/src/components/Avatar';
import { Friend, FriendRequest } from '@/src/types/friends';
import { feedback } from '@/src/services/feedback';

interface FriendsModalProps {
  visible: boolean;
  onClose: () => void;
  currentUserId: string;
  friends: Friend[];
  incomingRequests: FriendRequest[];
  outgoingRequests: FriendRequest[];
  pingCooldowns: Record<string, number>;
  onSendPing: (friendId: string) => Promise<{ success: boolean; error?: string; cooldownRemaining?: number }>;
  onSendRequest: (username: string) => Promise<{ success: boolean; error?: string }>;
  onRespondRequest: (requestId: string, accept: boolean) => Promise<{ success: boolean; error?: string }>;
  onRemoveFriend: (friendId: string) => Promise<{ success: boolean; error?: string }>;
  onSearchUsers: (query: string) => Promise<Friend[]>;
  hapticsEnabled?: boolean;
  sfxEnabled?: boolean;
}

export function FriendsModal({
  visible,
  onClose,
  currentUserId,
  friends,
  incomingRequests,
  outgoingRequests,
  pingCooldowns,
  onSendPing,
  onSendRequest,
  onRespondRequest,
  onRemoveFriend,
  onSearchUsers,
  hapticsEnabled = true,
  sfxEnabled = true,
}: FriendsModalProps) {
  const [activeTab, setActiveTab] = useState<'friends' | 'requests' | 'add'>('friends');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Friend[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setSearchQuery('');
      setSearchResults([]);
      setActiveTab('friends');
    }
  }, [visible]);

  const handleSearch = async (text: string) => {
    setSearchQuery(text);
    const cleaned = text.trim().replace(/^@/, '');
    if (cleaned.length >= 2) {
      setIsSearching(true);
      try {
        const results = await onSearchUsers(cleaned);
        setSearchResults(results.filter((u) => u.id !== currentUserId));
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    } else {
      setSearchResults([]);
      setIsSearching(false);
    }
  };

  const handleSendRequest = async (username: string) => {
    feedback.tap(hapticsEnabled);
    setActionLoadingId(username);
    const res = await onSendRequest(username);
    setActionLoadingId(null);

    if (res.success) {
      feedback.success(hapticsEnabled);
      feedback.sound('success', sfxEnabled);
      Alert.alert('Request Sent', `Friend request sent to @${username}`);
      setSearchQuery('');
      setSearchResults([]);
    } else {
      feedback.sound('error', sfxEnabled);
      Alert.alert('Could Not Send Request', res.error || 'Failed to send friend request');
    }
  };

  const handlePing = async (friend: Friend) => {
    const cooldown = pingCooldowns[friend.id] || 0;
    if (cooldown > 0) {
      Alert.alert(
        'Ping Cooldown',
        `You pinged ${friend.name} recently. Please wait ${cooldown}s before pinging again.`
      );
      return;
    }

    feedback.sound('notification', sfxEnabled);
    feedback.haptic('medium');
    setActionLoadingId(`ping-${friend.id}`);
    const res = await onSendPing(friend.id);
    setActionLoadingId(null);

    if (res.success) {
      feedback.success(hapticsEnabled);
      Alert.alert('👋 Ping Sent', `Pinged ${friend.name}!`);
    } else {
      feedback.sound('error', sfxEnabled);
      Alert.alert('Ping Failed', res.error || 'Could not ping friend.');
    }
  };

  const handleStartChat = (friend: Friend) => {
    feedback.tap(hapticsEnabled);
    onClose();
    router.push({
      pathname: '/conversation/dm' as any,
      params: {
        peerId: friend.id,
        peerName: friend.name,
        peerAvatar: friend.avatar,
      },
    });
  };

  const handleRemoveFriend = (friend: Friend) => {
    feedback.haptic('warning');
    Alert.alert(
      'Remove Friend',
      `Are you sure you want to remove ${friend.name} (@${friend.username}) from your friends?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setActionLoadingId(`remove-${friend.id}`);
            const res = await onRemoveFriend(friend.id);
            setActionLoadingId(null);
            if (res.success) {
              feedback.success(hapticsEnabled);
            } else {
              Alert.alert('Error', res.error || 'Failed to remove friend.');
            }
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Friends & Connections</Text>
              <Text style={styles.sub}>Solo connections independent of workspaces</Text>
            </View>
            <Pressable hitSlop={12} onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={colors.muted} />
            </Pressable>
          </View>

          {/* Navigation Tabs */}
          <View style={styles.tabBar}>
            <Pressable
              style={[styles.tabItem, activeTab === 'friends' && styles.tabItemActive]}
              onPress={() => {
                feedback.tap(hapticsEnabled);
                setActiveTab('friends');
              }}
            >
              <Text style={[styles.tabText, activeTab === 'friends' && styles.tabTextActive]}>
                Friends ({friends.length})
              </Text>
            </Pressable>

            <Pressable
              style={[styles.tabItem, activeTab === 'requests' && styles.tabItemActive]}
              onPress={() => {
                feedback.tap(hapticsEnabled);
                setActiveTab('requests');
              }}
            >
              <Text style={[styles.tabText, activeTab === 'requests' && styles.tabTextActive]}>
                Requests {incomingRequests.length > 0 ? `(${incomingRequests.length})` : ''}
              </Text>
              {incomingRequests.length > 0 && <View style={styles.unreadDot} />}
            </Pressable>

            <Pressable
              style={[styles.tabItem, activeTab === 'add' && styles.tabItemActive]}
              onPress={() => {
                feedback.tap(hapticsEnabled);
                setActiveTab('add');
              }}
            >
              <Ionicons
                name="person-add"
                size={14}
                color={activeTab === 'add' ? '#00F5D4' : colors.muted}
              />
              <Text style={[styles.tabText, activeTab === 'add' && styles.tabTextActive]}>
                Add Friend
              </Text>
            </Pressable>
          </View>

          {/* Tab 1: Friends List */}
          {activeTab === 'friends' && (
            <ScrollView style={styles.listContainer}>
              {friends.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="people-outline" size={48} color={colors.muted} />
                  <Text style={styles.emptyTitle}>No friends yet</Text>
                  <Text style={styles.emptySub}>
                    Connect with friends by username to chat 1-on-1 and send lightweight pings.
                  </Text>
                  <Pressable
                    style={styles.emptyButton}
                    onPress={() => {
                      feedback.tap(hapticsEnabled);
                      setActiveTab('add');
                    }}
                  >
                    <Ionicons name="person-add" size={16} color="#0C0B12" />
                    <Text style={styles.emptyButtonText}>Add Friends</Text>
                  </Pressable>
                </View>
              ) : (
                friends.map((f) => {
                  const cooldown = pingCooldowns[f.id] || 0;
                  const isPinging = actionLoadingId === `ping-${f.id}`;

                  return (
                    <View key={f.id} style={styles.friendRow}>
                      <Avatar uri={f.avatar} name={f.name} size={42} />
                      <View style={styles.friendInfo}>
                        <Text style={styles.friendName} numberOfLines={1}>
                          {f.name}
                        </Text>
                        <Text style={styles.friendUsername} numberOfLines={1}>
                          @{f.username}
                        </Text>
                      </View>

                      <View style={styles.friendActions}>
                        {/* Ping Button */}
                        <Pressable
                          style={[styles.actionBtn, styles.pingBtn, cooldown > 0 && styles.btnDisabled]}
                          onPress={() => handlePing(f)}
                          disabled={isPinging || cooldown > 0}
                          accessibilityLabel={`Ping ${f.name}`}
                        >
                          {isPinging ? (
                            <ActivityIndicator size="small" color="#00F5D4" />
                          ) : (
                            <>
                              <Ionicons name="hand-right" size={14} color="#00F5D4" />
                              <Text style={styles.pingText}>
                                {cooldown > 0 ? `${cooldown}s` : 'Ping'}
                              </Text>
                            </>
                          )}
                        </Pressable>

                        {/* Direct Chat Button */}
                        <Pressable
                          style={[styles.actionBtn, styles.chatBtn]}
                          onPress={() => handleStartChat(f)}
                          accessibilityLabel={`Chat with ${f.name}`}
                        >
                          <Ionicons name="chatbubble-outline" size={16} color="white" />
                        </Pressable>

                        {/* Remove Friend Button */}
                        <Pressable
                          style={[styles.actionBtn, styles.removeBtn]}
                          onPress={() => handleRemoveFriend(f)}
                          accessibilityLabel={`Remove ${f.name}`}
                        >
                          <Ionicons name="person-remove-outline" size={15} color="#FF6D7A" />
                        </Pressable>
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>
          )}

          {/* Tab 2: Requests */}
          {activeTab === 'requests' && (
            <ScrollView style={styles.listContainer}>
              {incomingRequests.length === 0 && outgoingRequests.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="mail-open-outline" size={48} color={colors.muted} />
                  <Text style={styles.emptyTitle}>No pending requests</Text>
                  <Text style={styles.emptySub}>
                    Incoming friend invites from other EvoRyz users will appear here.
                  </Text>
                </View>
              ) : (
                <>
                  {incomingRequests.length > 0 && (
                    <View style={styles.sectionHeader}>
                      <Text style={styles.sectionTitle}>
                        INCOMING REQUESTS ({incomingRequests.length})
                      </Text>
                    </View>
                  )}
                  {incomingRequests.map((req) => (
                    <View key={req.id} style={styles.requestRow}>
                      <Avatar
                        uri={req.sender?.avatar}
                        name={req.sender?.name || 'User'}
                        size={40}
                      />
                      <View style={styles.friendInfo}>
                        <Text style={styles.friendName} numberOfLines={1}>
                          {req.sender?.name || 'User'}
                        </Text>
                        <Text style={styles.friendUsername} numberOfLines={1}>
                          @{req.sender?.username || 'unknown'}
                        </Text>
                      </View>

                      <View style={styles.requestActions}>
                        <Pressable
                          style={[styles.actionBtn, styles.acceptBtn]}
                          onPress={async () => {
                            feedback.tap(hapticsEnabled);
                            setActionLoadingId(`req-${req.id}`);
                            const res = await onRespondRequest(req.id, true);
                            setActionLoadingId(null);
                            if (res.success) {
                              feedback.success(hapticsEnabled);
                              feedback.sound('success', sfxEnabled);
                            }
                          }}
                        >
                          <Ionicons name="checkmark" size={16} color="#0C0B12" />
                          <Text style={styles.acceptBtnText}>Accept</Text>
                        </Pressable>

                        <Pressable
                          style={[styles.actionBtn, styles.declineBtn]}
                          onPress={async () => {
                            feedback.tap(hapticsEnabled);
                            setActionLoadingId(`req-${req.id}`);
                            await onRespondRequest(req.id, false);
                            setActionLoadingId(null);
                          }}
                        >
                          <Ionicons name="close" size={16} color={colors.muted} />
                        </Pressable>
                      </View>
                    </View>
                  ))}

                  {outgoingRequests.length > 0 && (
                    <View style={[styles.sectionHeader, { marginTop: 18 }]}>
                      <Text style={styles.sectionTitle}>
                        OUTGOING REQUESTS ({outgoingRequests.length})
                      </Text>
                    </View>
                  )}
                  {outgoingRequests.map((req) => (
                    <View key={req.id} style={styles.requestRow}>
                      <Avatar
                        uri={req.receiver?.avatar}
                        name={req.receiver?.name || 'User'}
                        size={40}
                      />
                      <View style={styles.friendInfo}>
                        <Text style={styles.friendName} numberOfLines={1}>
                          {req.receiver?.name || 'User'}
                        </Text>
                        <Text style={styles.friendUsername} numberOfLines={1}>
                          @{req.receiver?.username || 'unknown'}
                        </Text>
                        <Text style={styles.pendingBadge}>Waiting for response</Text>
                      </View>

                      <Pressable
                        style={[styles.actionBtn, styles.cancelBtn]}
                        onPress={async () => {
                          feedback.tap(hapticsEnabled);
                          setActionLoadingId(`req-${req.id}`);
                          await onRespondRequest(req.id, false);
                          setActionLoadingId(null);
                        }}
                      >
                        <Text style={styles.cancelBtnText}>Cancel</Text>
                      </Pressable>
                    </View>
                  ))}
                </>
              )}
            </ScrollView>
          )}

          {/* Tab 3: Add Friend */}
          {activeTab === 'add' && (
            <View style={styles.addTabContainer}>
              <View style={styles.searchBox}>
                <Ionicons name="search" size={18} color={colors.muted} />
                <TextInput
                  value={searchQuery}
                  onChangeText={handleSearch}
                  placeholder="Enter @username to find friends..."
                  placeholderTextColor={colors.muted}
                  style={styles.searchInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {isSearching && <ActivityIndicator size="small" color="#00F5D4" />}
              </View>

              <ScrollView style={styles.resultsList}>
                {searchResults.length === 0 && searchQuery.trim().length >= 2 && !isSearching && (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyTitle}>No user found</Text>
                    <Text style={styles.emptySub}>
                      Make sure the username is spelled correctly.
                    </Text>
                  </View>
                )}

                {searchResults.map((user) => {
                  const isAlreadyFriend = friends.some((f) => f.id === user.id);
                  const isPendingOutgoing = outgoingRequests.some((r) => r.receiverId === user.id);
                  const isPendingIncoming = incomingRequests.some((r) => r.senderId === user.id);
                  const isLoading = actionLoadingId === user.username;

                  return (
                    <View key={user.id} style={styles.userResultRow}>
                      <Avatar uri={user.avatar} name={user.name} size={42} />
                      <View style={styles.friendInfo}>
                        <Text style={styles.friendName} numberOfLines={1}>
                          {user.name}
                        </Text>
                        <Text style={styles.friendUsername} numberOfLines={1}>
                          @{user.username}
                        </Text>
                      </View>

                      {isAlreadyFriend ? (
                        <View style={styles.statusPill}>
                          <Ionicons name="checkmark-circle" size={14} color="#00F5D4" />
                          <Text style={styles.statusText}>Friends</Text>
                        </View>
                      ) : isPendingOutgoing ? (
                        <View style={styles.statusPill}>
                          <Ionicons name="time" size={14} color="#FFB703" />
                          <Text style={[styles.statusText, { color: '#FFB703' }]}>Requested</Text>
                        </View>
                      ) : isPendingIncoming ? (
                        <View style={styles.statusPill}>
                          <Ionicons name="mail" size={14} color="#A78BFA" />
                          <Text style={[styles.statusText, { color: '#A78BFA' }]}>Check Req</Text>
                        </View>
                      ) : (
                        <Pressable
                          style={styles.addBtn}
                          disabled={isLoading}
                          onPress={() => handleSendRequest(user.username)}
                        >
                          {isLoading ? (
                            <ActivityIndicator size="small" color="#0C0B12" />
                          ) : (
                            <>
                              <Ionicons name="person-add" size={14} color="#0C0B12" />
                              <Text style={styles.addBtnText}>Add</Text>
                            </>
                          )}
                        </Pressable>
                      )}
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 4, 10, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },
  modalCard: {
    width: '100%',
    maxHeight: '88%',
    backgroundColor: '#120F24',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#7357F640',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  title: {
    color: '#F7F5FC',
    fontSize: 20,
    fontWeight: '800',
  },
  sub: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#1A1633',
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
    gap: 4,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  tabItemActive: {
    backgroundColor: '#26204D',
    borderWidth: 1,
    borderColor: '#00F5D440',
  },
  tabText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#00F5D4',
    fontWeight: '800',
  },
  unreadDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF6D7A',
  },
  listContainer: {
    maxHeight: 420,
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#181432',
    padding: 12,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#7357F620',
  },
  friendInfo: {
    flex: 1,
    marginLeft: 12,
  },
  friendName: {
    color: '#F7F5FC',
    fontSize: 15,
    fontWeight: '700',
  },
  friendUsername: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 1,
  },
  friendActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  pingBtn: {
    backgroundColor: '#00F5D418',
    borderWidth: 1,
    borderColor: '#00F5D440',
    gap: 4,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  pingText: {
    color: '#00F5D4',
    fontSize: 12,
    fontWeight: '700',
  },
  chatBtn: {
    backgroundColor: '#7357F630',
    borderWidth: 1,
    borderColor: '#7357F650',
    paddingHorizontal: 10,
  },
  removeBtn: {
    backgroundColor: '#FF6D7A15',
    borderWidth: 1,
    borderColor: '#FF6D7A30',
    paddingHorizontal: 8,
  },
  sectionHeader: {
    paddingVertical: 6,
    marginBottom: 6,
  },
  sectionTitle: {
    color: colors.violetLight,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#181432',
    padding: 12,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#7357F620',
  },
  requestActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  acceptBtn: {
    backgroundColor: '#00F5D4',
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 12,
  },
  acceptBtnText: {
    color: '#0C0B12',
    fontSize: 12,
    fontWeight: '800',
  },
  declineBtn: {
    backgroundColor: '#26204D',
    borderWidth: 1,
    borderColor: '#7357F630',
    paddingHorizontal: 10,
  },
  cancelBtn: {
    backgroundColor: '#26204D',
    paddingHorizontal: 10,
  },
  cancelBtnText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '600',
  },
  pendingBadge: {
    color: '#FFB703',
    fontSize: 10,
    marginTop: 2,
    fontWeight: '600',
  },
  addTabContainer: {
    maxHeight: 440,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1633',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#7357F640',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: 'white',
    fontSize: 14,
    padding: 0,
  },
  resultsList: {
    maxHeight: 340,
  },
  userResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#181432',
    padding: 12,
    borderRadius: 14,
    marginBottom: 8,
  },
  addBtn: {
    backgroundColor: '#00F5D4',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  addBtnText: {
    color: '#0C0B12',
    fontSize: 12,
    fontWeight: '800',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#120F24',
    borderRadius: 8,
  },
  statusText: {
    color: '#00F5D4',
    fontSize: 11,
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    color: '#F7F5FC',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 4,
  },
  emptySub: {
    color: colors.muted,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#00F5D4',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 16,
  },
  emptyButtonText: {
    color: '#0C0B12',
    fontSize: 13,
    fontWeight: '800',
  },
});
