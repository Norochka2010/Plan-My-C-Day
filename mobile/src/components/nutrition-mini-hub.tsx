import { BackButton } from './back-button';
import { ProductCheckerEntry } from './product-checker';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Fonts } from '@/constants/theme';
import { getNutritionHub, type NutritionHub, type NutritionSection } from '@/lib/nutrition-content';
import { NutritionArtwork } from './nutrition-artwork';
function Button({ label, onPress }: { label: string; onPress: () => void }) {
 if (/^(‹|Back\b|Previous step)/.test(label)) return <BackButton label={label} onPress={onPress}/>;
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [s.button, pressed && { opacity: 0.65 }]}><Text style={s.buttonText}>{label}</Text></Pressable>;
}
function NutritionCard({ section }: { section: NutritionSection }) {
  return <View style={s.card}>
    <Text style={s.label}>PLAN MY C-DAY NUTRITION EDUCATION</Text>
    <Text accessibilityRole="header" style={s.title}>{section.title}</Text>
    {!!section.qualifier && <Text style={s.heading}>{section.qualifier}</Text>}
    {!!section.intro && <Text style={s.body}>{section.intro}</Text>}
    {!!section.uncertaintyLabel && <View style={s.context}><Text style={s.heading}>{section.uncertaintyLabel}</Text></View>}
    {!!section.safetyNote && <View style={s.context}><Text style={s.body}>{section.safetyNote}</Text></View>}
    <NutritionArtwork assetId={section.visualAssetId} />
    {section.layout === 'grid' ? <View style={s.grid}>{section.items.map((item, index) => <View key={`${section.id}-${index}`} style={s.grain}>
      <Text style={s.heading}>{item}</Text><Text style={s.label}>{section.itemLabel}</Text><Text style={s.small}>{section.itemNote}</Text>
    </View>)}</View> : section.items.map((item, index) => <View key={`${section.id}-${index}`} style={s.item}>{section.layout !== 'numbered' && <Text style={s.bullet}>•</Text>}<Text style={[s.body, s.itemText]}>{item}</Text></View>)}
  </View>;
}
/** In-app learning and the existing external resources share the Nutrition collection, not their content model. */
export function NutritionMiniHub() {
  const [hub, setHub] = useState<NutritionHub | null>(null), [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true), [failed, setFailed] = useState(false), [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true; setLoading(true); setFailed(false);
    getNutritionHub().then(value => { if (active) setHub(value); }).catch(() => { if (active) setFailed(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [retry]);
  const section = hub?.sections.find(item => item.id === selected);
  return <View style={s.wrap}>
    {loading ? <ActivityIndicator accessibilityLabel="Loading nutrition education" /> : failed ? <View style={s.card}>
      <Text style={s.body}>Nutrition learning couldn’t load right now. You can still explore the trusted resources below.</Text>
      <Button label="Try again" onPress={() => setRetry(n => n + 1)} />
    </View> : !hub || !hub.sections.length ? <Text style={s.body}>Nutrition learning isn’t available right now. The trusted resources are below.</Text> : section ? <>
      <Button label="Back to Nutrition & Eating Well" onPress={() => setSelected(null)} />
      <NutritionCard section={section} />
      <Button label="Back to Nutrition & Eating Well" onPress={() => setSelected(null)} />
    </> : <View style={s.card}>
      <Text style={s.label}>FOOD BASICS</Text>
      <Text accessibilityRole="header" style={s.title}>{hub.title}</Text>
      <Text style={s.body}>{hub.subtitle}</Text>
      {hub.sections.map(item => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={item.title} onPress={() => setSelected(item.id)} style={({ pressed }) => [s.section, pressed && { opacity: 0.65 }]}>
        <View style={s.itemText}><Text style={s.heading}>{item.title}</Text>{!!item.qualifier && <Text style={s.small}>{item.qualifier}</Text>}{!!item.uncertaintyLabel && <Text style={s.small}>{item.uncertaintyLabel}</Text>}</View><Text style={s.arrow}>›</Text>
      </Pressable>)}
    </View>}
    <ProductCheckerEntry />
  </View>;
}
const s = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  grain: { flexGrow: 1, flexBasis: '45%', minWidth: 130, padding: 14, gap: 8, borderRadius: 16, borderWidth: 1, borderColor: '#D4D5C3', backgroundColor: '#FFFCF7' },
  wrap: { gap: 20 }, card: { padding: 20, gap: 16, backgroundColor: '#F4F6E9', borderWidth: 1, borderColor: '#CCD7BD', borderRadius: 22 },
  title: { fontFamily: Fonts.rounded, fontSize: 24, lineHeight: 32, fontWeight: '600', color: '#344B38' },
  heading: { fontFamily: Fonts.rounded, fontSize: 18, lineHeight: 26, fontWeight: '600', color: '#344B38' },
  body: { fontSize: 16, lineHeight: 25, color: '#4C594B' }, small: { fontSize: 14, lineHeight: 21, color: '#566353' },
  label: { fontSize: 14, lineHeight: 21, letterSpacing: 0.5, fontWeight: '700', color: '#566353' },
  context: { borderWidth: 1, borderColor: '#D4D5C3', borderRadius: 14, padding: 14, backgroundColor: '#FFFCF7' },
  section: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderColor: '#CCD7BD', paddingVertical: 16, paddingHorizontal: 4 },
  item: { flexDirection: 'row', gap: 10 }, itemText: { flex: 1, gap: 4 }, bullet: { fontSize: 18, lineHeight: 25, color: '#64715C' }, arrow: { fontSize: 28, color: '#64715C' },
  button: { minHeight: 48, padding: 14, borderRadius: 14, backgroundColor: '#E2ECD9', alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 16, lineHeight: 23, fontWeight: '600', color: '#355338' },
});
