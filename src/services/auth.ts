import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from '@/utils/supabase';
import type { Session, User } from '@supabase/supabase-js';

// Complete any pending web browser auth sessions
WebBrowser.maybeCompleteAuthSession();

export interface AuthResult {
  success: boolean;
  user?: User;
  session?: Session | null;
  error?: string;
  cancelled?: boolean;
}

/**
 * Parses parameters from callback URLs (both fragment # and query ? styles)
 */
function parseUrlParams(url: string): Record<string, string> {
  const params: Record<string, string> = {};

  try {
    // 1. Check query parameters
    const queryIndex = url.indexOf('?');
    if (queryIndex !== -1) {
      const queryString = url.substring(queryIndex + 1).split('#')[0];
      const searchParams = new URLSearchParams(queryString);
      searchParams.forEach((val, key) => {
        params[key] = val;
      });
    }

    // 2. Check fragment hash parameters (Supabase OAuth default)
    const hashIndex = url.indexOf('#');
    if (hashIndex !== -1) {
      const hashString = url.substring(hashIndex + 1);
      const hashParams = new URLSearchParams(hashString);
      hashParams.forEach((val, key) => {
        params[key] = val;
      });
    }
  } catch (err) {
    console.warn('[EvoRyz Auth] Error parsing callback URL params:', err);
  }

  return params;
}

const inFlightCodeExchanges = new Map<string, Promise<AuthResult>>();
let lastExchangedCode: string | null = null;

export const authService = {
  /**
   * Initiates Google OAuth authentication flow with Supabase Auth
   */
  async signInWithGoogle(): Promise<AuthResult> {
    try {
      const redirectUrl = Linking.createURL('auth/callback', { scheme: 'evoryz' });

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (!data?.url) {
        return { success: false, error: 'Could not obtain Google authorization URL from server.' };
      }

      // Open in-app browser session
      const browserResult = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

      if (browserResult.type === 'cancel' || browserResult.type === 'dismiss') {
        return { success: false, cancelled: true, error: 'Sign in was cancelled.' };
      }

      if (browserResult.type === 'success' && browserResult.url) {
        return await this.handleAuthCallbackUrl(browserResult.url);
      }

      return { success: false, error: 'Authentication window closed without returning credentials.' };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred during sign in.';
      return { success: false, error: message };
    }
  },

  /**
   * Processes a callback URL or parameter set returned by OAuth redirect
   */
  async handleAuthCallbackUrl(
    urlOrParams: string | Record<string, string | string[] | undefined>
  ): Promise<AuthResult> {
    try {
      let params: Record<string, string> = {};

      if (typeof urlOrParams === 'string') {
        params = parseUrlParams(urlOrParams);
      } else if (urlOrParams && typeof urlOrParams === 'object') {
        for (const [key, val] of Object.entries(urlOrParams)) {
          if (val !== undefined) {
            params[key] = Array.isArray(val) ? val[0] : val;
          }
        }
      }

      if (params.error || params.error_description) {
        return {
          success: false,
          error: decodeURIComponent(params.error_description || params.error || 'Authentication error'),
        };
      }

      // If PKCE authorization code was returned
      if (params.code) {
        const code = params.code;

        // If this exact code was already exchanged successfully, return the active session
        if (code === lastExchangedCode) {
          const { data } = await supabase.auth.getSession();
          if (data.session) {
            return { success: true, user: data.session.user, session: data.session };
          }
        }

        // If an exchange is already in-flight for THIS specific code, await that promise
        const existingExchange = inFlightCodeExchanges.get(code);
        if (existingExchange) {
          return await existingExchange;
        }

        const exchangePromise = (async () => {
          try {
            const { data, error } = await supabase.auth.exchangeCodeForSession(code);
            if (error) {
              return { success: false, error: error.message };
            }
            lastExchangedCode = code;
            return { success: true, user: data.user ?? undefined, session: data.session };
          } finally {
            inFlightCodeExchanges.delete(code);
          }
        })();

        inFlightCodeExchanges.set(code, exchangePromise);
        return await exchangePromise;
      }

      // If implicit flow tokens were returned in hash
      if (params.access_token && params.refresh_token) {
        const { data, error } = await supabase.auth.setSession({
          access_token: params.access_token,
          refresh_token: params.refresh_token,
        });
        if (error) {
          return { success: false, error: error.message };
        }
        return { success: true, user: data.user ?? undefined, session: data.session };
      }

      // Fallback: check current session if tokens were processed
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        return { success: true, user: session.user, session };
      }

      return { success: false, error: 'No authentication tokens found in redirect URL.' };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to process authentication redirect.';
      return { success: false, error: message };
    }
  },

  /**
   * Signs the user out of Supabase Auth
   */
  async signOut(): Promise<{ error?: string }> {
    try {
      lastExchangedCode = null;
      inFlightCodeExchanges.clear();
      const { error } = await supabase.auth.signOut();
      if (error) return { error: error.message };
      return {};
    } catch (err: unknown) {
      return { error: err instanceof Error ? err.message : 'Sign out failed.' };
    }
  },

  /**
   * Retrieves active session
   */
  async getSession(): Promise<Session | null> {
    try {
      const { data } = await supabase.auth.getSession();
      return data.session;
    } catch {
      return null;
    }
  },

  /**
   * Subscribes to auth state changes
   */
  onAuthStateChange(callback: (session: Session | null) => void) {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      callback(session);
    });
    return subscription;
  },
};
