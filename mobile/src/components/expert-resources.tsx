import { NutritionMiniHub } from './nutrition-mini-hub';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LeafCharacter } from '@/components/leaf-character';
import { Fonts } from '@/constants/theme';
import { getExpertResources } from '@/lib/expert-resources-data';
import { expertCategories, expertMiniHubs, filterExpertResources, type ExpertCategory, type ExpertResource } from '@/lib/expert-resource-model';

const categoryArtwork: Record<ExpertCategory, { icon: string; background: string }> = {
  'Nutrition & Eating Well': { icon: '🌿', background: '#EDF3E5' },
  'School & 504 Plans': { icon: '📚', background: '#F0EBF6' },
  'Eating & Food Safety': { icon: '🛡️', background: '#EAF0F7' },
  'Newly Diagnosed': { icon: '🌱', background: '#EDF3E5' },
  'Travel & Independence': { icon: '🧭', background: '#FFF2DE' },
  'Social & Emotional Well-Being': { icon: '💬', background: '#F0EBF6' },
  'Research & Treatment': { icon: '🔬', background: '#EAF0F7' },
  'Advocacy & Getting Involved': { icon: '🤝', background: '#FFF2DE' },
};

function Button({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [s.button, (pressed || disabled) && s.dim]}><Text style={s.buttonText}>{label}</Text></Pressable>;
}
function ResourceCopy({ resource }: { resource: ExpertResource }) {
  return <>
    <Text style={s.badge}>EXPERT / TRUSTED SOURCE</Text>
    <Text accessibilityRole="header" style={s.cardTitle}>{resource.title}</Text>
    <Text style={s.organization}>{resource.organization}</Text>
    <Text style={s.small}>{resource.category}</Text>
    <Text style={s.body}>{resource.description}</Text>
    <Text style={s.small}>Good for</Text>
    <View style={s.tags}>{resource.tags.map(tag => <View key={tag} style={s.tag}><Text style={s.small}>{tag}</Text></View>)}</View>
  </>;
}
export function ExpertResources({ onClose, initialContentId = null }: { onClose: () => void; initialContentId?: string | null }) {
  const [resources, setResources] = useState<ExpertResource[]>([]);
  const [selected, setSelected] = useState<string | null>(initialContentId);
  const [categoryVisit, setCategoryVisit] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const pendingCategoryScroll = useRef(false);
  const [category, setCategory] = useState<ExpertCategory | null>(null);
  const [loading, setLoading] = useState(true), [failed, setFailed] = useState(false), [retry, setRetry] = useState(0);
  const [opening, setOpening] = useState(false), [linkError, setLinkError] = useState('');
  const generation = useRef(0), linkBusy = useRef(false), scroll = useRef<ScrollView>(null);
  useEffect(() => {
    let active = true; setLoading(true); setFailed(false);
    getExpertResources().then(rows => { if (active) setResources(rows); }).catch(() => { if (active) setFailed(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [retry]);
  useEffect(() => { pendingCategoryScroll.current = false; generation.current++; linkBusy.current = false; setOpening(false); setLinkError(''); scroll.current?.scrollTo({ y: 0, animated: false });
    return () => { generation.current++; };
  }, [selected]);
  const resource = resources.find(r => r.contentId === selected);
  const visible = filterExpertResources(resources, category);
  async function openSource(item: ExpertResource) {
    if (linkBusy.current) return;
    const request = generation.current; linkBusy.current = true; setOpening(true); setLinkError('');
    try { await Linking.openURL(item.url); }
    catch { if (generation.current === request) setLinkError('The resource couldn’t open. Check your connection and try again.'); }
    finally { if (generation.current === request) { linkBusy.current = false; setOpening(false); } }
  }
  function chooseCategory(next: ExpertCategory | null) {
    pendingCategoryScroll.current = true;
    setCategory(next);
    setCategoryVisit(value => value + 1);
  }
  return <SafeAreaView style={s.screen}>
    <ScrollView ref={scroll} contentContainerStyle={s.content} onLayout={event => setViewportHeight(event.nativeEvent.layout.height)}>
      <Button label={selected ? 'Back to resources' : 'Back to Explore'} onPress={selected ? () => setSelected(null) : onClose} />
      <View style={s.header}><View style={s.copy}><Text accessibilityRole="header" style={s.title}>From the Experts</Text>
        {!selected && <Text style={s.body}>Go deeper with a trusted outside source.</Text>}</View><LeafCharacter size={70} /></View>
      {loading ? <ActivityIndicator accessibilityLabel="Loading trusted resources" /> : failed ? <View style={s.card}>
        <Text style={s.body}>Trusted resources couldn’t load right now.</Text><Button label="Try again" onPress={() => setRetry(v => v + 1)} />
      </View> : selected ? resource ? <View style={s.card}>
        <ResourceCopy resource={resource} />
        {resource.domains && resource.domains.length > 0 && <Text style={s.small}>{resource.domains.join(' · ')}</Text>}
        <Text style={s.small}>Reviewed {resource.reviewedDate}</Text>
        <Text style={s.body}>This opens the original resource outside Plan My C-Day.</Text>
        <Text selectable style={s.url}>{resource.url}</Text>
        {!!linkError && <Text accessibilityRole="alert" style={s.body}>{linkError}</Text>}
        <Button label={opening ? 'Opening source…' : 'Read from the source ↗'} onPress={() => void openSource(resource)} disabled={opening} />
      </View> : <View style={s.card}><Text style={s.body}>This resource isn’t available right now.</Text><Button label="Browse resources" onPress={() => setSelected(null)} /></View> : <>
        <Text accessibilityRole="header" style={s.heading}>Featured collection</Text>
        <View style={s.collections}>{expertMiniHubs.map(hub => <Pressable key={hub} accessibilityRole="button" accessibilityState={{ selected: category === hub }} onPress={() => chooseCategory(hub)} style={[s.collection, category === hub && s.selected]}>
          <Text style={s.cardTitle}>{hub}</Text><Text style={s.small}>{hub === 'Nutrition & Eating Well' ? 'Learn and explore trusted resources →' : 'Explore trusted resources →'}</Text>
        </Pressable>)}</View>
        <Text accessibilityRole="header" style={s.heading}>Browse by category</Text>
        <Pressable accessibilityRole="button" accessibilityState={{ selected: category === null }}
          onPress={() => chooseCategory(null)} style={({ pressed }) => [s.allResources, category === null && s.selected, pressed && s.dim]}>
          <Text style={s.categoryLabel}>All resources</Text>
          <Text accessible={false} style={s.categoryLabel}>{category === null ? '✓' : '›'}</Text>
        </Pressable>
        <View style={s.categoryGrid}>
          {[0, 2, 4, 6].map(start => <View key={start} style={s.categoryRow}>
            {expertCategories.slice(start, start + 2).map(cat => <Pressable key={cat} accessibilityRole="button"
              accessibilityLabel={cat} accessibilityState={{ selected: category === cat }} onPress={() => chooseCategory(cat)}
              style={({ pressed }) => [s.categoryTile, { backgroundColor: categoryArtwork[cat].background }, category === cat && s.selected, pressed && s.dim]}>
              <View style={s.categoryIconRow}>
                <Text accessible={false} style={s.categoryIcon}>{categoryArtwork[cat].icon}</Text>
                {category === cat && <Text accessible={false} style={s.categoryCheck}>✓</Text>}
              </View>
              <Text style={s.categoryLabel}>{cat}</Text>
            </Pressable>)}
          </View>)}
        </View>
        <View key={categoryVisit} style={{ gap: 16, minHeight: Math.max(0, viewportHeight - 48) }}
          onLayout={event => {
            if (!pendingCategoryScroll.current) return;
            const y = Math.max(0, event.nativeEvent.layout.y - 24);
            requestAnimationFrame(() => {
              if (!pendingCategoryScroll.current) return;
              scroll.current?.scrollTo({ y, animated: false });
              pendingCategoryScroll.current = false;
            });
          }}>
        <Text accessibilityRole="header" style={s.heading}>{category ?? 'All resources'}</Text>
        {category === 'Nutrition & Eating Well' && <><NutritionMiniHub /><Text accessibilityRole="header" style={s.heading}>Go Deeper with Trusted Experts</Text></>}
        <Text style={s.small}>{visible.length} {visible.length === 1 ? 'resource' : 'resources'}</Text>
        {visible.length === 0 ? <View style={s.card}><Text style={s.body}>No resources are available in this category yet.</Text><Button label="See all resources" onPress={() => chooseCategory(null)} /></View> : visible.map(item => <View key={item.contentId} style={s.card}>
          <ResourceCopy resource={item} /><Button label="View resource" onPress={() => setSelected(item.contentId)} />
        </View>)}
        </View>
      </>}
    </ScrollView>
  </SafeAreaView>;
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFCF7' },
  content: { padding: 24, paddingBottom: 32, gap: 16, width: '100%', maxWidth: 640, alignSelf: 'center' },
  header: { flexDirection: 'row', gap: 12, alignItems: 'center' }, copy: { flex: 1, gap: 8 },
  title: { fontFamily: Fonts.rounded, fontSize: 28, lineHeight: 36, fontWeight: '600', color: '#302040' },
  heading: { fontFamily: Fonts.rounded, fontSize: 20, lineHeight: 28, fontWeight: '600', color: '#302040' },
  cardTitle: { fontFamily: Fonts.rounded, fontSize: 19, lineHeight: 27, fontWeight: '600', color: '#302040' },
  organization: { fontSize: 16, lineHeight: 24, fontWeight: '600', color: '#435871' },
  body: { fontSize: 16, lineHeight: 25, color: '#62556E' }, small: { fontSize: 14, lineHeight: 21, color: '#62556E' },
  badge: { fontSize: 14, lineHeight: 21, letterSpacing: 0.6, fontWeight: '700', color: '#435871' },
  card: { borderRadius: 22, padding: 20, gap: 12, backgroundColor: '#EAF0FA', borderColor: '#C8D7EB', borderWidth: 1 },
  collections: { gap: 12 }, collection: { padding: 18, gap: 8, borderRadius: 20, backgroundColor: '#F1F6EA', borderWidth: 1, borderColor: '#C5DDB5' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, tag: { backgroundColor: '#FFFCF7', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 },
  allResources: { minHeight: 48, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, backgroundColor: '#FFFCF7', borderWidth: 2, borderColor: '#DED8E5', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  categoryGrid: { gap: 10 }, categoryRow: { flexDirection: 'row', gap: 10 },
  categoryTile: { flex: 1, minWidth: 0, minHeight: 112, padding: 14, borderRadius: 18, borderWidth: 2, borderColor: 'transparent', gap: 10 },
  categoryIconRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  categoryIcon: { fontSize: 22, lineHeight: 28 }, categoryCheck: { color: '#355338', fontSize: 18, fontWeight: '700' },
  categoryLabel: { color: '#40364B', fontSize: 14, lineHeight: 20, fontWeight: '600' },
  selected: { backgroundColor: '#DCEBD0', borderColor: '#587646', borderWidth: 2 },
  button: { minHeight: 48, padding: 14, borderRadius: 14, backgroundColor: '#E2ECD9', alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 16, lineHeight: 23, fontWeight: '600', color: '#355338' }, dim: { opacity: 0.6 },
  url: { fontSize: 14, lineHeight: 21, color: '#435871' },
});
