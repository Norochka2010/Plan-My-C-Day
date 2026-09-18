import { ScrollView, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ExploreSummary } from '@/lib/explore-content';
import { Fonts } from '@/constants/theme';
import { ExploreActionButton } from './explore-action-button';

export function ExploreActivityCatalog({ kind = 'MYTH_OR_FACT', title, items, loading, failed, onRetry, onOpen, onClose, initialOffset = 0, onOffsetChange }: {
  kind?: 'MYTH_OR_FACT' | 'QUICK_LEARN' | 'PRACTICE_A_SKILL' | 'REAL_LIFE_CHALLENGE';
  title: string; items: ExploreSummary[]; loading: boolean; failed: boolean; onRetry: () => void;
  onOpen: (item: ExploreSummary) => void; onClose: () => void; initialOffset?: number; onOffsetChange?: (y: number) => void;
}) {
  const presentation = {
    MYTH_OR_FACT: { intro: 'Pick an answer and discover why.', color: '#F4EBF7', border: '#D9C4E5' },
    QUICK_LEARN: { intro: 'Understand one useful idea.', color: '#EDF5E7', border: '#C5DDB5' },
    PRACTICE_A_SKILL: { intro: 'Rehearse what you could say or do.', color: '#EFEDF9', border: '#CEC8E8' },
    REAL_LIFE_CHALLENGE: { intro: 'Try a small step at your own pace.', color: '#FFF3DC', border: '#EBD4A5' },
  }[kind];
  return <View style={s.screen}>
    <View style={s.nav}><ExploreActionButton variant="back" label="‹ Explore" onPress={onClose} /></View>
    <ScrollView contentOffset={{ x: 0, y: initialOffset }} onScroll={e => onOffsetChange?.(e.nativeEvent.contentOffset.y)} scrollEventThrottle={16} contentContainerStyle={s.list}>
      <Text accessibilityRole="header" style={s.title}>{title}</Text>
      <Text style={s.intro}>{presentation.intro}</Text>
      {loading ? <Text style={s.intro}>Loading activities…</Text> : failed ? <>
        <Text style={s.intro}>Activities could not load.</Text><ExploreActionButton label="Try again" onPress={onRetry} />
      </> : !items.length ? <Text style={s.intro}>New activities are on their way.</Text> : items.map(item =>
        <Pressable key={item.content_id} accessibilityRole="button" accessibilityHint="Opens this activity" onPress={() => onOpen(item)}
          style={({ pressed }) => [s.card, { backgroundColor: presentation.color, borderColor: presentation.border }, pressed && { opacity: 0.7 }]}>
          <View style={s.row}><Text style={s.cardTitle}>{item.title}</Text><Text accessible={false} style={s.arrow}>›</Text></View>
          {!!item.subtitle && <Text numberOfLines={2} style={s.intro}>{item.subtitle}</Text>}
          {typeof item.estimated_minutes === 'number' && item.estimated_minutes > 0 && <Text style={s.small}>{item.estimated_minutes} min</Text>}
          {__DEV__ && item.development_preview && <Text style={s.small}>Preview · Expert review required</Text>}
        </Pressable>)}
    </ScrollView>
  </View>;
}
const s = StyleSheet.create({
  screen: { flex: 1 }, nav: { paddingHorizontal: 20, width: '100%', maxWidth: 640, alignSelf: 'center' },
  list: { padding: 20, paddingTop: 8, paddingBottom: 32, gap: 12, width: '100%', maxWidth: 640, alignSelf: 'center' },
  title: { color: '#241638', fontFamily: Fonts.rounded, fontSize: 28, lineHeight: 35, fontWeight: '600' },
  cardTitle: { flex: 1, color: '#302040', fontFamily: Fonts.rounded, fontSize: 18, lineHeight: 25, fontWeight: '600' },
  intro: { color: '#62556E', fontSize: 15, lineHeight: 23 }, small: { color: '#716579', fontSize: 13, lineHeight: 20 },
  card: { padding: 16, gap: 6, borderRadius: 18, borderWidth: 1 }, row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  arrow: { fontSize: 24, color: '#63497B' },
});
