import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { Fonts } from '@/constants/theme';
import type { ExploreSummary } from '@/lib/explore-content';
import { readExploreGrowth, type GrowthBar } from '@/lib/explore-growth';
export function ExploreGrowthCard({ catalog, catalogLoading, catalogFailed, refreshKey }: { catalog: ExploreSummary[]; catalogLoading: boolean; catalogFailed: boolean; refreshKey: string }) {
  const [expanded, setExpanded] = useState(false);
  const [bars, setBars] = useState<GrowthBar[] | null>(null), [failed, setFailed] = useState(false), [retry, setRetry] = useState(0);
  useFocusEffect(useCallback(() => {
    let active = true, request = 0;
    async function refresh() {
      const current = ++request; setBars(null); setFailed(false);
      if (catalogLoading || catalogFailed) return;
      try { const result = await readExploreGrowth(catalog); if (active && current === request) setBars(result); }
      catch { if (active && current === request) setFailed(true); }
    }
    void refresh();
    const listener = AppState.addEventListener('change', state => { if (state === 'active') void refresh(); });
    return () => { active = false; listener.remove(); };
  }, [catalog, catalogLoading, catalogFailed, refreshKey, retry]));
  return <View style={s.wrap}>
    <Pressable accessibilityRole="button" accessibilityLabel="Your growth" accessibilityState={{ expanded }}
      accessibilityHint={expanded ? 'Collapse progress details' : 'Expand progress in six learning areas'}
      onPress={() => setExpanded(value => !value)} style={({ pressed }) => [s.toggle, pressed && { opacity: 0.65 }]}>
      <View style={s.toggleCopy}><Text style={s.heading}>Your growth</Text>
        {!expanded && <Text style={s.small}>{catalogFailed || failed ? 'Progress unavailable · Tap for details' : catalogLoading || !bars ? 'Loading your progress…' : 'Six learning areas · Tap to view'}</Text>}
      </View>
      <Text accessible={false} style={s.chevron}>{expanded ? '⌃' : '⌄'}</Text>
    </Pressable>
    {!expanded && bars && !catalogFailed && !failed && <View style={s.preview} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {bars.map(bar => <View key={bar.domain} style={[s.track, { flex: 1, height: 4 }]}><View style={[s.fill, { width: `${bar.available ? 100 * bar.completed / bar.available : 0}%` }]} /></View>)}
    </View>}
    {expanded && <>
    <Text style={s.small}>Activities completed in each area—not a score of your health or ability. An activity can count in more than one area.</Text>
    {catalogFailed ? <Text style={s.small}>Growth needs the activity list. Use Try again above to reload Explore.</Text> : failed ? <>
      <Text style={s.small}>Your saved progress couldn’t load right now.</Text>
      <Pressable accessibilityRole="button" style={s.retry} onPress={() => setRetry(n => n + 1)}><Text style={s.small}>Try again</Text></Pressable>
    </> : catalogLoading || !bars ? <Text style={s.small}>Loading your progress…</Text> : <View style={s.row}>{bars.map(bar => <View key={bar.domain} style={s.domain}>
      <Text style={s.label}>{bar.domain}</Text>
      <View style={s.track} accessibilityRole="progressbar" accessibilityLabel={`${bar.domain} activities completed`} accessibilityValue={{ min: 0, max: Math.max(1, bar.available), now: bar.completed, text: bar.available ? `${bar.completed} of ${bar.available} available activities completed` : 'No activities available yet' }}>
        <View style={[s.fill, { width: `${bar.available ? 100 * bar.completed / bar.available : 0}%` }]} />
      </View>
      <Text style={s.status}>{bar.available ? `${bar.completed} of ${bar.available} completed` : 'More to come'}</Text>
    </View>)}</View>}
    <Text style={s.small}>Based on available Quick Learn, Myth or Fact, Practice, and Challenges. Saved on this device.</Text>
    </>}
  </View>;
}
const s = StyleSheet.create({
  wrap: { gap: 10, padding: 14, borderRadius: 18, borderWidth: 1, borderColor: '#DDD3E6', backgroundColor: '#FAF6FC' },
  toggle: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 12 }, toggleCopy: { flex: 1, gap: 2 },
  chevron: { color: '#63497B', fontSize: 24 }, preview: { flexDirection: 'row', gap: 5 }, heading: { color: '#302040', fontSize: 19, lineHeight: 27, fontWeight: '600', fontFamily: Fonts.rounded },
  small: { color: '#716579', fontSize: 12, lineHeight: 18 }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  domain: { minWidth: 90, flexBasis: '29%', flexGrow: 1, gap: 7, paddingVertical: 8 },
  label: { color: '#594366', fontSize: 11, letterSpacing: 0.6, fontWeight: '700' },
  track: { height: 7, backgroundColor: '#E7DFEB', borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: '#9275A4', borderRadius: 4 }, status: { color: '#716579', fontSize: 11, lineHeight: 17 },
  retry: { minHeight: 44, padding: 12, alignSelf: 'flex-start', borderRadius: 12, backgroundColor: '#EEE4F4' },
});
