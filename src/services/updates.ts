import * as Updates from 'expo-updates';
import Constants from 'expo-constants';

export interface UpdateCheckResult {
  isEnabled: boolean;
  isAvailable: boolean;
  error?: string;
  updateId?: string;
  manifest?: Record<string, unknown>;
}

export const UpdatesService = {
  isEnabled(): boolean {
    return Updates.isEnabled;
  },

  getAppInfo(): {
    version: string;
    runtimeVersion: string;
    channel: string;
    updateId: string;
    isEmbeddedLaunch: boolean;
  } {
    const version = Constants.expoConfig?.version ?? '1.0.0';
    const runtimeVersion = String(
      Updates.runtimeVersion ?? Constants.expoConfig?.runtimeVersion ?? 'appVersion'
    );
    const channel = Updates.channel ?? 'preview';
    const updateId = Updates.updateId ?? 'embedded';
    const isEmbeddedLaunch = Updates.isEmbeddedLaunch ?? true;

    return {
      version,
      runtimeVersion,
      channel,
      updateId,
      isEmbeddedLaunch,
    };
  },

  async checkForUpdate(): Promise<UpdateCheckResult> {
    if (!Updates.isEnabled) {
      return {
        isEnabled: false,
        isAvailable: false,
        error: 'OTA updates are active in standalone/preview APK builds.',
      };
    }

    try {
      const check = await Updates.checkForUpdateAsync();
      if (check.isAvailable) {
        const fetched = await Updates.fetchUpdateAsync();
        return {
          isEnabled: true,
          isAvailable: true,
          manifest: (fetched.manifest as Record<string, unknown>) ?? undefined,
        };
      }
      return {
        isEnabled: true,
        isAvailable: false,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        isEnabled: true,
        isAvailable: false,
        error: message,
      };
    }
  },

  async reload(): Promise<void> {
    if (!Updates.isEnabled) return;
    try {
      await Updates.reloadAsync();
    } catch (err) {
      console.warn('[UpdatesService] reloadAsync error:', err);
    }
  },
};
