import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useApp } from '@/src/store/AppContext';
import { WinterArcEntryTransition } from '@/src/components/winterArc/WinterArcEntryTransition';
import { WinterArcDashboard } from '@/src/components/winterArc/WinterArcDashboard';

export default function WinterArcScreen() {
  const { user } = useApp();
  const [showTransition, setShowTransition] = useState(true);

  return (
    <View style={styles.container}>
      <StatusBar hidden={false} style="light" />
      {showTransition ? (
        <WinterArcEntryTransition onProceed={() => setShowTransition(false)} />
      ) : (
        <WinterArcDashboard
          userId={user?.id || 'offline_user'}
          onExit={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(tabs)/daily');
            }
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09080F',
  },
});
