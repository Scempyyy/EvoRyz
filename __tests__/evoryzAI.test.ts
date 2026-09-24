import { EvoRyzAIService } from '../src/services/evoryzAI';
import { supabase } from '../utils/supabase';

jest.mock('../utils/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
    },
    functions: {
      invoke: jest.fn(),
    },
  },
}));

describe('EvoRyzAIService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns unauthenticated error message if no active session', async () => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValueOnce({
      data: { session: null },
      error: null,
    });

    const res = await EvoRyzAIService.ask('How do I build discipline?');
    expect(res.text).toContain('Please sign in');
    expect(res.error).toBe('Unauthenticated session');
    expect(supabase.functions.invoke).not.toHaveBeenCalled();
  });

  it('passes Bearer authorization and prompt to evoryz-ai edge function', async () => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValueOnce({
      data: {
        session: {
          access_token: 'mock-jwt-token',
        },
      },
      error: null,
    });

    (supabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
      data: { text: 'Focus on small daily wins and track your habits.' },
      error: null,
    });

    const res = await EvoRyzAIService.ask('How do I stay consistent?');
    expect(supabase.functions.invoke).toHaveBeenCalledWith('evoryz-ai', {
      body: {
        prompt: 'How do I stay consistent?',
        conversationHistory: [],
      },
      headers: {
        Authorization: 'Bearer mock-jwt-token',
      },
    });
    expect(res.text).toBe('Focus on small daily wins and track your habits.');
    expect(res.error).toBeUndefined();
  });

  it('extracts contextual error message from edge function response', async () => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValueOnce({
      data: {
        session: {
          access_token: 'mock-jwt-token',
        },
      },
      error: null,
    });

    const mockHttpError = {
      message: 'Edge Function returned a non-2xx status code',
      context: {
        json: jest.fn().mockResolvedValue({ error: 'AI mentor service rate limit exceeded' }),
      },
    };

    (supabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
      data: null,
      error: mockHttpError,
    });

    const res = await EvoRyzAIService.ask('Help me prioritize');
    expect(res.error).toBe('AI mentor service rate limit exceeded');
    expect(res.text).toContain('AI mentor service rate limit exceeded');
  });

  it('sanitizes raw Gemini API errors into a clean user-friendly fallback', async () => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValueOnce({
      data: {
        session: {
          access_token: 'mock-jwt-token',
        },
      },
      error: null,
    });

    const rawGeminiError = {
      message: 'Edge Function returned a non-2xx status code',
      context: {
        json: jest.fn().mockResolvedValue({
          error: 'Gemini API error: 404 NOT_FOUND models/gemini-2.5-flash is no longer available',
        }),
      },
    };

    (supabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
      data: null,
      error: rawGeminiError,
    });

    const res = await EvoRyzAIService.ask('Who built you?');
    expect(res.text).toBe('EvoRyz AI is temporarily unavailable. Please try again.');
    expect(res.text).not.toContain('Gemini');
    expect(res.text).not.toContain('404');
  });
});
