import { supabase } from '@/utils/supabase';
import { Friend, FriendRequest } from '@/src/types/friends';
import { isUUID } from '@/src/utils/uuid';

export class FriendService {
  /**
   * Updates user's display name with validation (1-50 characters).
   * Does NOT alter the immutable user ID or username.
   */
  async updateDisplayName(
    userId: string,
    newDisplayName: string
  ): Promise<{ success: boolean; error?: string; displayName?: string }> {
    if (!isUUID(userId)) {
      return { success: false, error: 'Invalid user session.' };
    }

    const cleaned = newDisplayName.trim();
    if (cleaned.length < 1) {
      return { success: false, error: 'Display name cannot be empty.' };
    }
    if (cleaned.length > 50) {
      return { success: false, error: 'Display name cannot exceed 50 characters.' };
    }

    try {
      // 1. Try RPC function
      const { data: rpcData, error: rpcErr } = await supabase.rpc('update_display_name', {
        new_display_name: cleaned,
      });

      if (!rpcErr && rpcData) {
        if (rpcData.success) {
          return { success: true, displayName: cleaned };
        }
        return { success: false, error: rpcData.error || 'Failed to update display name.' };
      }

      // 2. Direct fallback
      const { error: directErr } = await supabase
        .from('profiles')
        .update({
          name: cleaned,
          display_name: cleaned,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (directErr) {
        return { success: false, error: directErr.message || 'Failed to update display name.' };
      }

      return { success: true, displayName: cleaned };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update display name.';
      return { success: false, error: msg };
    }
  }

  /**
   * Search users by username.
   * STRICT PRIVACY: Returns ONLY safe public profile info (id, name, username, avatar).
   * NEVER returns private tasks, habits, meals, or journal entries.
   */
  async searchUsers(query: string, currentUserId?: string): Promise<Friend[]> {
    const q = query.trim().replace(/^@/, '');
    if (!q || q.length < 2) return [];

    try {
      // 1. Invoke secure server-side RPC returning ONLY public fields (never email/private data)
      const { data: rpcData, error: rpcErr } = await supabase.rpc('search_users_by_username', {
        search_term: q,
        limit_count: 15,
      });

      if (!rpcErr && Array.isArray(rpcData)) {
        return rpcData
          .filter((p: any) => p.id !== currentUserId)
          .map((p: any) => ({
            id: p.id,
            name: p.display_name || p.name || 'User',
            username: p.username || `user_${p.id.slice(0, 8)}`,
            avatar: p.avatar_url || (p.display_name || p.name)?.charAt(0).toUpperCase() || 'U',
          }));
      }

      // 2. Direct fallback (only reads rows allowed under strict RLS)
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, display_name, username, avatar_url')
        .or(`username.ilike.%${q}%,name.ilike.%${q}%`)
        .limit(15);

      if (error || !data) return [];

      return data
        .filter((p: any) => p.id !== currentUserId)
        .map((p: any) => ({
          id: p.id,
          name: p.display_name || p.name || 'User',
          username: p.username || `user_${p.id.slice(0, 8)}`,
          avatar: p.avatar_url || (p.display_name || p.name)?.charAt(0).toUpperCase() || 'U',
        }));
    } catch {
      return [];
    }
  }

  /**
   * Fetch all confirmed friends for the current user.
   */
  async fetchFriends(userId: string): Promise<Friend[]> {
    if (!isUUID(userId)) return [];

    try {
      const { data, error } = await supabase
        .from('friendships')
        .select('friend_id, profiles!friendships_friend_id_fkey(id, name, username, avatar_url)')
        .eq('user_id', userId);

      if (error || !data) {
        // Fallback: fetch friend_id then query profiles
        const { data: rawData, error: rawErr } = await supabase
          .from('friendships')
          .select('friend_id')
          .eq('user_id', userId);

        if (rawErr || !rawData || rawData.length === 0) return [];

        const friendIds = rawData.map((f: any) => f.friend_id);
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, name, username, avatar_url')
          .in('id', friendIds);

        if (!profilesData) return [];
        return profilesData.map((p: any) => ({
          id: p.id,
          name: p.name || 'Friend',
          username: p.username || '',
          avatar: p.avatar_url || p.name?.charAt(0).toUpperCase() || 'F',
        }));
      }

      return data
        .map((row: any) => {
          const p = row.profiles;
          if (!p) return null;
          return {
            id: p.id,
            name: p.name || 'Friend',
            username: p.username || '',
            avatar: p.avatar_url || p.name?.charAt(0).toUpperCase() || 'F',
          };
        })
        .filter((f: any): f is Friend => f !== null);
    } catch (err) {
      console.warn('[FriendService] fetchFriends error:', err);
      return [];
    }
  }

  /**
   * Fetch incoming and outgoing friend requests.
   */
  async fetchFriendRequests(
    userId: string
  ): Promise<{ incoming: FriendRequest[]; outgoing: FriendRequest[] }> {
    if (!isUUID(userId)) return { incoming: [], outgoing: [] };

    try {
      const { data, error } = await supabase
        .from('friend_requests')
        .select('*')
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error || !data) return { incoming: [], outgoing: [] };

      // Collect user IDs to fetch their profiles
      const userIds = new Set<string>();
      for (const r of data) {
        userIds.add(r.sender_id);
        userIds.add(r.receiver_id);
      }

      let profileMap = new Map<string, Friend>();
      if (userIds.size > 0) {
        const { data: pData } = await supabase
          .from('profiles')
          .select('id, name, username, avatar_url')
          .in('id', Array.from(userIds));

        if (pData) {
          for (const p of pData) {
            profileMap.set(p.id, {
              id: p.id,
              name: p.name || 'User',
              username: p.username || '',
              avatar: p.avatar_url || p.name?.charAt(0).toUpperCase() || 'U',
            });
          }
        }
      }

      const incoming: FriendRequest[] = [];
      const outgoing: FriendRequest[] = [];

      for (const row of data) {
        const req: FriendRequest = {
          id: row.id,
          senderId: row.sender_id,
          receiverId: row.receiver_id,
          status: row.status,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          sender: profileMap.get(row.sender_id),
          receiver: profileMap.get(row.receiver_id),
        };

        if (row.receiver_id === userId) {
          incoming.push(req);
        } else {
          outgoing.push(req);
        }
      }

      return { incoming, outgoing };
    } catch (err) {
      console.warn('[FriendService] fetchFriendRequests error:', err);
      return { incoming: [], outgoing: [] };
    }
  }

  /**
   * Send a friend request by username.
   */
  async sendFriendRequest(
    targetUsername: string,
    currentUserId: string
  ): Promise<{ success: boolean; error?: string; status?: string }> {
    const cleaned = targetUsername.trim().replace(/^@/, '');
    if (!cleaned) {
      return { success: false, error: 'Please enter a username.' };
    }

    try {
      // 1. Try secure RPC
      const { data: rpcData, error: rpcErr } = await supabase.rpc('send_friend_request', {
        target_username: cleaned,
      });

      if (!rpcErr && rpcData) {
        return rpcData;
      }

      // 2. Direct fallback
      const { data: targetProfile, error: profileErr } = await supabase
        .from('profiles')
        .select('id, username')
        .ilike('username', cleaned)
        .single();

      if (profileErr || !targetProfile) {
        return { success: false, error: 'User not found.' };
      }

      if (targetProfile.id === currentUserId) {
        return { success: false, error: 'You cannot send a friend request to yourself.' };
      }

      // Check existing friendship
      const { data: friendExists } = await supabase
        .from('friendships')
        .select('id')
        .eq('user_id', currentUserId)
        .eq('friend_id', targetProfile.id)
        .maybeSingle();

      if (friendExists) {
        return { success: false, error: 'You are already friends with this user.' };
      }

      // Check existing pending request
      const { data: pendingReq } = await supabase
        .from('friend_requests')
        .select('id, sender_id')
        .eq('status', 'pending')
        .or(
          `and(sender_id.eq.${currentUserId},receiver_id.eq.${targetProfile.id}),and(sender_id.eq.${targetProfile.id},receiver_id.eq.${currentUserId})`
        )
        .maybeSingle();

      if (pendingReq) {
        if (pendingReq.sender_id === currentUserId) {
          return { success: false, error: 'A pending friend request has already been sent.' };
        } else {
          // Auto-accept reciprocal request
          await this.respondFriendRequest(pendingReq.id, true);
          return { success: true, status: 'accepted' };
        }
      }

      const { error: insertErr } = await supabase.from('friend_requests').insert({
        sender_id: currentUserId,
        receiver_id: targetProfile.id,
        status: 'pending',
      });

      if (insertErr) {
        return { success: false, error: insertErr.message || 'Failed to send friend request.' };
      }

      return { success: true, status: 'pending' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send friend request.';
      return { success: false, error: msg };
    }
  }

  /**
   * Accept or decline a friend request.
   */
  async respondFriendRequest(
    requestId: string,
    accept: boolean
  ): Promise<{ success: boolean; error?: string }> {
    if (!isUUID(requestId)) {
      return { success: false, error: 'Invalid request ID.' };
    }

    try {
      // 1. Try secure RPC
      const { data: rpcData, error: rpcErr } = await supabase.rpc('respond_friend_request', {
        request_id: requestId,
        accept,
      });

      if (!rpcErr && rpcData) {
        return rpcData;
      }

      // 2. Direct fallback
      const status = accept ? 'accepted' : 'declined';
      const { data: req, error: updateErr } = await supabase
        .from('friend_requests')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', requestId)
        .select('*')
        .single();

      if (updateErr || !req) {
        return { success: false, error: updateErr?.message || 'Failed to respond to request.' };
      }

      if (accept) {
        // Create symmetric friendships
        await supabase.from('friendships').upsert([
          { user_id: req.sender_id, friend_id: req.receiver_id },
          { user_id: req.receiver_id, friend_id: req.sender_id },
        ]);
      }

      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to respond to request.';
      return { success: false, error: msg };
    }
  }

  /**
   * Remove a friend and delete reciprocal friendships.
   */
  async removeFriend(
    currentUserId: string,
    friendId: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!isUUID(currentUserId) || !isUUID(friendId)) {
      return { success: false, error: 'Invalid user ID.' };
    }

    try {
      // 1. Try secure RPC
      const { data: rpcData, error: rpcErr } = await supabase.rpc('remove_friend', {
        target_user_id: friendId,
      });

      if (!rpcErr && rpcData) {
        return rpcData;
      }

      // 2. Direct fallback
      await supabase
        .from('friendships')
        .delete()
        .or(
          `and(user_id.eq.${currentUserId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${currentUserId})`
        );

      await supabase
        .from('friend_requests')
        .delete()
        .or(
          `and(sender_id.eq.${currentUserId},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${currentUserId})`
        );

      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to remove friend.';
      return { success: false, error: msg };
    }
  }

  /**
   * Send a lightweight friend ping.
   * Rate limited to 1 ping per 60 seconds per friend.
   */
  async sendFriendPing(
    currentUserId: string,
    targetFriendId: string
  ): Promise<{ success: boolean; error?: string; cooldownRemaining?: number }> {
    if (!isUUID(currentUserId) || !isUUID(targetFriendId)) {
      return { success: false, error: 'Invalid user ID.' };
    }

    if (currentUserId === targetFriendId) {
      return { success: false, error: 'Cannot ping yourself.' };
    }

    try {
      // 1. Try secure RPC
      const { data: rpcData, error: rpcErr } = await supabase.rpc('send_friend_ping', {
        target_friend_id: targetFriendId,
      });

      if (!rpcErr && rpcData) {
        if (!rpcData.success && rpcData.cooldown_remaining) {
          return {
            success: false,
            error: rpcData.error,
            cooldownRemaining: rpcData.cooldown_remaining,
          };
        }
        return rpcData;
      }

      // 2. Direct fallback
      const { data: lastPing } = await supabase
        .from('friend_pings')
        .select('created_at')
        .eq('sender_id', currentUserId)
        .eq('receiver_id', targetFriendId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastPing) {
        const elapsed = (Date.now() - new Date(lastPing.created_at).getTime()) / 1000;
        if (elapsed < 60) {
          return {
            success: false,
            error: 'Please wait before pinging again.',
            cooldownRemaining: Math.ceil(60 - elapsed),
          };
        }
      }

      const { error: insertErr } = await supabase.from('friend_pings').insert({
        sender_id: currentUserId,
        receiver_id: targetFriendId,
      });

      if (insertErr) {
        return { success: false, error: insertErr.message || 'Failed to send ping.' };
      }

      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send ping.';
      return { success: false, error: msg };
    }
  }
}

export const friendService = new FriendService();
