import type { ComponentRef } from 'react';
import { BackButton } from '@/components/back-button';
import { TabTitle } from '@/constants/theme';
import { MeGrowth } from '@/components/me-growth';
import { useLocalSearchParams } from 'expo-router';
import { DeleteAccount } from '@/components/delete-account';
import { MePersonalSpace } from '@/components/me-personal-space';
import { AccountSetup, AccountSignIn } from '@/components/account-setup';
import { MeQuickLearnProgress } from '@/components/me-quick-learn-progress';
import { MeCDayProgress } from '@/components/me-c-day-progress';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { ActivityIndicator, AppState, Modal, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { LeafCharacter } from '@/components/leaf-character';
import { markIntentionalSignOut, supabase } from '@/lib/supabase';
import { createLogger, elapsed, setLogUser } from '@/lib/logger';

const log = createLogger('auth_me');

export default function HomeScreen() {
  const {growthEntry}=useLocalSearchParams<{growthEntry?:string}>();
  const growthY=useRef(0);
  const growthPending=useRef(false);
  const revealGrowth=useCallback(()=>{growthPending.current=true;requestAnimationFrame(()=>accountScroll.current?.scrollTo({y:growthY.current,animated:true}));},[]);
  const accountScroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const [authWelcome,setAuthWelcome] = useState(true);
  const authStepChanged = useCallback((welcome:boolean)=>{
    setAuthWelcome(welcome);
    requestAnimationFrame(()=>accountScroll.current?.scrollTo({y:0,animated:false}));
  },[]);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<{ first_name: string; last_name: string; email: string } | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [profileRevision, setProfileRevision] = useState(0);
  const [settings, setSettings] = useState(false);
  const [details, setDetails] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [accountDeleted, setAccountDeleted] = useState(false);
  useEffect(()=>{if(growthEntry&&session)revealGrowth();},[growthEntry,session?.user.id,revealGrowth]);
  useEffect(()=>{if(!session)setSettings(false);},[session]);

  useEffect(() => {
    let active = true;
    let authChanged = false;
    const restoreStarted = Date.now();
    log.info('session_restore_start');
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      authChanged = true;
      log.info('me_auth_event', { event: _event, has_session: !!nextSession, mounted: active });
      if (active) {
        if(nextSession){
          setAccountDeleted(false);
          if(_event==='SIGNED_IN')setMessage('');
        }
        setSession(nextSession);
        setInitializing(false);
      }
    });
    supabase.auth.getSession().then(({ data, error }) => {
      const expiresIn = data.session?.expires_at ? data.session.expires_at - Math.floor(Date.now() / 1000) : null;
      log[error ? 'warn' : 'info'](error ? 'session_restore_error' : 'session_restore_done', { has_session: !!data.session, user_id: data.session?.user.id ?? null, expires_in_s: expiresIn, error, auth_event_arrived_first: authChanged, duration_ms: elapsed(restoreStarted), mounted: active });
      if (!active) return;
      if (!authChanged) setSession(data.session);
      if (error) setMessage(error.message);
      setInitializing(false);
    }).catch((error) => {
      log.error('session_restore_threw', { error, duration_ms: elapsed(restoreStarted) });
      if (active) {
        setMessage('Could not restore your session. Please sign in again.');
        setInitializing(false);
      }
    });
    const refresh = (state: string) => {
      log.info(state === 'active' ? 'auto_refresh_start' : 'auto_refresh_stop', { app_state: state });
      if (state === 'active') supabase.auth.startAutoRefresh().catch(error => log.error('auto_refresh_start_failed', { error }));
      else supabase.auth.stopAutoRefresh().catch(error => log.error('auto_refresh_stop_failed', { error }));
    };
    if (Platform.OS !== 'web') refresh(AppState.currentState ?? 'active');
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
          if (error) { log.warn('me_profile_load_failed', { error, user_id: session.user.id }); setMessage('Your account is signed in, but your profile could not load. Make sure the users table setup has been run.'); }
          else { setLogUser({ id: session.user.id, firstName: data?.first_name ?? null }); setProfile(data); }
        }).catch((error) => {
          log.error('me_profile_load_threw', { error });
          if (active) setMessage('Could not load your profile. Check your connection and reopen the app.');
        });
    }
    return () => { active = false; };
  }, [session?.user.id, profileRevision]);

  async function signOut() {
    setBusy(true);
    setMessage('');
    markIntentionalSignOut('user_tapped_sign_out');
    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) throw error;
      log.info('sign_out_ok');
    } catch (error) {
      log.warn('sign_out_failed', { error });
      setMessage(error instanceof Error ? error.message : 'Could not sign out. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView onContentSizeChange={()=>{if(growthPending.current){growthPending.current=false;accountScroll.current?.scrollTo({y:growthY.current,animated:true});}}} ref={accountScroll} contentContainerStyle={[styles.content,session&&{paddingTop:12}]} keyboardShouldPersistTaps="handled">
            <View style={[styles.form,session&&{gap:12}]}>
              {!session && authWelcome && <View style={styles.hero}>
                {/* Reserved for the future animation; static leaf for now. */}
                <View style={styles.animationSpace}><LeafCharacter size={104} /></View>
                <View style={styles.heroCopy}>
                  <ThemedText accessibilityRole="header" style={TabTitle}>Me</ThemedText>
                  <ThemedText style={styles.intro}>Your space to look back and grow.</ThemedText>
                </View>
              </View>}
              {initializing ? <ActivityIndicator accessibilityLabel="Loading your account" /> : session ? (
                <>
                  <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>
                    <ThemedText accessibilityRole="header" style={TabTitle}>Me</ThemedText>
                    <Pressable accessibilityRole="button" accessibilityLabel="Open settings" onPress={()=>setSettings(true)} style={[styles.detailsButton,{minHeight:44,paddingVertical:8,paddingHorizontal:12}]}><ThemedText>⚙ Settings</ThemedText></Pressable>
                  </View>
                  <MePersonalSpace key={`personal-space:${session.user.id}`} userId={session.user.id} firstName={profile?.first_name || session.user.user_metadata.first_name || ''} revision={profileRevision} />
                  <View onLayout={event=>{growthY.current=event.nativeEvent.layout.y;}}><MeGrowth key={`${session.user.id}:${growthEntry||'default'}`} initiallyExpanded={!!growthEntry} onExpand={revealGrowth} onViewHistory={()=>setDetails(true)}/></View>
                  <MeCDayProgress key={`c-day-progress:${session.user.id}`} userId={session.user.id} />
                  <Modal visible={details} presentationStyle="fullScreen" animationType="slide" onRequestClose={()=>setDetails(false)}>
                    <SafeAreaProvider><SafeAreaView style={{flex:1,backgroundColor:'#FFFCF7'}}>
                      <ScrollView contentContainerStyle={styles.content}>
                        <View style={styles.form}>
                          <Pressable accessibilityRole="button" onPress={()=>setDetails(false)} style={styles.detailsButton}><ThemedText>‹ Back to Your growth</ThemedText></Pressable>
                          <MeQuickLearnProgress key={`quick-learn:${session.user.id}`} />
                        </View>
                      </ScrollView>
                    </SafeAreaView></SafeAreaProvider>
                  </Modal>
                  <Modal visible={settings} presentationStyle="fullScreen" animationType="slide" onRequestClose={()=>setSettings(false)}>
                    <SafeAreaProvider>
                    <SafeAreaView edges={['top','bottom','left','right']} style={{flex:1,backgroundColor:'#FFFCF7'}}>
                    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
                    <View style={styles.form}>
                    <Pressable accessibilityRole="button" onPress={()=>setSettings(false)} style={styles.detailsButton}><ThemedText>‹ Back to Me</ThemedText></Pressable>
                    <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}><View style={{flex:1,gap:6}}><ThemedText type="title" style={{fontSize:30,lineHeight:38}}>Settings</ThemedText><ThemedText>Make this space yours.</ThemedText></View><LeafCharacter size={72}/></View>
                    {!!message && <ThemedText accessibilityRole="alert">{message}</ThemedText>}
                  <View style={styles.account}>
                    <ThemedText style={styles.accountLabel}>Account & settings</ThemedText>
                    <ThemedText style={styles.accountEmail}>{session.user.email}</ThemedText>
                    <AccountSetup key={session.user.id} userId={session.user.id} onSaved={() => setProfileRevision(value => value + 1)} />
                    <Pressable accessibilityRole="button" accessibilityState={{disabled:busy}} disabled={busy} onPress={signOut} style={({pressed})=>[styles.signOutButton,{opacity:busy||pressed?0.6:1}]}><ThemedText style={styles.signOutText}>{busy?'Signing out…':'Sign out'}</ThemedText></Pressable>
                  </View>
                    <DeleteAccount userId={session.user.id} onDeleted={()=>{setSettings(false);setSession(null);setProfile(null);setMessage('');setAccountDeleted(true);}} />
                    </View></ScrollView></SafeAreaView></SafeAreaProvider>
                  </Modal>
                </>
              ) : (
                <>
                  <AccountSignIn onStepChange={authStepChanged} />
                </>
              )}
              {!session && accountDeleted && <ThemedText accessibilityLiveRegion="polite" style={styles.title}>Your account has been deleted.</ThemedText>}
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
  account: { backgroundColor:'#F0EDF5',borderRadius:24,padding:18,gap:18 },
  signOutButton:{minHeight:50,padding:14,borderRadius:16,borderWidth:1,borderColor:'#B9CDAA',backgroundColor:'#FFFCF7'},
  signOutText:{textAlign:'center',fontWeight:'700',color:'#3E6342'},
  accountLabel: { fontWeight: '600', fontSize: 15 },
  accountEmail: { fontSize: 14, color: '#62556E' },
  container: { flex: 1 },
  content: { flexGrow: 1, alignItems: 'center', padding: 20, paddingBottom: 32 },
  form: { width: '100%', maxWidth: 560, gap: 20 },
  title: { textAlign: 'center' },
  input: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 16, minHeight: 48 },
});
