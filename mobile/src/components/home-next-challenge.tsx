import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { supabase } from '@/lib/supabase';
import { newId } from '@/lib/c-day-model';
import { getHomeChallenge, type ChallengeSuggestion } from '@/lib/home-challenge';
export function HomeNextChallenge() {
  const router = useRouter();
  const [suggestion, setSuggestion] = useState<ChallengeSuggestion | null>(null), [loading, setLoading] = useState(true), [failed, setFailed] = useState(false), [retry, setRetry] = useState(0);
  useFocusEffect(useCallback(() => {
    let active = true, generation = 0;
    async function refresh() {
      const request = ++generation; setSuggestion(null); setLoading(true); setFailed(false);
      try {
        const { data, error } = await supabase.auth.getSession(); if (error) throw error;
        const result = await getHomeChallenge(data.session?.user.id ?? null);
        if (active && request === generation) setSuggestion(result);
      } catch { if (active && request === generation) setFailed(true); }
      finally { if (active && request === generation) setLoading(false); }
    }
    void refresh();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => { void refresh(); });
    const app = AppState.addEventListener('change', state => { if (state === 'active') void refresh(); });
    const timer = setInterval(() => { void refresh(); }, 60000);
    return () => { active = false; generation++; subscription.unsubscribe(); app.remove(); clearInterval(timer); };
  }, [retry]));
  return <View style={s.section}>
    <Text accessibilityRole="header" style={s.sectionTitle}>My Next Challenge</Text>
    <View style={s.card}>
      <View style={s.badge}><Text style={s.icon}>★</Text></View>
      <View style={s.copy}>
        {loading ? <Text style={s.body}>Finding a challenge for you…</Text> : failed ? <>
          <Text style={s.body}>Your challenge suggestion couldn’t load right now.</Text>
          <Pressable accessibilityRole="button" style={s.button} onPress={() => setRetry(n => n + 1)}><Text style={s.link}>Try again</Text></Pressable>
        </> : suggestion ? <>
          <Text style={s.title}>{suggestion.card.title}</Text>
          {__DEV__ && suggestion.developmentPreview && <Text style={s.small}>Development preview · Review required</Text>}
          <Text style={s.body}>{suggestion.card.instruction}</Text>
          <Text style={s.small}>{suggestion.eventTitle ? `Could help with ${suggestion.eventTitle}.` : 'An optional challenge from Explore.'}</Text>
          <Text style={s.small}>Try it if you’d like—your C-Day never depends on completing it.</Text>
          <Pressable accessibilityRole="button" style={s.button} onPress={() => router.push({ pathname: '/explore', params: { supportContentId: suggestion.card.content_id, supportEntry: newId(), returnTo: 'home', homeChallenge: '1' } })}>
            <Text style={s.link}>{suggestion.progress ? 'Continue challenge →' : 'View challenge →'}</Text>
          </Pressable>
        </> : <>
          <Text style={s.title}>Room for something new</Text>
          <Text style={s.body}>No new challenges available right now. You can revisit activities in Explore whenever you’d like.</Text>
          <Pressable accessibilityRole="button" style={s.button} onPress={() => router.push('/explore')}><Text style={s.link}>Open Explore →</Text></Pressable>
        </>}
      </View>
    </View>
  </View>;
}
const s = StyleSheet.create({
  section: { gap: 10 }, sectionTitle: { fontSize: 14, fontWeight: '700', color: '#35204E', textTransform: 'uppercase', letterSpacing: 0.7 },
  card: { borderWidth: 1.5, borderColor: '#EED3A1', borderRadius: 18, backgroundColor: '#FFFDFA', padding: 18, flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  badge: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#FFF1D6', alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 29, color: '#5D4277' }, copy: { flex: 1, gap: 8 }, title: { color: '#241638', fontSize: 16, lineHeight: 23, fontWeight: '600' },
  body: { color: '#6E6577', fontSize: 14, lineHeight: 21 }, small: { color: '#6E6577', fontSize: 14, lineHeight: 21 },
  button: { minHeight: 44, justifyContent: 'center' }, link: { color: '#5D4277', fontSize: 14, lineHeight: 22, fontWeight: '600' },
});
