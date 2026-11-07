import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Fonts } from '@/constants/theme';
import { ExploreActionButton } from './explore-action-button';

const welcomeKey = 'home-account-welcome-dismissed-v1';
const accountSeenKey = 'home-account-seen-v1';

/** Account invitations beneath Leaf, after account restoration finishes. */
export function HomeAccountWelcome() {
  const router = useRouter();
  const [signedOut, setSignedOut] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const [welcomed, setWelcomed] = useState(false);
  const [returning, setReturning] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    let active = true;
    let authChanged = false;
    let accountSeen = false;
    AsyncStorage.multiGet([welcomeKey, accountSeenKey]).then(values => {
      if (!active) return;
      setWelcomed(values[0][1] === 'true');
      setReturning(accountSeen || values[1][1] === 'true');
      setStorageReady(true);
    }).catch(() => { if (active) setStorageReady(true); });
    function updateAccount(hasAccount: boolean) {
      if (!active) return;
      setSignedOut(!hasAccount);
      if (hasAccount) {
        accountSeen = true;
        setReturning(true);
        setDismissed(false);
        void AsyncStorage.setItem(accountSeenKey, 'true').catch(() => {});
      }
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      authChanged = true;
      updateAccount(!!session);
    });
    supabase.auth.getSession().then(({ data, error }) => {
      if (!authChanged && !error) updateAccount(!!data.session);
    }).catch(() => {});
    return () => { active = false; subscription.unsubscribe(); };
  }, []);
  const signInPrompt = returning || welcomed;
  function dismiss() {
    setDismissed(true);
    if (!signInPrompt) void AsyncStorage.setItem(welcomeKey, 'true').catch(() => {});
  }
  if (!storageReady || !signedOut || dismissed) return null;
  return <View style={styles.bubble}>
    <View accessible={false} style={styles.pointer} />
    <Text accessibilityRole="header" style={styles.title}>{signInPrompt ? (returning ? 'Welcome back!' : 'Already have an account?') : 'New to Plan My C-Day?'}</Text>
    <Text style={styles.copy}>{signInPrompt ? 'Tap the Me tab to sign in and pick up where you left off. You can keep exploring first, too.' : 'Tap the Me tab to create an account. You can keep exploring first, too.'}</Text>
    <ExploreActionButton label={signInPrompt ? "Go to Me · Sign in" : "Go to Me · Create an account"} onPress={() => { dismiss(); router.navigate('/me'); }} />
    <ExploreActionButton label="Maybe later" variant="back" onPress={dismiss} />
  </View>;
}
const styles = StyleSheet.create({
  bubble: { backgroundColor: '#FFFCF7', borderColor: '#D9C4E5', borderWidth: 1, borderRadius: 20, padding: 18, gap: 12, marginTop: 10 },
  pointer: { position: 'absolute', top: -9, alignSelf: 'center', width: 16, height: 16, backgroundColor: '#FFFCF7', borderLeftWidth: 1, borderTopWidth: 1, borderColor: '#D9C4E5', transform: [{ rotate: '45deg' }] },
  title: { fontFamily: Fonts.rounded, fontWeight: '600', fontSize: 22, lineHeight: 29, color: '#302040' },
  copy: { fontSize: 16, lineHeight: 25, color: '#62556E' },
});
