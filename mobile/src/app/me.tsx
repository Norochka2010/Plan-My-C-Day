import { MeQuickLearnProgress } from '@/components/me-quick-learn-progress';
import { MeCDayProgress } from '@/components/me-c-day-progress';
import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { ActivityIndicator, AppState, Button, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { LeafCharacter } from '@/components/leaf-character';
import { supabase } from '@/lib/supabase';

export default function HomeScreen() {
  const theme = useTheme();
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<{ first_name: string; last_name: string; email: string } | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
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
        setPassword('');
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
  }, [session?.user.id]);

  async function authenticate(signUp: boolean) {
    if (!email.trim() || !password) {
      setMessage('Enter your email and password.');
      return;
    }
    if (signUp && (!firstName.trim() || !lastName.trim())) {
      setMessage('Enter your first and last name to create an account.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const credentials = { email: email.trim(), password };
      const { data, error } = signUp
        ? await supabase.auth.signUp({ ...credentials, options: { data: { first_name: firstName.trim(), last_name: lastName.trim() } } })
        : await supabase.auth.signInWithPassword(credentials);
      if (error) throw error;
      if (signUp && !data.session) {
        setMessage('Check your email to confirm your account, then return here and sign in.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not connect. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    setMessage('');
    try {
      const { error } = await supabase.auth.signOut();
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
              <View style={styles.hero}>
                {/* Reserved for the future animation; static leaf for now. */}
                <View style={styles.animationSpace}><LeafCharacter size={104} /></View>
                <View style={styles.heroCopy}>
                  <ThemedText type="title" style={styles.heroTitle}>Me & Leaf</ThemedText>
                  <ThemedText style={styles.intro}>Your space to look back and grow.</ThemedText>
                </View>
              </View>
              {initializing ? <ActivityIndicator accessibilityLabel="Loading your account" /> : session ? (
                <>
                  <ThemedText style={styles.title}>Welcome, {profile ? [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'planner' : session.user.user_metadata.first_name || 'planner'}!</ThemedText>
                  <MeCDayProgress key={session.user.id} userId={session.user.id} />
                  <MeQuickLearnProgress key={`quick-learn:${session.user.id}`} />
                  <View style={styles.account}>
                    <ThemedText style={styles.accountLabel}>Your account</ThemedText>
                    <ThemedText style={styles.accountEmail}>{session.user.email}</ThemedText>
                    <Button title={busy ? 'Signing out…' : 'Sign out'} disabled={busy} onPress={signOut} />
                  </View>
                </>
              ) : (
                <>
                  <ThemedText style={styles.title}>Sign in or create an account to get started.</ThemedText>
                  <ThemedText>First name (for new accounts)</ThemedText>
                  <TextInput accessibilityLabel="First name" style={[styles.input, { color: theme.text, borderColor: theme.text }]} value={firstName} onChangeText={setFirstName} autoComplete="given-name" editable={!busy} />
                  <ThemedText>Last name (for new accounts)</ThemedText>
                  <TextInput accessibilityLabel="Last name" style={[styles.input, { color: theme.text, borderColor: theme.text }]} value={lastName} onChangeText={setLastName} autoComplete="family-name" editable={!busy} />
                  <ThemedText>Email</ThemedText>
                  <TextInput accessibilityLabel="Email" style={[styles.input, { color: theme.text, borderColor: theme.text }]} value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" editable={!busy} />
                  <ThemedText>Password</ThemedText>
                  <TextInput accessibilityLabel="Password" style={[styles.input, { color: theme.text, borderColor: theme.text }]} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoCorrect={false} editable={!busy} />
                  <Button title={busy ? 'Please wait…' : 'Sign in'} disabled={busy} onPress={() => authenticate(false)} />
                  <Button title="Create account" disabled={busy} onPress={() => authenticate(true)} />
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
