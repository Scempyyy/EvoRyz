import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { authService } from '@/src/services/auth';
import { useApp } from '@/src/store/AppContext';
import { colors } from '@/src/theme';
import { EvoRyzLogo } from '@/src/components/EvoRyzLogo';
import { feedback } from '@/src/services/feedback';

export default function Auth() {
  const { session, user } = useApp();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fadeAnim = useState(() => new Animated.Value(0))[0];

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  // If already authenticated, redirect forward
  useEffect(() => {
    if (session && user && user.id !== 'me') {
      router.replace('/(tabs)/daily');
    }
  }, [session, user]);

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      feedback.tap(true);

      const result = await authService.signInWithGoogle();

      if (result.cancelled) {
        setLoading(false);
        return;
      }

      if (!result.success || result.error) {
        setLoading(false);
        setErrorMessage(result.error || 'Failed to authenticate with Google. Please try again.');
        feedback.error(true);
        return;
      }

      feedback.success(true);
      // AppContext onAuthStateChange will detect the session and navigate
    } catch (err: unknown) {
      setLoading(false);
      const msg = err instanceof Error ? err.message : 'Sign in failed. Please check your connection.';
      setErrorMessage(msg);
      feedback.error(true);
    }
  };

  return (
    <LinearGradient colors={[colors.bg, '#141126', '#090812']} style={s.root}>
      <SafeAreaView style={s.safe}>
        <View style={s.topBar}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            style={s.backBtn}
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={24} color={colors.muted} />
            <Text style={s.backText}>Back</Text>
          </Pressable>
        </View>

        <Animated.View style={[s.content, { opacity: fadeAnim }]}>
          {/* Brand Presentation */}
          <View style={s.brandSection}>
            <EvoRyzLogo size={84} showWordmark={true} showTagline={true} />
            <Text style={s.lead}>
              Private growth, accountability, and daily focus.
            </Text>
          </View>

          {/* Action Section */}
          <View style={s.actionSection}>
            {errorMessage ? (
              <View style={s.errorContainer}>
                <Ionicons name="alert-circle" size={20} color={colors.red} style={s.errorIcon} />
                <View style={s.errorContent}>
                  <Text style={s.errorTitle}>Authentication Notice</Text>
                  <Text style={s.errorBody}>{errorMessage}</Text>
                  {errorMessage.includes('redirect_uri_mismatch') && (
                    <Text style={s.errorHint}>
                      Note: Google Cloud Console requires the Supabase callback redirect URI to be authorized.
                    </Text>
                  )}
                </View>
              </View>
            ) : null}

            {/* Polished Google Sign-in Button */}
            <Pressable
              onPress={handleGoogleSignIn}
              disabled={loading}
              style={({ pressed }) => [
                s.googleButton,
                pressed && s.googleButtonPressed,
                loading && s.googleButtonDisabled,
              ]}
              accessibilityLabel="Continue with Google"
              accessibilityRole="button"
            >
              {loading ? (
                <View style={s.loadingRow}>
                  <ActivityIndicator size="small" color="#0F172A" />
                  <Text style={s.loadingText}>Authenticating with Google…</Text>
                </View>
              ) : (
                <View style={s.buttonContent}>
                  <GoogleIcon />
                  <Text style={s.buttonText}>Continue with Google</Text>
                </View>
              )}
            </Pressable>

            {/* Privacy & Security Pledge */}
            <View style={s.securityBadge}>
              <Ionicons name="shield-checkmark-outline" size={15} color={colors.violetLight} />
              <Text style={s.securityText}>
                Zero-knowledge encrypted journal · Protected by Row Level Security
              </Text>
            </View>
          </View>

          {/* Terms Footer */}
          <View style={s.footer}>
            <Text style={s.terms}>
              By signing in, you agree to our Terms of Service & Privacy Policy. Your private data is never shared.
            </Text>
          </View>
        </Animated.View>
      </SafeAreaView>
    </LinearGradient>
  );
}

function GoogleIcon() {
  return (
    <View style={s.googleIconContainer}>
      <Ionicons name="logo-google" size={20} color="#4285F4" />
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
  },
  safe: {
    flex: 1,
    paddingHorizontal: 24,
  },
  topBar: {
    paddingVertical: 8,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backText: {
    color: colors.muted,
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingBottom: 24,
  },
  brandSection: {
    alignItems: 'center',
    marginTop: 48,
  },
  lead: {
    color: '#D1D5DB',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 18,
    maxWidth: 280,
    lineHeight: 24,
  },
  actionSection: {
    width: '100%',
    alignItems: 'center',
    gap: 16,
  },
  errorContainer: {
    flexDirection: 'row',
    backgroundColor: '#30131B',
    borderColor: '#7F1D1D',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    width: '100%',
    alignItems: 'flex-start',
    gap: 10,
  },
  errorIcon: {
    marginTop: 2,
  },
  errorContent: {
    flex: 1,
  },
  errorTitle: {
    color: '#FECACA',
    fontWeight: '800',
    fontSize: 13,
  },
  errorBody: {
    color: '#F87171',
    fontSize: 12,
    marginTop: 2,
    lineHeight: 17,
  },
  errorHint: {
    color: '#FCA5A5',
    fontSize: 11,
    marginTop: 6,
    lineHeight: 15,
    fontStyle: 'italic',
  },
  googleButton: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  googleButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.985 }],
  },
  googleButtonDisabled: {
    opacity: 0.7,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  googleIconContainer: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#0F172A',
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: -0.2,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    color: '#0F172A',
    fontWeight: '700',
    fontSize: 15,
  },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  securityText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    maxWidth: 290,
  },
  footer: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  terms: {
    color: '#64748B',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
  },
});
