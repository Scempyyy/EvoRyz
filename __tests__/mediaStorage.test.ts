import { resolveMediaUrl } from '../src/services/mediaResolver';
import { supabaseRepo } from '../src/services/supabaseRepository';
import { supabase } from '../utils/supabase';

jest.mock('../utils/supabase', () => {
  const uploadMock = jest.fn();
  const createSignedUrlMock = jest.fn();
  const fromMock = jest.fn(() => ({
    upload: uploadMock,
    createSignedUrl: createSignedUrlMock,
  }));

  return {
    supabase: {
      storage: {
        from: fromMock,
      },
      from: jest.fn(),
      rpc: jest.fn(),
      channel: jest.fn(),
      auth: {
        getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
      },
    },
  };
});

describe('Cross-Device Workspace Media Storage & Resolution', () => {
  const workspaceId = '11111111-1111-4111-a111-111111111111';
  const messageId = '22222222-2222-4222-a222-222222222222';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('resolveMediaUrl', () => {
    it('returns null for empty or undefined uri', async () => {
      expect(await resolveMediaUrl(null)).toBeNull();
      expect(await resolveMediaUrl(undefined)).toBeNull();
      expect(await resolveMediaUrl('')).toBeNull();
    });

    it('returns direct HTTP and HTTPS URLs immediately without storage lookup', async () => {
      const httpUrl = 'http://example.com/test.jpg';
      const httpsUrl = 'https://example.com/voice.m4a';

      expect(await resolveMediaUrl(httpUrl)).toBe(httpUrl);
      expect(await resolveMediaUrl(httpsUrl)).toBe(httpsUrl);
      expect(supabase.storage.from).not.toHaveBeenCalled();
    });

    it('returns local file:// and content:// URIs immediately for local playback/display', async () => {
      const fileUri = 'file:///data/user/0/com.evoryz/cache/photo.jpg';
      const contentUri = 'content://media/external/images/media/123';

      expect(await resolveMediaUrl(fileUri)).toBe(fileUri);
      expect(await resolveMediaUrl(contentUri)).toBe(contentUri);
      expect(supabase.storage.from).not.toHaveBeenCalled();
    });

    it('resolves remote storage paths to signed URLs via Supabase Storage', async () => {
      const storagePath = `${workspaceId}/${messageId}.jpg`;
      const signedUrl = `https://supabase.co/storage/v1/object/sign/workspace-media/${storagePath}?token=abc`;

      const storageBucket = (supabase.storage.from as jest.Mock)();
      storageBucket.createSignedUrl.mockResolvedValueOnce({
        data: { signedUrl },
        error: null,
      });

      const result = await resolveMediaUrl(storagePath);
      expect(result).toBe(signedUrl);
      expect(supabase.storage.from).toHaveBeenCalledWith('workspace-media');
      expect(storageBucket.createSignedUrl).toHaveBeenCalledWith(storagePath, 86400);
    });

    it('uses in-memory cache for repeated storage path resolutions', async () => {
      const storagePath = `${workspaceId}/${messageId}.png`;
      const signedUrl = `https://supabase.co/storage/v1/object/sign/workspace-media/${storagePath}?token=xyz`;

      const storageBucket = (supabase.storage.from as jest.Mock)();
      storageBucket.createSignedUrl.mockResolvedValueOnce({
        data: { signedUrl },
        error: null,
      });

      // First resolution: hits storage API
      const result1 = await resolveMediaUrl(storagePath);
      expect(result1).toBe(signedUrl);
      expect(storageBucket.createSignedUrl).toHaveBeenCalledTimes(1);

      // Second resolution: served from memory cache without another API call
      const result2 = await resolveMediaUrl(storagePath);
      expect(result2).toBe(signedUrl);
      expect(storageBucket.createSignedUrl).toHaveBeenCalledTimes(1);
    });
  });

  describe('supabaseRepo storage methods', () => {
    it('getSignedMediaUrl strips leading bucket name and requests signed URL', async () => {
      const storageBucket = (supabase.storage.from as jest.Mock)();
      storageBucket.createSignedUrl.mockResolvedValueOnce({
        data: { signedUrl: 'https://test.supabase.co/signed' },
        error: null,
      });

      const url = await supabaseRepo.getSignedMediaUrl(`workspace-media/${workspaceId}/note.m4a`);
      expect(url).toBe('https://test.supabase.co/signed');
      expect(storageBucket.createSignedUrl).toHaveBeenCalledWith(`${workspaceId}/note.m4a`, 86400);
    });

    it('getSignedMediaUrl handles errors gracefully', async () => {
      const storageBucket = (supabase.storage.from as jest.Mock)();
      storageBucket.createSignedUrl.mockResolvedValueOnce({
        data: null,
        error: new Error('Permission denied'),
      });

      const url = await supabaseRepo.getSignedMediaUrl(`${workspaceId}/missing.jpg`);
      expect(url).toBeNull();
    });
  });
});
