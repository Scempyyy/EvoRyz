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

  // --------------------------------------------------------------------------
  // WORKSPACE CHAT MESSAGES & REALTIME
  // --------------------------------------------------------------------------
  async fetchMessages(conversationId: string, workspaceId?: string): Promise<Message[]> {
    try {
      let query = supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(100);

      if (workspaceId && isUUID(workspaceId)) {
        query = query.eq('workspace_id', workspaceId);
      }

      const { data, error } = await query;
      if (error || !data) return [];

      return data.map((row) => ({
        id: row.id,
        workspaceId: row.workspace_id ?? undefined,
        conversationId: row.conversation_id,
        senderId: row.sender_id,
        type: row.type,
        content: row.content,
        timestamp: row.created_at,
        status: row.status ?? 'sent',
        replyTo: row.reply_to ?? undefined,
        reactions: Array.isArray(row.reactions) ? row.reactions : [],
        uri: row.uri ?? undefined,
        thumbnailUri: row.thumbnail_uri ?? undefined,
        attachmentName: row.attachment_name ?? undefined,
        mimeType: row.mime_type ?? undefined,
        size: row.size ?? undefined,
        width: row.width ?? undefined,
        height: row.height ?? undefined,
        duration: row.duration ?? undefined,
      }));
    } catch {
      return [];
    }
  }

  async insertMessage(message: Message): Promise<void> {
    if (!isUUID(message.senderId)) return;
    const msgId = ensureUUID(message.id);
    const workspaceId = message.workspaceId && isUUID(message.workspaceId) ? message.workspaceId : null;
    try {
      await supabase.from('messages').insert({
        id: msgId,
        workspace_id: workspaceId,
        sender_id: message.senderId,
        conversation_id: message.conversationId,
        type: message.type,
        content: message.content,
        status: message.status || 'sent',
        reply_to: message.replyTo && isUUID(message.replyTo) ? message.replyTo : null,
        reactions: message.reactions || [],
        uri: message.uri || null,
        thumbnail_uri: message.thumbnailUri || null,
        attachment_name: message.attachmentName || null,
        mime_type: message.mimeType || null,
        size: message.size || null,
        width: message.width || null,
        height: message.height || null,
        duration: message.duration || null,
      });
    } catch (err) {
      console.warn('[SupabaseRepository] insertMessage error:', err);
    }
  }

  subscribeToMessages(
    conversationId: string,
    onNewMessage: (msg: Message) => void
  ): () => void {
    if (this.messageChannel) {
      supabase.removeChannel(this.messageChannel);
    }

    this.messageChannel = supabase
      .channel(`chat-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const row = payload.new;
          if (row) {
            onNewMessage({
              id: row.id,
              workspaceId: row.workspace_id ?? undefined,
              conversationId: row.conversation_id,
              senderId: row.sender_id,
              type: row.type,
              content: row.content,
              timestamp: row.created_at,
              status: row.status ?? 'sent',
              replyTo: row.reply_to ?? undefined,
              reactions: Array.isArray(row.reactions) ? row.reactions : [],
              uri: row.uri ?? undefined,
              thumbnailUri: row.thumbnail_uri ?? undefined,
              attachmentName: row.attachment_name ?? undefined,
              mimeType: row.mime_type ?? undefined,
              size: row.size ?? undefined,
            });
          }
        }
      )
      .subscribe();

    return () => {
      if (this.messageChannel) {
        supabase.removeChannel(this.messageChannel);
        this.messageChannel = null;
      }
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
      const { data: allMembers, error } = await supabase
        .from('workspace_members')
        .select('user_id, role, profiles(name, avatar_url)')
        .eq('workspace_id', workspaceId);

      if (error || !allMembers) return [];

      return allMembers.map((m: unknown) => {
        const row = m as { user_id: string; role: string; profiles?: { name?: string; avatar_url?: string } };
        return {
          id: row.user_id,
          name: row.profiles?.name || 'Member',
          avatar: row.profiles?.avatar_url || row.profiles?.name?.charAt(0)?.toUpperCase() || 'M',
        };
      });
    } catch {
      return [];
    }
  }

  async fetchUserWorkspace(userId: string): Promise<Workspace | null> {
    if (!isUUID(userId)) return null;
    try {
      const { data: memberRows, error: memberErr } = await supabase
        .from('workspace_members')
        .select('workspace_id, role, workspaces(*)')
        .eq('user_id', userId)
        .limit(1);

      if (memberErr || !memberRows || !memberRows.length) return null;

      const wsData = (memberRows[0] as unknown as { workspaces: { id: string; name: string; mode: 'duo' | 'team'; invite_code: string } }).workspaces;
      if (!wsData) return null;

      const members = await this.loadWorkspaceMembers(wsData.id);

      return {
        id: wsData.id,
        name: wsData.name,
        mode: wsData.mode,
        inviteCode: wsData.invite_code,
        members,
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
    inviteCode: string
  ): Promise<{ success: boolean; workspace?: Workspace; error?: string }> {
    const cleanCode = inviteCode.trim().toUpperCase();
    if (!cleanCode) {
      return { success: false, error: 'Please enter a valid invite code.' };
    }

    try {
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

  async insertActivity(activity: ActivityEvent): Promise<void> {
    if (!activity.workspaceId || !isUUID(activity.workspaceId) || !isUUID(activity.userId)) return;
    const actId = ensureUUID(activity.id);
    try {
      await supabase.from('activities').insert({
        id: actId,
        user_id: activity.userId,
        workspace_id: activity.workspaceId,
        type: activity.type,
        title: activity.title,
        visibility: activity.visibility,
      });
    } catch (err) {
      console.warn('[SupabaseRepository] insertActivity error:', err);
    }
  }
}

export const supabaseRepo = new SupabaseRepository();
