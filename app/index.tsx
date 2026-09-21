import { Redirect } from 'expo-router';
import { useApp } from '@/src/store/AppContext';

export default function Index() {
  const { hydrated, session, user } = useApp();
  if (!hydrated) return null;

  const isAuthenticated = Boolean(session && user && user.id !== 'unauthenticated');
  return <Redirect href={isAuthenticated ? '/(tabs)/daily' : '/welcome'} />;
}
