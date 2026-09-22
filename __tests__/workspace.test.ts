import { supabaseRepo } from '../src/services/supabaseRepository';
import { supabase } from '../utils/supabase';

jest.mock('../utils/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
    from: jest.fn(),
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
    (supabase.rpc as jest.Mock).mockResolvedValueOnce({
      data: {
        id: mockWsId,
        name: 'Alpha Team',
        mode: 'team',
        invite_code: 'EVR-TEST01',
      },
      error: null,
    });

    const mockFrom = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValueOnce({
        data: [{ user_id: mockUserId, role: 'owner', profiles: { name: 'Owner User', avatar_url: 'A' } }],
        error: null,
      }),
    };
    (supabase.from as jest.Mock).mockReturnValue(mockFrom);

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

    const mockFrom = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValueOnce({
        data: [
          { user_id: '33333333-3333-4333-a333-333333333333', role: 'owner', profiles: { name: 'Partner 1' } },
          { user_id: mockUserId, role: 'member', profiles: { name: 'Partner 2' } },
        ],
        error: null,
      }),
    };
    (supabase.from as jest.Mock).mockReturnValue(mockFrom);

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
});
