import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ExploreSummary } from '@/lib/explore-content';
import { Fonts } from '@/constants/theme';

export function ExploreActivityCatalog({ kind = "MYTH_OR_FACT", items, loading, failed, onRetry, onOpen, onClose }: {
  kind?: "MYTH_OR_FACT" | "QUICK_LEARN" | "PRACTICE_A_SKILL" | "REAL_LIFE_CHALLENGE";
  items: ExploreSummary[]; loading: boolean; failed: boolean; onRetry: () => void;
  onOpen: (item: ExploreSummary) => void; onClose: () => void;
}) {
  const presentation = {
    MYTH_OR_FACT: { icon: '?', intro: 'Pick a card. See what you think.' },
    QUICK_LEARN: { icon: '✦', intro: 'Pick a lesson. Discover something useful.' },
    PRACTICE_A_SKILL: { icon: '💬', intro: 'Pick a scenario. Practice at your own pace.' },
    REAL_LIFE_CHALLENGE: { icon: '☆', intro: 'Find a challenge you’d like to try.' },
  }[kind];
  const scroll = useRef<ScrollView>(null);
  const [viewport, setViewport] = useState(0), [content, setContent] = useState(0), [offset, setOffset] = useState(0);
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const more = content - viewport - offset > 12;
  const overflow = content > viewport + 12;
  return <>
    <Text style={s.intro}>{presentation.intro}</Text>
    <ScrollView ref={scroll} style={{ maxHeight: Math.max(120, Math.min(400, height - insets.top - insets.bottom - 280)) }}
      contentContainerStyle={s.list} showsVerticalScrollIndicator persistentScrollbar
      onLayout={e => setViewport(e.nativeEvent.layout.height)} onContentSizeChange={(_, h) => setContent(h)}
      onScroll={e => setOffset(e.nativeEvent.contentOffset.y)} scrollEventThrottle={32}>
      {loading ? <Text style={s.intro}>Loading activities…</Text> : failed ? <>
        <Text style={s.intro}>Activities could not load.</Text>
        <Pressable accessibilityRole="button" style={s.back} onPress={onRetry}><Text style={s.backLabel}>Try again</Text></Pressable>
      </> : items.length === 0 ? <Text style={s.intro}>New activities are on their way.</Text> : items.map((item, index) =>
        <Pressable key={item.content_id} accessibilityRole="button" accessibilityLabel={item.title}
          accessibilityHint="Opens this activity" onPress={() => onOpen(item)}
          style={({ pressed }) => [s.card, { backgroundColor: ['#F4EBF7', '#EDF5E7', '#FFF3DF'][index % 3] }, pressed && s.pressed]}>
          <View style={s.row}><View style={s.badge}><Text accessible={false} style={s.question}>{presentation.icon}</Text></View><Text accessible={false} style={s.cue}>Tap to explore ›</Text></View>
          <Text style={s.title}>{item.title}</Text>
          {__DEV__ && item.development_preview && <Text style={s.small}>Development preview · Expert review required</Text>}
          {!!item.subtitle && <Text style={s.intro}>{item.subtitle}</Text>}
        </Pressable>)}
    </ScrollView>
    {!loading && !failed && overflow && <Pressable accessibilityRole="button"
      accessibilityLabel={more ? 'Browse more activities' : 'Return to the first activity'}
      onPress={() => scroll.current?.scrollTo({ y: more ? Math.min(content - viewport, offset + viewport * 0.8) : 0, animated: false })}
      style={({ pressed }) => [s.more, pressed && s.pressed]}>
      <Text style={s.moreLabel}>{more ? 'More cards below ↓' : 'Back to first card ↑'}</Text>
    </Pressable>}
    <Pressable accessibilityRole="button" onPress={onClose} style={({ pressed }) => [s.back, pressed && s.pressed]}>
      <Text style={s.backLabel}>‹ Back to Explore</Text>
    </Pressable>
  </>;
}
const s = StyleSheet.create({
  intro: { color: '#62556E', fontSize: 14, lineHeight: 21 }, list: { gap: 12, paddingRight: 6, paddingBottom: 4 },
  card: { padding: 16, gap: 10, borderRadius: 18, borderWidth: 1, borderColor: '#D9CDE0' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  badge: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#FFFCF7', alignItems: 'center', justifyContent: 'center' },
  question: { color: '#63497B', fontSize: 20, fontWeight: '700' }, cue: { color: '#62556E', fontSize: 12 },
  title: { color: '#302040', fontFamily: Fonts.rounded, fontSize: 18, lineHeight: 25, fontWeight: '600' },
  small: { color: '#716579', fontSize: 12, lineHeight: 18 },
  more: { minHeight: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 12, backgroundColor: '#EDF3E6' },
  moreLabel: { color: '#355338', fontSize: 14, fontWeight: '600' },
  back: { minHeight: 48, padding: 14, borderRadius: 14, backgroundColor: '#E5EDF8', borderWidth: 1, borderColor: '#BCCDE4', alignItems: 'center', justifyContent: 'center' },
  backLabel: { color: '#354F70', fontSize: 16, fontWeight: '600' }, pressed: { opacity: 0.65 },
});
