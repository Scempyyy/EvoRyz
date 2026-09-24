import { supabase } from '@/utils/supabase';
import {
  DailyTask,
  Habit,
  Goal,
  Meal,
  Message,
  JournalEntry,
  Workspace,
  WorkspaceMember,
  ActivityEvent,
  DailySummary,
  User,
  WorkspaceTheme,
  TeamGoal,
  DirectMessage,
  AuditLogEntry,
} from '@/src/types';
import { JournalSecurityConfig } from '@/src/services/encryption';
import { ensureUUID, isUUID, generateUUID } from '@/src/utils/uuid';
import type { RealtimeChannel } from '@supabase/supabase-js';

export class SupabaseRepository {
  private messageChannel: RealtimeChannel | null = null;

  // --------------------------------------------------------------------------
  // PROFILES
  // --------------------------------------------------------------------------
  async getProfile(userId: string): Promise<Partial<User> | null> {
    if (!isUUID(userId)) return null;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.warn('[SupabaseRepository] getProfile error:', error.message);
        return null;
      }
      if (!data) return null;

      return {
        id: data.id,
        email: data.email,
        name: data.name,
        username: data.username,
        avatar: data.avatar_url || data.name?.charAt(0)?.toUpperCase() || 'U',
      };
    } catch (err) {
      console.warn('[SupabaseRepository] getProfile exception:', err);
      return null;
    }
  }

  async upsertProfile(user: Partial<User> & { id: string }): Promise<void> {
    if (!isUUID(user.id)) return;
    try {
      await supabase.from('profiles').upsert({
        id: user.id,
        email: user.email,
        name: user.name,
        username: user.username,
        avatar_url: user.avatar,
        updated_at: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('[SupabaseRepository] upsertProfile error:', err);
    }
  }

  async ensureProfile(user: Partial<User> & { id: string }): Promise<void> {
    if (!isUUID(user.id)) return;
    try {
      // 1. Try secure RPC ensure_profile_exists
      const { error: rpcErr } = await supabase.rpc('ensure_profile_exists', {
        target_user_id: user.id,
      });
      if (!rpcErr) return;

      // 2. Direct upsert fallback
      await supabase.from('profiles').upsert(
        {
          id: user.id,
          email: user.email ?? null,
          name: user.name ?? 'User',
          username: user.username ?? `user_${user.id.slice(0, 8)}`,
          avatar_url: user.avatar ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id', ignoreDuplicates: true }
      );
    } catch (err) {
      console.warn('[SupabaseRepository] ensureProfile error:', err);
    }
  }

  async updateUsername(
    userId: string,
    newUsername: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!isUUID(userId)) {
      return { success: false, error: 'Invalid user session.' };
    }

    const cleaned = newUsername.trim().toLowerCase();
    if (cleaned.length < 3 || cleaned.length > 20) {
      return { success: false, error: 'Username must be between 3 and 20 characters.' };
    }
    if (!/^[a-z0-9_]+$/.test(cleaned)) {
      return {
        success: false,
        error: 'Username may only contain letters, numbers, and underscores.',
      };
    }

    try {
      // 1. Attempt secure RPC first
      const { data: rpcData, error: rpcErr } = await supabase.rpc('update_username', {
        new_username: cleaned,
      });

      if (!rpcErr && rpcData) {
        return { success: true };
      }

      if (rpcErr) {
        const msg = rpcErr.message || '';
        if (msg.includes('already taken') || rpcErr.code === '23505') {
          return { success: false, error: 'Username is already taken.' };
        }
        if (msg.includes('characters') || msg.includes('may only contain')) {
          return { success: false, error: msg };
        }
      }

      // 2. Fallback direct profile update
      const { error: directErr } = await supabase
        .from('profiles')
        .update({ username: cleaned, updated_at: new Date().toISOString() })
        .eq('id', userId);

      if (directErr) {
        if (
          directErr.code === '23505' ||
          directErr.message?.includes('duplicate key') ||
          directErr.message?.includes('unique')
        ) {
          return { success: false, error: 'Username is already taken.' };
        }
        return { success: false, error: directErr.message || 'Failed to update username.' };
      }

      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update username.';
      return { success: false, error: msg };
    }
  }

  // --------------------------------------------------------------------------
  // TASKS
  // --------------------------------------------------------------------------
  async fetchTasks(userId: string, activeDay: string): Promise<DailyTask[]> {
    if (!isUUID(userId)) return [];
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', userId)
        .eq('date', activeDay);

      if (error || !data) return [];

      return data.map((row) => ({
        id: row.id,
        ownerId: row.user_id,
        workspaceId: row.workspace_id ?? undefined,
        title: row.title,
        description: row.description ?? undefined,
        visibility: row.visibility,
        date: row.date,
        completed: row.completed,
        category: row.category ?? undefined,
        streak: row.streak ?? 0,
      }));
    } catch {
      return [];
    }
  }

  async upsertTask(task: DailyTask): Promise<void> {
    if (!isUUID(task.ownerId)) return;
    const taskId = ensureUUID(task.id);
    const workspaceId = task.workspaceId && isUUID(task.workspaceId) ? task.workspaceId : null;
    try {
      await supabase.from('tasks').upsert({
        id: taskId,
        user_id: task.ownerId,
        workspace_id: workspaceId,
        title: task.title,
        description: task.description || null,
        visibility: task.visibility,
        date: task.date,
        completed: task.completed,
        category: task.category || null,
        streak: task.streak || 0,
        updated_at: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('[SupabaseRepository] upsertTask error:', err);
    }
  }

  async deleteTask(taskId: string): Promise<void> {
    if (!isUUID(taskId)) return;
    try {
      await supabase.from('tasks').delete().eq('id', taskId);
    } catch (err) {
      console.warn('[SupabaseRepository] deleteTask error:', err);
    }
  }

  // --------------------------------------------------------------------------
  // HABITS
  // --------------------------------------------------------------------------
  async fetchHabits(userId: string): Promise<Habit[]> {
    if (!isUUID(userId)) return [];
    try {
      const { data, error } = await supabase
        .from('habits')
        .select('*')
        .eq('user_id', userId);

      if (error || !data) return [];

      return data.map((row) => ({
        id: row.id,
        ownerId: row.user_id,
        workspaceId: row.workspace_id ?? undefined,
        name: row.name,
        description: row.description ?? undefined,
        type: row.type,
        visibility: row.visibility,
        frequency: row.frequency ?? 'daily',
        currentStreak: row.current_streak ?? 0,
        bestStreak: row.best_streak ?? 0,
        completedToday: row.completed_today ?? false,
        history: Array.isArray(row.history) ? row.history : [],
      }));
    } catch {
      return [];
    }
  }

  async upsertHabit(habit: Habit): Promise<void> {
    if (!isUUID(habit.ownerId)) return;
    const habitId = ensureUUID(habit.id);
    const workspaceId = habit.workspaceId && isUUID(habit.workspaceId) ? habit.workspaceId : null;
    try {
      await supabase.from('habits').upsert({
        id: habitId,
        user_id: habit.ownerId,
        workspace_id: workspaceId,
        name: habit.name,
        description: habit.description || null,
        type: habit.type,
        visibility: habit.visibility,
        frequency: habit.frequency,
        current_streak: habit.currentStreak,
        best_streak: habit.bestStreak,
        completed_today: habit.completedToday,
        history: habit.history,
        updated_at: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('[SupabaseRepository] upsertHabit error:', err);
    }
  }

  async deleteHabit(habitId: string): Promise<void> {
    if (!isUUID(habitId)) return;
    try {
      await supabase.from('habits').delete().eq('id', habitId);
    } catch (err) {
      console.warn('[SupabaseRepository] deleteHabit error:', err);
    }
  }

  // --------------------------------------------------------------------------
  // GOALS
  // --------------------------------------------------------------------------
  async fetchGoals(userId: string): Promise<Goal[]> {
    if (!isUUID(userId)) return [];
    try {
      const { data, error } = await supabase
        .from('goals')
        .select('*')
        .eq('user_id', userId);

      if (error || !data) return [];

      return data.map((row) => ({
        id: row.id,
        ownerId: row.user_id,
        workspaceId: row.workspace_id ?? undefined,
        title: row.title,
        description: row.description ?? '',
        visibility: row.visibility,
        progress: row.progress ?? 0,
        deadline: row.deadline ?? 'No deadline',
        priority: row.priority ?? 'medium',
        category: row.category ?? 'Personal',
        milestones: Array.isArray(row.milestones) ? row.milestones : [],
      }));
    } catch {
      return [];
    }
  }

  async upsertGoal(goal: Goal): Promise<void> {
    if (!isUUID(goal.ownerId)) return;
    const goalId = ensureUUID(goal.id);
    const workspaceId = goal.workspaceId && isUUID(goal.workspaceId) ? goal.workspaceId : null;
    const milestones = (goal.milestones || []).map((m) => ({
      ...m,
      id: ensureUUID(m.id),
    }));
    try {
      await supabase.from('goals').upsert({
        id: goalId,
        user_id: goal.ownerId,
        workspace_id: workspaceId,
        title: goal.title,
        description: goal.description,
        visibility: goal.visibility,
        progress: goal.progress,
        deadline: goal.deadline,
        priority: goal.priority,
        category: goal.category,
        milestones,
        updated_at: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('[SupabaseRepository] upsertGoal error:', err);
    }
  }

  async deleteGoal(goalId: string): Promise<void> {
    if (!isUUID(goalId)) return;
    try {
      await supabase.from('goals').delete().eq('id', goalId);
    } catch (err) {
      console.warn('[SupabaseRepository] deleteGoal error:', err);
    }
  }

  // --------------------------------------------------------------------------
  // MEALS
  // --------------------------------------------------------------------------
  async fetchMeals(userId: string, activeDay: string): Promise<Meal[]> {
    if (!isUUID(userId)) return [];
    try {
      const { data, error } = await supabase
        .from('meals')
        .select('*')
        .eq('user_id', userId)
        .eq('date', activeDay);

      if (error || !data) return [];

      return data.map((row) => ({
        id: row.id,
        ownerId: row.user_id,
        workspaceId: row.workspace_id ?? undefined,
        name: row.name,
        type: row.type,
        calories: row.calories ?? 0,
        protein: row.protein ?? 0,
        carbs: row.carbs ?? 0,
        fat: row.fat ?? 0,
        fiber: row.fiber ?? 0,
        notes: row.notes ?? undefined,
        photoUri: row.photo_uri ?? undefined,
        visibility: row.visibility,
        date: row.date,
      }));
    } catch {
      return [];
    }
  }

  async insertMeal(meal: Meal): Promise<void> {
    if (!isUUID(meal.ownerId)) return;
    const mealId = ensureUUID(meal.id);
    const workspaceId = meal.workspaceId && isUUID(meal.workspaceId) ? meal.workspaceId : null;
    try {
      await supabase.from('meals').insert({
        id: mealId,
        user_id: meal.ownerId,
        workspace_id: workspaceId,
        name: meal.name,
        type: meal.type,
        calories: meal.calories,
        protein: meal.protein,
        carbs: meal.carbs,
        fat: meal.fat,
        fiber: meal.fiber,
        notes: meal.notes || null,
        photo_uri: meal.photoUri || null,
        visibility: meal.visibility,
        date: meal.date,
      });
    } catch (err) {
      console.warn('[SupabaseRepository] insertMeal error:', err);
    }
  }

  async deleteMeal(mealId: string): Promise<void> {
    if (!isUUID(mealId)) return;
    try {
      await supabase.from('meals').delete().eq('id', mealId);
    } catch (err) {
      console.warn('[SupabaseRepository] deleteMeal error:', err);
    }
  }

  async updateMeal(meal: Meal): Promise<void> {
    if (!isUUID(meal.id)) return;
    try {
      await supabase
        .from('meals')
        .update({
          name: meal.name,
          type: meal.type,
          calories: meal.calories,
          protein: meal.protein,
          carbs: meal.carbs,
          fat: meal.fat,
          fiber: meal.fiber,
          notes: meal.notes || null,
          photo_uri: meal.photoUri || null,
          visibility: meal.visibility,
        })
        .eq('id', meal.id);
    } catch (err) {
      console.warn('[SupabaseRepository] updateMeal error:', err);
    }
  }

  // --------------------------------------------------------------------------
  // WORKSPACE CHAT MESSAGES & REALTIME
  // --------------------------------------------------------------------------
  async fetchMessages(conversationId: string, workspaceId?: string): Promise<Message[]> {
    try {
      let query = supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(100);

      if (workspaceId && isUUID(workspaceId)) {
        query = query.eq('workspace_id', workspaceId);
      } else {
        query = query.eq('conversation_id', conversationId);
      }

      const { data, error } = await query;
      if (error || !data) {
        if (error) console.warn('[SupabaseRepository] fetchMessages error:', error.message);
        return [];
      }

      return data.map((row) => ({
        id: row.id,
        workspaceId: row.workspace_id ?? undefined,
        conversationId: row.conversation_id || conversationId,
        senderId: row.sender_id,
        type: row.message_type || row.type || 'text',
        content: row.content || row.body || '',
        timestamp: row.created_at,
        status: row.status ?? 'sent',
        replyTo: row.reply_to ?? undefined,
        reactions: Array.isArray(row.reactions) ? row.reactions : [],
        uri: row.uri || row.media_url || undefined,
        thumbnailUri: row.thumbnail_uri ?? undefined,
        attachmentName: row.attachment_name ?? undefined,
        mimeType: row.mime_type ?? undefined,
        size: row.size ?? undefined,
        width: row.width ?? undefined,
        height: row.height ?? undefined,
        duration: row.duration ?? undefined,
        isPinned: Boolean(row.is_pinned),
        pinnedBy: row.pinned_by ?? undefined,
        pinnedAt: row.pinned_at ?? undefined,
      }));
    } catch (err) {
      console.warn('[SupabaseRepository] fetchMessages exception:', err);
      return [];
    }
  }

  async insertActivity(activity: ActivityEvent): Promise<boolean> {
    try {
      if (!isUUID(activity.userId)) return false;
      const { error } = await supabase.from('activities').insert({
        id: ensureUUID(activity.id),
        user_id: ensureUUID(activity.userId),
        workspace_id: activity.workspaceId && isUUID(activity.workspaceId) ? ensureUUID(activity.workspaceId) : null,
        type: activity.type,
        title: activity.title,
        visibility: activity.visibility,
        timestamp: activity.timestamp,
      });
      if (error) {
        console.warn('[SupabaseRepository] insertActivity failed:', error.message);
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  async uploadWorkspaceMedia(
    workspaceId: string,
    messageId: string,
    localUri: string,
    mimeType?: string,
    fileName?: string
  ): Promise<string | null> {
    try {
      if (!isUUID(workspaceId) || !localUri) return null;

      let ext = 'bin';
      let contentType = mimeType || 'application/octet-stream';

      if (fileName && fileName.includes('.')) {
        const parts = fileName.split('.');
        const cand = parts[parts.length - 1]?.toLowerCase();
        if (cand && cand.length <= 5) ext = cand;
      } else if (localUri.includes('.')) {
        const cleanUri = localUri.split('?')[0];
        const parts = cleanUri.split('.');
        const cand = parts[parts.length - 1]?.toLowerCase();
        if (cand && cand.length <= 5 && !cand.includes('/')) ext = cand;
      }

      if (ext === 'bin' && mimeType) {
        if (mimeType.includes('jpeg') || mimeType.includes('jpg')) ext = 'jpg';
        else if (mimeType.includes('png')) ext = 'png';
        else if (mimeType.includes('gif')) ext = 'gif';
        else if (mimeType.includes('webp')) ext = 'webp';
        else if (mimeType.includes('m4a') || mimeType.includes('mp4a')) ext = 'm4a';
        else if (mimeType.includes('mp3')) ext = 'mp3';
        else if (mimeType.includes('aac')) ext = 'aac';
        else if (mimeType.includes('wav')) ext = 'wav';
        else if (mimeType.includes('mp4')) ext = 'mp4';
        else if (mimeType.includes('quicktime')) ext = 'mov';
        else if (mimeType.includes('pdf')) ext = 'pdf';
      }

      if (!mimeType || mimeType === 'application/octet-stream') {
        if (ext === 'jpg' || ext === 'jpeg') contentType = 'image/jpeg';
        else if (ext === 'png') contentType = 'image/png';
        else if (ext === 'gif') contentType = 'image/gif';
        else if (ext === 'webp') contentType = 'image/webp';
        else if (ext === 'm4a') contentType = 'audio/m4a';
        else if (ext === 'mp3') contentType = 'audio/mpeg';
        else if (ext === 'wav') contentType = 'audio/wav';
        else if (ext === 'mp4') contentType = 'video/mp4';
        else if (ext === 'pdf') contentType = 'application/pdf';
      }

      const storagePath = `${workspaceId}/${ensureUUID(messageId)}.${ext}`;

      const res = await fetch(localUri);
      const blob = await res.blob();

      const { data, error } = await supabase.storage
        .from('workspace-media')
        .upload(storagePath, blob, {
          contentType,
          upsert: true,
        });

      if (error) {
        console.warn('[SupabaseRepository] uploadWorkspaceMedia error:', error.message);
        return null;
      }

      return data?.path || storagePath;
    } catch (err: unknown) {
      console.warn('[SupabaseRepository] uploadWorkspaceMedia exception:', err instanceof Error ? err.message : err);
      return null;
    }
  }

  async getSignedMediaUrl(path: string, expiresIn = 86400): Promise<string | null> {
    try {
      if (!path) return null;
      const cleanPath = path.replace(/^workspace-media\//, '').replace(/^\/+/, '');
      if (cleanPath.startsWith('http://') || cleanPath.startsWith('https://')) {
        return cleanPath;
      }
      if (cleanPath.startsWith('file://') || cleanPath.startsWith('content://')) {
        return null;
      }

      const { data, error } = await supabase.storage
        .from('workspace-media')
        .createSignedUrl(cleanPath, expiresIn);

      if (error) {
        console.warn('[SupabaseRepository] getSignedMediaUrl error:', error.message);
        return null;
      }

      return data?.signedUrl || null;
    } catch (err) {
      console.warn('[SupabaseRepository] getSignedMediaUrl exception:', err);
      return null;
    }
  }

  async insertMessage(message: Message): Promise<{ success: boolean; error?: string }> {
    if (!isUUID(message.senderId)) return { success: false, error: 'Invalid sender ID' };
    const msgId = ensureUUID(message.id);
    const workspaceId = message.workspaceId && isUUID(message.workspaceId) ? message.workspaceId : null;
    const msgType = message.type || 'text';
    const validDbTypes = ['text', 'image', 'video', 'file', 'voice', 'system', 'ai'];
    const dbMessageType = validDbTypes.includes(msgType) ? msgType : 'text';
    try {
      let finalUri = message.uri || null;
      if (workspaceId && finalUri && (finalUri.startsWith('file://') || finalUri.startsWith('content://'))) {
        const uploadedPath = await this.uploadWorkspaceMedia(
          workspaceId,
          msgId,
          finalUri,
          message.mimeType,
          message.attachmentName
        );
        if (uploadedPath) {
          finalUri = uploadedPath;
        }
      }

      const payload: Record<string, unknown> = {
        id: msgId,
        workspace_id: workspaceId,
        sender_id: message.senderId,
        conversation_id: message.conversationId || 'workspace',
        type: msgType,
        message_type: dbMessageType,
        content: message.content,
        body: message.content,
        status: message.status || 'sent',
        reply_to: message.replyTo && isUUID(message.replyTo) ? message.replyTo : null,
        reactions: message.reactions || [],
        uri: finalUri,
        thumbnail_uri: message.thumbnailUri || null,
        attachment_name: message.attachmentName || null,
        mime_type: message.mimeType || null,
        size: message.size || null,
        width: message.width || null,
        height: message.height || null,
        duration: message.duration || null,
      };

      const { error } = await supabase.from('messages').insert(payload);
      if (error) {
        console.warn('[SupabaseRepository] insertMessage error:', error.message);
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'insertMessage failed';
      console.warn('[SupabaseRepository] insertMessage exception:', msg);
      return { success: false, error: msg };
    }
  }

  // --------------------------------------------------------------------------
  // AI MENTOR PERSISTENCE
  // --------------------------------------------------------------------------
  async fetchAiMessages(userId: string): Promise<{ role: 'user' | 'model'; content: string }[]> {
    if (!isUUID(userId)) return [];
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('id, type, content, body, created_at')
        .eq('conversation_id', 'ai')
        .eq('sender_id', userId)
        .order('created_at', { ascending: true })
        .limit(100);

      if (error || !data) return [];
      return data.map((r) => ({
        role: r.type === 'user' ? 'user' : 'model',
        content: r.content || r.body || '',
      }));
    } catch {
      return [];
    }
  }

  async insertAiMessage(
    userId: string,
    role: 'user' | 'model',
    content: string
  ): Promise<boolean> {
    if (!isUUID(userId)) return false;
    try {
      const { error } = await supabase.from('messages').insert({
        id: generateUUID(),
        sender_id: userId,
        workspace_id: null,
        conversation_id: 'ai',
        type: role,
        message_type: 'text',
        content,
        body: content,
        status: 'sent',
      });
      if (error) {
        console.warn('[SupabaseRepository] insertAiMessage error:', error.message);
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  subscribeToMessages(
    conversationId: string,
    onNewMessage: (msg: Message) => void,
    workspaceId?: string,
    onStatusChange?: (
      status: 'SUBSCRIBED' | 'CONNECTING' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED',
      error?: Error
    ) => void
  ): () => void {
    let isCancelled = false;
    let subscribeTimer: ReturnType<typeof setTimeout> | null = null;
    let isTerminal = false;

    if (this.messageChannel) {
      const oldChannel = this.messageChannel;
      this.messageChannel = null;
      void supabase.removeChannel(oldChannel).catch((err) => {
        console.warn('[SupabaseRepository] Error removing old channel:', err);
      });
    }

    const validWsId = workspaceId && isUUID(workspaceId) ? workspaceId : null;
    const channelTopic = validWsId
      ? `chat-ws-${validWsId}-${Date.now()}`
      : `chat-${conversationId}-${Date.now()}`;
    const filter = validWsId
      ? `workspace_id=eq.${validWsId}`
      : `conversation_id=eq.${conversationId}`;

    const setup = async () => {
      onStatusChange?.('CONNECTING');

      try {
        if (!supabase.realtime.isConnected()) {
          console.log('[SupabaseRepository] Realtime socket not connected. Connecting now...');
          supabase.realtime.connect();
        }
      } catch (connErr) {
        console.warn('[SupabaseRepository] Realtime connect warning:', connErr);
      }

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          await supabase.realtime.setAuth(session.access_token);
        }
      } catch (authErr) {
        console.warn('[SupabaseRepository] Realtime setAuth error:', authErr);
      }

      if (isCancelled) return;

      const channel = supabase.channel(channelTopic);
      this.messageChannel = channel;

      subscribeTimer = setTimeout(() => {
        if (!isTerminal && !isCancelled) {
          isTerminal = true;
          const timeoutErr = new Error(`Realtime subscription to ${channelTopic} timed out after 8s`);
          console.error('[SupabaseRepository]', timeoutErr.message);
          onStatusChange?.('TIMED_OUT', timeoutErr);
        }
      }, 8000);

      channel
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter,
          },
          (payload) => {
            const row = payload.new as any;
            if (row) {
              if (validWsId && row.workspace_id && row.workspace_id !== validWsId) {
                return;
              }
              onNewMessage({
                id: row.id,
                workspaceId: row.workspace_id ?? undefined,
                conversationId: row.conversation_id || conversationId,
                senderId: row.sender_id,
                type: row.type || row.message_type || 'text',
                content: row.content || row.body || '',
                timestamp: row.created_at,
                status: row.status ?? 'sent',
                replyTo: row.reply_to ?? undefined,
                reactions: Array.isArray(row.reactions) ? row.reactions : [],
                uri: row.uri || row.media_url || undefined,
                thumbnailUri: row.thumbnail_uri ?? undefined,
                attachmentName: row.attachment_name ?? undefined,
                mimeType: row.mime_type ?? undefined,
                size: row.size ?? undefined,
                width: row.width ?? undefined,
                height: row.height ?? undefined,
                duration: row.duration ?? undefined,
              });
            }
          }
        )
        .subscribe((status, err) => {
          if (isCancelled) return;

          console.log(`[SupabaseRepository] Subscription callback for ${channelTopic}: status=${status}`, err ?? '');

          if (status === 'SUBSCRIBED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            isTerminal = true;
            if (subscribeTimer) {
              clearTimeout(subscribeTimer);
              subscribeTimer = null;
            }
          }

          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            const errObj = err instanceof Error ? err : new Error(String(err || status));
            console.error(`[SupabaseRepository] Realtime terminal error on ${channelTopic}:`, {
              status,
              name: errObj.name,
              message: errObj.message,
              cause: (errObj as any).cause,
              stack: errObj.stack,
            });
            onStatusChange?.(status as any, errObj);
            return;
          }

          onStatusChange?.(status as any, err ? new Error(String(err)) : undefined);
        });
    };

    void setup();

    return () => {
      isCancelled = true;
      if (subscribeTimer) {
        clearTimeout(subscribeTimer);
        subscribeTimer = null;
      }
      if (this.messageChannel) {
        const ch = this.messageChannel;
        this.messageChannel = null;
        void supabase.removeChannel(ch).catch(() => {});
      }
    };
  }

  subscribeToTeamGoals(workspaceId: string, onUpdate: () => void): () => void {
    if (!isUUID(workspaceId)) return () => {};
    const channelName = `realtime-team-goals-${workspaceId}-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'team_goals', filter: `workspace_id=eq.${workspaceId}` },
        () => onUpdate()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel).catch(() => {});
    };
  }

  subscribeToDirectMessages(userId: string, onMessage: (msg: DirectMessage) => void): () => void {
    if (!isUUID(userId)) return () => {};
    const channelName = `realtime-dm-${userId}-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'direct_messages', filter: `recipient_id=eq.${userId}` },
        (payload) => {
          const row = payload.new as any;
          if (row) {
            onMessage({
              id: row.id,
              conversationId: row.conversation_id,
              senderId: row.sender_id,
              recipientId: row.recipient_id,
              content: row.content,
              type: row.message_type || 'text',
              attachmentUrl: row.attachment_url ?? undefined,
              thumbnailUrl: row.thumbnail_url ?? undefined,
              isPinned: Boolean(row.is_pinned),
              reactions: Array.isArray(row.reactions) ? row.reactions : [],
              replyToId: row.reply_to_id ?? undefined,
              createdAt: row.created_at,
            });
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel).catch(() => {});
    };
  }

  // --------------------------------------------------------------------------
  // JOURNAL ENTRIES (CIPHERTEXT ONLY)
  // --------------------------------------------------------------------------
  async fetchJournalEntries(userId: string): Promise<JournalEntry[]> {
    if (!isUUID(userId)) return [];
    try {
      const { data, error } = await supabase
        .from('journal_entries')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (error || !data) return [];

      return data.map((row) => ({
        id: row.id,
        ownerId: row.user_id,
        encryptedContent: row.encrypted_content,
        iv: row.iv,
        tag: row.tag ?? undefined,
        algorithm: row.algorithm ?? 'AES-GCM-256',
        date: row.entry_date,
        timestamp: row.created_at,
      }));
    } catch {
      return [];
    }
  }

  async insertJournalEntry(entry: JournalEntry): Promise<void> {
    if (!isUUID(entry.ownerId)) return;
    const entryId = ensureUUID(entry.id);
    try {
      await supabase.from('journal_entries').insert({
        id: entryId,
        user_id: entry.ownerId,
        encrypted_content: entry.encryptedContent,
        iv: entry.iv,
        tag: entry.tag || null,
        algorithm: entry.algorithm,
        entry_date: entry.date,
      });
    } catch (err) {
      console.warn('[SupabaseRepository] insertJournalEntry error:', err);
    }
  }

  async updateJournalEntry(id: string, encryptedContent: string, iv: string): Promise<void> {
    if (!isUUID(id)) return;
    try {
      await supabase.from('journal_entries').update({
        encrypted_content: encryptedContent,
        iv,
        updated_at: new Date().toISOString(),
      }).eq('id', id);
    } catch (err) {
      console.warn('[SupabaseRepository] updateJournalEntry error:', err);
    }
  }

  async deleteJournalEntry(entryId: string): Promise<void> {
    if (!isUUID(entryId)) return;
    try {
      await supabase.from('journal_entries').delete().eq('id', entryId);
    } catch (err) {
      console.warn('[SupabaseRepository] deleteJournalEntry error:', err);
    }
  }

  // --------------------------------------------------------------------------
  // JOURNAL SECURITY (PIN VERIFIER + SALT)
  // --------------------------------------------------------------------------
  async fetchJournalSecurity(userId: string): Promise<JournalSecurityConfig | null> {
    if (!isUUID(userId)) return null;
    try {
      const { data, error } = await supabase
        .from('journal_security')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error || !data) return null;

      return {
        salt: data.salt,
        verifierHash: data.verifier_hash,
        iterations: data.iterations,
        failedAttempts: data.failed_attempts ?? 0,
        lockedUntil: data.locked_until,
        lastVerifiedAt: data.last_verified_at,
      };
    } catch {
      return null;
    }
  }

  async saveJournalSecurity(userId: string, config: JournalSecurityConfig): Promise<void> {
    if (!isUUID(userId)) return;
    try {
      await supabase.from('journal_security').upsert({
        user_id: userId,
        salt: config.salt,
        verifier_hash: config.verifierHash,
        iterations: config.iterations,
        failed_attempts: config.failedAttempts,
        locked_until: config.lockedUntil,
        last_verified_at: config.lastVerifiedAt,
        updated_at: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('[SupabaseRepository] saveJournalSecurity error:', err);
    }
  }

  // --------------------------------------------------------------------------
  // WORKSPACES LIFECYCLE & MEMBERSHIP
  // --------------------------------------------------------------------------
  async loadWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]> {
    if (!isUUID(workspaceId)) return [];
    try {
      // 1. Try secure RPC function first (guarantees complete member resolution for enrolled members)
      const { data: rpcData, error: rpcErr } = await supabase.rpc('get_workspace_members', {
        workspace_id_input: workspaceId,
      });

      if (!rpcErr && Array.isArray(rpcData) && rpcData.length > 0) {
        return rpcData.map((m: any) => ({
          id: m.id,
          name: m.name || (m.role === 'owner' ? 'Owner' : 'Member'),
          avatar: m.avatar || (m.name ? m.name.charAt(0).toUpperCase() : 'M'),
        }));
      }

      // 2. Query workspace_members table with role and mute settings
      const { data: memRows, error: memErr } = await supabase
        .from('workspace_members')
        .select('user_id, role, is_muted, notifications_muted')
        .eq('workspace_id', workspaceId);

      if (memErr) {
        console.warn('[SupabaseRepository] loadWorkspaceMembers query warning:', memErr.message);
        return [];
      }
      if (!memRows || !memRows.length) return [];

      // 3. Fetch profiles with presence for all member user_ids
      const userIds = memRows.map((r) => r.user_id).filter(isUUID);
      const profileMap = new Map<
        string,
        { name?: string | null; avatar_url?: string | null; last_seen?: string | null; is_online?: boolean | null }
      >();

      if (userIds.length > 0) {
        try {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, name, avatar_url, last_seen, is_online')
            .in('id', userIds);

          (profiles || []).forEach((p) => {
            if (p?.id) profileMap.set(p.id, p);
          });
        } catch {}
      }

      return memRows.map((row) => {
        const prof = profileMap.get(row.user_id);
        const name = prof?.name || (row.role === 'owner' ? 'Owner' : 'Member');
        return {
          id: row.user_id,
          name,
          avatar: prof?.avatar_url || name.charAt(0).toUpperCase() || 'M',
          role: row.role || 'member',
          isMuted: Boolean(row.is_muted),
          notificationsMuted: Boolean(row.notifications_muted),
          lastSeen: prof?.last_seen ?? undefined,
          isOnline: Boolean(prof?.is_online),
        };
      });
    } catch (err) {
      console.warn('[SupabaseRepository] loadWorkspaceMembers exception:', err);
      return [];
    }
  }

  async fetchUserWorkspace(userId: string): Promise<Workspace | null> {
    if (!isUUID(userId)) return null;
    try {
      // 1. Query membership directly
      const { data: memberRows, error: memberErr } = await supabase
        .from('workspace_members')
        .select('workspace_id, role')
        .eq('user_id', userId)
        .order('joined_at', { ascending: false })
        .limit(1);

      if (memberErr || !memberRows || !memberRows.length) return null;

      const wsId = memberRows[0].workspace_id;
      if (!isUUID(wsId)) return null;

      // 2. Query workspace directly including theme
      const { data: wsRow, error: wsErr } = await supabase
        .from('workspaces')
        .select('id, name, mode, invite_code, avatar_url, theme')
        .eq('id', wsId)
        .maybeSingle();

      if (wsErr || !wsRow) return null;

      // 3. Load full membership list
      let members = await this.loadWorkspaceMembers(wsRow.id);
      if (!members || members.length === 0) {
        members = [{ id: userId, name: 'You', avatar: 'Y', role: 'member' }];
      }

      return {
        id: wsRow.id,
        name: wsRow.name,
        mode: wsRow.mode as 'duo' | 'team',
        inviteCode: wsRow.invite_code,
        members,
        avatarUrl: wsRow.avatar_url ?? undefined,
        theme: (wsRow.theme as any) || 'default',
      };
    } catch {
      return null;
    }
  }

  async loadCurrentWorkspace(userId: string): Promise<Workspace | null> {
    return this.fetchUserWorkspace(userId);
  }

  async createWorkspace(
    userId: string,
    name: string,
    mode: 'duo' | 'team',
    inviteCode?: string
  ): Promise<Workspace | null> {
    if (!isUUID(userId)) return null;
    try {
      // Pre-flight: guarantee creator profile exists before workspace_members foreign key evaluates
      await this.ensureProfile({ id: userId });

      // 1. Try secure RPC
      const { data: rpcData, error: rpcErr } = await supabase.rpc('create_workspace_secure', {
        name_input: name.trim() || (mode === 'duo' ? 'My Duo' : 'My Team'),
        mode_input: mode,
        invite_code_input: inviteCode || null,
      });

      if (!rpcErr && rpcData) {
        const parsed = typeof rpcData === 'string' ? JSON.parse(rpcData) : rpcData;
        const members = await this.loadWorkspaceMembers(parsed.id);
        return {
          id: parsed.id,
          name: parsed.name,
          mode: parsed.mode,
          inviteCode: parsed.invite_code,
          members: members.length ? members : [{ id: userId, name: 'Owner', avatar: 'O' }],
        };
      }

      // 2. Direct fallback
      const generatedCode = inviteCode?.trim().toUpperCase() || `EVR-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      const wsId = generateUUID();
      const { data: wsRow, error: wsErr } = await supabase
        .from('workspaces')
        .insert({
          id: wsId,
          name: name.trim() || (mode === 'duo' ? 'My Duo' : 'My Team'),
          mode,
          invite_code: generatedCode,
          owner_id: userId,
        })
        .select()
        .single();

      if (wsErr || !wsRow) {
        console.warn('[SupabaseRepository] createWorkspace fallback error:', wsErr?.message);
        return null;
      }

      await this.ensureProfile({ id: userId });
      await supabase.from('workspace_members').upsert({
        workspace_id: wsRow.id,
        user_id: userId,
        role: 'owner',
      });

      const members = await this.loadWorkspaceMembers(wsRow.id);
      return {
        id: wsRow.id,
        name: wsRow.name,
        mode: wsRow.mode,
        inviteCode: wsRow.invite_code,
        members: members.length ? members : [{ id: userId, name: 'Owner', avatar: 'O' }],
      };
    } catch (err) {
      console.warn('[SupabaseRepository] createWorkspace exception:', err);
      return null;
    }
  }

  async joinWorkspaceByInviteCode(
    inviteCode: string,
    userId?: string
  ): Promise<{ success: boolean; workspace?: Workspace; error?: string }> {
    const cleanCode = inviteCode.trim().toUpperCase();
    if (!cleanCode) {
      return { success: false, error: 'Please enter a valid invite code.' };
    }

    try {
      if (userId && isUUID(userId)) {
        await this.ensureProfile({ id: userId });
      }

      // 1. Execute secure RPC (checks invite code, server-side Duo 2-member limit, prevents duplicate membership)
      const { data: rpcData, error: rpcErr } = await supabase.rpc('join_workspace_by_invite', {
        invite_code_input: cleanCode,
      });

      if (rpcErr) {
        return { success: false, error: rpcErr.message };
      }

      if (rpcData) {
        const parsed = typeof rpcData === 'string' ? JSON.parse(rpcData) : rpcData;
        const members = await this.loadWorkspaceMembers(parsed.id);
        return {
          success: true,
          workspace: {
            id: parsed.id,
            name: parsed.name,
            mode: parsed.mode,
            inviteCode: parsed.invite_code,
            members,
          },
        };
      }

      return { success: false, error: 'Failed to join workspace.' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to join workspace.';
      return { success: false, error: msg };
    }
  }

  async leaveWorkspace(userId: string, workspaceId: string): Promise<boolean> {
    if (!isUUID(workspaceId) || !isUUID(userId)) return true;
    try {
      // 1. Try secure RPC
      const { error: rpcErr } = await supabase.rpc('leave_workspace', {
        workspace_id_input: workspaceId,
      });

      if (!rpcErr) return true;

      // 2. Direct fallback
      const { error: delErr } = await supabase
        .from('workspace_members')
        .delete()
        .eq('workspace_id', workspaceId)
        .eq('user_id', userId);

      return !delErr;
    } catch (err) {
      console.warn('[SupabaseRepository] leaveWorkspace error:', err);
      return false;
    }
  }

  // --------------------------------------------------------------------------
  // AVATARS & WORKSPACE IDENTITY
  // --------------------------------------------------------------------------
  async uploadUserAvatar(userId: string, localUri: string): Promise<string | null> {
    if (!isUUID(userId)) return null;
    try {
      let ext = 'jpg';
      const match = localUri.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
      if (match && match[1]) {
        ext = match[1].toLowerCase();
      }
      const storagePath = `users/${userId}_${Date.now()}.${ext}`;
      const res = await fetch(localUri);
      const blob = await res.blob();

      const { data, error } = await supabase.storage
        .from('avatars')
        .upload(storagePath, blob, {
          contentType: `image/${ext === 'png' ? 'png' : ext === 'webp' ? 'webp' : 'jpeg'}`,
          upsert: true,
        });

      if (error) {
        console.warn('[SupabaseRepository] uploadUserAvatar error:', error.message);
        return null;
      }

      const { data: signedData } = await supabase.storage
        .from('avatars')
        .createSignedUrl(data?.path || storagePath, 86400 * 7);

      const avatarUrl = signedData?.signedUrl || null;
      if (avatarUrl) {
        await supabase.from('profiles').update({ avatar_url: avatarUrl }).eq('id', userId);
      }
      return avatarUrl;
    } catch (err) {
      console.warn('[SupabaseRepository] uploadUserAvatar exception:', err);
      return null;
    }
  }

  async removeUserAvatar(userId: string): Promise<boolean> {
    if (!isUUID(userId)) return false;
    try {
      const { error } = await supabase.from('profiles').update({ avatar_url: null }).eq('id', userId);
      return !error;
    } catch (err) {
      console.warn('[SupabaseRepository] removeUserAvatar error:', err);
      return false;
    }
  }

  async uploadWorkspaceAvatar(workspaceId: string, localUri: string): Promise<string | null> {
    if (!isUUID(workspaceId)) return null;
    try {
      let ext = 'jpg';
      const match = localUri.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
      if (match && match[1]) {
        ext = match[1].toLowerCase();
      }
      const storagePath = `workspaces/${workspaceId}_${Date.now()}.${ext}`;
      const res = await fetch(localUri);
      const blob = await res.blob();

      const { data, error } = await supabase.storage
        .from('avatars')
        .upload(storagePath, blob, {
          contentType: `image/${ext === 'png' ? 'png' : ext === 'webp' ? 'webp' : 'jpeg'}`,
          upsert: true,
        });

      if (error) {
        console.warn('[SupabaseRepository] uploadWorkspaceAvatar error:', error.message);
        return null;
      }

      const { data: signedData } = await supabase.storage
        .from('avatars')
        .createSignedUrl(data?.path || storagePath, 86400 * 7);

      return signedData?.signedUrl || null;
    } catch (err) {
      console.warn('[SupabaseRepository] uploadWorkspaceAvatar exception:', err);
      return null;
    }
  }

  async updateWorkspaceIdentity(
    workspaceId: string,
    name?: string,
    avatarUrl?: string | null
  ): Promise<boolean> {
    if (!isUUID(workspaceId)) return false;
    try {
      // 1. Try secure RPC function
      const { error: rpcErr } = await supabase.rpc('update_workspace_identity', {
        target_workspace_id: workspaceId,
        new_name: name || null,
        new_avatar_url: avatarUrl === undefined ? null : avatarUrl,
      });

      if (!rpcErr) return true;

      // 2. Direct fallback
      const updateData: Record<string, unknown> = {};
      if (name !== undefined) updateData.name = name;
      if (avatarUrl !== undefined) updateData.avatar_url = avatarUrl;

      const { error: directErr } = await supabase
        .from('workspaces')
        .update(updateData)
        .eq('id', workspaceId);

      return !directErr;
    } catch (err) {
      console.warn('[SupabaseRepository] updateWorkspaceIdentity error:', err);
      return false;
    }
  }

  // --------------------------------------------------------------------------
  // DAILY SUMMARIES & ACTIVITIES
  // --------------------------------------------------------------------------
  async fetchSummaries(userId: string): Promise<DailySummary[]> {
    if (!isUUID(userId)) return [];
    try {
      const { data, error } = await supabase
        .from('daily_summaries')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(14);

      if (error || !data) return [];

      return data.map((row) => ({
        date: row.date,
        you: row.you_percent,
        shared: row.shared_percent ?? undefined,
      }));
    } catch {
      return [];
    }
  }

  async upsertSummary(userId: string, summary: DailySummary, workspaceId?: string): Promise<void> {
    if (!isUUID(userId)) return;
    const wsId = workspaceId && isUUID(workspaceId) ? workspaceId : null;
    try {
      await supabase.from('daily_summaries').upsert({
        user_id: userId,
        workspace_id: wsId,
        date: summary.date,
        you_percent: summary.you,
        shared_percent: summary.shared ?? null,
      });
    } catch (err) {
      console.warn('[SupabaseRepository] upsertSummary error:', err);
    }
  }

  async fetchActivities(workspaceId: string): Promise<ActivityEvent[]> {
    if (!isUUID(workspaceId)) return [];
    try {
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error || !data) return [];

      return data.map((row) => ({
        id: row.id,
        userId: row.user_id,
        workspaceId: row.workspace_id,
        type: row.type,
        title: row.title,
        visibility: row.visibility,
        timestamp: row.created_at,
      }));
    } catch {
      return [];
    }
  }

  // --------------------------------------------------------------------------
  // EVOLUTION 2.0: MESSAGE PINNING & BOOKMARKS
  // --------------------------------------------------------------------------
  async togglePinMessage(messageId: string, pin: boolean): Promise<boolean> {
    if (!isUUID(messageId)) return false;
    try {
      const { data, error } = await supabase.rpc('toggle_pin_message', {
        target_message_id: messageId,
        pin,
      });
      if (error) {
        console.warn('[SupabaseRepository] togglePinMessage error:', error.message);
        return false;
      }
      return Boolean(data?.success);
    } catch {
      return false;
    }
  }

  async bookmarkMessage(userId: string, messageId: string): Promise<boolean> {
    if (!isUUID(userId) || !isUUID(messageId)) return false;
    try {
      const { error } = await supabase.from('saved_messages').insert({
        user_id: userId,
        message_id: messageId,
      });
      return !error;
    } catch {
      return false;
    }
  }

  async removeBookmark(userId: string, messageId: string): Promise<boolean> {
    if (!isUUID(userId) || !isUUID(messageId)) return false;
    try {
      const { error } = await supabase
        .from('saved_messages')
        .delete()
        .eq('user_id', userId)
        .eq('message_id', messageId);
      return !error;
    } catch {
      return false;
    }
  }

  async fetchSavedMessageIds(userId: string): Promise<string[]> {
    if (!isUUID(userId)) return [];
    try {
      const { data, error } = await supabase
        .from('saved_messages')
        .select('message_id')
        .eq('user_id', userId);
      if (error || !data) return [];
      return data.map((d) => d.message_id);
    } catch {
      return [];
    }
  }

  // --------------------------------------------------------------------------
  // EVOLUTION 2.0: TEAM ADMIN & THEMES
  // --------------------------------------------------------------------------
  async setWorkspaceTheme(workspaceId: string, theme: WorkspaceTheme): Promise<boolean> {
    if (!isUUID(workspaceId)) return false;
    try {
      const { data, error } = await supabase.rpc('set_workspace_theme', {
        target_workspace_id: workspaceId,
        new_theme: theme,
      });
      if (error) {
        console.warn('[SupabaseRepository] setWorkspaceTheme error:', error.message);
        return false;
      }
      return Boolean(data?.success);
    } catch {
      return false;
    }
  }

  async setWorkspaceMemberRole(workspaceId: string, targetUserId: string, role: 'owner' | 'admin' | 'member'): Promise<boolean> {
    if (!isUUID(workspaceId) || !isUUID(targetUserId)) return false;
    try {
      const { data, error } = await supabase.rpc('set_workspace_member_role', {
        target_workspace_id: workspaceId,
        target_user_id: targetUserId,
        new_role: role,
      });
      if (error) {
        console.warn('[SupabaseRepository] setWorkspaceMemberRole error:', error.message);
        return false;
      }
      return Boolean(data?.success);
    } catch {
      return false;
    }
  }

  async setWorkspaceMemberMuted(workspaceId: string, targetUserId: string, muted: boolean): Promise<boolean> {
    if (!isUUID(workspaceId) || !isUUID(targetUserId)) return false;
    try {
      const { data, error } = await supabase.rpc('set_workspace_member_muted', {
        target_workspace_id: workspaceId,
        target_user_id: targetUserId,
        muted,
      });
      if (error) {
        console.warn('[SupabaseRepository] setWorkspaceMemberMuted error:', error.message);
        return false;
      }
      return Boolean(data?.success);
    } catch {
      return false;
    }
  }

  async removeWorkspaceMember(workspaceId: string, targetUserId: string): Promise<boolean> {
    if (!isUUID(workspaceId) || !isUUID(targetUserId)) return false;
    try {
      const { data, error } = await supabase.rpc('remove_workspace_member', {
        target_workspace_id: workspaceId,
        target_user_id: targetUserId,
      });
      if (error) {
        console.warn('[SupabaseRepository] removeWorkspaceMember error:', error.message);
        return false;
      }
      return Boolean(data?.success);
    } catch {
      return false;
    }
  }

  async toggleWorkspaceNotifications(workspaceId: string, muted: boolean): Promise<boolean> {
    if (!isUUID(workspaceId)) return false;
    try {
      const { data, error } = await supabase.rpc('toggle_workspace_notifications', {
        target_workspace_id: workspaceId,
        mute_notifications: muted,
      });
      if (error) {
        console.warn('[SupabaseRepository] toggleWorkspaceNotifications error:', error.message);
        return false;
      }
      return Boolean(data?.success);
    } catch {
      return false;
    }
  }

  async updateUserPresence(isOnline: boolean): Promise<void> {
    try {
      await supabase.rpc('update_user_presence', { user_online: isOnline });
    } catch (err) {
      console.warn('[SupabaseRepository] updateUserPresence warning:', err);
    }
  }

  // --------------------------------------------------------------------------
  // EVOLUTION 2.0: TEAM GOALS & AUDIT LOGS
  // --------------------------------------------------------------------------
  async fetchTeamGoals(workspaceId: string): Promise<TeamGoal[]> {
    if (!isUUID(workspaceId)) return [];
    try {
      const { data, error } = await supabase
        .from('team_goals')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false });

      if (error || !data) return [];
      return data.map((d: any) => ({
        id: d.id,
        workspaceId: d.workspace_id,
        title: d.title,
        target: d.target,
        current: d.current,
        unit: d.unit || '%',
        createdBy: d.created_by ?? undefined,
        createdAt: d.created_at,
        updatedAt: d.updated_at,
      }));
    } catch {
      return [];
    }
  }

  async createTeamGoal(workspaceId: string, title: string, target: number, unit = '%'): Promise<TeamGoal | null> {
    if (!isUUID(workspaceId)) return null;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('team_goals')
        .insert({
          workspace_id: workspaceId,
          title: title.trim(),
          target,
          current: 0,
          unit,
          created_by: user?.id ?? null,
        })
        .select('*')
        .single();

      if (error || !data) return null;
      return {
        id: data.id,
        workspaceId: data.workspace_id,
        title: data.title,
        target: data.target,
        current: data.current,
        unit: data.unit,
        createdBy: data.created_by ?? undefined,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };
    } catch {
      return null;
    }
  }

  async updateTeamGoal(goalId: string, current: number): Promise<boolean> {
    if (!isUUID(goalId)) return false;
    try {
      const { error } = await supabase
        .from('team_goals')
        .update({ current, updated_at: new Date().toISOString() })
        .eq('id', goalId);
      return !error;
    } catch {
      return false;
    }
  }

  async deleteTeamGoal(goalId: string): Promise<boolean> {
    if (!isUUID(goalId)) return false;
    try {
      const { error } = await supabase.from('team_goals').delete().eq('id', goalId);
      return !error;
    } catch {
      return false;
    }
  }

  async fetchAuditLogs(workspaceId: string): Promise<AuditLogEntry[]> {
    if (!isUUID(workspaceId)) return [];
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error || !data) return [];
      return data.map((d: any) => ({
        id: d.id,
        workspaceId: d.workspace_id,
        actorId: d.actor_id ?? undefined,
        action: d.action,
        details: d.details || {},
        createdAt: d.created_at,
      }));
    } catch {
      return [];
    }
  }

  // --------------------------------------------------------------------------
  // EVOLUTION 2.0: USERNAME DISCOVERY & DIRECT MESSAGES
  // --------------------------------------------------------------------------
  async searchUsersByUsername(query: string): Promise<User[]> {
    const q = query.trim().replace(/^@/, '');
    if (!q || q.length < 2) return [];
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, username, avatar_url')
        .or(`username.ilike.%${q}%,name.ilike.%${q}%`)
        .limit(10);

      if (error || !data) return [];
      return data.map((p) => ({
        id: p.id,
        name: p.name || 'User',
        username: p.username || `user_${p.id.slice(0, 8)}`,
        avatar: p.avatar_url || p.name?.charAt(0).toUpperCase() || 'U',
        settings: {
          timezone: 'UTC',
          notifications: { enabled: true, dailyReminder: true, recapReminder: true, reminderTime: '21:00' },
          preferences: { defaultVisibility: 'private', theme: 'dark', haptics: true, sfx: true },
        },
      }));
    } catch {
      return [];
    }
  }

  getDmConversationId(userId1: string, userId2: string): string {
    return [userId1, userId2].sort().join('_');
  }

  async fetchDirectMessages(currentUserId: string, otherUserId: string): Promise<DirectMessage[]> {
    if (!isUUID(currentUserId) || !isUUID(otherUserId)) return [];
    const convoId = this.getDmConversationId(currentUserId, otherUserId);
    try {
      const { data, error } = await supabase
        .from('direct_messages')
        .select('*')
        .eq('conversation_id', convoId)
        .order('created_at', { ascending: true })
        .limit(100);

      if (error || !data) return [];
      return data.map((d: any) => ({
        id: d.id,
        conversationId: d.conversation_id,
        senderId: d.sender_id,
        recipientId: d.recipient_id,
        content: d.content,
        type: d.message_type || 'text',
        attachmentUrl: d.attachment_url ?? undefined,
        thumbnailUrl: d.thumbnail_url ?? undefined,
        isPinned: Boolean(d.is_pinned),
        reactions: Array.isArray(d.reactions) ? d.reactions : [],
        replyToId: d.reply_to_id ?? undefined,
        createdAt: d.created_at,
        updatedAt: d.updated_at,
      }));
    } catch {
      return [];
    }
  }

  async sendDirectMessage(dm: Omit<DirectMessage, 'id' | 'createdAt'>): Promise<{ success: boolean; data?: DirectMessage; error?: string }> {
    if (!isUUID(dm.senderId) || !isUUID(dm.recipientId)) {
      return { success: false, error: 'Invalid user IDs' };
    }
    const convoId = this.getDmConversationId(dm.senderId, dm.recipientId);
    try {
      const payload: Record<string, unknown> = {
        id: generateUUID(),
        conversation_id: convoId,
        sender_id: dm.senderId,
        recipient_id: dm.recipientId,
        content: dm.content,
        message_type: dm.type || 'text',
        attachment_url: dm.attachmentUrl || null,
        thumbnail_url: dm.thumbnailUrl || null,
        reply_to_id: dm.replyToId || null,
        reactions: dm.reactions || [],
      };

      const { data, error } = await supabase
        .from('direct_messages')
        .insert(payload)
        .select('*')
        .single();

      if (error || !data) {
        return { success: false, error: error?.message || 'Failed to send direct message' };
      }

      return {
        success: true,
        data: {
          id: data.id,
          conversationId: data.conversation_id,
          senderId: data.sender_id,
          recipientId: data.recipient_id,
          content: data.content,
          type: data.message_type,
          attachmentUrl: data.attachment_url ?? undefined,
          thumbnailUrl: data.thumbnail_url ?? undefined,
          isPinned: Boolean(data.is_pinned),
          reactions: data.reactions || [],
          replyToId: data.reply_to_id ?? undefined,
          createdAt: data.created_at,
        },
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'sendDirectMessage failed';
      return { success: false, error: msg };
    }
  }

  async deleteDirectMessage(dmId: string): Promise<boolean> {
    if (!isUUID(dmId)) return false;
    try {
      const { error } = await supabase.from('direct_messages').delete().eq('id', dmId);
      return !error;
    } catch {
      return false;
    }
  }

  // --------------------------------------------------------------------------
  // EVOLUTION 2.0: ACCOUNT DELETION & EXPORT
  // --------------------------------------------------------------------------
  async deleteUserAccount(): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('delete_user_account');
      if (error) {
        return { success: false, error: error.message };
      }
      return { success: Boolean(data?.success) };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'deleteUserAccount failed';
      return { success: false, error: msg };
    }
  }

  async exportUserData(userId: string): Promise<Record<string, unknown> | null> {
    if (!isUUID(userId)) return null;
    try {
      const [profile, tasks, habits, goals, meals, journal, activities, workspace] = await Promise.all([
        this.getProfile(userId),
        supabase.from('tasks').select('*').eq('owner_id', userId),
        supabase.from('habits').select('*').eq('owner_id', userId),
        supabase.from('goals').select('*').eq('owner_id', userId),
        supabase.from('meals').select('*').eq('owner_id', userId),
        supabase.from('journal_entries').select('*').eq('owner_id', userId),
        supabase.from('activities').select('*').eq('user_id', userId),
        this.fetchUserWorkspace(userId),
      ]);

      return {
        exportedAt: new Date().toISOString(),
        userId,
        profile,
        workspace,
        tasks: tasks.data || [],
        habits: habits.data || [],
        goals: goals.data || [],
        meals: meals.data || [],
        journal: journal.data || [],
        activities: activities.data || [],
      };
    } catch (err) {
      console.warn('[SupabaseRepository] exportUserData exception:', err);
      return null;
    }
  }
}

export const supabaseRepo = new SupabaseRepository();
