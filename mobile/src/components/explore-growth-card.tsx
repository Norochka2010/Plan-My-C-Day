import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Modal, Platform, ScrollView, AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { Fonts } from '@/constants/theme';
import type { Domain, ExploreSummary } from '@/lib/explore-content';
import { readExploreGrowth, type GrowthBar } from '@/lib/explore-growth';
const categorySkills: Record<Domain, { title: string; description: string }> = {
  KNOW: { title: 'Know · Understand the basics', description: 'Build your understanding of celiac disease, gluten, labels, and cross-contact. Practice spotting reliable information and knowing what questions to ask.' },
  MANAGE: { title: 'Manage · Make a plan', description: 'Build everyday planning and problem-solving skills. Practice preparing for meals, packing what you need, and making a backup plan when things change.' },
  SPEAK: { title: 'Speak · Use your voice', description: 'Practice explaining your needs, asking clear questions, and setting boundaries with friends, family, school staff, or food servers.' },
  TRUST: { title: 'Trust · Grow your confidence', description: 'Practice recognizing what you know, checking what you’re unsure about, and asking for support. Build confidence in your decisions without needing to have every answer.' },
  LIVE: { title: 'Live · Join in your way', description: 'Practice finding ways to enjoy friendships, celebrations, travel, and everyday experiences while making room for your gluten-free needs.' },
  LEAD: { title: 'Lead · Make a difference', description: 'Practice sharing what you’ve learned, supporting others, and speaking up for more inclusive spaces—when you want to. You don’t have to be an advocate all the time.' },
};
// Curated entry points; only published, XP-bearing catalog entries can launch.
const practiceIds: Record<Domain, string> = {
  KNOW: '4cab56b8-ea49-5204-9dc2-f03df42ab0e5',
  MANAGE: 'da405da2-bdef-5350-8574-dfb14bb71afb',
  SPEAK: '91453ad5-311b-585f-8647-cc1694d781b0',
  TRUST: 'b69af127-5994-5cc0-bd2c-053edff234b8',
  LIVE: '191d843a-1070-523e-af2a-5963476e7bca',
  LEAD: '91453ad5-311b-585f-8647-cc1694d781b0',
};
const celebrationColors = [
  { backgroundColor: '#FFF3D8', color: '#886014', fill: '#D9A436' },
  { backgroundColor: '#EAF3E3', color: '#416139', fill: '#7B9C65' },
  { backgroundColor: '#FBE8EF', color: '#924363', fill: '#C77896' },
  { backgroundColor: '#E8EFFB', color: '#47658D', fill: '#7D9DCA' },
  { backgroundColor: '#EEE7FA', color: '#705294', fill: '#A187C1' },
  { backgroundColor: '#FCECDF', color: '#945B36', fill: '#C9966B' },
];
export function ExploreGrowthCard({ catalog, catalogLoading, catalogFailed, refreshKey, onOpen, onExpand, onViewHistory, initiallyExpanded = false }: { onViewHistory?: () => void; initiallyExpanded?: boolean; catalog: ExploreSummary[]; catalogLoading: boolean; catalogFailed: boolean; refreshKey: string; onOpen: (item: ExploreSummary) => void; onExpand: () => void }) {
  const [selected, setSelected] = useState<{ domain: Domain; colorIndex: number } | null>(null);
  const pendingPractice = useRef<ExploreSummary | null>(null);
  const practice = selected ? catalog.find(item => item.content_id === practiceIds[selected.domain] && !item.development_preview && (item.xp_value ?? 0) > 0) : undefined;
  function finishDismiss() {
    const item = pendingPractice.current;
    pendingPractice.current = null;
    if (item) onOpen(item);
  }
  function startPractice() {
    if (!practice) return;
    pendingPractice.current = practice;
    setSelected(null);
    if (Platform.OS !== 'ios') finishDismiss();
  }
  const [expanded, setExpanded] = useState(initiallyExpanded);
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
      onPress={() => { if (!expanded) onExpand(); setExpanded(value => !value); }} style={({ pressed }) => [s.toggle, pressed && { opacity: 0.65 }]}>
      <View style={s.titleStar} accessible={false}><Text style={s.star}>✦</Text></View>
      <View style={s.toggleCopy}><Text style={s.heading}>Your growth</Text>
        {!expanded && <Text style={s.small}>{catalogFailed || failed ? 'Progress unavailable · Tap for details' : catalogLoading || !bars ? 'Loading your progress…' : 'Six learning areas · Tap to view'}</Text>}
      </View>
      <Text accessible={false} style={s.chevron}>{expanded ? '⌃' : '⌄'}</Text>
    </Pressable>
    {!expanded && bars && !catalogFailed && !failed && <View style={s.preview} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {bars.map(bar => <View key={bar.domain} style={[s.track, { flex: 1, height: 4 }]}><View style={[s.fill, { width: `${bar.available ? 100 * bar.completed / bar.available : 0}%` }]} /></View>)}
    </View>}
    {expanded && <>
    <Text style={s.small}>Tap any category card to see the skills it builds.</Text>
    <Text style={s.encouragement}>Every little step is worth celebrating.</Text>
    <Text style={s.explanation}>Activities completed in each area—not a score of your health or ability. An activity can count in more than one area.</Text>
    {catalogFailed ? <Text style={s.small}>Growth needs the activity list. Use the retry button above to reload.</Text> : failed ? <>
      <Text style={s.small}>Your saved progress couldn’t load right now.</Text>
      <Pressable accessibilityRole="button" style={s.retry} onPress={() => setRetry(n => n + 1)}><Text style={s.small}>Try again</Text></Pressable>
    </> : catalogLoading || !bars ? <Text style={s.small}>Loading your progress…</Text> : <View style={s.row}>{bars.map((bar, index) => <Pressable key={bar.domain} accessibilityRole="button" accessibilityLabel={`${bar.domain}, ${bar.completed} of ${bar.available} completed`} accessibilityHint="Shows the skills this area builds" onPress={() => setSelected({ domain: bar.domain, colorIndex: index % 6 })} style={({ pressed }) => [s.domain, { backgroundColor: celebrationColors[index % 6].backgroundColor, opacity: pressed ? 0.75 : 1 }]}>
      <View style={s.badgeRow}><Text accessible={false} style={[s.badgeStar, { color: celebrationColors[index % 6].color }]}>{bar.completed > 0 ? '★' : '☆'}</Text><Text style={[s.label, { color: celebrationColors[index % 6].color }]}>{bar.domain}</Text></View>
      <View style={s.track} accessibilityRole="progressbar" accessibilityLabel={`${bar.domain} activities completed`} accessibilityValue={{ min: 0, max: Math.max(1, bar.available), now: bar.completed, text: bar.available ? `${bar.completed} of ${bar.available} available activities completed` : 'No activities available yet' }}>
        <View style={[s.fill, { backgroundColor: celebrationColors[index % 6].fill, width: `${bar.available ? Math.min(100, 100 * bar.completed / bar.available) : 0}%` }]} />
      </View>
      <Text style={s.status}>{bar.available ? `${bar.completed} of ${bar.available} completed` : 'More to come'}</Text>
    </Pressable>)}</View>}
    <Text style={s.explanation}>Based on available Quick Learn, Myth or Fact, Practice, and Challenges. Saved to your account.</Text>
    {onViewHistory && <Pressable accessibilityRole="button" onPress={onViewHistory} style={{minHeight:48,padding:14,borderRadius:14,backgroundColor:"#E5DDF0",justifyContent:"center"}}><Text style={{color:"#5D4277",fontSize:16,lineHeight:24,fontWeight:"600"}}>View learning history →</Text></Pressable>}
    </>}
    <Modal onDismiss={finishDismiss} visible={selected !== null} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
      <SafeAreaProvider><SafeAreaView style={s.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} accessible={false} onPress={() => setSelected(null)} />
        {selected && <View accessibilityViewIsModal onAccessibilityEscape={() => setSelected(null)} style={[s.popup, { backgroundColor: celebrationColors[selected.colorIndex].backgroundColor }]}>
          <ScrollView contentContainerStyle={s.popupContent} bounces={false}>
            <Text accessible={false} style={[s.sparkles, { color: celebrationColors[selected.colorIndex].color }]}>✧   ★   ✦</Text>
            <Text accessibilityRole="header" style={[s.popupTitle, { color: celebrationColors[selected.colorIndex].color }]}>{categorySkills[selected.domain].title}</Text>
            <Text style={s.popupDescription}>{categorySkills[selected.domain].description}</Text>
            <Pressable accessibilityRole="button" onPress={() => setSelected(null)} style={({ pressed }) => [s.popupButton, { backgroundColor: celebrationColors[selected.colorIndex].color, opacity: pressed ? 0.8 : 1 }]}>
              <Text style={s.popupButtonText}>Got it!</Text>
            </Pressable>
            {practice ? <View style={{ gap: 8 }}>
              <Pressable accessibilityRole="button" onPress={startPractice} style={({ pressed }) => [s.popupButton, { borderWidth: 2, borderColor: celebrationColors[selected.colorIndex].color, backgroundColor: '#FFFCF7', opacity: pressed ? 0.75 : 1 }]}>
                <Text style={[s.popupButtonText, { color: celebrationColors[selected.colorIndex].color }]}>Practice a skill ✦</Text>
              </Pressable>
              <Text style={s.practiceCaption}>{practice.title} · {practice.xp_value} XP on first completion</Text>
              {selected.domain === 'LEAD' && <Text style={s.practiceCaption}>Start with speaking up—a foundation for leading. This activity builds SPEAK.</Text>}
            </View> : <Text style={s.practiceCaption}>More practice is on its way.</Text>}
          </ScrollView>
        </View>}
      </SafeAreaView></SafeAreaProvider>
    </Modal>
  </View>;
}
const s = StyleSheet.create({
  practiceCaption: { color: '#62556E', fontSize: 16, lineHeight: 22, textAlign: 'center' },
  backdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: 'rgba(36,22,56,0.42)' },
  popup: { width: '100%', maxWidth: 420, maxHeight: '85%', borderRadius: 28, overflow: 'hidden' },
  popupContent: { padding: 26, gap: 20 },
  sparkles: { fontSize: 38, textAlign: 'center' },
  popupTitle: { fontFamily: Fonts.rounded, fontSize: 25, lineHeight: 33, fontWeight: '700', textAlign: 'center' },
  popupDescription: { color: '#302040', fontSize: 18, lineHeight: 28, textAlign: 'center' },
  popupButton: { minHeight: 50, borderRadius: 18, padding: 14, alignItems: 'center' },
  popupButtonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  wrap: { gap: 10, padding: 14, borderRadius: 18, borderWidth: 1, borderColor: '#DDD3E6', backgroundColor: '#FAF6FC' },
  toggle: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 12 }, toggleCopy: { flex: 1, gap: 2 },
  chevron: { color: '#63497B', fontSize: 24 }, preview: { flexDirection: 'row', gap: 5 }, heading: { color: '#302040', fontSize: 19, lineHeight: 27, fontWeight: '600', fontFamily: Fonts.rounded },
  explanation: { color: '#716579', fontSize: 16, lineHeight: 24 },
  small: { color: '#716579', fontSize: 16, lineHeight: 24 }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  domain: { minWidth: 120, flexBasis: '45%', flexGrow: 1, gap: 6, padding: 10, borderRadius: 18 },
  titleStar: { width: 40, height: 40, backgroundColor: '#FFF0C5', borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  star: { color: '#9A6B16', fontSize: 29 },
  encouragement: { color: '#63497B', fontSize: 17, lineHeight: 25, fontWeight: '600' },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap' },
  badgeStar: { fontSize: 20 },
  label: { color: '#594366', fontSize: 16, letterSpacing: 0.6, fontWeight: '700' },
  track: { height: 7, backgroundColor: '#E7DFEB', borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: '#9275A4', borderRadius: 4 }, status: { color: '#716579', fontSize: 16, lineHeight: 24 },
  retry: { minHeight: 44, padding: 12, alignSelf: 'flex-start', borderRadius: 12, backgroundColor: '#EEE4F4' },
});
