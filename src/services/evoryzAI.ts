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
        let errorMsg = error.message;
        if (error && typeof error === 'object' && 'context' in error) {
          try {
            const errContext = (error as any).context;
            if (errContext && typeof errContext.json === 'function') {
              const body = await errContext.json();
              if (body?.error) {
                errorMsg = body.error;
              }
            }
          } catch {}
        }
        return {
          text: `EvoRyz AI is currently unavailable: ${errorMsg}`,
          error: errorMsg,
        };
      }

      if (data?.error) {
        return {
          text: data.error,
          error: data.error,
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
