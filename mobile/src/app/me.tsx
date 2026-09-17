import { MePersonalSpace } from '@/components/me-personal-space';
import { AccountSetup, AccountSignIn } from '@/components/account-setup';
import { MeQuickLearnProgress } from '@/components/me-quick-learn-progress';
import { MeCDayProgress } from '@/components/me-c-day-progress';
import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { ActivityIndicator, AppState, Button, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { LeafCharacter } from '@/components/leaf-character';
import { supabase } from '@/lib/supabase';

export default function HomeScreen() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<{ first_name: string; last_name: string; email: string } | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [profileRevision, setProfileRevision] = useState(0);
  const [details, setDetails] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    let authChanged = false;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      authChanged = true;
      if (active) {
        setSession(nextSession);
        setInitializing(false);
      }
    });
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (!authChanged) setSession(data.session);
      if (error) setMessage(error.message);
      setInitializing(false);
    }).catch(() => {
      if (active) {
        setMessage('Could not restore your session. Please sign in again.');
        setInitializing(false);
      }
    });
    const refresh = (state: string) => {
      if (state === 'active') supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
    };
    if (Platform.OS !== 'web') refresh(AppState.currentState);
    const listener = Platform.OS !== 'web' ? AppState.addEventListener('change', refresh) : null;
    return () => {
      active = false;
      subscription.unsubscribe();
      listener?.remove();
      if (Platform.OS !== 'web') supabase.auth.stopAutoRefresh();
    };
  }, []);

  useEffect(() => {
    let active = true;
    setProfile(null);
    if (session?.user.id) {
      Promise.resolve(supabase.from('users').select('first_name, last_name, email').eq('id', session.user.id).single())
        .then(({ data, error }) => {
          if (!active) return;
          if (error) setMessage('Your account is signed in, but your profile could not load. Make sure the users table setup has been run.');
          else setProfile(data);
        }).catch(() => {
          if (active) setMessage('Could not load your profile. Check your connection and reopen the app.');
        });
    }
    return () => { active = false; };
  }, [session?.user.id, profileRevision]);

  async function signOut() {
    setBusy(true);
    setMessage('');
    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) throw error;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not sign out. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.form}>
              {!session && <View style={styles.hero}>
                {/* Reserved for the future animation; static leaf for now. */}
                <View style={styles.animationSpace}><LeafCharacter size={104} /></View>
                <View style={styles.heroCopy}>
                  <ThemedText type="title" style={styles.heroTitle}>Me & Leaf</ThemedText>
                  <ThemedText style={styles.intro}>Your space to look back and grow.</ThemedText>
                </View>
              </View>}
              {initializing ? <ActivityIndicator accessibilityLabel="Loading your account" /> : session ? (
                <>
                  <MePersonalSpace key={session.user.id} userId={session.user.id} firstName={profile?.first_name || session.user.user_metadata.first_name || ''} revision={profileRevision} />
                  <Pressable accessibilityRole="button" accessibilityState={{expanded:details}} onPress={() => setDetails(v=>!v)} style={styles.detailsButton}><ThemedText>My progress & C-Day history {details ? '−' : '+'}</ThemedText></Pressable>
                  {details && <>
                    <MeCDayProgress key={session.user.id} userId={session.user.id} />
                    <MeQuickLearnProgress key={`quick-learn:${session.user.id}`} />
                  </>}
                  <View style={styles.account}>
                    <ThemedText style={styles.accountLabel}>Account & settings</ThemedText>
                    <ThemedText style={styles.accountEmail}>{session.user.email}</ThemedText>
                    <AccountSetup key={session.user.id} userId={session.user.id} onSaved={() => setProfileRevision(value => value + 1)} />
                    <Button title={busy ? 'Signing out…' : 'Sign out'} disabled={busy} onPress={signOut} />
                  </View>
                </>
              ) : (
                <>
                  <AccountSignIn />
                </>
              )}
              {!!message && <ThemedText accessibilityLiveRegion="polite" style={styles.title}>{message}</ThemedText>}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  detailsButton: { minHeight: 52, padding: 16, borderRadius: 18, backgroundColor: '#EEE7FA' },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#F0EDF5', borderRadius: 24, padding: 14 },
  animationSpace: { width: 112, minHeight: 120, alignItems: 'center', justifyContent: 'center' },
  heroCopy: { flex: 1, minWidth: 0, gap: 8 },
  heroTitle: { fontSize: 27, lineHeight: 34 },
  intro: { fontSize: 14, lineHeight: 22, color: '#62556E' },
  account: { borderTopWidth: 1, borderTopColor: '#E1E5DA', paddingTop: 18, gap: 8 },
  accountLabel: { fontWeight: '600', fontSize: 15 },
  accountEmail: { fontSize: 14, color: '#62556E' },
  container: { flex: 1 },
  content: { flexGrow: 1, alignItems: 'center', padding: 20, paddingBottom: 32 },
  form: { width: '100%', maxWidth: 560, gap: 20 },
  title: { textAlign: 'center' },
  input: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 16, minHeight: 48 },
});
