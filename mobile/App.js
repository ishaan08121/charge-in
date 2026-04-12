import 'react-native-gesture-handler';
import React, { useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';

import { useAuthStore } from './src/store/authStore';
import AppNavigator from './src/navigation/AppNavigator';
import AuthNavigator from './src/navigation/AuthNavigator';
import { colors } from './src/constants/colors';
import usePushNotifications from './src/hooks/usePushNotifications';

function AppWithNotifications() {
  const navigationRef = useRef(null);
  usePushNotifications(navigationRef.current);

  return (
    <NavigationContainer ref={navigationRef}>
      <StatusBar style="light" backgroundColor={colors.bg} />
      <AppNavigator />
    </NavigationContainer>
  );
}

export default function App() {
  const { user, isLoading, hydrate } = useAuthStore();

  useEffect(() => {
    hydrate();
  }, []);

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!user) {
    return (
      <NavigationContainer>
        <StatusBar style="light" backgroundColor={colors.bg} />
        <AuthNavigator />
      </NavigationContainer>
    );
  }

  return <AppWithNotifications />;
}
