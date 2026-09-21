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
      const { data, error } = await supabase.functions.invoke('evoryz-ai', {
        body: { prompt, conversationHistory },
      });

      if (error) {
        // Honest reporting when Edge Function is not yet deployed or error occurs
        console.warn('[EvoRyzAIService] Edge function error:', error.message);
        return {
          text: "EvoRyz AI backend is currently unconfigured. To enable real AI mentor chat, deploy the Supabase Edge Function 'evoryz-ai' with your provider API key.",
          error: error.message,
        };
      }

      if (data?.error) {
        return {
          text: data.error,
          error: data.error,
        };
      }

      return {
        text: data?.text || 'No response received from EvoRyz AI.',
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
