import { Redirect } from 'expo-router';
import { useApp } from '@/src/store/AppContext';
export default function Index() { const { hydrated, hasCompletedSetup } = useApp(); if (!hydrated) return null; return <Redirect href={hasCompletedSetup ? '/(tabs)/daily' : '/welcome'} />; }
