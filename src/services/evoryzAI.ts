import { supabase } from '@/utils/supabase';

export interface EvoRyzAIResult {
  text: string;
  structured?: Record<string, unknown>;
  error?: string;
}

export interface ChatMessageContext {
  role: 'user' | 'model';
  content: string;
}

function sanitizeAiErrorMessage(raw?: string): string {
  if (!raw || typeof raw !== 'string') {
    return 'EvoRyz AI is temporarily unavailable. Please try again.';
  }
  const lower = raw.toLowerCase();
  if (
    lower.includes('gemini') ||
    lower.includes('not_found') ||
    lower.includes('404') ||
    lower.includes('503') ||
    lower.includes('500') ||
    lower.includes('api key') ||
    lower.includes('google') ||
    lower.includes('generativelanguage') ||
    lower.includes('models/') ||
    lower.includes('non-2xx status') ||
    lower.includes('html') ||
    lower.includes('internal server error')
  ) {
    return 'EvoRyz AI is temporarily unavailable. Please try again.';
  }
  return raw;
}

/**
 * Secure EvoRyz AI Service Boundary.
 * Calls Supabase Edge Function 'evoryz-ai'.
 * No AI provider secrets or API keys reside inside the client application.
 */
export const EvoRyzAIService = {
  async ask(
    prompt: string,
    conversationHistory: ChatMessageContext[] = []
  ): Promise<EvoRyzAIResult> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      } else {
        return {
          text: 'Please sign in to chat with your AI mentor.',
          error: 'Unauthenticated session',
        };
      }

      const { data, error } = await supabase.functions.invoke('evoryz-ai', {
        body: { prompt, conversationHistory },
        headers,
      });

      if (error) {
        console.warn('[EvoRyzAIService] Edge function error:', error.message);
        let errorMsg = 'EvoRyz AI is temporarily unavailable. Please try again.';
        if (error && typeof error === 'object' && 'context' in error) {
          try {
            const errContext = (error as any).context;
            if (errContext && typeof errContext.json === 'function') {
              const body = await errContext.json();
              if (body?.error) {
                errorMsg = sanitizeAiErrorMessage(body.error);
              }
            }
          } catch {}
        } else if (error.message) {
          errorMsg = sanitizeAiErrorMessage(error.message);
        }
        return {
          text: errorMsg,
          error: errorMsg,
        };
      }

      if (data?.error) {
        const cleanMsg = sanitizeAiErrorMessage(data.error);
        return {
          text: cleanMsg,
          error: cleanMsg,
        };
      }

      return {
        text: data?.text || data?.reply || 'No response received from EvoRyz AI.',
        structured: data?.structured,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error communicating with AI backend';
      return {
        text: "Could not reach EvoRyz AI service. Please verify your internet connection.",
        error: msg,
      };
    }
  },
};
