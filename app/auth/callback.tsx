import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { authService } from '@/src/services/auth';
import { colors } from '@/src/theme';
import { EvoRyzLogo } from '@/src/components/EvoRyzLogo';

export default function AuthCallbackScreen() {
  const params = useLocalSearchParams<{
    code?: string | string[];
    error?: string;
    error_description?: string;
  }>();
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession();

    let mounted = true;

    async function completeCallback() {
      try {
        const rawCode = Array.isArray(params.code) ? params.code[0] : params.code;
        const rawError = Array.isArray(params.error) ? params.error[0] : params.error;
        const rawDesc = Array.isArray(params.error_description) ? params.error_description[0] : params.error_description;

        let result = await authService.handleAuthCallbackUrl({
          code: rawCode,
          error: rawError,
          error_description: rawDesc,
        });

        if (!result.success && !rawCode) {
          // Attempt recovery from initial deep link URL if parameters were stripped by navigation
          const initialUrl = await Linking.getInitialURL();
          if (initialUrl && (initialUrl.includes('code=') || initialUrl.includes('access_token='))) {
            result = await authService.handleAuthCallbackUrl(initialUrl);
          }
        }

        if (!mounted) return;

        if (result.success) {
          router.replace('/(tabs)/daily');
        } else if (result.error) {
          setErrorText(result.error);
          setTimeout(() => {
            if (mounted) router.replace('/auth');
          }, 2000);
        } else {
          // If already authenticated, proceed to daily
          const activeSession = await authService.getSession();
          if (activeSession) {
            router.replace('/(tabs)/daily');
          } else {
            router.replace('/auth');
          }
        }
      } catch (err: unknown) {
        if (!mounted) return;
        const msg = err instanceof Error ? err.message : 'Authentication failed';
        setErrorText(msg);
        setTimeout(() => {
          if (mounted) router.replace('/auth');
        }, 2000);
      }
    }

    void completeCallback();

    return () => {
      mounted = false;
    };
  }, [params]);

  return (
    <View style={s.container}>
      <EvoRyzLogo size={72} showWordmark={true} />
      <View style={s.statusCard}>
        <ActivityIndicator size="small" color={colors.violetLight} />
        <Text style={s.statusText}>
          {errorText ? errorText : 'Establishing authenticated session…'}
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  statusCard: {
    marginTop: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusText: {
    color: '#D1D5DB',
    fontSize: 14,
    fontWeight: '600',
  },
});
