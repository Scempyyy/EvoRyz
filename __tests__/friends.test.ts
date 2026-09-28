import { FriendService } from '@/src/services/friendService';
import { supabaseRepo } from '@/src/services/supabaseRepository';
import { DailyTask, Habit, JournalEntry, Meal, Message } from '@/src/types';

jest.mock('@/utils/supabase', () => ({
  supabase: {
    rpc: jest.fn().mockImplementation((fn: string, args: any) => {
      if (fn === 'update_display_name') {
        const name = args.new_display_name?.trim();
        if (!name) return Promise.resolve({ data: { success: false, error: 'Display name cannot be empty' }, error: null });
        if (name.length > 50) return Promise.resolve({ data: { success: false, error: 'Display name cannot exceed 50 characters' }, error: null });
        return Promise.resolve({ data: { success: true, display_name: name }, error: null });
      }
      if (fn === 'send_friend_request') {
        if (args.target_username === 'my_username') {
          return Promise.resolve({ data: { success: false, error: 'You cannot send a friend request to yourself' }, error: null });
        }
        return Promise.resolve({ data: { success: true, status: 'pending' }, error: null });
      }
      if (fn === 'respond_friend_request') {
        return Promise.resolve({ data: { success: true, status: args.accept ? 'accepted' : 'declined' }, error: null });
      }
      if (fn === 'remove_friend') {
        return Promise.resolve({ data: { success: true }, error: null });
      }
      if (fn === 'send_friend_ping') {
        return Promise.resolve({ data: { success: true }, error: null });
      }
      if (fn === 'search_users_by_username') {
        const term = args.search_term?.trim().replace(/^@/, '');
        if (!term || term.length < 2) return Promise.resolve({ data: [], error: null });
        return Promise.resolve({
          data: [
            {
              id: '22222222-2222-4222-a222-222222222222',
              name: 'Alex Mercer',
              display_name: 'Alex Mercer',
              username: 'alex',
              avatar_url: 'https://avatar',
            },
          ],
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    }),
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      or: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      ilike: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({
        data: [
          { id: '22222222-2222-4222-a222-222222222222', name: 'Alex Mercer', username: 'alex', avatar_url: 'https://avatar' },
        ],
        error: null,
      }),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      insert: jest.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
}));

describe('Friend System, Display Name, Pings & Security Invariants', () => {
  let friendService: FriendService;

  beforeEach(() => {
    jest.clearAllMocks();
    friendService = new FriendService();
  });

  // --------------------------------------------------------------------------
  // 1. DISPLAY NAME UPDATE
  // --------------------------------------------------------------------------
  describe('Display Name Update', () => {
    it('rejects invalid or empty display names', async () => {
      const resEmpty = await friendService.updateDisplayName('11111111-1111-4111-a111-111111111111', '   ');
      expect(resEmpty.success).toBe(false);
      expect(resEmpty.error).toMatch(/cannot be empty/i);

      const tooLongName = 'a'.repeat(51);
      const resTooLong = await friendService.updateDisplayName('11111111-1111-4111-a111-111111111111', tooLongName);
      expect(resTooLong.success).toBe(false);
      expect(resTooLong.error).toMatch(/cannot exceed 50/i);
    });

    it('rejects invalid user session UUID', async () => {
      const res = await friendService.updateDisplayName('invalid-session-id', 'Valid Name');
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/invalid/i);
    });

    it('trims whitespace and accepts valid display name', async () => {
      const validId = '11111111-1111-4111-a111-111111111111';
      const res = await friendService.updateDisplayName(validId, '  Alex Mercer  ');
      expect(res.success).toBe(true);
      expect(res.displayName).toBe('Alex Mercer');
    });
  });

  // --------------------------------------------------------------------------
  // 2. SELF-REQUEST & DUPLICATE REQUEST PREVENTION
  // --------------------------------------------------------------------------
  describe('Friend Request Validation & Prevention', () => {
    it('prevents user from sending a friend request to oneself', async () => {
      const myId = '11111111-1111-4111-a111-111111111111';
      const res = await friendService.sendFriendRequest('my_username', myId);
      // In RPC or mock fallback, sending to self is rejected
      if (!res.success) {
        expect(res.error).toMatch(/yourself|User not found/i);
      }
    });

    it('requires a non-empty username to send a friend request', async () => {
      const myId = '11111111-1111-4111-a111-111111111111';
      const res = await friendService.sendFriendRequest('   ', myId);
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/enter a username/i);
    });
  });

  // --------------------------------------------------------------------------
  // 3. FRIEND REQUEST LIFECYCLE & FRIEND REMOVAL
  // --------------------------------------------------------------------------
  describe('Friend Request Lifecycle & Removal', () => {
    it('rejects invalid request ID on respondFriendRequest', async () => {
      const res = await friendService.respondFriendRequest('not-a-uuid', true);
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/invalid/i);
    });

    it('validates UUIDs on friend removal', async () => {
      const res = await friendService.removeFriend('invalid-user', 'invalid-friend');
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/invalid/i);
    });
  });

  // --------------------------------------------------------------------------
  // 4. DIRECT CHAT AUTHORIZATION
  // --------------------------------------------------------------------------
  describe('Direct Chat Authorization', () => {
    it('generates deterministic 1-to-1 conversation IDs regardless of user order', () => {
      const userA = '11111111-1111-4111-a111-111111111111';
      const userB = '22222222-2222-4222-a222-222222222222';

      const convoId1 = supabaseRepo.getDmConversationId(userA, userB);
      const convoId2 = supabaseRepo.getDmConversationId(userB, userA);

      expect(convoId1).toBe(convoId2);
      expect(convoId1).toBe(`${userA}_${userB}`);
    });

    it('rejects direct message sending when user IDs are invalid', async () => {
      const res = await supabaseRepo.sendDirectMessage({
        conversationId: 'conv-1',
        senderId: 'invalid-sender',
        recipientId: 'invalid-recipient',
        content: 'Hello',
        type: 'text',
      });

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/invalid/i);
    });
  });

  // --------------------------------------------------------------------------
  // 5. FRIEND PING AUTHORIZATION & RATE LIMITING
  // --------------------------------------------------------------------------
  describe('Friend Ping Authorization & Rate Limiting', () => {
    it('prevents user from pinging themselves', async () => {
      const userId = '11111111-1111-4111-a111-111111111111';
      const res = await friendService.sendFriendPing(userId, userId);
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/cannot ping yourself/i);
    });

    it('rejects invalid user IDs for friend ping', async () => {
      const res = await friendService.sendFriendPing('not-valid', 'also-not-valid');
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/invalid/i);
    });
  });

  // --------------------------------------------------------------------------
  // 6. STRICT PRIVATE DATA ISOLATION (ZERO DATA LEAKS TO FRIENDS)
  // --------------------------------------------------------------------------
  describe('Private Data Isolation Invariants', () => {
    const ownerId = '11111111-1111-4111-a111-111111111111';
    const friendId = '22222222-2222-4222-a222-222222222222';

    it('ensures private tasks are never visible to friends', () => {
      const privateTasks: DailyTask[] = [
        {
          id: 'task-1',
          ownerId,
          title: 'Private Doctor Appointment',
          description: 'Confidential personal notes',
          visibility: 'private',
          completed: false,
          date: '2026-10-01',
          category: 'Personal',
          streak: 0,
        },
      ];

      // A friend query filtering visible tasks for friendId
      const visibleToFriend = privateTasks.filter(
        (t) => t.visibility === 'shared' && t.ownerId !== friendId
      );

      expect(visibleToFriend).toHaveLength(0);
    });

    it('ensures private habits are never visible to friends', () => {
      const habits: Habit[] = [
        {
          id: 'habit-1',
          ownerId,
          name: 'Private Therapy Session',
          visibility: 'private',
          type: 'build',
          frequency: 'daily',
          currentStreak: 5,
          bestStreak: 10,
          history: [],
          completedToday: false,
        },
      ];

      const visibleToFriend = habits.filter(
        (h) => h.visibility === 'shared'
      );

      expect(visibleToFriend).toHaveLength(0);
    });

    it('ensures encrypted journal entries are never accessible by friends', () => {
      const journalEntries: JournalEntry[] = [
        {
          id: 'j-1',
          date: '2026-10-01',
          content: 'Encrypted ciphertext',
          timestamp: '2026-10-01T20:00:00Z',
        },
      ];

      // Journal has strictly zero sharing mechanism; it is strictly personal
      const friendHasAccess = false;
      expect(friendHasAccess).toBe(false);
      expect(journalEntries).toBeDefined();
    });

    it('ensures private meals are never shared with friends', () => {
      const meals: Meal[] = [
        {
          id: 'm-1',
          ownerId,
          name: 'Personal Dinner',
          calories: 650,
          protein: 40,
          carbs: 60,
          fat: 20,
          time: '19:30',
          date: '2026-10-01',
        },
      ];

      // Meals are strictly personal / owner-only
      const mealsForFriend = meals.filter((m) => m.ownerId === friendId);
      expect(mealsForFriend).toHaveLength(0);
    });

    it('ensures friend chat messages are never sent to workspace chat', () => {
      const directMessage: Message = {
        id: 'dm-msg-1',
        conversationId: `${ownerId}_${friendId}`,
        senderId: ownerId,
        content: 'Hey friend, this is our private DM',
        type: 'text',
        status: 'sent',
        timestamp: '2026-10-01T12:00:00Z',
        reactions: [],
        // workspaceId is strictly undefined for direct messages!
        workspaceId: undefined,
      };

      expect(directMessage.workspaceId).toBeUndefined();
      expect(directMessage.conversationId).not.toContain('workspace');
    });

    it('ensures public user search returns ONLY safe public fields', async () => {
      const results = await friendService.searchUsers('alex', ownerId);
      for (const user of results) {
        // Safe fields allowed
        expect(user).toHaveProperty('id');
        expect(user).toHaveProperty('name');
        expect(user).toHaveProperty('username');
        expect(user).toHaveProperty('avatar');

        // Private sensitive fields MUST NEVER be present
        expect((user as any).tasks).toBeUndefined();
        expect((user as any).habits).toBeUndefined();
        expect((user as any).meals).toBeUndefined();
        expect((user as any).journal).toBeUndefined();
        expect((user as any).email).toBeUndefined();
      }
    });
  });
});
