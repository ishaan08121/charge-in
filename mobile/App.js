import 'react-native-gesture-handler';
import React, { useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';

import { useAuthStore } from './src/store/authStore';
import { useThemeStore } from './src/store/themeStore';
import AppNavigator from './src/navigation/AppNavigator';
import AuthNavigator from './src/navigation/AuthNavigator';
import { useColors } from './src/constants/colors';
import usePushNotifications from './src/hooks/usePushNotifications';

function AppWithNotifications() {
  const navigationRef = useRef(null);
  const colors = useColors();
  const isDark = useThemeStore((s) => s.isDark);
  usePushNotifications(navigationRef.current);

  return (
    <NavigationContainer ref={navigationRef}>
      <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor={colors.bg} />
      <AppNavigator />
    </NavigationContainer>
  );
}

export default function App() {
  const { user, isLoading, hydrate } = useAuthStore();
  const hydrateTheme = useThemeStore((s) => s.hydrate);
  const colors = useColors();
  const isDark = useThemeStore((s) => s.isDark);

  useEffect(() => {
    hydrate();
    hydrateTheme();
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
        <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor={colors.bg} />
        <AuthNavigator />
      </NavigationContainer>
    );
  }

  return <AppWithNotifications />;
}
