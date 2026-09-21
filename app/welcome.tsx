import { router } from 'expo-router';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/src/theme';
import { EvoRyzLogo } from '@/src/components/EvoRyzLogo';

export default function Welcome() {
  return (
    <LinearGradient colors={[colors.bg, '#141026', '#090812']} style={s.root}>
      <SafeAreaView style={s.safe}>
        <View style={s.mark}>
          <EvoRyzLogo size={68} showWordmark={true} showTagline={true} />
        </View>

        <View style={s.bottom}>
          <Text style={s.title}>
            Grow on your{`\n`}terms.
          </Text>
          <Text style={s.copy}>
            A private space for your goals, habits, and daily focus — whether you grow solo, with a duo, or as a team.
          </Text>

          <Pressable
            style={s.primary}
            onPress={() => router.push('/auth')}
            accessibilityLabel="Get started"
          >
            <Text style={s.primaryText}>Continue with Google</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
  },
  safe: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 28,
  },
  mark: {
    alignItems: 'center',
    marginTop: 40,
  },
  bottom: {
    marginBottom: 16,
  },
  title: {
    color: 'white',
    fontSize: 40,
    fontWeight: '800',
    lineHeight: 46,
    letterSpacing: -1,
    marginBottom: 14,
  },
  copy: {
    color: '#9CA3AF',
    fontSize: 15,
    lineHeight: 23,
    marginBottom: 28,
  },
  primary: {
    backgroundColor: colors.violet,
    paddingVertical: 17,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: colors.violet,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  primaryText: {
    color: 'white',
    fontWeight: '800',
    fontSize: 16,
  },
});
