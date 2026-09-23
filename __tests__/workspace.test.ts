import { supabaseRepo } from '../src/services/supabaseRepository';
import { supabase } from '../utils/supabase';

jest.mock('../utils/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
    from: jest.fn(),
    channel: jest.fn(),
    removeChannel: jest.fn().mockResolvedValue('ok'),
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
    },
    realtime: {
      setAuth: jest.fn().mockResolvedValue(undefined),
    },
  },
}));

describe('Workspace Lifecycle & Invite System', () => {
  const mockUserId = '11111111-1111-4111-a111-111111111111';
  const mockWsId = '22222222-2222-4222-a222-222222222222';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects invalid / unauthenticated user IDs for workspace operations', async () => {
    const res = await supabaseRepo.createWorkspace('unauthenticated', 'My Team', 'team');
    expect(res).toBeNull();

    const fetchRes = await supabaseRepo.fetchUserWorkspace('not-a-uuid');
    expect(fetchRes).toBeNull();
  });

  it('createWorkspace calls create_workspace_secure RPC and returns structured workspace', async () => {
    (supabase.rpc as jest.Mock).mockImplementation((fn: string) => {
      if (fn === 'ensure_profile_exists') {
        return Promise.resolve({ data: null, error: null });
      }
      if (fn === 'create_workspace_secure') {
        return Promise.resolve({
          data: {
            id: mockWsId,
            name: 'Alpha Team',
            mode: 'team',
            invite_code: 'EVR-TEST01',
          },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'workspace_members') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValueOnce({
            data: [{ user_id: mockUserId, role: 'owner' }],
            error: null,
          }),
        };
      }
      if (table === 'profiles') {
        return {
          select: jest.fn().mockReturnThis(),
          in: jest.fn().mockResolvedValueOnce({
            data: [{ id: mockUserId, name: 'Owner User', avatar_url: 'A' }],
            error: null,
          }),
        };
      }
      return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockResolvedValue({ data: [], error: null }) };
    });

    const ws = await supabaseRepo.createWorkspace(mockUserId, 'Alpha Team', 'team', 'EVR-TEST01');
    expect(supabase.rpc).toHaveBeenCalledWith('create_workspace_secure', {
      name_input: 'Alpha Team',
      mode_input: 'team',
      invite_code_input: 'EVR-TEST01',
    });
    expect(ws).not.toBeNull();
    expect(ws?.id).toBe(mockWsId);
    expect(ws?.mode).toBe('team');
    expect(ws?.inviteCode).toBe('EVR-TEST01');
    expect(ws?.members.length).toBe(1);
    expect(ws?.members[0].name).toBe('Owner User');
  });

  it('joinWorkspaceByInviteCode calls join_workspace_by_invite RPC with uppercase normalized code', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValueOnce({
      data: {
        id: mockWsId,
        name: 'My Duo',
        mode: 'duo',
        invite_code: 'EVR-DUO123',
        already_member: false,
      },
      error: null,
    });

    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'workspace_members') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValueOnce({
            data: [
              { user_id: '33333333-3333-4333-a333-333333333333', role: 'owner' },
              { user_id: mockUserId, role: 'member' },
            ],
            error: null,
          }),
        };
      }
      if (table === 'profiles') {
        return {
          select: jest.fn().mockReturnThis(),
          in: jest.fn().mockResolvedValueOnce({
            data: [
              { id: '33333333-3333-4333-a333-333333333333', name: 'Partner 1', avatar_url: 'P' },
              { id: mockUserId, name: 'Partner 2', avatar_url: 'P2' },
            ],
            error: null,
          }),
        };
      }
      return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockResolvedValue({ data: [], error: null }) };
    });

    const res = await supabaseRepo.joinWorkspaceByInviteCode('  evr-duo123  ');
    expect(supabase.rpc).toHaveBeenCalledWith('join_workspace_by_invite', {
      invite_code_input: 'EVR-DUO123',
    });
    expect(res.success).toBe(true);
    expect(res.workspace?.id).toBe(mockWsId);
    expect(res.workspace?.members.length).toBe(2);
  });

  it('handles server-side Duo capacity limit error correctly', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValueOnce({
      data: null,
      error: { message: 'This Duo workspace is full (maximum 2 members).' },
    });

    const res = await supabaseRepo.joinWorkspaceByInviteCode('EVR-FULL');
    expect(res.success).toBe(false);
    expect(res.error).toBe('This Duo workspace is full (maximum 2 members).');
  });

  it('leaveWorkspace invokes leave_workspace RPC', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValueOnce({
      data: true,
      error: null,
    });

    const success = await supabaseRepo.leaveWorkspace(mockUserId, mockWsId);
    expect(supabase.rpc).toHaveBeenCalledWith('leave_workspace', {
      workspace_id_input: mockWsId,
    });
    expect(success).toBe(true);
  });

  describe('Username Update & Validation', () => {
    it('rejects invalid length or illegal characters', async () => {
      const tooShort = await supabaseRepo.updateUsername(mockUserId, 'ab');
      expect(tooShort.success).toBe(false);
      expect(tooShort.error).toContain('3 and 20 characters');

      const tooLong = await supabaseRepo.updateUsername(mockUserId, 'a'.repeat(21));
      expect(tooLong.success).toBe(false);
      expect(tooLong.error).toContain('3 and 20 characters');

      const illegalChars = await supabaseRepo.updateUsername(mockUserId, 'user@name!');
      expect(illegalChars.success).toBe(false);
      expect(illegalChars.error).toContain('letters, numbers, and underscores');
    });

    it('successfully calls update_username RPC and trims/lowercases input', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValueOnce({
        data: { success: true, username: 'valid_user123' },
        error: null,
      });

      const res = await supabaseRepo.updateUsername(mockUserId, '  Valid_User123  ');
      expect(supabase.rpc).toHaveBeenCalledWith('update_username', {
        new_username: 'valid_user123',
      });
      expect(res.success).toBe(true);
    });

    it('handles unique conflict error from database', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValueOnce({
        data: null,
        error: { code: '23505', message: 'Username is already taken' },
      });

      const res = await supabaseRepo.updateUsername(mockUserId, 'taken_username');
      expect(res.success).toBe(false);
      expect(res.error).toBe('Username is already taken.');
    });
  });

  describe('Activities Table & Error Resilience', () => {
    it('fetchActivities returns empty array instead of throwing when activities table fails', async () => {
      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValueOnce({
          data: null,
          error: { message: 'relation "public.activities" does not exist' },
        }),
      };
      (supabase.from as jest.Mock).mockReturnValue(mockFrom);

      const activities = await supabaseRepo.fetchActivities(mockWsId);
      expect(Array.isArray(activities)).toBe(true);
      expect(activities.length).toBe(0);
    });

    it('insertActivity never throws even if table does not exist or network fails', async () => {
      const mockFrom = {
        insert: jest.fn().mockRejectedValueOnce(new Error('relation "public.activities" does not exist')),
      };
      (supabase.from as jest.Mock).mockReturnValue(mockFrom);

      await expect(
        supabaseRepo.insertActivity({
          id: '33333333-3333-4333-a333-333333333333',
          userId: mockUserId,
          workspaceId: mockWsId,
          type: 'joined',
          title: 'joined workspace',
          visibility: 'shared',
          timestamp: new Date().toISOString(),
        })
      ).resolves.not.toThrow();
    });
  });

  describe('Workspace Members Resolution & Robustness', () => {
    it('loadWorkspaceMembers correctly resolves members even if profiles query fails', async () => {
      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'workspace_members') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockResolvedValueOnce({
              data: [
                { user_id: mockUserId, role: 'owner' },
                { user_id: '44444444-4444-4444-a444-444444444444', role: 'member' },
              ],
              error: null,
            }),
          };
        }
        if (table === 'profiles') {
          return {
            select: jest.fn().mockReturnThis(),
            in: jest.fn().mockResolvedValueOnce({
              data: [], // profiles empty / not yet created
              error: null,
            }),
          };
        }
        return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockResolvedValue({ data: [], error: null }) };
      });

      const members = await supabaseRepo.loadWorkspaceMembers(mockWsId);
      expect(members.length).toBe(2);
      expect(members[0].name).toBe('Owner');
      expect(members[1].name).toBe('Member');
    });

    it('fetchUserWorkspace guarantees at least 1 member for an authenticated workspace user', async () => {
      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'workspace_members') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnValueOnce({
              order: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValueOnce({
                  data: [{
                    workspace_id: mockWsId,
                    role: 'member',
                  }],
                  error: null,
                }),
              }),
            }).mockResolvedValueOnce({
              data: [], // simulate temporary empty members return from loadWorkspaceMembers
              error: null,
            }),
          };
        }
        if (table === 'workspaces') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({
                data: {
                  id: mockWsId,
                  name: 'Test WS',
                  mode: 'duo',
                  invite_code: 'EVR-TEST',
                },
                error: null,
              }),
            }),
          };
        }
        return { select: jest.fn().mockReturnThis(), in: jest.fn().mockResolvedValue({ data: [], error: null }) };
      });

      const ws = await supabaseRepo.fetchUserWorkspace(mockUserId);
      expect(ws).not.toBeNull();
      expect(ws?.members.length).toBe(1);
      expect(ws?.members[0].id).toBe(mockUserId);
    });
  });

  describe('Workspace Chat & Realtime Reliability', () => {
    it('insertMessage satisfies check constraint with matching message_type and type', async () => {
      let insertedPayload: any = null;
      (supabase.from as jest.Mock).mockReturnValue({
        insert: jest.fn().mockImplementation((payload) => {
          insertedPayload = payload;
          return Promise.resolve({ error: null });
        }),
      });

      const res = await supabaseRepo.insertMessage({
        id: '55555555-5555-4555-a555-555555555555',
        senderId: mockUserId,
        workspaceId: mockWsId,
        content: 'Hello Realtime',
        type: 'text',
        timestamp: new Date().toISOString(),
      });

      expect(res.success).toBe(true);
      expect(insertedPayload.type).toBe('text');
      expect(insertedPayload.message_type).toBe('text');
      expect(insertedPayload.content).toBe('Hello Realtime');
      expect(insertedPayload.body).toBe('Hello Realtime');
    });

    it('subscribeToMessages invokes setAuth with session token and transitions to SUBSCRIBED', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValueOnce({
        data: {
          session: {
            access_token: 'mock-jwt-token',
            user: { id: mockUserId },
          },
        },
        error: null,
      });

      const channelMock = {
        on: jest.fn().mockReturnThis(),
        subscribe: jest.fn().mockImplementation((cb) => {
          cb('SUBSCRIBED');
        }),
      };
      (supabase.channel as jest.Mock).mockReturnValue(channelMock);

      const statusHistory: string[] = [];
      const unsub = supabaseRepo.subscribeToMessages(
        'workspace',
        jest.fn(),
        mockWsId,
        (status) => statusHistory.push(status)
      );

      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(supabase.realtime.setAuth).toHaveBeenCalledWith('mock-jwt-token');
      expect(statusHistory).toContain('CONNECTING');
      expect(statusHistory).toContain('SUBSCRIBED');

      unsub();
      expect(supabase.removeChannel).toHaveBeenCalled();
    });

    it('subscribeToMessages reports CHANNEL_ERROR and TIMED_OUT properly', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValueOnce({
        data: { session: null },
        error: null,
      });

      const channelMock = {
        on: jest.fn().mockReturnThis(),
        subscribe: jest.fn().mockImplementation((cb) => {
          cb('CHANNEL_ERROR', new Error('Realtime connection rejected'));
        }),
      };
      (supabase.channel as jest.Mock).mockReturnValue(channelMock);

      const statusHistory: string[] = [];
      const unsub = supabaseRepo.subscribeToMessages(
        'workspace',
        jest.fn(),
        mockWsId,
        (status) => statusHistory.push(status)
      );

      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(statusHistory).toContain('CHANNEL_ERROR');
      unsub();
    });
  });
});


