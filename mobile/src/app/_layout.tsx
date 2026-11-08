import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AccountRecovery } from '@/components/account-recovery';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';

import { startLogging } from '@/lib/logger';

// Start structured logging before anything else runs so startup + auth restore are captured.
startLogging();
SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  const colorScheme = useColorScheme();
  return (
    <GestureHandlerRootView style={{ flex: 1 }}><ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <AppTabs />
      <AccountRecovery />
    </ThemeProvider></GestureHandlerRootView>
  );
}
