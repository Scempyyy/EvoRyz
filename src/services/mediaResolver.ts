import { useState, useEffect } from 'react';
import { supabaseRepo } from './supabaseRepository';

const activeCache = new Map<string, string>();
const cacheTimers = new Map<string, ReturnType<typeof setTimeout>>();
const pendingPromises = new Map<string, Promise<string | null>>();

function setCache(path: string, url: string, ttlMs = 86400 * 1000) {
  activeCache.set(path, url);
  const existingTimer = cacheTimers.get(path);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }
  const timer = setTimeout(() => {
    activeCache.delete(path);
    cacheTimers.delete(path);
  }, Math.max(1000, ttlMs - 60000));
  (timer as unknown as { unref?: () => void }).unref?.();
  cacheTimers.set(path, timer);
}

/**
 * Resolves a media URI (which may be a Supabase Storage path like `${workspaceId}/${messageId}.${ext}`)
 * into a signed HTTPS URL with 24-hour expiration and in-memory caching.
 * If the URI is already an HTTP(S) URL or a local file:// / content:// URI, it is returned directly.
 */
export async function resolveMediaUrl(uri?: string | null): Promise<string | null> {
  if (!uri) return null;

  // Direct remote HTTP(S) URLs
  if (uri.startsWith('http://') || uri.startsWith('https://')) {
    return uri;
  }

  // Local device URIs (file:// or content://)
  if (uri.startsWith('file://') || uri.startsWith('content://')) {
    return uri;
  }

  // Storage path (e.g. "workspace-media/uuid/..." or "uuid/...")
  const cleanPath = uri.replace(/^workspace-media\//, '').replace(/^\/+/, '');

  const cached = activeCache.get(cleanPath);
  if (cached) {
    return cached;
  }

  // Deduplicate concurrent requests for the same path
  if (pendingPromises.has(cleanPath)) {
    return pendingPromises.get(cleanPath)!;
  }

  const fetchPromise = (async () => {
    try {
      const signedUrl = await supabaseRepo.getSignedMediaUrl(cleanPath, 86400);
      if (signedUrl) {
        setCache(cleanPath, signedUrl, 86400 * 1000);
        return signedUrl;
      }
      return null;
    } catch {
      return null;
    } finally {
      pendingPromises.delete(cleanPath);
    }
  })();

  pendingPromises.set(cleanPath, fetchPromise);
  return fetchPromise;
}

/**
 * React hook to resolve a media URI to a usable URL (local, HTTP, or signed Supabase Storage URL).
 * Derives direct or cached URLs synchronously during render, avoiding cascading effect renders.
 */
export function useResolvedMediaUrl(uri?: string | null): string | null {
  const isDirect =
    !uri ||
    uri.startsWith('http://') ||
    uri.startsWith('https://') ||
    uri.startsWith('file://') ||
    uri.startsWith('content://');

  const cleanPath = uri ? uri.replace(/^workspace-media\//, '').replace(/^\/+/, '') : '';
  const cachedUrl = cleanPath ? activeCache.get(cleanPath) || null : null;

  const [asyncUrl, setAsyncUrl] = useState<string | null>(null);

  useEffect(() => {
    if (isDirect || cachedUrl) return;

    let isMounted = true;
    void resolveMediaUrl(uri).then((url) => {
      if (isMounted && url) {
        setAsyncUrl(url);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [uri, isDirect, cachedUrl]);

  if (!uri) return null;
  if (isDirect) return uri;
  if (cachedUrl) return cachedUrl;
  return asyncUrl;
}
